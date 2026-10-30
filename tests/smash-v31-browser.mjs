import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../artifacts/v31-smash/', import.meta.url);
const expectedHash = '307f48dcb643ed1c0c8d8ef39d4ef3dcbeefa1f42286cdae5c81d965db268e1b';
const widths = (process.env.H4_SMASH_WIDTHS || '1440,390,320').split(',').map(Number);
const completeNaturalEnd = process.env.H4_SMASH_NATURAL_END === '1';
await mkdir(output, { recursive: true });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), completeNaturalEnd, reports, failures }, null, 2));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function activate(page, mobile) {
  const target = page.locator('[data-smash]');
  if (mobile) await target.tap(); else await target.click();
}
async function mode(page, next) {
  await page.evaluate(() => document.activeElement?.blur());
  if (next === 'xray') {
    await page.keyboard.down('4');
    await page.waitForTimeout(1100);
    await page.keyboard.up('4');
  } else for (let index = 0; index < 3; index++) await page.keyboard.press('3');
  await page.waitForFunction(value => document.documentElement.dataset.mode === value
    && !document.documentElement.hasAttribute('data-mode-snapshot')
    && !document.documentElement.hasAttribute('data-xray-transition'), next, { timeout: 30000 });
}
async function indexRoute(page, name) {
  const menu = page.locator('[data-global-index]');
  if (!await menu.evaluate(el => el.open)) await menu.locator('summary').click();
  await menu.locator(`[data-index-page="${name}"]`).click();
  await page.waitForFunction(value => document.documentElement.dataset.page === value, name);
}
async function trackState(page, index = -1) {
  return page.evaluate(index => {
    const tracks = window.__smashProbe.sources.filter(source => source.duration > 90);
    const track = index < 0 ? tracks.at(-1) : tracks[index];
    return track ? { duration: track.duration, when: track.when, offset: track.offset, startedAt: track.startedAt,
      now: track.node.context.currentTime, gain: track.output?.gain.value, gainEvents: track.output?.__events || [],
      stopped: track.stops, ended: track.ended, endedAt: track.endedAt, trackSources: tracks.length,
      fetched: window.__smashProbe.fetches, decoded: window.__smashProbe.decodes,
      master: window.__smashProbe.contexts[0]?.__gains[0]?.gain.value,
      cueBus: window.__smashProbe.contexts[0]?.__gains[1]?.gain.value,
      contexts: window.__smashProbe.contexts.length } : null;
  }, index);
}

