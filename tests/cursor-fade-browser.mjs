import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55231';
const output = new URL('../docs/validation/CURSOR-VISIBLE/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const report = { checkedAt: new Date().toISOString(), build: '', fadeMs: null, before: null, hide: null, reveal: null, reduced: null, passed: false };

// Samples every animation frame for `ms`, optionally firing one event first.
async function trace(page, ms, fire) {
  return page.evaluate(({ ms, fire }) => new Promise(resolve => {
    const cursor = document.querySelector('[data-h4-cursor]');
    const styleOf = () => {
      const style = getComputedStyle(cursor), box = cursor.getBoundingClientRect();
      return { t: performance.now(), opacity: Number(style.opacity), visibility: style.visibility,
        property: style.transitionProperty, duration: style.transitionDuration,
        visible: cursor.dataset.h4CursorVisible || 'unset', x: box.left + 9, y: box.top + 2 };
    };
    const start = performance.now();
    const samples = [];
    const step = () => {
      samples.push(styleOf());
      if (performance.now() - start < ms) requestAnimationFrame(step);
      else resolve(samples);
    };
    if (fire === 'hide') document.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, composed: true,
      pointerType: 'mouse', relatedTarget: null, clientX: -1, clientY: -1 }));
    if (fire?.type === 'reveal') window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true,
      pointerType: 'mouse', clientX: fire.x, clientY: fire.y }));
    requestAnimationFrame(step);
  }), { ms, fire });
}

function analyze(samples, direction) {
  const values = samples.map(sample => sample.opacity);
  const mid = samples.filter(sample => sample.opacity > .05 && sample.opacity < .95);
  const startValue = values[0], endValue = values.at(-1);
  let monotonic = true;
  for (let index = 1; index < values.length; index += 1) {
    if (direction === 'out' && values[index] > values[index - 1] + .02) monotonic = false;
    if (direction === 'in' && values[index] < values[index - 1] - .02) monotonic = false;
  }
  const reachedEnd = samples.find(sample => direction === 'out' ? sample.opacity <= .001 : sample.opacity >= .999);
  return { startValue, endValue, midFrames: mid.length, midSample: mid[0] || null,
    monotonic, settledMs: reachedEnd ? Math.round(reachedEnd.t - samples[0].t) : null, frames: samples.length };
}

