import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const palette = ['#000000', '#ffffff', '#bcff16', '#8511ff', '#ff3dbb', '#2266ff'];
const surfaces = ['[data-floating-brand]', '[data-global-index] > summary', '.work-filters', '.hero-nav'];
const rgb = hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const luminance = color => color.map(value => value / 255)
  .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (first, second) => {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
};

/** Real browser-rendered palette samples, not computed-color assertions alone.
 * The temporary patch is actual page content inside the isolated composition,
 * behind the live header; it is deliberately NOT the corruption background.
 * Black/white captures identify real glyph interiors and their antialiasing.
 */
export async function checkFloatingHeaderContrast(page, { profile, world, output }) {
  await page.evaluate(() => {
    document.querySelector('[data-global-index]').open = false;
    document.activeElement?.blur(); scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.mouse.move(1, 180); await frames(page);
  const visibleSurfaces = await page.evaluate(selectors => selectors.filter(selector => {
    const element = document.querySelector(selector), box = element?.getBoundingClientRect();
    return box && box.width > 0 && box.height > 0;
  }), surfaces);
  const route = await page.evaluate(() => document.documentElement.dataset.page);
  const computed = await page.evaluate(selectors => {
    const composition = document.querySelector('[data-page-composition]');
    const main = composition?.querySelector(':scope > main');
    const values = selectors.map(selector => {
      const element = document.querySelector(selector), style = getComputedStyle(element);
      return { selector, blend: style.mixBlendMode, color: style.color, surface: style.backgroundColor,
        shadow: style.textShadow, z: style.zIndex };
    });
    const panelStyle = getComputedStyle(document.querySelector('.global-index-links'));
    return { values, isolation: composition && getComputedStyle(composition).isolation,
      mainZ: main && getComputedStyle(main).zIndex,
      inkInside: !document.querySelector('.ink-layer') || composition.contains(document.querySelector('.ink-layer')),
      backgroundOutside: !document.querySelector('.corruption-background') || !composition.contains(document.querySelector('.corruption-background')),
      panel: { blend: panelStyle.mixBlendMode, surface: panelStyle.backgroundColor, border: panelStyle.borderTopWidth },
      duplicateBindings: document.querySelectorAll('[data-header-outline] a, [data-header-outline] button, [data-header-outline] [id], [data-header-outline] [data-ui-interactive]').length,
      outlines: [...document.querySelectorAll('[data-header-outline]')].map(element => ({ hidden: element.getAttribute('aria-hidden'), inert: element.inert, pointer: getComputedStyle(element).pointerEvents })) };
  }, visibleSurfaces);
  assert.equal(computed.isolation, 'isolate'); assert.equal(computed.mainZ, 'auto');
  assert.equal(computed.inkInside, true); assert.equal(computed.backgroundOutside, true);
  for (const item of computed.values) {
    assert.ok(['difference', 'exclusion'].includes(item.blend), `${item.selector} blends actual content.`);
    assert.equal(item.color, 'rgb(255, 255, 255)'); assert.equal(item.shadow, 'none');
  }
  assert.equal(computed.panel.blend, 'normal'); assert.equal(computed.panel.surface, 'rgb(48, 48, 51)');
  assert.equal(computed.panel.border, '0px'); assert.equal(computed.duplicateBindings, 0);
  assert.ok(computed.outlines.length >= 3);
  for (const item of computed.outlines) { assert.equal(item.hidden, 'true'); assert.equal(item.inert, true); assert.equal(item.pointer, 'none'); }
  const pixels = [];
  try {
    await page.evaluate(() => {
      const patch = document.createElement('div'); patch.id = 'f14-palette-probe';
      patch.setAttribute('aria-hidden', 'true'); patch.setAttribute('data-no-mosh', '');
      patch.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:9;pointer-events:none;background:#000';
      document.querySelector('[data-page-composition]').append(patch);
    });
    for (const selector of visibleSurfaces) {
      const bounds = await page.locator(selector).boundingBox();
      assert.ok(bounds && bounds.width > 0 && bounds.height > 0);
      const clip = { x: Math.max(0, Math.floor(bounds.x)), y: Math.max(0, Math.floor(bounds.y)),
        width: Math.min(profile.width - Math.max(0, Math.floor(bounds.x)), Math.ceil(bounds.width)), height: Math.ceil(bounds.height) };
      const images = [];
      for (const color of palette) {
        await page.locator('#f14-palette-probe').evaluate((element, value) => { element.style.backgroundColor = value; }, color);
        await frames(page);
        const png = await page.screenshot({ clip });
        const decoded = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        images.push({ color, ...decoded });
        const name = selector.includes('brand') ? 'brand' : selector.includes('summary') ? 'index' : selector.includes('hero') ? 'routes' : 'categories';
        await writeFile(new URL(`header-${route}-${name}-${profile.width}-${profile.reduced}-${world}-${color.slice(1)}.png`, output), png);
      }
      const black = images[0], white = images[1], mask = [];
      assert.equal(black.info.channels, 3); assert.equal(white.data.length, black.data.length);
      for (let offset = 0; offset < black.data.length; offset += 3) {
        const b = [...black.data.subarray(offset, offset + 3)], w = [...white.data.subarray(offset, offset + 3)];
        // Exclude dark-stroke edges: they stay dark in the normal underlay and
        // cannot establish that the actual text fill is really blending.
        if (b.every((value, index) => value >= 210 && w[index] <= 45 && Math.abs(value + w[index] - 255) <= 24)) mask.push(offset);
      }
      assert.ok(mask.length >= 3, `${selector}: actual inverse glyph interiors must respond to black/white content (found ${mask.length}).`);
      for (const sample of images.slice(2)) {
        const background = rgb(sample.color), expected = background.map(value => 255 - value);
        const captured = [0, 1, 2].map(channel => median(mask.map(offset => sample.data[offset + channel])));
        const errors = mask.flatMap(offset => [0, 1, 2].map(channel => {
          const coverage = black.data[offset + channel] / 255;
          const antialiasedExpected = coverage * (255 - background[channel]) + (1 - coverage) * background[channel];
          return Math.abs(sample.data[offset + channel] - antialiasedExpected);
        }));
        const meanAbsoluteError = errors.reduce((sum, value) => sum + value, 0) / errors.length;
        assert.ok(meanAbsoluteError <= 30, `${selector} ${sample.color}: captured browser glyph pixels must invert the actual content, error ${meanAbsoluteError}.`);
        pixels.push({ selector, background: sample.color, expectedOpaqueInverse: expected,
          capturedMedianRGB: captured, glyphPixels: mask.length, meanAbsoluteError,
          measuredMedianContrast: contrast(captured, background),
          note: 'Interior-fill contrast; separate dark strokes provide edge separation. Not an assertion that every antialiased pixel meets4.5:1.' });
      }
    }
    await page.locator('#f14-palette-probe').evaluate(element => { element.style.backgroundColor = '#ff3dbb'; });
    await frames(page);
    await page.screenshot({ path: new URL(`header-palette-${route}-${profile.width}-${profile.reduced}-${world}.png`, output).pathname });
  } finally { await page.evaluate(() => document.querySelector('#f14-palette-probe')?.remove()); }
  // Existing suite verifies native INDEX geometry/open/focus and active routes.
  // Add explicit permanent blend checks while those real states are active.
  if (route === 'work') {
    await page.evaluate(() => document.querySelector('#tattoos').scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForFunction(() => document.querySelector('.work-filters [aria-current], .work-filters .is-active'));
  }
  const selected = page.locator(route === 'work' ? '.work-filters [aria-current], .work-filters .is-active' : '.hero-nav a').first();
  await selected.focus(); await frames(page);
  const focus = await selected.evaluate(element => ({ focused: element === document.activeElement,
    color: getComputedStyle(element).color, underline: getComputedStyle(element).textDecorationLine,
    outline: getComputedStyle(element).outlineStyle, blend: getComputedStyle(element.parentElement).mixBlendMode }));
  assert.equal(focus.focused, true); assert.equal(focus.color, 'rgb(255, 255, 255)');
  if (route === 'work') assert.ok(focus.underline.includes('underline'));
  assert.notEqual(focus.outline, 'none');
  assert.ok(['difference', 'exclusion'].includes(focus.blend));
  await page.evaluate(() => document.activeElement?.blur());
  await page.screenshot({ path: new URL(`header-final-${route}-${profile.width}-${profile.reduced}-${world}.png`, output).pathname });
  return { world, computed, pixels, focus };
}

/** A labelled synthetic WebGL compositing A/B, not a real mannequin benchmark.
 * Run after the suite's cold-Work no-WebGL assertion. This creates its own tiny
 * shader without downloading Three.js and deletes it at the end of each phase.
 */
export async function measureSyntheticHeaderCompositing(page, { durationMs = 1400 } = {}) {
  const session = await page.context().newCDPSession(page); await session.send('Performance.enable');
  const runs = [];
  try {
    // Warm shader/context setup BEFORE either timed bracket/CDP sample.
    const available = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = Math.min(innerWidth, 640); canvas.height = 110;
      canvas.style.cssText = 'position:fixed;inset:0 auto auto 0;width:100%;height:110px;z-index:7;pointer-events:none';
      document.querySelector('[data-page-composition]').append(canvas);
      const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
      if (!gl) { canvas.remove(); return false; }
      const shader = (type, source) => {
        const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value);
        if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value));
        return value;
      };
      const vertex = shader(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}');
      const fragment = shader(gl.FRAGMENT_SHADER, 'precision mediump float;uniform float t;uniform vec2 r;void main(){vec2 p=gl_FragCoord.xy/r;gl_FragColor=vec4(.2+.35*p.x,.25+.25*sin(t*.35+p.x),.5+.2*p.y,1.);}');
      const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, 'a'); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(gl.getUniformLocation(program, 'r'), canvas.width, canvas.height);
      const time = gl.getUniformLocation(program, 't');
      gl.uniform1f(time, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish();
      window.__f14SyntheticGL = { canvas, gl, program, vertex, fragment, buffer, time };
      return true;
    });
    assert.equal(available, true, 'Synthetic WebGL fixture must initialize; report unavailable rather than inventing performance.');
    await frames(page);
    // Alternating paired samples reduce first-phase/order bias. These remain
    // short synthetic observations; no guessed real-device FPS claim.
    for (const blend of [true, false, false, true]) {
      await page.evaluate(blend => {
        document.querySelector('#f14-compositing-control')?.remove();
        if (!blend) { const style = document.createElement('style'); style.id = 'f14-compositing-control';
          style.textContent = 'html body :is([data-floating-brand],.work-filters,.hero-nav,[data-global-index]>summary){mix-blend-mode:normal!important}'; document.head.append(style); }
      }, blend);
      await frames(page);
      const before = (await session.send('Performance.getMetrics')).metrics;
      const stats = await page.evaluate(async durationMs => {
        const { gl, time } = window.__f14SyntheticGL;
        const gaps = [], tasks = [];
        const observer = PerformanceObserver.supportedEntryTypes.includes('longtask') ? new PerformanceObserver(list => tasks.push(...list.getEntries().map(item => item.duration))) : null;
        observer?.observe({ type: 'longtask', buffered: false });
        const start = performance.now(); let previous = start;
        await new Promise(resolve => {
          const paint = now => { gaps.push(now - previous); previous = now;
            gl.uniform1f(time, (now - start) / 1000); gl.drawArrays(gl.TRIANGLES, 0, 3);
            if (now - start < durationMs) requestAnimationFrame(paint); else resolve(); };
          requestAnimationFrame(paint);
        });
        const elapsed = performance.now() - start; observer?.disconnect();
        const sorted = [...gaps].sort((a,b) => a-b);
        return { elapsedMs: elapsed, frames: gaps.length,
          frameP95Ms: sorted[Math.floor((sorted.length - 1)*.95)], frameMaxMs: Math.max(...gaps),
          longTasks: tasks.length, longTaskTotalMs: tasks.reduce((sum,value)=>sum+value,0), longTaskMaxMs: Math.max(0,...tasks) };
      }, durationMs);
      const after = (await session.send('Performance.getMetrics')).metrics;
      const metrics = ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'].map(name => ({ name,
        seconds: after.find(value=>value.name===name).value - before.find(value=>value.name===name).value }));
      assert.ok(stats.frames >= 3); runs.push({ blend, ...stats, metrics });
    }
    return { label: 'warmed synthetic WebGL header compositing A/B; NOT actual hero/mannequin performance', runs };
  } finally {
    await page.evaluate(() => {
      const fixture = window.__f14SyntheticGL;
      if (fixture) { const { gl, buffer, program, vertex, fragment, canvas } = fixture;
        gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
        gl.getExtension('WEBGL_lose_context')?.loseContext(); canvas.remove(); delete window.__f14SyntheticGL; }
      document.querySelector('#f14-compositing-control')?.remove();
    }).catch(() => {});
    await session.detach();
  }
}
