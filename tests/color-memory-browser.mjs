import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { livingDecayDefaults } from '../src/data/livingDecaySettings.js';

// Integration checks use real scrolling, pointer movement, hover and mode
// gestures. The separate image-memory oracle uses deliberately colored source
// pixels and is labelled as such; it does not pretend to capture DOM pixels.
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const destination = new URL('../artifacts/color-memory/', import.meta.url);
const widths = (process.env.H4_COLOR_WIDTHS || '1000,390,320').split(',').map(Number);
const recordVideo = process.env.H4_COLOR_VIDEO !== '0';
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const deadline = setTimeout(() => void browser.close(), 240000);
const reports = [];
const state = page => page.evaluate(() => window.__H4_CORRUPTION__?.snapshot());

async function settleMode(page, expected) {
  await page.waitForFunction(mode => document.documentElement.dataset.mode === mode
    && !document.documentElement.hasAttribute('data-xray-transition')
    && !document.documentElement.hasAttribute('data-mode-snapshot'), expected, { timeout: 15000 });
}

async function settleNavigation(page, selector) {
  // history.pushState precedes the async view-transition update. Waiting for
  // the URL alone can still observe the departing page and frozen hit targets.
  await page.locator(selector).waitFor();
  await page.evaluate(async () => { await document.activeViewTransition?.finished.catch(() => {}); });
  await page.waitForFunction(() => !document.activeViewTransition && !document.getAnimations().some(animation =>
    animation.effect?.pseudoElement?.startsWith('::view-transition-')));
}

async function switchMode(page, expected) {
  const started = Date.now();
  if (expected === 'xray') {
    await page.keyboard.down('4');
    try { await settleMode(page, expected); } finally { await page.keyboard.up('4'); }
    await page.waitForFunction(() => window.__H4_CORRUPTION__?.snapshot().ambient.frames > 0);
  } else {
    for (let index = 0; index < 3; index++) await page.keyboard.press('3');
    await settleMode(page, expected);
  }
  return Date.now() - started;
}

async function pixelDelta(page, save = false) {
  return page.locator('[data-corruption-ambient]').evaluate((canvas, capture) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const previous = window.__colorPrevious;
    let changed = 0, delta = 0;
    if (previous?.length === pixels.length) for (let index = 0; index < pixels.length; index += 4) {
      const difference = Math.abs(pixels[index] - previous[index]) + Math.abs(pixels[index + 1] - previous[index + 1])
        + Math.abs(pixels[index + 2] - previous[index + 2]);
      if (difference > 8) changed++;
      delta += difference;
    }
    if (capture) window.__colorPrevious = pixels;
    return { changed, meanChannelDelta: delta / (pixels.length / 4 * 3), pixels: pixels.length / 4 };
  }, save);
}

async function settleWorkSection(page) {
  const section = page.locator('#selected-work');
  await section.evaluate(element => {
    document.activeElement?.blur();
    scrollTo({ top: element.offsetTop + parseFloat(getComputedStyle(element).getPropertyValue('--motion-run')), behavior: 'instant' });
  });
  await page.waitForFunction(() => document.querySelector('#selected-work')?.dataset.motionState === 'settled');
  await page.waitForTimeout(160);
}

async function nativeCanvasMemoryOracle(page) {
  const result = await page.evaluate(async () => {
    const { paintImageMemory } = await import('/src/image-memory.js');
    const bitmap = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 8;
      return { canvas, context: canvas.getContext('2d', { willReadFrequently: true }) };
    };
    const history = bitmap(), output = bitmap(), sourceB = bitmap();
    history.context.fillStyle = '#050c19'; history.context.fillRect(0, 0, 64, 8);
    history.context.fillStyle = '#f00500'; history.context.fillRect(8, 0, 8, 8);
    sourceB.context.fillStyle = '#0000f5'; sourceB.context.fillRect(0, 0, 64, 8);
    const center = () => {
      const pixels = output.context.getImageData(0, 0, 64, 1).data;
      let total = 0, weighted = 0;
      for (let x = 0; x < 64; x++) {
        const weight = Math.max(0, pixels[x * 4] - pixels[x * 4 + 2] - 20);
        total += weight; weighted += (x + .5) * weight;
      }
      return total > 0 ? weighted / total : null;
    };
    const centers = [];
    for (const offsetX of [8, 8, -8]) {
      const cells = Array.from({ length: 8 }, (_, index) => ({ x: index * 8, y: 0, width: 8, height: 8,
        offsetX, offsetY: 0, recovery: .015, bleed: 0, negative: 0 }));
      paintImageMemory({ context: output.context, history: history.canvas, historyContext: history.context,
        source: sourceB.canvas, width: 64, height: 8, cells });
      centers.push(center());
    }
    const survivingColor = [...output.context.getImageData(20, 0, 1, 1).data];
    return { centers, survivingColor, note: 'Controlled red source A / blue source B on native browser Canvas2D, not a DOM snapshot.' };
  });
  assert.deepEqual(result.centers, [20, 28, 20], 'Native browser pixels retain and successively move source A after source B replaces it.');
  assert.ok(result.survivingColor[0] > 220 && result.survivingColor[2] > 0 && result.survivingColor[2] < 20);
  return result;
}

