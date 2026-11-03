import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const route = (path) => new URL(path, baseURL).href;

async function mode(page, expected) {
  await page.waitForFunction((value) => document.documentElement.dataset.mode === value, expected);
}
async function changeMode(page, expected) {
  await page.evaluate(() => document.activeElement?.blur());
  if (expected === 'normal') {
    for (let index = 0; index < 3; index++) await page.keyboard.press('3');
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
    window.__audioProbe = { contexts: [], sources: [], changes: [], fetches: [] };
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (url, ...args) {
      const value = String(url?.url || url);
      if (/\/assets\/audio\/(?:loop-(?:333|4)|x-(?:333-4|4-333))\.m4a(?:$|[?#])/.test(value)) window.__audioProbe.fetches.push(value);
      return nativeFetch(url, ...args);
    };
    const Native = window.AudioContext || window.webkitAudioContext;
    window.AudioContext = class extends Native {
      constructor(options) { super(options); window.__audioProbe.contexts.push(this); }
      resume() { this.resumes = (this.resumes || 0) + 1; return super.resume(); }
      suspend() { this.suspends = (this.suspends || 0) + 1; return super.suspend(); }
      createBufferSource() {
        const source = super.createBufferSource(), start = source.start.bind(source);
        source.start = function (when = 0, offset = 0, ...rest) {
          window.__audioProbe.sources.push({ loop: source.loop, duration: source.buffer?.duration || 0, when, offset });
          return start(when, offset, ...rest);
        };
        return source;
      }
    };
    document.addEventListener('h4:modechange', (event) => window.__audioProbe.changes.push({ mode: event.detail.mode, time: performance.now() }));
  });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/\/assets\/audio\/.*\.m4a(?:$|[?#])/.test(request.url())) requests.push(request.url()); });
  await page.goto(route('/work/tattoos'), { waitUntil: 'networkidle' });
  await mode(page, 'normal');
  assert.equal(await page.evaluate(() => window.__audioProbe.contexts.length), 0, 'Browsing without a gesture allocates no audio context.');
  assert.deepEqual(requests, [], 'World files are not requested on page load.');
  await page.keyboard.down('4');
  await page.waitForTimeout(700);
  await page.keyboard.up('4');
  await page.waitForTimeout(500);
  let probe = await page.evaluate(() => ({ contexts: window.__audioProbe.contexts.length, sources: window.__audioProbe.sources, changes: window.__audioProbe.changes, fetches: window.__audioProbe.fetches }));
  assert.equal(probe.contexts, 1, 'The first trusted gesture unlocks the shared audio context.');
  assert.ok(probe.sources.some(source => source.loop && source.duration > 30), 'The active world loop starts after the gesture.');
  assert.equal(probe.sources.some(source => !source.loop && source.duration < 1), false, 'A cancelled hold does not fire a mode-change cue or transition.');
  assert.deepEqual(probe.changes, [], 'The held mode still requires one full second.');
  assert.ok(probe.fetches.some(url => url.endsWith('loop-333.m4a')));

  await changeMode(page, 'xray');
  probe = await page.evaluate(() => ({ contexts: window.__audioProbe.contexts.length, sources: window.__audioProbe.sources, changes: window.__audioProbe.changes, fetches: window.__audioProbe.fetches }));
  assert.equal(probe.contexts, 1, 'The mode transition shares the existing controller.');
  assert.deepEqual(probe.changes.map(item => item.mode), ['xray']);
  assert.ok(probe.sources.some(source => !source.loop && Math.abs(source.duration - 1.4) < .02), 'The file-based 1.4 s transition one-shot starts.');
  assert.equal(probe.sources.some(source => !source.loop && source.duration > .4 && source.duration < 1), false, 'The old synthesized 0.7 s mode cue remains disabled.');
  assert.ok(probe.fetches.some(url => url.endsWith('x-333-4.m4a')));

  assert.equal(await page.locator('[data-mode-mute]:visible').count(), 0, 'Work cannot duplicate the relocated frontpage sound control.');
  await page.locator('[data-global-index] > summary').click();
  await page.locator('[data-index-page="about"]').click();
  await pageKind(page, 'about');
  assert.equal(await page.locator('[data-mode-mute]:visible').count(), 0);
  assert.equal(await page.evaluate(() => window.__audioProbe.contexts.length), 1, 'Route navigation retains one audio controller.');
  assert.ok(requests.every(url => /\/assets\/audio\//.test(url)), 'No unrelated media is routed through world sound.');

  await page.locator('[data-floating-brand]').click();
  await pageKind(page, 'home');
  const mute = page.locator('[data-controls] [data-mode-mute]');
  await mute.click();
  assert.equal(await mute.getAttribute('aria-pressed'), 'true');
  await page.waitForFunction(() => window.__audioProbe.contexts[0].suspends > 0);
  await mute.click();
  assert.equal(await mute.getAttribute('aria-pressed'), 'false');
  await page.waitForFunction(() => window.__audioProbe.contexts[0].state === 'running');
  await changeMode(page, 'normal');
  assert.ok((await page.evaluate(() => window.__audioProbe.fetches)).some(url => url.endsWith('x-4-333.m4a')));
  assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS mode audio: gesture-only world startup, no legacy cue, file transitions, one shared context, route/mute persistence and both directions.');

  const unsupported = await browser.newContext({ reducedMotion: 'reduce' });
  await unsupported.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  const fallback = await unsupported.newPage();
  const fallbackErrors = [];
  fallback.on('pageerror', (error) => fallbackErrors.push(error.message));
  await fallback.goto(route('/work/tattoos'), { waitUntil: 'networkidle' });
  await mode(fallback, 'normal');
  assert.equal(await fallback.locator('[data-mode-mute]:visible').count(), 0);
  await changeMode(fallback, 'xray');
  await changeMode(fallback, 'normal');
  await fallback.locator('[data-floating-brand]').click();
  await pageKind(fallback, 'home');
  assert.equal(await fallback.locator('[data-controls] [data-mode-mute]').isDisabled(), true, 'The relocated control announces unavailable audio.');
  assert.deepEqual(fallbackErrors, [], 'Unavailable audio must not prevent either mode transition.');
  await unsupported.close();
  console.log('PASS unavailable audio: visually reliable transitions and a disabled sound control.');
} finally { await browser.close(); }