async function crop(page, x, y, name) {
  await page.screenshot({ path: new URL(name, output).pathname,
    clip: { x: Math.max(0, x - 60), y: Math.max(0, y - 50), width: 160, height: 120 } });
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.build);
  report.build = await page.locator('html').getAttribute('data-build');

  // Steady visible state.
  await page.mouse.move(700, 420);
  await page.waitForFunction(() => document.querySelector('[data-h4-cursor]')?.dataset.h4CursorVisible === 'true');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-h4-cursor]')).opacity) >= .999);
  report.fadeMs = await page.locator('[data-h4-cursor]').evaluate(element => getComputedStyle(element).getPropertyValue('--h4-cursor-fade').trim());
  assert.match(report.fadeMs, /^(180ms|\.?18s)$/);
  await crop(page, 700, 420, 'fade-visible-1440.png');

  // Before: the previous hard cut, reproduced on the same build by removing the transition.
  await page.addStyleTag({ content: '[data-h4-cursor], [data-h4-cursor][data-h4-cursor-visible="true"] { transition: none !important; }' });
  const beforeTrace = await trace(page, 220, 'hide');
  report.before = analyze(beforeTrace, 'out');
  assert.equal(report.before.endValue, 0);
  assert.equal(report.before.midFrames, 0, `The hard cut must not produce fade frames: ${JSON.stringify(report.before)}`);
  await page.evaluate(() => { for (const style of document.querySelectorAll('style')) if (style.textContent.includes('transition: none !important')) style.remove(); });
  await page.mouse.move(720, 430);
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-h4-cursor]')).opacity) >= .999);

  // After: leave fades 1 -> 0 with real mid frames.
  const hideTrace = await trace(page, 260, 'hide');
  report.hide = analyze(hideTrace, 'out');
  assert.ok(report.hide.startValue >= .95, `Leave must start visible: ${report.hide.startValue}`);
  assert.ok(report.hide.midFrames >= 2, `Leave must produce mid frames: ${JSON.stringify(report.hide)}`);
  assert.ok(report.hide.midSample.opacity > .1 && report.hide.midSample.opacity < .9, `Mid opacity ${report.hide.midSample.opacity}`);
  assert.ok(report.hide.monotonic, 'Leave opacity must fall monotonically.');
  assert.ok(report.hide.settledMs >= 120 && report.hide.settledMs <= 260, `Fade out duration ${report.hide.settledMs}ms`);
  assert.equal(hideTrace.at(-1).visibility, 'hidden');

  // Mid-frame screenshot of the leave fade.
  await page.mouse.move(700, 420);
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-h4-cursor]')).opacity) >= .999);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, composed: true,
    pointerType: 'mouse', relatedTarget: null, clientX: -1, clientY: -1 })));
  await page.waitForTimeout(70);
  await crop(page, 700, 420, 'fade-out-mid-1440.png');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-h4-cursor]')).visibility === 'hidden');

  // Re-enter at a new point: position jumps before the fade starts.
  const target = { x: 420, y: 300 };
  const revealTrace = await trace(page, 260, { type: 'reveal', x: target.x, y: target.y });
  report.reveal = analyze(revealTrace, 'in');
  const firstRevealed = revealTrace.find(sample => sample.visible === 'true');
  assert.ok(firstRevealed, 'The reveal must set the visible flag.');
  assert.ok(Math.abs(firstRevealed.x - target.x) <= .25 && Math.abs(firstRevealed.y - target.y) <= .25,
    `Reveal must land on the new pointer in the same frame: ${firstRevealed.x},${firstRevealed.y}`);
  assert.ok(firstRevealed.opacity < .999, `Reveal must start from hidden: ${firstRevealed.opacity}`);
  assert.ok(report.reveal.midFrames >= 2, `Reveal must produce mid frames: ${JSON.stringify(report.reveal)}`);
  assert.ok(report.reveal.monotonic, 'Reveal opacity must rise monotonically.');
  assert.ok(report.reveal.settledMs >= 120 && report.reveal.settledMs <= 260, `Fade in duration ${report.reveal.settledMs}ms`);
  assert.equal(revealTrace.at(-1).opacity, 1);
  assert.doesNotMatch(firstRevealed.property, /transform/);

  // Mid-frame screenshot of the reveal fade at the new point.
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, composed: true,
    pointerType: 'mouse', relatedTarget: null, clientX: -1, clientY: -1 })));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-h4-cursor]')).visibility === 'hidden');
  await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: x, clientY: y })), target);
  await page.waitForTimeout(70);
  await crop(page, target.x, target.y, 'fade-in-mid-1440.png');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-h4-cursor]')).opacity) >= .999);

  await writeFile(new URL('fade-trace.json', output), JSON.stringify({ ...report,
    hideTrace: hideTrace.filter((_, index) => index % 3 === 0), revealTrace: revealTrace.filter((_, index) => index % 3 === 0) }, null, 2) + '\n');
  await context.close();

  // Reduced motion keeps the established instant contract.
  const reducedContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(`${base}/`, { waitUntil: 'networkidle' });
  await reducedPage.mouse.move(640, 400);
  await reducedPage.waitForFunction(() => document.querySelector('[data-h4-cursor]')?.dataset.h4CursorVisible === 'true');
  const reducedTrace = await trace(reducedPage, 120, 'hide');
  report.reduced = analyze(reducedTrace, 'out');
  assert.equal(report.reduced.endValue, 0);
  assert.ok(report.reduced.settledMs <= 60, `Reduced motion must hide instantly: ${report.reduced.settledMs}ms`);
  assert.match(reducedTrace[0].duration, /^0s/);
  await reducedContext.close();

  report.passed = true;
  await writeFile(new URL('fade-trace.json', output), JSON.stringify({ ...report,
    hideTrace: hideTrace.filter((_, index) => index % 3 === 0), revealTrace: revealTrace.filter((_, index) => index % 3 === 0) }, null, 2) + '\n');
  console.log(`PASS cursor fade ${report.build}: out ${report.hide.midFrames} mid frames / ${report.hide.settledMs}ms, in ${report.reveal.midFrames} mid frames / ${report.reveal.settledMs}ms at the new point, hard cut ${report.before.midFrames} frames.`);
} finally {
  await browser.close();
}
