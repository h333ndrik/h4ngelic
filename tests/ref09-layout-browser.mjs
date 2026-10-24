import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const out = new URL('../artifacts/ref09-phase2/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];

async function geometry(page) {
  return page.evaluate(() => {
    const box = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right,
        centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2, font: parseFloat(style.fontSize) };
    };
    const row = document.querySelector('.footer-identity');
    const counter = document.querySelector('[data-visit-counter-hotspot]');
    const controls = document.querySelector('[data-controls]');
    return {
      row: box(row), counter: box(counter), brand: box(row.querySelector('.footer-brand')), location: box(row.querySelector('.footer-location')),
      counterInRow: counter.parentElement === row,
      greeting: box(document.querySelector('[data-visit-message]')),
      moreAbout: box(document.querySelector('.about-preview .text-link')),
      aboutHeading: box(document.querySelector('.about-preview .kinetic-heading')),
      controls: box(controls), buttons: [...controls.querySelectorAll('button')].map(element => ({ ...box(element),
        border: getComputedStyle(element).borderTopWidth, radius: getComputedStyle(element).borderRadius, padding: getComputedStyle(element).padding })),
      footerSound: document.querySelectorAll('[data-artist-footer] [data-mode-mute]').length,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
}

try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, deviceScaleFactor: 1,
      hasTouch: width < 600, isMobile: width < 600, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
      await page.waitForFunction(() => document.documentElement.hasAttribute('data-xray-ready'));
      const state = await geometry(page);
      assert.equal(state.counterInRow, true, 'The visit counter belongs to the existing identity row.');
      assert.ok(Math.abs(state.counter.centerX - state.row.centerX) < .5, 'The count is mathematically centered, independently of unequal edge labels.');
      assert.ok(state.brand.right + 3 <= state.counter.x && state.counter.right + 3 <= state.location.x, 'All three identity labels have clear, nonoverlapping space.');
      for (const label of [state.brand, state.location]) {
        assert.ok(Math.abs(label.centerY - state.counter.centerY) < .5, 'The three labels share one vertical center.');
        assert.equal(label.font, state.counter.font, 'The identity row uses one typographic size.');
      }
      assert.equal(state.footerSound, 0, 'No old footer sound control remains.');
      assert.equal(state.buttons.length, 4, 'Sound is one of the four existing upper control pills.');
      for (const button of state.buttons) {
        assert.ok(button.x >= 20 && button.right <= width - 20, 'Every upper control stays inside the viewport.');
        assert.ok(button.height >= 44, 'Touch and keyboard hit areas retain their minimum height.');
        assert.ok(Math.abs(button.height - state.buttons[0].height) < .5, 'Sound matches the other control heights.');
        for (const property of ['font', 'border', 'radius', 'padding']) assert.equal(button[property], state.buttons[0][property], `Upper controls share ${property}.`);
      }
      assert.ok(state.moreAbout.font >= 28 && state.moreAbout.font < state.aboutHeading.font, 'MORE ABOUT grows while remaining subordinate to its heading.');
      assert.ok(state.greeting.font >= (width < 600 ? 14 : 16));
      assert.ok(Math.abs(state.greeting.centerX - width / 2) < .6, 'The larger returning message stays centered in its original header position.');
      assert.equal(state.overflow, false);
      const sound = page.locator('[data-controls] [data-mode-mute]');
      assert.equal(await sound.getAttribute('aria-pressed'), 'false');
      await sound.click();
      assert.equal(await sound.getAttribute('aria-pressed'), 'true');
      const count = await page.locator('[data-visit-number]').textContent();
      await page.screenshot({ path: new URL(`hero-${width}.png`, out).pathname });
      await page.locator('.hero-nav a[href="/work"]').click();
      await page.waitForURL(url => url.pathname === '/work');
      assert.equal(await page.locator('[data-mode-mute]:visible').count(), 0, 'Interior pages do not add a duplicate or misplaced sound control.');
      await page.locator('.page-nav a[href="/about"]').click();
      await page.waitForURL(url => url.pathname === '/about');
      assert.equal(await page.locator('[data-mode-mute]:visible').count(), 0);
      await page.locator('.brand-link').click();
      await page.waitForURL(url => url.pathname === '/');
      assert.equal(await page.locator('[data-mode-mute]').count(), 1);
      assert.equal(await sound.getAttribute('aria-pressed'), 'true', 'Mute remains selected after Home/Work/About/Home navigation.');
      assert.equal(await page.locator('[data-visit-number]').textContent(), count, 'Relocation does not alter local visit continuity.');
      const after = await geometry(page);
      assert.ok(Math.abs(after.counter.centerX - after.row.centerX) < .5);
      await page.locator('[data-visit-counter-hotspot]').scrollIntoViewIfNeeded();
      if (width < 600) await page.locator('[data-visit-counter-hotspot]').tap();
      else await page.locator('[data-visit-counter-hotspot]').hover();
      assert.ok(Number(await page.locator('[data-visit-number]').evaluate(el => getComputedStyle(el).opacity)) > .3);
      await page.screenshot({ path: new URL(`footer-${width}.png`, out).pathname });
      assert.deepEqual(errors, []);
      reports.push({ width, centerError: state.counter.centerX - state.row.centerX, buttons: state.buttons.length,
        greetingFont: state.greeting.font, moreAboutFont: state.moreAbout.font, errors: errors.length });
      console.log(`PASS Phase 2 ${width}px: centered identity-row count, matching upper sound control, persistent mute/visits, larger header/About, no overlap/overflow.`);
    } finally { await context.close(); }
  }
  await writeFile(new URL('results.json', out), JSON.stringify({ testedAt: new Date().toISOString(), base, reports }, null, 2) + '\n');
} finally { await browser.close(); }
