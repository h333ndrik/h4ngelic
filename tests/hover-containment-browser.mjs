import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const destination = new URL('../artifacts/master-foundation/', import.meta.url);
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];

async function hoverFrames(page, target, bounds) {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(380);
  const before = await target.boundingBox();
  assert.ok(before);
  await target.evaluate(element => {
    window.__containmentFrames = [];
    element.addEventListener('pointerenter', () => {
      const visual = element.querySelector('.interaction-visual');
      const started = performance.now();
      function sample() {
        const rect = visual.getBoundingClientRect();
        const arrow = visual.querySelector('.arrow')?.getBoundingClientRect();
        const hit = element.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(visual);
        const text = [...range.getClientRects()].filter(part => part.width && part.height);
        window.__containmentFrames.push({ left: rect.left, right: rect.right,
          arrowLeft: arrow?.left, arrowRight: arrow?.right,
          textLeft: Math.min(...text.map(part => part.left)), textRight: Math.max(...text.map(part => part.right)),
          x: hit.x, y: hit.y, width: hit.width, height: hit.height,
          glow: getComputedStyle(visual).filter, targetScale: Number(getComputedStyle(element).getPropertyValue('--ui-target-scale')),
          doc: document.documentElement.scrollWidth, viewport: innerWidth });
        if (performance.now() - started < 450) requestAnimationFrame(sample);
      }
      sample();
    }, { once: true });
  });
  await target.hover();
  await page.waitForTimeout(500);
  const frames = await page.evaluate(() => window.__containmentFrames);
  assert.ok(frames.length > 3, 'Inspect the transition, not only its settled end pose.');
  for (const frame of frames) {
    const left = bounds?.left ?? 0, right = bounds?.right ?? frame.viewport;
    assert.ok(frame.left >= left - .6 && frame.right <= right + .6,
      `Enlarged label must remain inside ${left}..${right}, got ${frame.left}..${frame.right}.`);
    assert.ok(frame.textLeft >= left - .6 && frame.textRight <= right + .6, 'Every line of actual label text remains in bounds.');
    if (frame.arrowRight != null) assert.ok(frame.arrowLeft >= left - .6 && frame.arrowRight <= right + .6, 'The paired arrow remains visible.');
    assert.ok(frame.doc <= frame.viewport + 1, 'Hover never creates horizontal document overflow.');
    for (const property of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(frame[property] - before[property]) < .6, 'Only the visual moves; its real hit area stays fixed.');
  }
  assert.notEqual(frames.at(-1).glow, 'none', 'Subtle luminous feedback remains present.');
  return { samples: frames.length, minimumLeft: Math.min(...frames.map(frame => frame.left)),
    maximumRight: Math.max(...frames.map(frame => frame.right)), scale: frames.at(-1).targetScale };
}

try {
  for (const width of [1614, 1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('/work', base).href, { waitUntil: 'networkidle' });
    const actual = page.locator('[data-archive-category="analog-photography"] .archive-category-heading a');
    await actual.scrollIntoViewIfNeeded();
    const archive = await hoverFrames(page, actual);
    await page.evaluate(() => {
      const fixture = document.createElement('div');
      fixture.id = 'hover-containment-fixture';
      fixture.style.cssText = 'position:relative;margin:60px 2px 0;padding-bottom:80px;';
      fixture.innerHTML = '<div style="display:flex;justify-content:flex-end"><a class="text-link edge-fixture" href="#edge-fixture">next <i class="arrow" aria-hidden="true"></i></a></div>'
        + '<div class="clip-fixture" style="overflow:hidden;display:flex;justify-content:flex-end;width:160px;margin:30px 20px"><a class="text-link" href="#clip-fixture">forward <i class="arrow" aria-hidden="true"></i></a></div>'
        + '<h3 class="archive-category-heading" style="font-size:60px;margin:30px 20px"><a class="long-fixture" href="#long-fixture">analog photography <i class="arrow" aria-hidden="true"></i></a></h3>';
      document.body.append(fixture);
    });
    await page.waitForFunction(() => [...document.querySelectorAll('#hover-containment-fixture a')].every(element => element.hasAttribute('data-ui-interactive')));
    const edge = page.locator('.edge-fixture'); await edge.scrollIntoViewIfNeeded();
    const edgeResult = await hoverFrames(page, edge);
    const clipped = page.locator('.clip-fixture a'); await clipped.scrollIntoViewIfNeeded();
    const clip = await page.locator('.clip-fixture').boundingBox();
    const clippedResult = await hoverFrames(page, clipped, { left: clip.x, right: clip.x + clip.width });
    const long = page.locator('.long-fixture'); await long.scrollIntoViewIfNeeded();
    const wrapped = await hoverFrames(page, long);
    assert.equal((await long.textContent()).trim(), 'analog photography');
    if (width < 600) assert.ok((await long.boundingBox()).height > 100, 'An oversized label wraps readably instead of being clipped.');
    let resize = null;
    if (width === 390) {
      await page.evaluate(() => {
        const anchor = document.createElement('a');
        anchor.className = 'text-link resize-fixture'; anchor.href = '#resize-fixture';
        anchor.style.cssText = 'position:fixed;left:240px;top:100px;width:70px;font-size:16px;z-index:30';
        anchor.innerHTML = 'fwd <i class="arrow" aria-hidden="true"></i>';
        document.body.append(anchor);
      });
      const shrinking = page.locator('.resize-fixture');
      await page.waitForFunction(() => document.querySelector('.resize-fixture .interaction-visual'));
      await shrinking.locator('.interaction-visual').evaluate(element => { element.style.width = '70px'; });
      await shrinking.hover(); await page.waitForTimeout(300);
      assert.ok(await shrinking.evaluate(element => Number(getComputedStyle(element).getPropertyValue('--ui-target-scale')) > 1.024));
      await page.evaluate(() => {
        window.__resizeContainmentFrames = [];
        const started = performance.now();
        function sample() {
          const visual = document.querySelector('.resize-fixture .interaction-visual').getBoundingClientRect();
          window.__resizeContainmentFrames.push({ left: visual.left, right: visual.right, width: innerWidth, doc: document.documentElement.scrollWidth });
          if (performance.now() - started < 500) requestAnimationFrame(sample);
        }
        sample();
      });
      await page.setViewportSize({ width: 320, height: 900 });
      await page.waitForTimeout(550);
      const frames = await page.evaluate(() => window.__resizeContainmentFrames.filter(frame => frame.width === 320));
      assert.ok(frames.length > 3);
      assert.ok(frames.every(frame => frame.left >= -.6 && frame.right <= 320.6 && frame.doc <= 321),
        'A held hover refits immediately when the viewport shrinks, without a clipped easing tail.');
      resize = { from: 390, to: 320, samples: frames.length, maximumRight: Math.max(...frames.map(frame => frame.right)) };
      await shrinking.evaluate(element => element.remove());
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await long.focus();
    assert.equal(await long.locator('.interaction-visual').evaluate(element => getComputedStyle(element).transform), 'none');
    assert.notEqual(await long.evaluate(element => getComputedStyle(element).outlineStyle), 'none');
    assert.deepEqual(errors, []);
    reports.push({ width, archive, edge: edgeResult, clipped: clippedResult, wrapped, resize, errors });
    console.log(`PASS hover containment ${width}px: actual long archive label, right-edge link, clipped scrollport, wrapped oversized text, stable hit areas, glow and reduced motion.`);
    await context.close();
  }
  await writeFile(new URL('hover-containment.json', destination), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2));
} finally { await browser.close(); }
