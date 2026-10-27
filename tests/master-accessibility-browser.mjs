import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../artifacts/master-foundation/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('[data-naavi]')?.dataset.chapter === '0');
    // Observe only the real animation created by NAAVI. No fake animation,
    // media event or duration extension is supplied by this harness.
    await page.locator('[data-naavi] .chapter-digit').evaluate(digit => {
      const nativeAnimate = digit.animate.bind(digit);
      window.__naaviAccessibility = { started: 0, canceled: false, animation: null };
      digit.animate = (...args) => {
        const animation = nativeAnimate(...args);
        const nativeCancel = animation.cancel.bind(animation);
        const probe = window.__naaviAccessibility;
        probe.started++;
        probe.animation = animation;
        animation.cancel = () => { probe.canceled = true; return nativeCancel(); };
        return animation;
      };
    });
    const started = page.waitForFunction(() => {
      const probe = window.__naaviAccessibility;
      return probe.started > 0 && probe.animation?.playState === 'running';
    });
    await page.locator('[data-naavi]').click();
    await started;
    const before = await page.evaluate(() => {
      const probe = window.__naaviAccessibility;
      return { started: probe.started, currentTime: probe.animation.currentTime,
        playState: probe.animation.playState, duration: probe.animation.effect.getTiming().duration };
    });
    assert.equal(before.playState, 'running', 'The preference must change during the actual digit animation.');
    assert.equal(before.duration, 280);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => window.__naaviAccessibility.canceled);
    const after = await page.evaluate(() => ({
      canceled: window.__naaviAccessibility.canceled,
      playState: window.__naaviAccessibility.animation.playState,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      running: document.querySelector('[data-naavi] .chapter-digit').getAnimations().filter(animation => animation.playState === 'running').length,
    }));
    assert.equal(after.reduced, true);
    assert.equal(after.canceled, true, 'The new preference must cancel, rather than merely outlast, the active animation.');
    assert.equal(after.playState, 'idle');
    assert.equal(after.running, 0);

    // Use the genuine published image, rather than a synthetic gallery fixture.
    await page.goto(`${base}/work#digital-artworks`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal');
    const thumbnail = page.locator('[data-archive-category="digital-artworks"] [data-artwork-open]').first();
    await thumbnail.locator('img').evaluate(image => image.decode());
    await thumbnail.scrollIntoViewIfNeeded();
    await thumbnail.click();
    const expanded = page.locator('.artwork-dialog[open] .artwork-viewer-image');
    await expanded.waitFor({ state: 'visible' });
    await expanded.hover();
    const cursor = await expanded.evaluate(image => ({
      cursor: getComputedStyle(image).cursor,
      width: image.naturalWidth, height: image.naturalHeight,
      fine: matchMedia('(hover: hover) and (pointer: fine)').matches,
    }));
    assert.equal(cursor.fine, true);
    assert.notEqual(cursor.cursor, 'zoom-out');
    assert.match(cursor.cursor, /h4ngelic-cursor\.svg/, 'An expanded photograph keeps the exact native h4 cursor.');
    assert.equal(cursor.width, 1440); assert.equal(cursor.height, 1920);
    await page.keyboard.press('Escape');
    await page.locator('.artwork-dialog').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    await writeFile(new URL('accessibility.json', output), JSON.stringify({ checkedAt: new Date().toISOString(),
      width: 1440, actualAnimation: { before, after }, expandedOriginal: cursor, errors }, null, 2));
    console.log('PASS dynamic accessibility: reduced-motion cancels an active NAAVI animation; the genuine expanded artwork retains the native h4 cursor.');
  } finally { await context.close(); }
} finally { await browser.close(); }