try {
  for (const width of widths) {
    console.log(`START actual SMASH ${width}px${completeNaturalEnd && width === widths[0] ? ' including full natural end' : ''}`);
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'no-preference' });
    const page = await context.newPage(), errors = [], requests = [], responses = [];
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (/\/audio\/.*\.mp3(?:$|[?#])/.test(request.url())) requests.push(request.url()); });
    page.on('response', response => { if (/\/audio\/.*\.mp3(?:$|[?#])/.test(response.url())) responses.push(response); });
    await page.addInitScript(() => {
      window.__smashProbe = { contexts: [], sources: [], fetches: 0, decodes: 0 };
      const fetch = window.fetch.bind(window);
      window.fetch = function (url, ...rest) {
        if (String(url).includes('h4ngelic_v8_full_sound_remaster_v11.mp3')) window.__smashProbe.fetches++;
        return fetch(url, ...rest);
      };
      const Native = window.AudioContext || window.webkitAudioContext;
      window.AudioContext = class extends Native {
        constructor(options) { super(options); this.__gains = []; window.__smashProbe.contexts.push(this); }
        decodeAudioData(...args) { window.__smashProbe.decodes++; return super.decodeAudioData(...args); }
        createGain() {
          const gain = super.createGain();
          this.__gains ||= [];
          this.__gains.push(gain);
          gain.__events = [];
          for (const key of ['setValueAtTime', 'linearRampToValueAtTime', 'cancelAndHoldAtTime', 'cancelScheduledValues']) {
            if (typeof gain.gain[key] !== 'function') continue;
            const native = gain.gain[key].bind(gain.gain);
            gain.gain[key] = function (...args) { gain.__events.push([key, ...args]); return native(...args); };
          }
          return gain;
        }
        createBufferSource() {
          const source = super.createBufferSource(), start = source.start.bind(source), stop = source.stop.bind(source), connect = source.connect.bind(source);
          let record;
          source.connect = function (target, ...args) { source.__output = target; return connect(target, ...args); };
          source.start = function (when = 0, offset = 0, ...args) {
            record = { node: source, output: source.__output, duration: source.buffer.duration, when, offset,
              startedAt: performance.now(), stops: [], ended: false };
            window.__smashProbe.sources.push(record);
            return start(when, offset, ...args);
          };
          source.stop = function (when = 0) { record?.stops.push({ when, now: source.context.currentTime }); return stop(when); };
          source.addEventListener('ended', () => { if (record) { record.ended = true; record.endedAt = performance.now(); } });
          return source;
        }
      };
    });
    try {
      await page.goto(new URL('/work', base).href, { waitUntil: 'networkidle' });
      await page.locator('[data-smash]').waitFor();
      assert.equal(await page.locator('[data-smash]').isDisabled(), false);
      assert.deepEqual(requests, [], 'The approved MP3 must not preload during page load.');
      assert.equal(await page.evaluate(() => window.__smashProbe.contexts.length), 0, 'No AudioContext is allocated just for rendering the footer.');
      await activate(page, width < 600);
      await page.waitForFunction(() => window.__smashProbe.sources.some(source => source.duration > 90));
      const initial = await trackState(page);
      assert.ok(initial.duration > 99 && initial.duration < 102, 'The actual supplied100-second V11 must be decoded without a shortened fixture.');
      assert.equal(initial.offset, 0);
      assert.equal(initial.contexts, 1);
      assert.equal(initial.fetched, 1); assert.equal(initial.decoded, 1);
      const envelope = initial.gainEvents;
      const attack = envelope.find(event => event[0] === 'linearRampToValueAtTime' && event[1] === 1);
      const tailStart = envelope.find(event => event[0] === 'setValueAtTime' && event[1] === 1);
      const tailEnd = envelope.find(event => event[0] === 'linearRampToValueAtTime' && event[1] === 0);
      assert.ok(Math.abs(attack[2] - initial.when - 1.8) < .002);
      assert.ok(Math.abs(tailEnd[2] - tailStart[2] - 5) < .002);
      assert.ok(Math.abs(tailEnd[2] - initial.when - initial.duration) < .002, 'The native gain automation reaches zero at the real file end.');
      await page.waitForTimeout(800);
      const duringAttack = await trackState(page);
      assert.ok(duringAttack.gain > 0 && duringAttack.gain < 1, 'Live attack gain must rise gradually.');
      await page.waitForTimeout(1200);
      const afterAttack = await trackState(page);
      assert.ok(afterAttack.gain > .98, 'The attack reaches its intended level after1.8seconds.');
      const served = await responses[0].body();
      assert.equal(createHash('sha256').update(served).digest('hex'), expectedHash, 'The server delivers the exact approved bytes.');
      assert.equal(served.byteLength, 3210973);
      await mode(page, 'xray');
      await mode(page, 'normal');
      const afterModes = await trackState(page);
      assert.equal(afterModes.trackSources, 1);
      assert.equal(afterModes.stopped.length, 0, 'Both reality switches leave the actual track source uninterrupted.');
      assert.equal(afterModes.ended, false);
      await indexRoute(page, 'about');
      const afterRoute = await trackState(page);
      assert.equal(afterRoute.trackSources, 1);
      assert.equal(afterRoute.stopped.length, 0, 'The central track survives a real internal page change.');
      await page.locator('[data-floating-brand]').click();
      await page.waitForFunction(() => document.documentElement.dataset.page === 'home' && scrollY < 2);
      const mute = page.locator('[data-mode-mute]');
      await mute.click();
      await page.waitForFunction(() => window.__smashProbe.contexts[0].__gains[0].gain.value < .001);
      assert.equal((await trackState(page)).ended, false);
      await page.locator('[data-sound-volume-toggle]').click();
      const slider = page.locator('[data-sound-volume]');
      await slider.focus(); await slider.press('Home');
      for (let index = 0; index < 5; index++) await slider.press('ArrowRight');
      await slider.press('Escape');
      await mute.click();
      await page.waitForFunction(() => Math.abs(window.__smashProbe.contexts[0].__gains[0].gain.value - .025) < .002);
      assert.equal((await trackState(page)).ended, false, 'Global mute and volume changes do not restart or stop track time.');
      await indexRoute(page, 'work');
      await activate(page, width < 600);
      const stopping = await trackState(page, 0);
      assert.equal(stopping.stopped.length, 1);
      assert.ok(stopping.stopped[0].when - stopping.stopped[0].now > .9 && stopping.stopped[0].when - stopping.stopped[0].now < 1.1);
      assert.equal(stopping.ended, false, 'Manual stop starts a real short fade rather than stopping immediately.');
      await page.waitForFunction(() => window.__smashProbe.sources.find(source => source.duration > 90)?.ended);
      await page.waitForFunction(() => document.querySelector('[data-smash]')?.getAttribute('aria-pressed') === 'false');
      await activate(page, width < 600);
      await page.waitForFunction(() => window.__smashProbe.sources.filter(source => source.duration > 90).length === 2);
      const restarted = await trackState(page);
      assert.equal(restarted.offset, 0); assert.equal(restarted.fetched, 1); assert.equal(restarted.decoded, 1);
      assert.equal(requests.length, 1, 'A second activation uses the cached approved track without another HTTP request.');
      let natural = null;
      if (completeNaturalEnd && width === widths[0]) {
        console.log(`WAIT actual SMASH natural end: ${restarted.duration.toFixed(3)}s, no seeking or substituted buffer`);
        while (true) {
          const state = await trackState(page), remaining = state.when + state.duration - state.now;
          if (remaining <= 5.4) break;
          await page.waitForTimeout(Math.min(20000, Math.max(100, (remaining - 5.4) * 1000)));
          console.log(`SMASH natural progress: ${Math.round((await trackState(page)).now - restarted.when)}s`);
        }
        await page.waitForFunction(() => { const source = window.__smashProbe.sources.filter(source => source.duration > 90).at(-1); return source.node.context.currentTime > source.when + source.duration - 4; });
        const tailFour = await trackState(page);
        assert.ok(tailFour.gain > .6 && tailFour.gain < .85, 'The actual final five-second tail is fading before the track ends.');
        await page.waitForFunction(() => { const source = window.__smashProbe.sources.filter(source => source.duration > 90).at(-1); return source.node.context.currentTime > source.when + source.duration - .6; });
        const tailLast = await trackState(page);
        assert.ok(tailLast.gain < .15 && tailLast.gain >= 0);
        await page.waitForFunction(() => window.__smashProbe.sources.filter(source => source.duration > 90).at(-1)?.ended, null, { timeout: 5000 });
        await page.waitForFunction(() => document.querySelector('[data-smash]')?.getAttribute('aria-pressed') === 'false');
        await page.waitForTimeout(120);
        const ended = await trackState(page);
        assert.ok(ended.cueBus > .98, 'Natural completion smoothly restores the ordinary cue bus.');
        assert.equal(ended.stopped.length, 0, 'The complete natural-end observation never seeks or manually stops the original track.');
        natural = { tailFour, tailLast, ended, observedMs: ended.endedAt - ended.startedAt };
        await mode(page, 'xray');
        assert.ok(await page.evaluate(() => window.__smashProbe.sources.some(source => source.duration < 1)), 'A real post-track mode change resumes the existing site cue.');
      } else {
        await activate(page, width < 600);
        await page.waitForFunction(() => window.__smashProbe.sources.filter(source => source.duration > 90).at(-1)?.ended);
      }
      const pageBounds = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.ok(pageBounds.scrollWidth <= pageBounds.width + 1, 'Actual soundtrack interaction and mode navigation cannot create horizontal page overflow.');
      assert.deepEqual(errors, []);
      reports.push({ width, originalBytes: served.byteLength, originalSHA256: expectedHash, initial, duringAttack, afterAttack,
        afterModes, afterRoute, stopping, restarted, natural, requests, pageBounds, errors });
      await save();
      console.log(`PASS actual SMASH ${width}px: exactfile, deferredfetch/cache, nativeattack/tail/stop, globalstate, routes and both realities${natural ? ', complete real natural end' : ''}`);
    } catch (error) {
      failures.push({ width, url: page.url(), error: error.stack, requests, errors });
      await save();
      throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
