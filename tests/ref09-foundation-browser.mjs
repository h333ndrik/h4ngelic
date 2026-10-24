import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const out = new URL('../artifacts/ref09-phase1/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
const url = path => new URL(path, base).href;
async function state(page, expected) {
  await page.waitForFunction(value => document.documentElement.dataset.mode === value
    && document.documentElement.hasAttribute('data-xray-ready')
    && !document.documentElement.hasAttribute('data-xray-transition'), expected, { timeout: 10000 });
}
async function enter(page, key = '4') {
  await page.keyboard.down(key);
  try { await state(page, 'xray'); } finally { await page.keyboard.up(key); }
}
async function reverse(page, key = '3') {
  for (let i = 0; i < 3; i++) await page.keyboard.press(key);
  await state(page, 'normal');
}
async function normalGray(page) {
  await state(page, 'normal');
  await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(48, 48, 51)');
  assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(48, 48, 51)');
}
async function hintState(page) {
  return page.locator('[data-other-side-hint]').evaluate(element => {
    const message = element.querySelector('[data-secret-message]');
    const box = element.getBoundingClientRect();
    const parent = element.parentElement.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { text: element.textContent.trim(), opacity: Number(getComputedStyle(message).opacity), font: parseFloat(style.fontSize), color: style.color,
      x: box.x + box.width / 2, y: (box.y + box.height / 2 - parent.y) / parent.height,
      within: box.left >= -1 && box.right <= innerWidth + 1, width: innerWidth };
  });
}
try {
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url('/#contact'), { waitUntil: 'networkidle' });
    await normalGray(page);
    const hint = page.locator('[data-other-side-hint]');
    await hint.scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    assert.equal((await hintState(page)).opacity, 0, 'Normal instruction is hidden before discovery.');
    await hint.hover();
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-secret-message][data-xray-hint]')).opacity) >= .34);
    assert.ok((await hintState(page)).opacity <= .351);
    await page.waitForTimeout(2800);
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-secret-message][data-xray-hint]')).opacity) < .01);
    await page.mouse.move(2, 2);

    await page.evaluate(() => {
      window.__ref09 = { starts: [], changes: [] };
      document.addEventListener('keydown', event => { if ((event.key === '4' || event.code === 'Numpad4') && !event.repeat) window.__ref09.starts.push(performance.now()); }, true);
      document.addEventListener('h4:modechange', event => window.__ref09.changes.push({ mode: event.detail.mode, time: performance.now() }));
    });
    await page.keyboard.down('4'); await page.waitForTimeout(800);
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal');
    await page.keyboard.up('4'); await page.waitForTimeout(300);
    await normalGray(page);
    await page.keyboard.down('4'); await state(page, 'xray');
    await page.keyboard.down('4'); await page.waitForTimeout(1100);
    await page.keyboard.up('4');
    const activation = await page.evaluate(() => window.__ref09);
    assert.equal(activation.changes.length, 1);
    assert.ok(activation.changes[0].time - activation.starts[1] >= 999, 'A real continuous hold cannot activate before one second.');
    await page.keyboard.down('4'); await page.waitForTimeout(1100); await page.keyboard.up('4');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'The old hold-4 reverse is removed.');
    await page.waitForTimeout(2200);
    const visible = await hintState(page);
    assert.equal(visible.text, 'PRESS 3 THREE TIMES TO REVERSE.');
    assert.equal(visible.opacity, 1, 'Reverse instruction remains visible without hovering after the secret timer expires.');
    assert.ok(visible.font >= 20 && visible.font <= 24);
    assert.equal(visible.color, 'rgb(255, 255, 255)');
    assert.ok(Math.abs(visible.x - visible.width / 2) < 1 && visible.y > .25 && visible.y < .5);
    await page.screenshot({ path: new URL('desktop-reverse.png', out).pathname });

    await page.keyboard.down('3');
    for (let i = 0; i < 6; i++) await page.keyboard.down('3');
    await page.keyboard.up('3');
    await page.keyboard.press('3');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'Auto repeat cannot count as released presses.');
    await page.waitForTimeout(2100);
    await page.keyboard.press('3'); await page.keyboard.press('3');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'A timed-out prefix cannot contribute to a new sequence.');
    await page.keyboard.press('3'); await normalGray(page);
    const countAfterReverse = await page.evaluate(() => window.__ref09.changes.length);
    await page.keyboard.press('3'); await page.keyboard.press('3'); await page.keyboard.press('3');
    assert.equal(await page.evaluate(() => window.__ref09.changes.length), countAfterReverse);

    await enter(page, 'Numpad4');
    await page.evaluate(() => {
      const input = document.createElement('input'); input.id = 'test-input'; document.body.append(input);
      const editable = document.createElement('div'); editable.contentEditable = 'true'; editable.id = 'test-editable'; document.body.append(editable);
    });
    await page.locator('#test-input').focus(); await page.keyboard.type('333');
    assert.equal(await page.locator('#test-input').inputValue(), '333');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray');
    await page.locator('#test-editable').focus(); await page.keyboard.type('333');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray');
    await page.evaluate(() => { document.activeElement.blur(); document.querySelector('#test-input').remove(); document.querySelector('#test-editable').remove(); });
    await page.keyboard.press('Numpad3'); await page.keyboard.press('Numpad3');
    await page.evaluate(() => dispatchEvent(new Event('blur')));
    await page.keyboard.press('Numpad3');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'Blur resets an incomplete sequence.');
    await page.keyboard.press('Numpad3'); await page.keyboard.press('Numpad3'); await normalGray(page);

    await enter(page);
    await page.keyboard.press('3'); await page.keyboard.press('3');
    await page.locator('.about-preview .text-link').click();
    await page.waitForURL(href => href.pathname === '/about');
    await state(page, 'xray');
    await page.keyboard.press('3');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'Enhanced navigation cancels the unfinished sequence.');
    await page.keyboard.press('3'); await page.keyboard.press('3'); await normalGray(page);
    for (const path of ['/work', '/work/tattoos', '/about', '/#contact']) {
      await page.goto(url(path), { waitUntil: 'networkidle' }); await normalGray(page);
    }
    assert.deepEqual(errors, []);
    reports.push({ profile: 'desktop', errors, activationMs: activation.changes[0].time - activation.starts[1], instruction: visible });
    console.log('PASS Phase1 desktop: real one-second entry, 4 cannot reverse, released 333/window/repeat/numpad, editing/blur/navigation guards, protected persistent white instruction and exact established gray.');
    await context.close();
  }
  for (const width of [390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url('/#contact'), { waitUntil: 'networkidle' }); await normalGray(page);
    const hint = page.locator('[data-other-side-hint]'); await hint.scrollIntoViewIfNeeded();
    const touch = await context.newCDPSession(page);
    async function touchHold(expected, cancel = false) {
      const box = await hint.boundingBox();
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
      try {
        if (cancel) { await page.waitForTimeout(700); assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal'); }
        else await state(page, expected);
      } finally { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    }
    await touchHold('normal', true); await page.waitForTimeout(400); await normalGray(page);
    await touchHold('xray');
    const visible = await hintState(page);
    assert.equal(visible.text, 'PRESS 3 THREE TIMES TO REVERSE.'); assert.equal(visible.opacity, 1);
    assert.ok(visible.font >= 18 && visible.within);
    await page.screenshot({ path: new URL(`mobile-${width}-reverse.png`, out).pathname });
    if (width === 390) await touchHold('normal'); else await reverse(page, 'Numpad3');
    await normalGray(page);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    reports.push({ profile: `touch-${width}`, errors, instruction: visible });
    await touch.detach(); await context.close();
    console.log(`PASS Phase1 touch ${width}: native short/full holds, discreet exit, readable persistent instruction, reduced motion and no overflow.`);
  }
  await writeFile(new URL('results.json', out), JSON.stringify({ testedAt: new Date().toISOString(), base, reports }, null, 2) + '\n');
} finally { await browser.close(); }
