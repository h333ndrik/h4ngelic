import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const output = new URL('../artifacts/website-completion/', import.meta.url);
await mkdir(output, { recursive: true });
const reports = [];

async function counterBox(page) {
  return page.locator('[data-chapter-counter]').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
      center: rect.left + rect.width / 2, chapter: element.dataset.chapter,
      total: element.dataset.chapterTotal, next: element.dataset.chapterTarget,
      accessible: !element.hidden && element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true' };
  });
}

try {
  for (const width of [1000, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce',
      hasTouch: width < 600, isMobile: width < 600 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(new URL('/?test=1', base).href, { waitUntil: 'networkidle' });
      const chapter = page.locator('[data-chapter-counter]');
      await chapter.waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelector('[data-chapter-counter]')?.dataset.chapterTotal === '4');
      const index = page.locator('[data-global-index]');
      assert.equal(await index.isVisible(), false, 'Home must contain no visible INDEX.');
      assert.equal(await index.evaluate(element => element.hidden), true, 'Hidden Home INDEX must leave the accessibility tree.');
      assert.equal(await index.locator('summary').evaluate(element => {
        element.focus(); return document.activeElement === element;
      }), false, 'The hidden Home summary must not accept keyboard focus.');
      assert.equal(await page.locator('.masthead .edition').isVisible(), true);
      const home = await counterBox(page);
      assert.ok(Math.abs(home.center - width / 2) < 1);
      for (const expected of ['2', '3', '4']) {
        await chapter.click();
        await page.waitForFunction(expected => document.querySelector('[data-chapter-counter]').dataset.chapter === expected, expected);
      }
      assert.equal((await counterBox(page)).next, 'final', 'Contact must lead beyond Inquiry to the final h4.');

      const checks = [];
      for (const selector of ['input[name="name"]', 'input[name="email"]', 'textarea[name="message"]', '[data-inquiry-submit]']) {
        const control = page.locator(`#contact ${selector}`);
        await control.evaluate((element, preferredCenter) => {
          const rect = element.getBoundingClientRect();
          scrollTo({ top: scrollY + rect.top + rect.height / 2 - preferredCenter, behavior: 'instant' });
        }, (home.top + home.bottom) / 2);
        await page.waitForFunction(selector => {
          const counter = document.querySelector('[data-chapter-counter]');
          const input = document.querySelector(`#contact ${selector}`);
          const a = counter.getBoundingClientRect(), b = input.getBoundingClientRect();
          return !counter.hidden && counter.tabIndex >= 0 && counter.getAttribute('aria-hidden') !== 'true'
            && (a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
        }, selector);
        const state = await counterBox(page);
        assert.ok(state.accessible && state.top >= 0 && state.bottom <= 844);
        if (!selector.includes('submit')) {
          await control.click();
          assert.equal(await control.evaluate(element => document.activeElement === element), true, 'Navigation must not steal an input click.');
        }
        checks.push({ selector, counter: state });
      }
      await page.locator('#contact textarea[name="message"]').fill('4444');
      assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal', 'Typing in the form must preserve reality.');
      await page.locator('#contact').evaluate(element => {
        element.focus({ preventScroll: true }); element.scrollIntoView({ behavior: 'instant', block: 'start' });
      });
      await page.waitForFunction(() => document.querySelector('[data-chapter-counter]').dataset.chapterTarget === 'final');
      await chapter.click();
      await page.waitForFunction(() => document.querySelector('[data-chapter-counter]').dataset.chapterTarget === 'home');
      assert.equal((await counterBox(page)).total, '4', 'Final h4 remains part of the real Contact chapter.');
      assert.ok(await page.locator('[data-footer-secret-space]').evaluate(element => element.getBoundingClientRect().top < innerHeight));
      await chapter.click();
      await page.waitForFunction(() => scrollY <= 2 && document.querySelector('[data-chapter-counter]').dataset.chapter === '1');
      assert.equal(await index.isVisible(), false);
      assert.ok(Math.abs((await counterBox(page)).top - home.top) < 1, 'The counter returns to its normal bottom position.');

      await page.goto(new URL('/work', base).href, { waitUntil: 'networkidle' });
      await index.waitFor({ state: 'visible' });
      assert.equal(await chapter.isVisible(), false, 'Interiors must not show an inaccurate homepage chapter count.');
      await index.locator('summary').click();
      assert.deepEqual(await index.locator('[data-index-page]').evaluateAll(links => links.map(link => link.dataset.indexPage)), ['home', 'work', 'about', 'contact']);
      await index.locator('[data-index-page="about"]').click();
      await page.locator('html[data-page="about"]').waitFor();
      await page.waitForFunction(() => !document.querySelector('[data-global-index]').open);
      assert.equal(await index.isVisible(), true);
      await page.locator('.brand-link').click();
      await page.locator('html[data-page="home"]').waitFor();
      await page.waitForFunction(() => document.querySelector('[data-global-index]').hidden);
      assert.deepEqual(errors, []);
      reports.push({ width, home, checks, chapterCount: 4, contactReachesFinal: true, interiorIndex: true, runtimeErrors: errors });
      console.log(`PASS navigation completion ${width}px: no Home INDEX, Berlin, real four chapters, live form-safe counter, final h4 stop and interior menu.`);
    } finally { await context.close(); }
  }
  if (process.env.H4_PREVIEW_URL) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      await page.goto(new URL('/', process.env.H4_PREVIEW_URL).href);
      assert.equal(await page.locator('[data-global-index]').isVisible(), false, 'Prerendered Home must hide INDEX before JavaScript.');
      await page.goto(new URL('/about', process.env.H4_PREVIEW_URL).href);
      assert.equal(await page.locator('[data-global-index]').isVisible(), true, 'No-JS interior keeps native navigation.');
      await page.locator('[data-global-index] summary').click();
      assert.equal(await page.locator('[data-index-page="work"]').isVisible(), true);
    } finally { await context.close(); }
  }
  await writeFile(new URL('navigation.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), base,
    staticNoJSChecked: Boolean(process.env.H4_PREVIEW_URL), reports }, null, 2));
} finally { await browser.close(); }
