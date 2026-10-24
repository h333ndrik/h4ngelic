import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  });
  await page.goto(new URL('/work', base).href, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('html').getAttribute('data-xray-quality'), 'full');
  await page.evaluate(() => {
    window.__cancelProbe = { amounts: [], calls: 0 };
    document.addEventListener('h4:modeprogress', event => window.__cancelProbe.amounts.push(event.detail.amount));
    // Model the real native lifecycle where capture is accepted but its update
    // callback has not yet run when the window loses focus.
    document.startViewTransition = () => {
      window.__cancelProbe.calls++;
      let finish;
      const finished = new Promise(resolve => { finish = resolve; });
      return { ready: new Promise(() => {}), updateCallbackDone: new Promise(() => {}), finished, skipTransition: finish };
    };
  });
  await page.keyboard.down('4');
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-mode-snapshot'));
  await page.keyboard.up('4');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray' && !document.documentElement.hasAttribute('data-xray-transition'));
  await page.waitForTimeout(180);
  const state = await page.evaluate(() => ({ ...window.__cancelProbe,
    snapshotActive: document.documentElement.hasAttribute('data-mode-snapshot'),
    transitionActive: document.documentElement.hasAttribute('data-xray-transition'),
    firstRed: Number(document.querySelector('[data-xray-channel="red"]').getAttribute('tableValues').split(' ')[0]),
  }));
  assert.equal(state.calls, 1);
  assert.equal(state.snapshotActive, false);
  assert.equal(state.transitionActive, false);
  assert.equal(state.firstRed, .08, 'A queued fallback frame must not overwrite the completed Other Side treatment.');
  const finishedAt = state.amounts.indexOf(1);
  assert.ok(finishedAt >= 0);
  assert.ok(state.amounts.slice(finishedAt).every(value => value === 1), 'Completed mode progress must remain at its target after interrupted native capture.');
  assert.deepEqual(errors, []);
  console.log('PASS interrupted native capture: accepted mode commits once and its finished treatment remains stable with no surviving fallback frame.');
} finally { await browser.close(); }
