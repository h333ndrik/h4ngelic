import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../artifacts/v312/F20/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const reports = [], failures = [];
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
try {
  for (const profile of profiles) {
    console.log(`CHECK F20 hero ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 }, deviceScaleFactor: 1,
      isMobile: profile.width < 600, hasTouch: profile.width < 600, reducedMotion: profile.reduced ? 'reduce' : 'no-preference' });
    await context.addInitScript(() => {
      localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .2 }));
      window.__f20Shifts = [];
      window.__f20Lcp = 0;
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__f20Shifts.push(entry.value); })
        .observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__f20Lcp = Math.max(window.__f20Lcp, entry.startTime); })
        .observe({ type: 'largest-contentful-paint', buffered: true });
    });
    let page, requests = [], errors = [];
    try {
    const warm = await context.newPage();
    await warm.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
    await warm.close();
    const paintSamples = [];
    let first;
    for (let run = 0; run < 3; run++) {
      page = await context.newPage();
      page.setDefaultTimeout(60000);
      const runRequests = [], runErrors = [];
      page.on('request', request => runRequests.push({ url: request.url(), at: Date.now() }));
      page.on('pageerror', error => runErrors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') runErrors.push(message.text()); });
      await page.goto(new URL('/?test=1', base).href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => performance.getEntriesByType('paint').some(entry => entry.name === 'first-contentful-paint'));
      first = await page.evaluate(() => {
        const poster = document.querySelector('[data-hero-poster]'), paint = performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint');
        return { poster: Boolean(poster), opacity: Number(getComputedStyle(poster).opacity), background: getComputedStyle(poster).backgroundImage,
          fcp: paint?.startTime ?? performance.now(), preloads: [...document.head.querySelectorAll('[data-hero-preload]')].map(link => ({ kind: link.dataset.heroPreload,
            rel: link.rel, href: link.href, as: link.as, priority: link.getAttribute('fetchpriority'), media: link.media })) };
      });
      paintSamples.push(first.fcp);
      if (run < 2) await page.close(); else { requests = runRequests; errors = runErrors; }
    }
    first.paintSamples = paintSamples;
    first.fcpMedian = [...paintSamples].sort((a, b) => a - b)[1];
      assert.equal(first.poster, true); assert.ok(first.opacity >= .54, `The boot poster is visible during its breathe cycle: ${first.opacity}`); if (profile.reduced) assert.match(first.background, /wordmark-fallback\.svg/);
      else assert.equal(first.background, 'none', 'The boot surface never paints the 2D wordmark.');
      assert.ok(first.fcpMedian < 100, `The critical poster must paint before 100ms in the warmed median: ${JSON.stringify(paintSamples)}`);
      if (profile.reduced) {
        assert.deepEqual(first.preloads, [], 'Reduced motion activates no WebGL/font/texture preloads.');
        await page.waitForTimeout(250);
        const state = await page.evaluate(() => ({ stage: document.querySelector('#stage').className,
          canvas: getComputedStyle(document.querySelector('#logo-canvas')).display,
          poster: Number(getComputedStyle(document.querySelector('[data-hero-poster]')).opacity), background: getComputedStyle(document.querySelector('[data-hero-poster]')).backgroundImage, lcp: window.__f20Lcp }));
        assert.match(state.stage, /is-poster-static/); assert.equal(state.canvas, 'none'); assert.equal(state.poster, 1);
        assert.match(state.background, /wordmark-fallback\.svg/, 'Reduced motion retains the text poster.');
        assert.ok(state.lcp <= 200, `Reduced-motion Home LCP stays inside the 200ms guard: ${state.lcp}ms`);
        assert.ok(!requests.some(request => /\/src\/main\.js|wordmark\.typeface|tattoo-texture/.test(request.url)));
      } else {
        assert.equal(first.preloads.length, 4, 'Home activates module, font and both responsive artwork preloads.');
        assert.ok(first.preloads.some(link => link.kind === 'module' && /\/src\/main\.js|\/main-(?:[A-Za-z0-9_-]+)\.js/.test(link.href)));
        assert.ok(first.preloads.some(link => link.kind === 'font' && /wordmark\.typeface\.json/.test(link.href) && link.as === 'fetch'));
        assert.ok(first.preloads.filter(link => link.kind.startsWith('artwork')).every(link => link.priority === 'high'));
        const textureRequests = requests.filter(request => /tattoo-texture(?:-640)?\.webp/.test(request.url));
        assert.equal(textureRequests.length, 1, `Exactly one matching tattoo texture is requested: ${JSON.stringify(textureRequests)}`);
        await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
        await page.waitForFunction(() => {
          const stage = document.querySelector('#stage');
          return stage?.dataset.artworkReady === 'true' || window.__H4_TEST__?.snapshot().artworkReady;
        }, null, { timeout: 60000 });
        await frames(page);
        const ready = await page.evaluate(() => {
          const stage = document.querySelector('#stage'), snapshot = window.__H4_TEST__?.snapshot();
          return { firstFrameHadArtwork: snapshot?.firstFrameHadArtwork ?? stage.dataset.firstFrameHadArtwork === 'true',
            firstFrameAt: snapshot?.firstFrameAt ?? Number(stage.dataset.firstFrameAt),
            artworkRequestedAt: snapshot?.artworkRequestedAt ?? Number(stage.dataset.artworkRequestedAt),
            artworkReadyAt: snapshot?.artworkReadyAt ?? Number(stage.dataset.artworkReadyAt),
            posterOpacity: Number(getComputedStyle(document.querySelector('[data-hero-poster]')).opacity),
            lcp: window.__f20Lcp,
            cls: window.__f20Shifts.reduce((sum, value) => sum + value, 0) };
        });
        assert.equal(ready.firstFrameHadArtwork, false, 'The first chrome frame renders without the tattoo texture.');
        assert.ok(ready.firstFrameAt > 0 && ready.artworkRequestedAt >= ready.firstFrameAt, 'Texture loading starts only after the first frame.');
        assert.ok(ready.artworkReadyAt > ready.firstFrameAt, 'The texture resolves asynchronously after the first frame.');
        assert.ok(ready.lcp <= 200, `Home LCP stays inside the 200ms guard: ${ready.lcp}ms`);
        assert.ok(ready.cls < .01, `Poster/chrome/texture handoff remains shift-free: ${ready.cls}`);
        await frames(page);
      }
      assert.deepEqual(errors, []);
      await page.screenshot({ path: new URL(`hero-${profile.width}-${profile.reduced ? 'reduced' : 'motion'}.png`, output).pathname });
      reports.push({ ...profile, first, requests: requests.filter(request => /main|wordmark|tattoo-texture/.test(request.url)), errors });
      console.log(`PASS F20 ${profile.width}px reduced=${profile.reduced}: poster FCP median ${first.fcpMedian.toFixed(2)}ms (${paintSamples.map(value => value.toFixed(2)).join('/')}), ${profile.reduced ? 'static no-WebGL path stayed intact' : 'preloads present and texture deferred after frame 1 with CLS 0'}.`);
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors }); throw error;
    } finally { await context.close(); }
  }
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 844 } });
    const requests = []; page.on('request', request => requests.push(request.url()));
    await page.goto(new URL('/creative', base).href, { waitUntil: 'networkidle' });
    assert.ok(!requests.some(url => /wordmark-fallback|\/src\/main\.js|wordmark\.typeface|tattoo-texture/.test(url)), `Cold Work must not preload hero assets: ${JSON.stringify(requests)}`);
    assert.equal(await page.locator('[data-hero-poster]').count(), 0);
    await page.close();
  }
} catch (error) {
  failures.push({ error: error.stack }); throw error;
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), base, reports, failures }, null, 2) + '\n');
  await browser.close();
}
