import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const output = new URL('../artifacts/world-sound/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const isAudio = url => /\/assets\/audio\/(?:loop-(?:333|4)|x-(?:333-4|4-333))\.m4a(?:$|[?#])/.test(url);

async function installProbe(context) {
  await context.addInitScript(() => {
    window.__worldProbe = { contexts: 0, resumes: 0, suspends: 0, sources: [], fetches: [], errors: [] };
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (url, ...args) {
      const value = String(url?.url || url);
      if (/\/assets\/audio\/(?:loop-(?:333|4)|x-(?:333-4|4-333))\.m4a(?:$|[?#])/.test(value)) window.__worldProbe.fetches.push(value);
      return nativeFetch(url, ...args);
    };
    const Native = window.AudioContext || window.webkitAudioContext;
    if (!Native) return;
    window.AudioContext = class extends Native {
      constructor(options) { super(options); window.__worldProbe.contexts++; }
      resume() { window.__worldProbe.resumes++; return super.resume(); }
      suspend() { window.__worldProbe.suspends++; return super.suspend(); }
      createBufferSource() {
        const source = super.createBufferSource(), start = source.start.bind(source);
        const record = { loop: false, duration: 0, when: 0, offset: 0, stops: [], startedAt: 0 };
        source.__worldRecord = record;
        source.start = function (when = 0, offset = 0, ...rest) {
          record.loop = source.loop;
          record.duration = source.buffer?.duration || 0;
          record.when = when; record.offset = offset; record.startedAt = performance.now();
          window.__worldProbe.sources.push(record);
          return start(when, offset, ...rest);
        };
        const stop = source.stop.bind(source);
        source.stop = function (when = 0) { record.stops.push({ when, at: performance.now() }); return stop(when); };
        return source;
      }
    };
  });
}

async function waitMode(page, expected) {
  await page.waitForFunction(value => document.documentElement.dataset.mode === value
    && !document.documentElement.hasAttribute('data-xray-transition')
    && !document.documentElement.hasAttribute('data-mode-snapshot'), expected, { timeout: 20000 });
}
async function enterMode(page) {
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.down('4');
  try { await waitMode(page, 'xray'); } finally { await page.keyboard.up('4'); }
}
async function returnMode(page) {
  for (let index = 0; index < 3; index++) await page.keyboard.press('3');
  await waitMode(page, 'normal');
}
const audioSnapshot = page => page.evaluate(() => window.__H4_AUDIO__.snapshot());

try {
  const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })));
  for (const { width, reduced } of profiles) {
    console.log(`CHECK world sound ${width}px reduced=${reduced}`);
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await installProbe(context);
    const page = await context.newPage(), errors = [], requests = [], responses = [];
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (isAudio(request.url())) requests.push(request.url()); });
    page.on('response', response => { if (isAudio(response.url())) responses.push({ url: response.url(), status: response.status() }); });
    try {
      await page.goto(new URL('/work/tattoos?test=1', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => Boolean(window.__H4_AUDIO__));
      await page.waitForTimeout(250);
      let probe = await page.evaluate(() => window.__worldProbe);
      assert.equal(probe.contexts, 0, 'Page load must allocate no AudioContext.');
      assert.deepEqual(requests, [], 'No world asset may be requested before the first user gesture.');
      assert.deepEqual(probe.fetches, [], 'The world engine must not fetch bytes before the first user gesture.');
      assert.equal((await audioSnapshot(page)).world, null, 'The world engine must remain uninitialized before a gesture.');

      await page.mouse.click(5, Math.min(500, width < 600 ? 800 : 900));
      await page.waitForFunction(() => window.__worldProbe.contexts === 1
        && window.__H4_AUDIO__.snapshot().world?.loops['333'].status === 'ready'
        && window.__H4_AUDIO__.snapshot().world?.loops['333'].active, null, { timeout: 30000 });
      let state = await audioSnapshot(page);
      assert.equal(state.state, 'running');
      assert.equal(state.world.currentWorld, '333');
      probe = await page.evaluate(() => window.__worldProbe);
      assert.ok(probe.fetches.some(url => url.endsWith('loop-333.m4a')), 'The first gesture fetches the active world loop.');
      const initialTransport = state.world.transportStart;
      const firstLoop = probe.sources.find(source => source.loop);
      assert.ok(firstLoop && firstLoop.duration > 30 && firstLoop.duration < 32, 'The real 16-bar M4A is decoded into the loop source.');
      assert.equal(firstLoop.offset, 0);
      assert.equal(state.world.assets['loops:333'].path, '/assets/audio/loop-333.m4a');
      assert.equal(probe.fetches.filter(url => url.endsWith('loop-333.m4a')).length, 1, 'The active loop is fetched once.');

      await enterMode(page);
      await page.waitForFunction(() => window.__H4_AUDIO__.snapshot().world?.currentWorld === '4');
      state = await audioSnapshot(page);
      assert.equal(state.world.transportStart, initialTransport, 'A mode change never restarts the shared transport.');
      assert.ok(Math.abs(state.world.crossfade.durationSeconds - .9) < 1e-9, 'The audio fade reads the live 900 ms visual transition config.');
      await page.waitForFunction(() => window.__worldProbe.sources.some(source => !source.loop && Math.abs(source.duration - 1.4) < .02)
        && window.__H4_AUDIO__.snapshot().world?.loops['4'].status === 'ready', null, { timeout: 30000 });
      await page.waitForFunction(() => window.__H4_AUDIO__.snapshot().world?.loops['333'].active === false, null, { timeout: 6000 });
      probe = await page.evaluate(() => window.__worldProbe);
      assert.ok(probe.fetches.some(url => url.endsWith('loop-4.m4a')));
      assert.ok(probe.fetches.some(url => url.endsWith('x-333-4.m4a')));
      assert.equal(probe.fetches.filter(url => url.endsWith('loop-4.m4a')).length, 1, 'The incoming loop is fetched once.');
      const outgoingLoop = probe.sources.find(source => source.loop && source.offset === 0);
      assert.ok(outgoingLoop?.stops.length > 0, 'The inactive loop source is explicitly stopped after the fade.');
      assert.equal(Object.values((await audioSnapshot(page)).world.loops).filter(loop => loop.active).length, 1,
        'Exactly one world loop remains active.');
      assert.equal((await audioSnapshot(page)).state, 'running');

      await returnMode(page);
      await page.waitForFunction(() => window.__H4_AUDIO__.snapshot().world?.currentWorld === '333'
        && window.__H4_AUDIO__.snapshot().world?.loops['4'].active === false, null, { timeout: 6000 });
      state = await audioSnapshot(page);
      assert.equal(state.world.transportStart, initialTransport);
      probe = await page.evaluate(() => window.__worldProbe);
      assert.ok(probe.fetches.some(url => url.endsWith('x-4-333.m4a')));
      const transitions = probe.sources.filter(source => !source.loop && Math.abs(source.duration - 1.4) < .02);
      assert.ok(transitions.length >= 2, 'Both direction-specific transition one-shots have been played.');
      assert.ok(transitions.every(source => source.stops.length === 0), 'Normal direction changes never truncate or early-fade the full one-shots.');
      assert.ok(state.world.transitionVoices <= 2);

      // Exercise the retargetable audio state machine directly while the visual
      // controller remains on its existing non-interruptible snapshot path.
      await page.evaluate(() => { void window.__H4_AUDIO__.switchMode('xray', 900); });
      await page.waitForTimeout(160);
      await page.evaluate(() => { void window.__H4_AUDIO__.switchMode('normal', 900); });
      await page.waitForFunction(() => window.__H4_AUDIO__.snapshot().world?.currentWorld === '333'
        && window.__H4_AUDIO__.snapshot().world?.crossfade?.from === '4', null, { timeout: 5000 });
      state = await audioSnapshot(page);
      assert.equal(state.world.transportStart, initialTransport, 'Mid-crossfade reversal keeps the same transport clock.');
      assert.ok(state.world.crossfade.durationSeconds > .89);
      assert.ok(state.world.transitionVoices <= 2, 'One-shot voices stay capped.');
      assert.equal((await page.evaluate(() => window.__worldProbe.contexts)), 1, 'Every transition shares one AudioContext.');
      assert.equal(errors.length, 0, 'The normal sound loop and both transitions produce no console errors.');

      if (width === 1440 && !reduced) {
        await page.locator('[data-floating-brand]').click();
        await page.waitForFunction(() => location.pathname === '/' && document.documentElement.dataset.page === 'home');
        const mute = page.locator('[data-controls] [data-mode-mute]');
        await mute.click();
        await page.waitForFunction(() => window.__H4_AUDIO__.snapshot().state === 'suspended');
        state = await audioSnapshot(page);
        assert.equal(state.muted, true);
        assert.equal(state.state, 'suspended', 'Sound off suspends the AudioContext for zero active rendering.');
        await mute.click();
        await page.waitForFunction(() => window.__H4_AUDIO__.snapshot().state === 'running');
        assert.equal((await audioSnapshot(page)).muted, false);

        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForFunction(() => window.__H4_AUDIO__.snapshot().state === 'suspended');
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForFunction(() => window.__H4_AUDIO__.snapshot().state === 'running');

        const smash = page.locator('[data-smash]');
        await smash.scrollIntoViewIfNeeded();
        await smash.click();
        await page.waitForFunction(() => window.__H4_AUDIO__.snapshot().smashPlaying);
        await page.waitForFunction(() => window.__H4_AUDIO__.snapshot().world.duck < .3);
        assert.ok((await audioSnapshot(page)).world.duck <= .21, 'SMASH ducks the complete world bus.');
        await smash.click();
        await page.waitForFunction(() => !window.__H4_AUDIO__.snapshot().smashPlaying, null, { timeout: 6000 });
        await page.waitForFunction(() => window.__H4_AUDIO__.snapshot().world.duck > .95);
        assert.equal((await page.evaluate(() => window.__worldProbe.contexts)), 1, 'Mute, visibility and SMASH never duplicate the controller.');
      }

      const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
      assert.equal(overflow, 0);
      assert.equal(errors.length, 0);
      await page.screenshot({ path: new URL(`${width}-${reduced}.png`, output).pathname });
      const finalProbe = await page.evaluate(() => window.__worldProbe);
      reports.push({ width, reduced, requests, responses, fetches: finalProbe.fetches, sources: finalProbe.sources, final: await audioSnapshot(page), errors, overflow });
      await save();
      console.log(`PASS world sound ${width}px reduced=${reduced}: lazy load, locked transport, 900ms crossfade, both transitions, mono controller.`);
    } catch (error) {
      failures.push({ width, reduced, url: page.url(), error: error.stack, errors, requests });
      await save();
      throw error;
    } finally { await context.close(); }
  }

  // Isolated degraded path: the target loop and its transition decode as
  // unavailable. The outgoing loop fades out and no substitute sound is made.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await installProbe(context);
    await context.route('**/assets/audio/loop-4.m4a', route => route.fulfill({ status: 200, contentType: 'audio/mp4', body: 'not an m4a' }));
    await context.route('**/assets/audio/x-333-4.m4a', route => route.fulfill({ status: 200, contentType: 'audio/mp4', body: 'not an m4a' }));
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(new URL('/work/tattoos?test=1', base).href, { waitUntil: 'networkidle' });
    await page.mouse.click(5, 500);
    await page.waitForFunction(() => window.__H4_AUDIO__?.snapshot().world?.loops['333'].active);
    await enterMode(page);
    await page.waitForFunction(() => window.__H4_AUDIO__.snapshot().world?.loops['4'].status === 'missing');
    const final = await audioSnapshot(page);
    assert.equal(final.world.currentWorld, '4');
    assert.equal(final.world.loops['4'].active, false);
    assert.ok(final.world.blockedAssets.includes('loops:4'));
    assert.ok(final.world.blockedAssets.includes('transitions:333>4'));
    assert.deepEqual(pageErrors, [], 'Missing/decode-failed world assets do not throw into the mode UI.');
    await page.screenshot({ path: new URL('missing-1440.png', output).pathname });
    reports.push({ degraded: true, final, pageErrors });
    await save();
    await context.close();
    console.log('PASS world sound missing-file degradation: no substitute audio, visual mode remains usable.');
  }
} finally {
  await save();
  await browser.close();
}
