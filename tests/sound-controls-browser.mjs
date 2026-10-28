import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const out = process.env.H4_SOUND_ARTIFACTS || 'artifacts/v3-sound-controls';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const results = [];
await mkdir(out, { recursive: true });
try {
  for (const width of [1440, 810, 390, 320]) for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 1000 }, reducedMotion, isMobile: width < 500, hasTouch: width < 500 });
    await context.addInitScript(() => {
      window.__soundContexts = 0;
      const Native = window.AudioContext || window.webkitAudioContext;
      window.AudioContext = class extends Native { constructor(options) { super(options); window.__soundContexts++; } };
    });
    const page = await context.newPage();
    const errors = [], audioRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\.mp3|__h4_private_audio/.test(request.url())) audioRequests.push(request.url()); });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    const arrow = page.locator('[data-sound-volume-toggle]');
    const mute = page.locator('[data-mode-mute]');
    const range = page.locator('[data-sound-volume]');
    await arrow.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.__soundContexts), 0);
    if (width < 500) await arrow.tap(); else await arrow.press('Enter');
    await page.waitForTimeout(260);
    assert.equal(await arrow.getAttribute('aria-expanded'), 'true');
    const box = await page.locator('[data-sound-volume-popup]').boundingBox();
    const controls = await arrow.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `Volume popup fits ${width}px.`);
    assert.ok(box.y + box.height <= controls.y, 'The compact popup opens above SOUND.');
    await range.focus();
    await range.press('Home');
    await range.press('ArrowRight');
    assert.equal(await range.inputValue(), '1');
    assert.equal(await range.getAttribute('aria-valuetext'), '1 percent');
    assert.equal(await page.evaluate(() => window.__soundContexts), 0, 'Volume preference alone never allocates audio.');
    await range.press('Escape');
    assert.equal(await arrow.getAttribute('aria-expanded'), 'false');
    assert.equal(await arrow.evaluate(node => node === document.activeElement), true, 'Escape returns keyboard focus to the attached arrow.');
    await mute.click();
    assert.equal(await mute.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => window.__soundContexts), 0);
    await arrow.click();
    await page.locator('.hero').click({ position: { x: width / 2, y: 150 } });
    assert.equal(await arrow.getAttribute('aria-expanded'), 'false');
    await page.reload({ waitUntil: 'networkidle' });
    await arrow.waitFor({ state: 'visible' });
    assert.equal(await mute.getAttribute('aria-pressed'), 'true');
    assert.equal(await range.inputValue(), '1');
    assert.equal(await page.evaluate(() => window.__soundContexts), 0, 'Reload restores preferences without autoplay.');
    assert.equal(await page.locator('[data-smash]').isDisabled(), true, 'The missing approved private file has no substitute.');
    assert.deepEqual(audioRequests, []);
    assert.deepEqual(errors, []);
    results.push({ width, reducedMotion, popup: box, persistedVolume: 1, persistedMuted: true, contexts: 0, errors });
    await page.screenshot({ path: `${out}/${width}-${reducedMotion}.png` });
    await context.close();
  }
  console.log(`PASS sound controls: ${results.length} desktop/tablet/mobile motion profiles, above-popup fit, keyboard range/Escape, touch, outside close, persisted mute/volume, no autoplay or missing-track request.`);
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
