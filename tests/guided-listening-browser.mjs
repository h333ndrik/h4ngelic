import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { worldSoundSettings } from '../src/audio/worldSoundSettings.js';

const LOOP_333 = worldSoundSettings.paths.loops['333'][0];

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const output = new URL('../artifacts/guided-listening/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const reports = [], failures = [];

async function instrument(context) {
  await context.addInitScript(() => {
    window.__guided = { contexts: 0, fetches: [], sources: [], ramps: [], errors: [] };
    const Native = window.AudioContext || window.webkitAudioContext;
    if (!Native) return;
    window.AudioContext = class extends Native {
      constructor(options) {
        super(options);
        window.__guided.contexts++;
        window.__guided.context = this;
        window.__guided.originalResume = this.resume.bind(this);
      }
      createGain() {
        const node = super.createGain();
        const ramp = node.gain.linearRampToValueAtTime.bind(node.gain);
        node.gain.linearRampToValueAtTime = (value, time) => {
          window.__guided.ramps.push({ value, at: time, now: this.currentTime });
          return ramp(value, time);
        };
        return node;
      }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        source.start = function (when = 0, offset = 0, ...rest) {
          window.__guided.sources.push({ loop: source.loop, duration: source.buffer?.duration || 0, when, offset });
          return start(when, offset, ...rest);
        };
        return source;
      }
    };
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (url, ...args) {
      const value = String(url?.url || url);
      if (/\/assets\/audio\//.test(value)) window.__guided.fetches.push(value);
      return nativeFetch(url, ...args);
    };
    window.addEventListener('error', event => window.__guided.errors.push(event.message));
  });
}

const probe = page => page.evaluate(() => ({
  contexts: window.__guided.contexts,
  fetches: [...window.__guided.fetches],
  sources: window.__guided.sources.map(source => ({ ...source })),
  ramps: window.__guided.ramps.map(ramp => ({ ...ramp })),
  errors: [...window.__guided.errors],
  snapshot: window.__H4_AUDIO__.snapshot(),
}));
const activeLoop = page => page.waitForFunction(() => window.__H4_AUDIO__?.snapshot().world?.loops['333'].active, null, { timeout: 30000 });

async function scenario(name, { width = 1440, reduced = false, mobile = false, setup, run } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: reduced ? 'reduce' : 'no-preference',
    isMobile: mobile, hasTouch: mobile });
  await instrument(context);
  if (setup) await setup(context);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  try {
    await page.goto(new URL('/?test=1', base).href, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__H4_AUDIO__));
    await page.waitForTimeout(300);
    await run(page, consoleErrors);
    const final = await probe(page);
    assert.deepEqual([...consoleErrors, ...final.errors], [], `${name}: zero console errors`);
    reports.push({ name, width, reduced, final, consoleErrors });
    console.log(`PASS guided listening: ${name}`);
  } catch (error) {
    const final = await probe(page).catch(() => null);
    failures.push({ name, width, reduced, error: error.stack, final, consoleErrors });
    console.error(`FAIL guided listening: ${name}`);
    throw error;
  } finally { await context.close(); }
}

