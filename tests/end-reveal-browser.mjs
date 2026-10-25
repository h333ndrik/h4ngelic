import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const output = new URL('../artifacts/end-reveal/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
const selectedProfiles = process.env.H4_END_PROFILES?.split(',');
const url = path => new URL(path, base).href;
const reveal = page => page.locator('[data-end-reveal]').evaluate(element => {
  const mark = element.querySelector('.end-reveal-mark');
  const hint = element.querySelector('[data-other-side-hint]');
  const box = element.getBoundingClientRect();
  const markBox = mark.getBoundingClientRect();
  const hintBox = hint.getBoundingClientRect();
  return { top: box.top, height: box.height, progress: Number(element.dataset.endRevealProgress),
    opacity: Number(getComputedStyle(mark).opacity), mask: getComputedStyle(mark, '::before').maskImage,
    material: getComputedStyle(mark.querySelector('.end-reveal-material'), '::before').backgroundImage,
    active: element.hasAttribute('data-end-reveal-active'), hintZ: getComputedStyle(hint).zIndex,
    hintOpacity: Number(getComputedStyle(hint.querySelector('[data-secret-message]')).opacity),
    hintColor: getComputedStyle(hint).color, animation: getComputedStyle(mark.querySelector('.end-reveal-material'), '::before').animationName,
    markBox: { left: markBox.left, right: markBox.right, top: markBox.top, bottom: markBox.bottom },
    hintBox: { left: hintBox.left, right: hintBox.right, top: hintBox.top, bottom: hintBox.bottom },
    width: innerWidth, viewport: innerHeight };
});
async function state(page, expected) {
  await page.waitForFunction(mode => document.documentElement.dataset.mode === mode
    && document.documentElement.hasAttribute('data-xray-ready')
    && !document.documentElement.hasAttribute('data-xray-transition')
    && !document.documentElement.hasAttribute('data-mode-snapshot'), expected, { timeout: 15000 });
}
try {
  for (const profile of [
    { name: 'desktop', viewport: { width: 1440, height: 1000 } },
    { name: 'touch-390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    { name: 'touch-320', viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true },
    { name: 'reduced', viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' },
  ]) {
    const { name, ...options } = profile;
    if (selectedProfiles && !selectedProfiles.includes(name)) continue;
    const context = await browser.newContext({ deviceScaleFactor: 1, ...options });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    try {
      await page.goto(url('/'), { waitUntil: 'networkidle' });
      await state(page, 'normal');
      const initial = await reveal(page);
      assert.equal(initial.opacity, 0, `${name}: the monogram is invisible at the hero.`);
      assert.ok(initial.top > initial.viewport);
      assert.ok(!requests.some(value => /living-decay-material/.test(value)), 'Normal does not download the Other material.');
      await page.locator('#contact').evaluate(element => scrollTo({ top: element.getBoundingClientRect().top + scrollY, behavior: 'instant' }));
      await page.waitForTimeout(80);
      const contact = await reveal(page);
      assert.equal(contact.opacity, 0, `${name}: contact is still before the final reveal.`);
      assert.ok(contact.top >= contact.viewport * (profile.reducedMotion === 'reduce' ? .45 : .9) - 1, JSON.stringify(contact));

      if (profile.reducedMotion !== 'reduce') {
        await page.locator('[data-end-reveal]').evaluate(element => scrollTo({ top: element.getBoundingClientRect().top + scrollY - innerHeight * .55, behavior: 'instant' }));
        await page.waitForFunction(() => {
          const value = Number(document.querySelector('[data-end-reveal]').dataset.endRevealProgress);
          return value > .2 && value < .9;
        });
        const intermediate = await reveal(page);
        assert.ok(intermediate.opacity > 0 && intermediate.opacity < 1);
      }

      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForFunction(() => Number(document.querySelector('[data-end-reveal]').dataset.endRevealProgress) >= .95);
      const final = await reveal(page);
      assert.ok(final.opacity >= .99);
      assert.match(final.mask, /h4-monogram\.svg/);
      assert.equal(final.material, 'none');
      assert.ok(final.markBox.left >= 0 && final.markBox.right <= final.width);
      assert.ok(final.markBox.top >= final.top - 1 && final.markBox.bottom <= final.top + final.height + 1);
      assert.ok(final.hintBox.left >= 0 && final.hintBox.right <= final.width);
      assert.equal(final.hintZ, '3');
      await page.locator('[data-other-side-hint]').focus();
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-xray-hint]')).opacity) >= .99);
      await page.screenshot({ path: new URL(`${name}-normal.png`, output).pathname });

      await page.keyboard.down('4');
      try { await state(page, 'xray'); } finally { await page.keyboard.up('4'); }
      const other = await reveal(page);
      assert.match(other.material, /living-decay-material(?:-mobile)?\.webp/);
      assert.equal(other.mask, final.mask, 'The same exact silhouette survives the mode switch.');
      assert.equal(other.hintOpacity, 1);
      assert.equal(other.hintColor, 'rgb(255, 255, 255)');
      assert.equal(other.animation, profile.reducedMotion === 'reduce' ? 'none' : 'h4-end-material');
      await page.screenshot({ path: new URL(`${name}-other.png`, output).pathname });
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert.equal((await reveal(page)).active, false);
      assert.equal((await reveal(page)).animation, 'none');
      await page.evaluate(() => {
        delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      for (let index = 0; index < 3; index++) await page.keyboard.press('3');
      await state(page, 'normal');
      const restored = await reveal(page);
      assert.equal(restored.mask, final.mask);
      assert.equal(restored.material, 'none');
      assert.ok(restored.opacity >= .99);
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.end-reveal-mark')).opacity) === 0);
      await page.goto(url('/work'), { waitUntil: 'networkidle' });
      assert.equal(await page.locator('[data-end-reveal]').count(), 0);
      await page.goto(url('/about'), { waitUntil: 'networkidle' });
      assert.equal(await page.locator('[data-end-reveal]').count(), 0);
      assert.deepEqual(errors, []);
      reports.push({ profile: name, initial, contact, final, other, restored, errors });
      console.log(`PASS end reveal ${name}: final section only, exact SVG, scroll progress, foreground CTA, 4/333, hidden pause, route scope.`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(new URL('results.json', output), JSON.stringify(reports, null, 2));
}
