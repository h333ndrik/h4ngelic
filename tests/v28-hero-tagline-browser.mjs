import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_HERO_TAGLINE_ARTIFACTS || 'artifacts/v312/V28'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
try {
  for (const profile of profiles) {
    console.log(`CHECK V28 hero tagline ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 }, deviceScaleFactor: 1,
      isMobile: profile.width < 600, hasTouch: profile.width < 600, reducedMotion: profile.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); const errors = [];
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      window.__v28 = { cls: 0 };
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__v28.cls += entry.value; })
        .observe({ type: 'layout-shift', buffered: true });
    });
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.locator('.hero').waitFor();
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.identity').count(), 0, 'No tagline element exists.');
      assert.doesNotMatch((await page.locator('.hero').innerText()).replace(/\s+/g, ' '), /mixed media/i, 'No tagline text is visible in the hero.');
      const layout = await page.evaluate(() => {
        const hero = document.querySelector('.hero').getBoundingClientRect();
        const stage = document.querySelector('.stage').getBoundingClientRect();
        const hint = document.querySelector('#interaction-hint');
        const visible = [...document.querySelectorAll('.hero-bottom *')].filter(element => {
          const s = getComputedStyle(element); const box = element.getBoundingClientRect();
          return s.visibility !== 'hidden' && s.display !== 'none' && box.width > 1 && box.height > 1 && element.textContent.trim();
        }).map(element => element.textContent.trim());
        return { hero: { width: hero.width, height: hero.height }, stage: { width: stage.width, height: stage.height },
          stageFillsHero: Math.abs(stage.width - hero.width) < 1.5 && Math.abs(stage.height - hero.height) < 1.5,
          hintSrOnly: hint.classList.contains('sr-only'), visibleBelowLogo: visible,
          pageWidth: document.documentElement.scrollWidth, width: innerWidth };
      });
      assert.ok(layout.stageFillsHero, 'The hero stage keeps the full clean stage area.');
      assert.equal(layout.visibleBelowLogo.length, 0, 'No visible tagline copy remains below the logo.');
      assert.equal(layout.hintSrOnly, true);
      assert.ok(layout.pageWidth <= layout.width + 1, 'The clean hero does not introduce horizontal overflow.');
      const cls = await page.evaluate(() => window.__v28.cls);
      assert.ok(cls < .02, `No layout-shift regression from removing the tagline: ${cls}`);
      const stage = await page.locator('#stage').evaluate(element => ({ poster: element.classList.contains('is-poster-static'), canvas: getComputedStyle(element.querySelector('#logo-canvas')).display }));
      if (profile.reduced) { assert.equal(stage.poster, true); assert.equal(stage.canvas, 'none'); }
      assert.deepEqual(errors, []);
      await page.screenshot({ path: new URL(`hero-${profile.width}-${profile.reduced}.png`, output).pathname });
      reports.push({ ...profile, layout, cls, stage, errors }); await save();
      console.log(`PASS V28 ${profile.width}px reduced=${profile.reduced}: no tagline element or copy, clean full-stage hero, no overflow and CLS ${cls.toFixed(4)}.`);
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors }); await save();
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