try {
  await scenario('wordmark pointerdown unlocks, fades 1.8 s and fetches once', {
    async run(page) {
      let state = await probe(page);
      assert.equal(state.contexts, 0, 'No AudioContext before a gesture.');
      assert.deepEqual(state.fetches, [], 'No audio fetch before a gesture.');
      const box = await page.locator('#stage').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await activeLoop(page);
      state = await probe(page);
      assert.equal(state.contexts, 1, 'Exactly one AudioContext.');
      assert.deepEqual(state.fetches, [LOOP_333], 'Only the active loop is fetched, once.');
      assert.equal(state.sources.filter(source => source.loop).length, 1, 'One loop voice.');
      assert.equal((await page.locator('[data-mode-mute]').textContent()).trim(), 'sound on');
      assert.equal(await page.locator('[data-mode-mute]').getAttribute('aria-label'), 'sound', 'The accessible name is stable; aria-pressed carries the state.');
      assert.equal(await page.locator('[data-sound-activity]').getAttribute('aria-hidden'), 'true');
      assert.ok(state.ramps.some(ramp => ramp.value === 1 && ramp.at - ramp.now >= 1.5 && ramp.at - ramp.now <= 2.0),
        'The loop fades in over 1.5–2 s.');
      await page.mouse.move(720, 400);
      await page.mouse.move(1100, 700);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(700);
      state = await probe(page);
      assert.equal(state.sources.filter(source => source.loop).length, 1, 'Later stages never restart the loop.');
      assert.equal(state.fetches.filter(url => url.endsWith(LOOP_333)).length, 1, 'No second fetch.');
    },
  });

  await scenario('pointermove never starts audio', {
    async run(page) {
      const button = await page.locator('#pause-control').boundingBox();
      const x = button.x + button.width / 2, y = button.y + button.height / 2;
      await page.mouse.click(x, y);
      await page.waitForTimeout(300);
      let state = await probe(page);
      assert.equal(state.contexts, 1, 'A neutral click unlocks state only.');
      assert.deepEqual(state.fetches, [], 'Unlock fetches nothing.');
      await page.mouse.move(x + 150, y);
      await page.mouse.move(x + 400, y + 120);
      await page.waitForTimeout(400);
      state = await probe(page);
      assert.deepEqual(state.fetches, [], 'A 200+ px pointermove is not an audio trigger.');
      assert.equal(state.snapshot.world, null);
    },
  });

  await scenario('WORKS becomes 25% visible and starts the loop once', {
    async run(page) {
      const button = await page.locator('#pause-control').boundingBox();
      await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
      await page.waitForTimeout(300);
      assert.deepEqual((await probe(page)).fetches, [], 'Unlock alone stays silent.');
      await page.evaluate(() => document.getElementById('selected-work').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await activeLoop(page);
      const state = await probe(page);
      assert.deepEqual(state.fetches, [LOOP_333]);
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(500);
      assert.equal((await probe(page)).fetches.length, 1, 'The WORKS observer fires only once.');
    },
  });

  await scenario('stored mute always wins until SOUND is switched on', {
    async setup(context) {
      await context.addInitScript(() => {
        try { localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .6 })); } catch { /* ignore */ }
      });
    },
    async run(page) {
      const box = await page.locator('#stage').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1200);
      let state = await probe(page);
      assert.equal(state.snapshot.muted, true);
      assert.equal(state.contexts, 1, 'Unlocking is allowed while muted.');
      assert.deepEqual(state.fetches, [], 'Muted triggers fetch nothing.');
      assert.equal(state.snapshot.world, null, 'Muted triggers never activate a world.');
      await page.locator('[data-mode-mute]').click();
      await activeLoop(page);
      assert.equal((await page.locator('[data-mode-mute]').textContent()).trim(), 'sound on');
      state = await probe(page);
      assert.equal(state.snapshot.muted, false);
      assert.deepEqual(state.fetches, [LOOP_333], 'SOUND ON is the hard control that starts audio.');
    },
  });

  await scenario('failed visibility resume exposes tap to resume', {
    async run(page) {
      const box = await page.locator('#stage').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await activeLoop(page);
      await page.evaluate(() => { window.__guided.context.resume = () => Promise.reject(new Error('blocked')); });
      await page.evaluate(() => {
        window.__H4_AUDIO__.setPageHidden(true);
        window.__H4_AUDIO__.setPageHidden(false);
      });
      await page.waitForTimeout(300);
      let state = await probe(page);
      assert.equal(state.snapshot.needsResume, true);
      assert.equal((await page.locator('[data-mode-mute]').textContent()).trim(), 'tap to resume');
      assert.equal(await page.locator('[data-mode-mute]').getAttribute('aria-label'), 'tap to resume sound');
      await page.evaluate(() => { window.__guided.context.resume = window.__guided.originalResume; });
      const button = page.locator('[data-mode-mute]');
      await button.focus();
      assert.equal(await button.evaluate(node => node === document.activeElement), true, 'The affordance is keyboard reachable.');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      state = await probe(page);
      assert.equal(state.snapshot.needsResume, false, 'The SOUND affordance clears the resume state.');
      assert.equal((await page.locator('[data-mode-mute]').textContent()).trim(), 'sound on');
      assert.equal(await page.locator('[data-mode-mute]').getAttribute('aria-label'), 'sound');
    },
  });

  await scenario('one-time iOS silent-switch hint appears and clears', {
    async setup(context) {
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'platform', { configurable: true, get: () => 'iPhone' });
        Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
        Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => 5 });
      });
    },
    async run(page) {
      const box = await page.locator('#stage').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + Math.min(box.height / 2, 400));
      await activeLoop(page);
      const hint = page.locator('[data-sound-ios-hint]');
      await hint.waitFor({ state: 'visible', timeout: 5000 });
      assert.match(await hint.textContent(), /hearing nothing\? check the silent switch\./);
      assert.equal(await hint.getAttribute('role'), null, 'The hint is not a live region.');
      assert.equal(await page.evaluate(() => localStorage.getItem('h4ngelic.sound.ios-hint.v1')), 'shown');
      await page.waitForTimeout(6500);
      assert.equal(await hint.count(), 0, 'The hint removes itself after about six seconds.');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => Boolean(window.__H4_AUDIO__));
      const box2 = await page.locator('#stage').boundingBox();
      await page.mouse.click(box2.x + box2.width / 2, box2.y + Math.min(box2.height / 2, 400));
      await activeLoop(page);
      await page.waitForTimeout(400);
      assert.equal(await page.locator('[data-sound-ios-hint]').count(), 0, 'Dismissal persists across reloads.');
    },
  });

  await scenario('touch pointermove is inert; WORKS visibility carries stage B', {
    width: 390, mobile: true,
    async run(page) {
      const button = await page.locator('#pause-control').boundingBox();
      await page.touchscreen.tap(button.x + button.width / 2, button.y + button.height / 2);
      await page.waitForTimeout(250);
      assert.deepEqual((await probe(page)).fetches, [], 'Touch unlock stays silent.');
      await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove', { clientX: 380, clientY: 600, pointerType: 'touch', bubbles: true })));
      await page.waitForTimeout(300);
      assert.deepEqual((await probe(page)).fetches, [], 'A touch pointermove never triggers audio.');
      await page.evaluate(() => document.getElementById('selected-work').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await activeLoop(page);
      assert.deepEqual((await probe(page)).fetches, [LOOP_333]);
    },
  });

  await scenario('stage B re-arms after a home → work → home round-trip', {
    async run(page) {
      const button = await page.locator('#pause-control').boundingBox();
      await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
      await page.waitForTimeout(300);
      assert.deepEqual((await probe(page)).fetches, [], 'Unlock alone stays silent.');
      await page.click('.hero-nav a[href="/work"]');
      await page.waitForFunction(() => location.pathname !== '/' && !document.getElementById('selected-work'), null, { timeout: 20000 });
      await page.goBack();
      await page.waitForFunction(() => location.pathname === '/' && Boolean(document.getElementById('selected-work')), null, { timeout: 20000 });
      await page.evaluate(() => document.getElementById('selected-work').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await activeLoop(page);
      const state = await probe(page);
      assert.deepEqual(state.fetches, [LOOP_333], 'The re-created WORKS section still starts stage B.');
      assert.equal(state.sources.filter(source => source.loop).length, 1, 'One loop voice.');
    },
  });

  await scenario('stored mute suppresses the WORKS visibility stage', {
    async setup(context) {
      await context.addInitScript(() => {
        try { localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .6 })); } catch { /* ignore */ }
      });
    },
    async run(page) {
      await page.evaluate(() => document.getElementById('selected-work').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForTimeout(700);
      const state = await probe(page);
      assert.equal(state.snapshot.muted, true);
      assert.equal(state.contexts, 0, 'Muted stages do not even need an AudioContext.');
      assert.deepEqual(state.fetches, [], 'No stage may fetch while muted.');
      assert.equal(state.snapshot.world, null);
    },
  });

  const results = { checkedAt: new Date().toISOString(), base, reports, failures };
  await writeFile(new URL('results.json', output), JSON.stringify(results, null, 2));
  console.log(`PASS guided listening: ${reports.length} scenarios, 0 failures.`);
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