try {
  for (const width of widths) {
    const mobile = width < 600;
    const context = await browser.newContext({ viewport: { width, height: mobile ? 844 : 760 }, deviceScaleFactor: 1,
      isMobile: mobile, hasTouch: mobile, reducedMotion: 'no-preference',
      recordVideo: recordVideo ? { dir: destination.pathname, size: { width: Math.min(width, 1000), height: mobile ? 844 : 760 } } : undefined });
    const errors = [], requests = [];
    const page = await context.newPage();
    const video = page.video();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    try {
      await page.addInitScript(() => {
        const probe = window.__colorProbe = { visual: [], impulses: [], scroll: [], transitions: [], webgl: 0, token: performance.timeOrigin };
        const original = HTMLCanvasElement.prototype.getContext;
        const contexts = new WeakSet();
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
          const result = original.call(this, type, ...args);
          if (result && /webgl/.test(type) && !contexts.has(result)) { contexts.add(result); probe.webgl++; }
          return result;
        };
        document.addEventListener('h4:visualmotion', event => {
          for (const sample of event.detail?.samples || []) if (probe.visual.length < 2400) probe.visual.push({
            kind: sample.kind, time: event.detail.time, x: sample.x, y: sample.y,
            width: sample.width, height: sample.height, points: sample.points,
          });
        });
        document.addEventListener('h4:moshimpulse', event => {
          const detail = event.detail || {};
          if (probe.impulses.length < 2400) probe.impulses.push({ kind: detail.kind, time: performance.now(),
            x: detail.x, y: detail.y, dx: detail.dx, dy: detail.dy, deltaMs: detail.deltaMs,
            strength: detail.strength, vectors: detail.vectors });
        });
        document.addEventListener('h4:scrollmotion', event => { if (probe.scroll.length < 1200) probe.scroll.push(event.detail); });
        document.addEventListener('h4:transitionintent', event => probe.transitions.push({ ...event.detail, at: performance.now() }));
      });

      // Work deliberately starts without Three.js. No probe imports the hero.
      await page.goto(new URL('/work?test=1', base).href, { waitUntil: 'networkidle' });
      await page.locator('html[data-xray-ready]').waitFor();
      assert.equal(await page.evaluate(() => window.__colorProbe.webgl), 0);
      assert.equal(await page.locator('[data-corruption-ambient]').count(), 0);
      const enterWallMs = await switchMode(page, 'xray');
      const first = await state(page);
      assert.ok(first.ambient.width <= (mobile ? 512 : 1120) && first.ambient.height <= (mobile ? 768 : 800));
      assert.equal(await page.evaluate(() => window.__colorProbe.webgl), 0, 'The shared memory field must not add a WebGL renderer.');
      const canvasMemoryOracle = await nativeCanvasMemoryOracle(page);
      await page.evaluate(defaults => window.__H4_CORRUPTION__.configureLivingDecay({ ...defaults,
        idleIntensity: 0, mutationSpeed: 0, negativeExposure: 0, colorBleeding: 0, recoverySpeed: .1,
        heroMosh: 0, sectionMosh: 0, typographyMosh: 0, hoverMosh: 0, clickMosh: 0, navigationMosh: 0,
        cursorMosh: 2, feedbackPersistence: .99,
      }), livingDecayDefaults);
      await pixelDelta(page, true);
      const beforeInput = await state(page);
      const x = Math.round(width * .55), y = mobile ? 470 : 490;
      await page.mouse.move(x - 70, y);
      await page.waitForTimeout(50);
      await page.mouse.move(x, y + 16, { steps: 5 });
      await page.waitForTimeout(150);
      const firstMotionPixels = await pixelDelta(page, true);
      const firstMotion = await state(page);
      await page.mouse.move(x + 45, y - 12, { steps: 5 });
      await page.waitForTimeout(150);
      const secondMotionPixels = await pixelDelta(page, true);
      await page.mouse.move(x - 30, y + 7, { steps: 5 });
      await page.waitForTimeout(150);
      const reversePixels = await pixelDelta(page);
      const reverse = await state(page);
      assert.ok(firstMotionPixels.changed > 5, 'Physical pointer motion must change actual stored image pixels.');
      assert.ok(secondMotionPixels.changed > 5 && reversePixels.changed > 5, 'Subsequent movement and reversal must continue changing the prior image.');
      assert.ok(reverse.ambient.frames > beforeInput.ambient.frames);
      assert.ok(reverse.ambient.advectedBlocks > firstMotion.ambient.advectedBlocks, 'New movement must advect the shared history again.');
      assert.equal(await page.locator('.corruption-background [data-corruption-region]').count(), 0,
        'Background pointer damage must share the persistent field rather than allocate independent ROIs.');

      const token = await page.evaluate(() => window.__colorProbe.token);
      const seed = reverse.ambient.seed;
      await page.evaluate(() => window.__H4_CORRUPTION__.configureLivingDecay({ navigationMosh: 1.25 }));
      const navigationStart = await state(page);
      const navigationWallStarted = Date.now();
      await page.locator('.page-nav a[href="/about"]').click();
      await page.waitForURL(url => url.pathname === '/about');
      await settleNavigation(page, '.about-page');
      await settleMode(page, 'xray');
      const navigationEnd = await state(page);
      const navigationWallMs = Date.now() - navigationWallStarted;
      assert.equal(await page.evaluate(() => window.__colorProbe.token), token, 'Internal navigation preserves the renderer document.');
      assert.equal(navigationEnd.ambient.seed, seed);
      assert.ok(navigationEnd.ambient.frames >= navigationStart.ambient.frames);
      assert.ok(navigationEnd.ambient.memory.accepted >= navigationStart.ambient.memory.accepted,
        'Navigation must preserve the accumulated numeric motion field and image history.');
      assert.equal(await page.evaluate(() => window.__colorProbe.webgl), 0, 'About also stays free of the Three.js scene.');
      const nonHomeHeroRequests = requests.filter(path => /\/src\/main\.js|\/three/.test(path));
      assert.deepEqual(nonHomeHeroRequests, [], 'Neither Work nor About downloads the hero scene or Three.js.');
      await page.screenshot({ path: new URL(`other-about-${width}.png`, destination).pathname });

      // Return to the actual homepage through the existing internal link.
      await page.locator('.brand-link').click();
      await page.waitForURL(url => url.pathname === '/');
      await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
      await settleNavigation(page, '#selected-work');
      await page.waitForFunction(() => window.__colorProbe.visual.some(sample => sample.kind === 'logo'));
      await page.evaluate(defaults => window.__H4_CORRUPTION__.configureLivingDecay(defaults), livingDecayDefaults);
      await page.waitForTimeout(1200);
      const hero = await page.evaluate(() => window.__colorProbe.visual.filter(sample => sample.kind === 'logo'));
      assert.ok(hero.length > 1 && hero.some(sample => sample.points?.length === 8),
        'The running Three.js hero must publish its eight real projected geometry corners.');
      const heroRelativeEdgeMotion = hero.slice(1).reduce((maximum, current, index) => {
        const previous = hero[index];
        const points = new Map((previous.points || []).map(point => [point.id, point]));
        const centerX = current.x - previous.x, centerY = current.y - previous.y;
        return Math.max(maximum, ...(current.points || []).map(point => {
          const prior = points.get(point.id);
          return prior ? Math.hypot(point.x - prior.x - centerX, point.y - prior.y - centerY) : 0;
        }));
      }, 0);
      assert.ok(heroRelativeEdgeMotion > .1,
        'Actual projected mesh edges must move relative to its center; rotation cannot collapse to center translation.');
      const heroVectors = await page.evaluate(() => window.__colorProbe.impulses.filter(sample => sample.kind === 'logo'));
      assert.ok(heroVectors.some(sample => sample.vectors?.length >= 4), 'Signed hero corner motion must reach the shared memory consumer.');
      await page.screenshot({ path: new URL(`other-hero-${width}.png`, destination).pathname });

      const parallaxBefore = await state(page);
      const scrollBefore = await page.evaluate(() => scrollY);
      await page.mouse.move(width - 25, 230);
      await page.mouse.wheel(0, 180);
      await page.waitForFunction(before => scrollY - before > 50, scrollBefore);
      await page.waitForTimeout(180);
      const parallaxAfter = await state(page);
      const scrollAfter = await page.evaluate(() => scrollY);
      const scrollPixels = scrollAfter - scrollBefore;
      assert.ok(scrollPixels > 50, 'The parallax check must include actual document movement.');
      const parallaxPixels = parallaxAfter.ambient.parallax.y - parallaxBefore.ambient.parallax.y;
      const parallaxRatio = Math.abs(parallaxPixels / scrollPixels);
      assert.ok(parallaxRatio >= .29 && parallaxRatio <= .51,
        `Source-position parallax must follow the artistic 30–50% target; actual ratio=${parallaxRatio}.`);
      const sourceOffsetPixels = parallaxAfter.ambient.parallax.offsetY - parallaxBefore.ambient.parallax.offsetY;
      const sourceOffsetRatio = Math.abs(sourceOffsetPixels / scrollPixels);
      assert.ok(sourceOffsetRatio > .25 && sourceOffsetRatio <= .51,
        `The actual continuous source crop also moves more slowly than the document; actual ratio=${sourceOffsetRatio}.`);

      await settleWorkSection(page);
      const headingMotion = await page.evaluate(() => window.__colorProbe.impulses.filter(sample => ['typography', 'section'].includes(sample.kind)));
      assert.ok(headingMotion.some(sample => sample.vectors?.length > 0 || Math.hypot(sample.dx || 0, sample.dy || 0) > 0),
        'Actual flying section/type movement must reach the image-memory bus.');
      let hover = null;
      if (!mobile) {
        const target = page.locator('#selected-work .category-link').first();
        const hitBefore = await target.boundingBox();
        await page.mouse.move(2, 2);
        await page.waitForTimeout(360);
        const startIndex = await page.evaluate(() => window.__colorProbe.impulses.length);
        await page.mouse.move(hitBefore.x + hitBefore.width * .55, hitBefore.y + hitBefore.height * .5);
        await page.waitForFunction(() => {
          const target = document.querySelector('#selected-work .category-link');
          const scale = new DOMMatrixReadOnly(getComputedStyle(target.querySelector('.category-magnet')).transform).a;
          const preferred = Number(target.style.getPropertyValue('--ui-target-scale')) || 1.2;
          return target.matches(':hover') && scale >= preferred - .025;
        });
        const hitAfter = await target.boundingBox();
        const enlarged = await target.locator('.category-magnet').evaluate(element => ({
          scale: new DOMMatrixReadOnly(getComputedStyle(element).transform).a,
          filter: getComputedStyle(element).filter,
          preferred: Number(element.closest('.category-link').style.getPropertyValue('--ui-target-scale')) || 1.2,
        }));
        assert.ok(enlarged.scale >= enlarged.preferred - .025 && enlarged.scale <= 1.25,
          `Hover reaches its available-space scale: actual=${enlarged.scale}, preferred=${enlarged.preferred}.`);
        assert.match(enlarged.filter, /drop-shadow/, 'The sampled pixel effect must preserve the established white glow.');
        for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(hitBefore[key] - hitAfter[key]) < .5,
          'Hover visuals must not move the actual link hit target.');
        await page.waitForFunction(from => window.__colorProbe.impulses.slice(from).some(sample => sample.kind === 'hover-motion'
          && sample.vectors?.reduce((sum, vector) => sum + vector.dx, 0) > .2), startIndex);
        const leaveIndex = await page.evaluate(() => window.__colorProbe.impulses.length);
        await page.mouse.move(2, 2);
        await page.waitForFunction(() => {
          const target = document.querySelector('#selected-work .category-link');
          const scale = new DOMMatrixReadOnly(getComputedStyle(target.querySelector('.category-magnet')).transform).a;
          return !target.matches(':hover') && Math.abs(scale - 1) < .01;
        });
        await page.waitForFunction(from => window.__colorProbe.impulses.slice(from).some(sample => sample.kind === 'hover-motion'
          && sample.vectors?.reduce((sum, vector) => sum + vector.dx, 0) < -.2), leaveIndex);
        hover = await page.evaluate(({ from, leave }) => {
          const samples = window.__colorProbe.impulses.slice(from).filter(sample => sample.kind === 'hover-motion');
          return { samples, growth: window.__colorProbe.impulses.slice(from, leave).filter(sample => sample.kind === 'hover-motion'),
            contraction: window.__colorProbe.impulses.slice(leave).filter(sample => sample.kind === 'hover-motion') };
        }, { from: startIndex, leave: leaveIndex });
        assert.ok(hover.growth.some(sample => sample.vectors?.some(vector => Math.hypot(vector.dx, vector.dy) > .2)),
          'Resolved hover expansion must publish moving edges.');
        assert.ok(hover.contraction.some(sample => sample.vectors?.some(vector => Math.hypot(vector.dx, vector.dy) > .2)),
          'Resolved hover contraction must also publish moving edges.');
        assert.ok(hover.growth.some(sample => sample.vectors.reduce((sum, vector) => sum + vector.dx, 0) > .2)
          && hover.contraction.some(sample => sample.vectors.reduce((sum, vector) => sum + vector.dx, 0) < -.2),
          'Outward growth and inward contraction must retain opposite signed edge directions.');
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px layout has no accidental horizontal page overflow.`);
      await page.screenshot({ path: new URL(`other-work-strip-${width}.png`, destination).pathname });

      const hidden = await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        return window.__H4_CORRUPTION__.snapshot();
      });
      await page.waitForTimeout(400);
      assert.equal((await state(page)).ambient.frames, hidden.ambient.frames, 'Hidden documents stop image-memory rendering.');
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(100);
      const reduced = await state(page);
      await page.waitForTimeout(350);
      assert.equal((await state(page)).ambient.frames, reduced.ambient.frames, 'Reduced-motion disables continuous feedback.');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const reverseWallMs = await switchMode(page, 'normal');
      const normal = await state(page);
      await page.waitForTimeout(300);
      assert.equal((await state(page)).ambient.frames, normal.ambient.frames, 'Normal mode stops the Other Side field.');
      const probe = await page.evaluate(() => ({ ...window.__colorProbe, visual: window.__colorProbe.visual.slice(-80) }));
      assert.ok(probe.transitions.some(event => event.kind === 'mode' && event.duration >= 750 && event.duration <= 1200));
      assert.ok(probe.transitions.some(event => event.kind === 'navigation' && event.duration >= 250 && event.duration <= 450));
      assert.deepEqual(errors, []);
      reports.push({ width, mobile, recordedVideo: recordVideo, canvasMemoryOracle, enterWallMs, reverseWallMs, firstMotionPixels, secondMotionPixels, reversePixels,
        memoryBefore: beforeInput.ambient.memory, memoryAfter: reverse.ambient.memory,
        parallax: { scrollPixels, parallaxPixels, ratio: parallaxRatio, sourceOffsetPixels, sourceOffsetRatio },
        navigation: { wallMs: navigationWallMs, before: navigationStart.ambient, after: navigationEnd.ambient },
        heroSamples: hero.length, heroRelativeEdgeMotion, heroVectors, hover, transitions: probe.transitions, webglContexts: probe.webgl, errors,
        requestsThreeOnWorkOrAbout: nonHomeHeroRequests,
      });
      console.log(`PASS color-memory integration ${width}px: real pointer/reversal pixels, preserved route memory, geometry/typography motion, source parallax and lifecycle.`);
    } catch (error) {
      const failure = await page.evaluate(() => ({ path: location.pathname, scroll: { x: scrollX, y: scrollY },
        body: { height: document.body.scrollHeight, overflow: getComputedStyle(document.body).overflow },
        html: { height: document.documentElement.scrollHeight, overflow: getComputedStyle(document.documentElement).overflow,
          attributes: [...document.documentElement.attributes].map(attribute => [attribute.name, attribute.value]) },
        state: window.__H4_CORRUPTION__?.snapshot(), probe: window.__colorProbe,
        hover: [...document.querySelectorAll('#selected-work .category-link')].map(target => ({
          rect: target.getBoundingClientRect().toJSON(), hover: target.matches(':hover'),
          preferred: target.style.getPropertyValue('--ui-target-scale'),
          transform: getComputedStyle(target.querySelector('.category-magnet')).transform,
          filter: getComputedStyle(target.querySelector('.category-magnet')).filter,
        })),
      })).catch(() => null);
      await writeFile(new URL(`failure-${width}.json`, destination), JSON.stringify({ error: error.message, failure }, null, 2));
      await page.screenshot({ path: new URL(`failure-${width}.png`, destination).pathname, timeout: 5000 }).catch(() => {});
      throw error;
    } finally {
      await context.close();
      if (video) await video.saveAs(new URL(`motion-${width}.webm`, destination).pathname);
    }
  }
  await writeFile(new URL('results.json', destination), JSON.stringify({ measuredAt: new Date().toISOString(),
    note: 'Headless Chromium with software WebGL. Motion integration and pixel tests; not physical-device frame-rate measurements.', reports }, null, 2));
} finally {
  clearTimeout(deadline);
  await browser.close();
}
