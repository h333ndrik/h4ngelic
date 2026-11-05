import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const out = process.env.H4_SOUND_ARTIFACTS || 'artifacts/v31-sound-controls';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
await mkdir(out, { recursive: true });
try {
  for (const width of [1440, 810, 390, 320]) for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 1000 }, reducedMotion, isMobile: width < 500, hasTouch: width < 500 });
    await context.addInitScript(() => {
      window.__soundContexts = 0;
      const Native = window.AudioContext || window.webkitAudioContext;
      window.AudioContext = class extends Native { constructor(options) { super(options); window.__soundContexts++; window.__soundContext = this; } };
    });
    const page = await context.newPage();
    const errors = [], audioRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (/\.mp3|__h4_private_audio/.test(request.url())) audioRequests.push(request.url()); });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    const arrow = page.locator('[data-sound-volume-toggle]');
    const mute = page.locator('[data-mode-mute]');
    const range = page.locator('[data-sound-volume]');
    await arrow.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.__soundContexts), 0);
    const activity = page.locator('[data-sound-activity]');
    assert.equal(await activity.count(), 1);
    assert.equal(await activity.getAttribute('aria-hidden'), 'true');
    assert.equal(await activity.locator('i').count(), 3);
    const reserved = await activity.boundingBox();
    assert.ok(reserved.width > 8, 'Inactive bars reserve their space.');
    assert.equal(await mute.getAttribute('aria-label'), 'sound on');
    if (width < 500) await arrow.tap(); else await arrow.press('Enter');
    await page.waitForTimeout(260);
    assert.equal(await page.evaluate(() => window.__soundContexts), 1, 'The first trusted control gesture unlocks the shared world-sound context.');
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
    assert.equal(await page.evaluate(() => window.__soundContexts), 1, 'Volume changes reuse the context unlocked by the gesture.');
    await range.press('Escape');
    assert.equal(await arrow.getAttribute('aria-expanded'), 'false');
    assert.equal(await arrow.evaluate(node => node === document.activeElement), true, 'Escape returns keyboard focus to the attached arrow.');
    await mute.click();
    assert.equal(await mute.getAttribute('aria-pressed'), 'true');
    assert.equal(await mute.getAttribute('aria-label'), 'sound off');
    assert.equal((await mute.textContent()).trim(), 'sound off');
    assert.equal(await activity.getAttribute('data-active'), 'false');
    assert.equal(await page.evaluate(() => window.__H4_AUDIO__?.snapshot().analyserConnected ?? false), false);
    await page.waitForFunction(() => window.__soundContext.state === 'suspended');
    assert.equal(await page.evaluate(() => window.__soundContexts), 1, 'Sound off suspends the existing context rather than duplicating it.');
    await arrow.click();
    await page.locator('.hero').click({ position: { x: width / 2, y: 150 } });
    assert.equal(await arrow.getAttribute('aria-expanded'), 'false');
    await page.reload({ waitUntil: 'networkidle' });
    await arrow.waitFor({ state: 'visible' });
    assert.equal(await mute.getAttribute('aria-pressed'), 'true');
    assert.equal(await mute.getAttribute('aria-label'), 'sound off');
    assert.equal(await range.inputValue(), '1');
    assert.equal(await page.evaluate(() => window.__soundContexts), 0, 'Reload restores preferences without autoplay.');
    assert.equal(await page.locator('[data-smash]').isDisabled(), false, 'The supplied approved track is available without being preloaded.');
    assert.deepEqual(audioRequests, []);
    assert.deepEqual(errors, []);
    const horizontalOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    assert.equal(horizontalOverflow, 0);
    results.push({ width, reducedMotion, popup: box, persistedVolume: 1, persistedMuted: true, contextsAfterGesture: 1,
      contextsAfterReload: 0, horizontalOverflow, audioRequests, errors });
    await page.screenshot({ path: `${out}/${width}-${reducedMotion}.png` });
    await context.close();
  }
  console.log(`PASS sound controls: ${results.length} desktop/tablet/mobile motion profiles, above-popup fit, keyboard range/Escape, touch, outside close, persisted mute/volume, no autoplay or early soundtrack request.`);
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
