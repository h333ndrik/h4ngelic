import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_PERFORMANCE_ARTIFACTS || 'artifacts/v312/V17'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
try {
  for (const profile of profiles) {
    console.log(`CHECK V17 performance ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 }, deviceScaleFactor: 1,
      isMobile: profile.width < 600, hasTouch: profile.width < 600, reducedMotion: profile.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); const errors = [];
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      window.__v17 = { idleRuns: [], longTasks: [], lcp: 0, fcp: 0, paints: [] };
      const idle = window.requestIdleCallback;
      if (idle) window.requestIdleCallback = (callback, options) => idle.call(window, (deadline) => {
        window.__v17.idleRuns.push(performance.now());
        callback(deadline);
      }, options);
      new PerformanceObserver(list => window.__v17.longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration }))))
        .observe({ type: 'longtask', buffered: true });
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          window.__v17.paints.push({ name: entry.name, start: entry.startTime });
          if (entry.name === 'first-contentful-paint') window.__v17.fcp = entry.startTime;
        }
      }).observe({ type: 'paint', buffered: true });
      new PerformanceObserver(list => { const entries = list.getEntries(); if (entries.length) window.__v17.lcp = entries.at(-1).startTime; })
        .observe({ type: 'largest-contentful-paint', buffered: true });
    });
    try {
      await page.goto(new URL('/?test', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true', null, { timeout: 10000 });
      await page.waitForFunction(() => document.querySelector('#stage.is-ready, #stage.is-poster-static'), null, { timeout: 60000 });
      const metrics = await page.evaluate(() => ({
        ...window.__v17,
        navigation: performance.getEntriesByType('navigation')[0] ? (({ domContentLoadedEventEnd, loadEventEnd }) => ({ domContentLoadedEventEnd, loadEventEnd }))(performance.getEntriesByType('navigation')[0]) : null,
      }));
      assert.ok(metrics.fcp > 0, 'A first-contentful paint was measured.');
      assert.ok(metrics.idleRuns.some(time => time >= metrics.fcp), `Easter-egg work starts in idle after first paint: ${JSON.stringify(metrics.idleRuns)} / FCP ${metrics.fcp}`);
      assert.equal(await page.locator('script[type="speculationrules"]').count(), 1);
      const rules = JSON.parse(await page.locator('script[type="speculationrules"]').textContent());
      assert.equal(rules.prefetch.length, 2);
      assert.ok(rules.prefetch.every(rule => rule.eagerness === 'moderate'));
      const visibility = await page.locator('.about-preview, .contact-section').evaluateAll(nodes => nodes.map(node => ({
        visibility: getComputedStyle(node).contentVisibility, intrinsic: getComputedStyle(node).containIntrinsicSize })));
      assert.ok(visibility.every(item => item.visibility === 'auto' && item.intrinsic !== 'none'), 'Below-fold sections defer rendering.');
      const full = !profile.reduced;
      let initial = null, prepared = null, during = null;
      if (full) {
        initial = await page.evaluate(() => window.__H4_TEST__.snapshot());
        assert.equal(initial.substeps, 120);
        await page.keyboard.down('4');
        await page.waitForFunction(() => window.__H4_TEST__.snapshot().xrayPrepared === true, null, { timeout: 15000 });
        prepared = await page.evaluate(() => window.__H4_TEST__.snapshot());
        assert.equal(prepared.xrayPrepared, true, 'The target shader is warmed while 4 is held.');
        await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray', null, { timeout: 15000 });
        during = await page.evaluate(() => window.__H4_TEST__.snapshot());
        await page.keyboard.up('4');
        assert.equal(during.modeTransitioning, true);
        assert.equal(during.substeps, 30);
        assert.equal(during.pixelRatio, 1);
        await page.waitForTimeout(1700);
        const after = await page.evaluate(() => window.__H4_TEST__.snapshot());
        assert.equal(after.modeTransitioning, false);
        assert.equal(after.substeps, 120);
        assert.equal(after.pixelRatio, initial.pixelRatio);
      } else {
        assert.equal(await page.locator('#stage.is-poster-static').count(), 1, 'Reduced motion keeps the static poster without WebGL.');
        assert.equal(await page.locator('#logo-canvas').isVisible(), false);
      }
      await page.goto(new URL('/creative/onskin', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('[data-horizontal-drift="tattoos"]')?.dataset.carouselPreload === 'idle', null, { timeout: 5000 });
      const carousel = await page.locator('[data-horizontal-drift="tattoos"]').evaluate(section => ({ preload: section.dataset.carouselPreload, images: section.querySelectorAll('.drift-track img').length,
        contentVisibility: getComputedStyle(section.closest('.archive-category')).contentVisibility }));
      assert.equal(carousel.preload, 'idle');
      assert.equal(carousel.contentVisibility, 'auto');
      assert.equal(carousel.images, 8);
      await page.goto(new URL('/#contact', base).href, { waitUntil: 'networkidle' });
      const form = page.locator('[data-inquiry-form]');
      await form.waitFor();
      const draftKey = 'h4ngelic.inquiry.draft.v1';
      await page.locator('[name="name"]').fill('draft visitor');
      await page.locator('[name="email"]').fill('draft@example.com');
      await page.locator('[name="message"]').fill('a saved draft');
      await page.waitForTimeout(2300);
      const draft = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), draftKey);
      assert.equal(draft?.message, 'a saved draft');
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('[name="name"]').waitFor();
      assert.equal(await page.locator('[name="name"]').inputValue(), 'draft visitor');
      assert.equal(await page.locator('[name="email"]').inputValue(), 'draft@example.com');
      assert.equal(await page.locator('[name="message"]').inputValue(), 'a saved draft');
      await page.route('**/api/inquiry', route => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ accepted: true, id: 'v17-local' }) }));
      await page.locator('[data-inquiry-submit]').click();
      await page.waitForFunction(() => document.querySelector('[data-inquiry-status]')?.dataset.state === 'success');
      assert.equal(await page.evaluate(key => localStorage.getItem(key), draftKey), null, 'A successful submit clears the local draft.');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: new URL(`home-${profile.width}-${profile.reduced}.png`, output).pathname });
      reports.push({ ...profile, metrics, initial, prepared, during, carousel, draft, errors }); await save();
      console.log(`PASS V17 ${profile.width}px reduced=${profile.reduced}: idle easter-egg start after FCP, speculation rules, content visibility, shader prewarm, transition quality (${full ? '1x/30Hz' : 'reduced'}), draft restore/clear and idle carousel warmup. LCP ${metrics.lcp.toFixed(1)}ms, long tasks ${metrics.longTasks.length}.`);
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors }); await save();
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
