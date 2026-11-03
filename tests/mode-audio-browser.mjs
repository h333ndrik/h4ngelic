import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const route = (path) => new URL(path, baseURL).href;

async function mode(page, expected) {
  await page.waitForFunction((value) => document.documentElement.dataset.mode === value, expected);
}
async function changeMode(page, expected) {
  if (expected === 'normal') {
    for (let index = 0; index < 3; index++) await page.keyboard.press('3');
    await mode(page, expected);
  } else {
    await page.keyboard.down('4');
    try { await mode(page, expected); } finally { await page.keyboard.up('4'); }
  }
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-xray-transition'));
}
async function pageKind(page, expected) {
  await page.waitForFunction(value => document.documentElement.dataset.page === value, expected);
}

try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    window.__audioProbe = { contexts: 0, resumes: [], starts: [], ends: 0, changes: [] };
    const Native = window.AudioContext || window.webkitAudioContext;
    document.addEventListener('h4:modechange', (event) => window.__audioProbe.changes.push({ mode: event.detail.mode, time: performance.now() }));
    window.AudioContext = class extends Native {
      constructor(options) { super(options); window.__audioProbe.contexts++; }
      resume() { window.__audioProbe.resumes.push(performance.now()); return super.resume(); }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start;
        source.start = function (when) {
          const data = source.buffer.getChannelData(0);
          let peak = 0;
          for (const value of data) peak = Math.max(peak, Math.abs(value));
          window.__audioProbe.starts.push({ mode: document.documentElement.dataset.mode, time: performance.now(), scheduled: when, duration: source.buffer.duration, peak });
          return start.call(this, when);
        };
        source.addEventListener('ended', () => window.__audioProbe.ends++);
        return source;
      }
    };
  });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(route('/work'), { waitUntil: 'networkidle' });
  await mode(page, 'normal');
  assert.equal(await page.evaluate(() => window.__audioProbe.contexts), 0, 'Browsing without discovery must allocate no audio context.');
  await page.keyboard.down('4');
  await page.waitForTimeout(700);
  await page.keyboard.up('4');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__audioProbe.contexts), 0, 'Disabled mode cues allocate no audio context for a hold.');
  assert.equal(await page.evaluate(() => window.__audioProbe.starts.length), 0, 'A cancelled hold must never make a sound.');

  await page.keyboard.down('4');
  await mode(page, 'xray');
  await page.keyboard.down('4');
  await page.waitForTimeout(900);
  await page.keyboard.up('4');
  const first = await page.evaluate(() => window.__audioProbe);
  assert.equal(first.starts.length, 0, 'Mode transitions are silent.');
  assert.equal(first.ends, 0);
  assert.equal(first.contexts, 0, 'Mode transitions do not allocate Web Audio.');
  assert.equal(first.changes[0].mode, 'xray', 'The visual mode transition still runs.');

  assert.equal(await page.locator('[data-mode-mute]:visible').count(), 0, 'Work cannot duplicate the relocated frontpage sound control.');
  await page.locator('[data-global-index] > summary').click();
  await page.locator('[data-index-page="about"]').click();
  await pageKind(page, 'about');
  assert.equal(await page.locator('[data-mode-mute]:visible').count(), 0);
  assert.ok(!requests.some((url) => /\/src\/main\.js|\/main-[^/]+\.js|wordmark\.typeface|tattoo-texture|LiberationSans/.test(url)), 'Direct Work/About, including mode sound, must not import the Three.js hero.');

  // Exercise the real relocated button. It is never clicked through a hidden
  // hero or manufactured footer fixture on an interior page.
  await page.locator('[data-floating-brand]').click();
  await pageKind(page, 'home');
  const mute = page.locator('[data-controls] [data-mode-mute]');
  assert.equal(await mute.isVisible(), true);
  assert.equal(await page.locator('.page-footer [data-mode-mute]').count(), 0);
  await mute.click();
  assert.equal(await mute.getAttribute('aria-pressed'), 'true');
  await changeMode(page, 'normal');
  assert.equal(await page.evaluate(() => window.__audioProbe.starts.length), 0, 'The reverse transition remains silent.');
  await page.locator('.hero-nav a[href="/about"]').click();
  await pageKind(page, 'about');
  assert.equal(await page.locator('[data-mode-mute]:visible').count(), 0);
  assert.equal(await page.locator('[data-mode-mute]').getAttribute('aria-pressed'), 'true', 'The retained Home control reflects mute across enhanced navigation.');
  await changeMode(page, 'xray');
  await changeMode(page, 'normal');
  assert.equal(await page.evaluate(() => window.__audioProbe.starts.length), 0, 'Both transitions remain silent after leaving the frontpage.');

  await page.locator('[data-floating-brand]').click();
  await pageKind(page, 'home');
  await mute.click();
  assert.equal(await mute.getAttribute('aria-pressed'), 'false', 'Global mute still toggles back off.');
  const final = await page.evaluate(() => window.__audioProbe);
  assert.deepEqual(final.starts, [], 'Mode cues stay disabled through every transition.');
  assert.equal(final.contexts, 0, 'Mode-only use never allocates Web Audio.');
  assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS mode audio V30: all mode transitions silent, no Web Audio allocation, visible upper mute state persists across navigation, strict 333 return and no direct interior 3D scene.');

  const unsupported = await browser.newContext({ reducedMotion: 'reduce' });
  await unsupported.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  const fallback = await unsupported.newPage();
  const fallbackErrors = [];
  fallback.on('pageerror', (error) => fallbackErrors.push(error.message));
  await fallback.goto(route('/work'), { waitUntil: 'networkidle' });
  await mode(fallback, 'normal');
  assert.equal(await fallback.locator('[data-mode-mute]:visible').count(), 0);
  await changeMode(fallback, 'xray');
  await changeMode(fallback, 'normal');
  await fallback.locator('[data-floating-brand]').click();
  await pageKind(fallback, 'home');
  assert.equal(await fallback.locator('[data-controls] [data-mode-mute]').isDisabled(), true, 'The relocated control announces unavailable audio.');
  assert.deepEqual(fallbackErrors, [], 'Unavailable audio must not prevent either mode transition.');
  await unsupported.close();
  console.log('PASS unavailable audio: disabled cues and both visual mode transitions remain reliable.');
} finally { await browser.close(); }
