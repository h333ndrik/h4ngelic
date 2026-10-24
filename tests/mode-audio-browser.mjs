import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const route = (path) => new URL(path, baseURL).href;

async function mode(page, expected) {
  await page.waitForFunction((value) => document.documentElement.dataset.mode === value, expected);
}
async function hold(page, expected) {
  await page.keyboard.down('4');
  try { await mode(page, expected); } finally { await page.keyboard.up('4'); }
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
  assert.equal(await page.evaluate(() => window.__audioProbe.contexts), 1, 'Accepted real input primes audio before the delayed mode change.');
  assert.equal(await page.evaluate(() => window.__audioProbe.starts.length), 0, 'A cancelled hold must never make a sound.');

  await page.keyboard.down('4');
  await mode(page, 'xray');
  await page.keyboard.down('4');
  await page.waitForTimeout(900);
  await page.keyboard.up('4');
  const first = await page.evaluate(() => window.__audioProbe);
  assert.equal(first.starts.length, 1, 'A sustained/repeated key produces exactly one sound.');
  assert.equal(first.ends, 1, 'The short cue ends and releases its source.');
  assert.equal(first.starts[0].mode, 'xray');
  assert.ok(first.starts[0].duration >= .4 && first.starts[0].duration <= .8);
  assert.ok(first.starts[0].peak <= .681, 'The actual AudioBuffer has controlled amplitude.');
  assert.ok(Math.abs(first.starts[0].time - first.changes[0].time) < 100, 'The cue begins with the actual mode transition.');

  const mute = page.locator('[data-mode-mute]');
  await mute.click();
  assert.equal(await mute.getAttribute('aria-pressed'), 'true');
  await hold(page, 'normal');
  assert.equal(await page.evaluate(() => window.__audioProbe.starts.length), 1, 'Muting prevents the reverse-transition sound.');
  await page.locator('.page-nav a[href="/about"]').click();
  await page.waitForURL((url) => url.pathname === '/about');
  assert.equal(await page.locator('[data-mode-mute]').getAttribute('aria-pressed'), 'true', 'Mute remains active across enhanced navigation.');
  await page.locator('[data-mode-mute]').click();
  await hold(page, 'xray');
  await hold(page, 'normal');
  const final = await page.evaluate(() => window.__audioProbe);
  assert.deepEqual(final.starts.map((start) => start.mode), ['xray', 'xray', 'normal']);
  assert.equal(final.contexts, 1, 'Navigation reuses one audio context.');
  assert.ok(!requests.some((url) => /\/src\/main\.js|\/main-[^/]+\.js|wordmark\.typeface|tattoo-texture|LiberationSans/.test(url)), 'Mode sound on Work/About must not import the Three.js hero.');
  assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS mode audio: trusted-gesture priming, silent short holds, actual transition timing, bounded 0.7s buffers, repeat latch, source cleanup, mute across navigation and no interior 3D scene.');

  const unsupported = await browser.newContext({ reducedMotion: 'reduce' });
  await unsupported.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  const fallback = await unsupported.newPage();
  const fallbackErrors = [];
  fallback.on('pageerror', (error) => fallbackErrors.push(error.message));
  await fallback.goto(route('/work'), { waitUntil: 'networkidle' });
  await mode(fallback, 'normal');
  assert.equal(await fallback.locator('[data-mode-mute]').isDisabled(), true);
  await hold(fallback, 'xray');
  await hold(fallback, 'normal');
  assert.deepEqual(fallbackErrors, [], 'Unavailable audio must not prevent either mode transition.');
  await unsupported.close();
  console.log('PASS unavailable audio: both visual mode transitions and accessible mute status remain reliable.');
} finally { await browser.close(); }
