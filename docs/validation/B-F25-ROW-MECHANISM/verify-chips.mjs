/** B-F22 verification (GATEPREP-2, Batch 1): does Type B really sit on one
 * baseline, keep its height under aria-current/:active and keep its own gap?
 * No source change — this script only measures and reports.
 *
 *   H4_BASE_URL=http://127.0.0.1:55232 node docs/validation/B-F25-ROW-MECHANISM/verify-chips.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const output = new URL('./', import.meta.url);
const widths = [1440, 1920, 2560, 390, 320];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, build: '', widths: [], coupling: [], failures: [] };

const measure = page => page.evaluate(() => {
  const resolve = name => {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;width:var(${name})`;
    document.body.append(probe);
    const value = probe.getBoundingClientRect().width;
    probe.remove();
    return value;
  };
  const textBox = element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node, box = null;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim() || node.parentElement.closest('.arrow')) continue;
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      box = box ? { top: Math.min(box.top, rect.top), bottom: Math.max(box.bottom, rect.bottom) }
        : { top: rect.top, bottom: rect.bottom };
    }
    return box;
  };
  const row = document.querySelector('.work-filters');
  const style = getComputedStyle(row);
  const brand = document.querySelector('[data-floating-brand] .brand-link') || document.querySelector('[data-floating-brand]');
  const index = document.querySelector('[data-global-index] summary');
  const naavi = document.querySelector('[data-naavi]');
  const items = [...row.querySelectorAll('.filter-link')].map(item => {
    const box = item.getBoundingClientRect();
    const text = textBox(item);
    return { label: item.textContent.trim(), height: box.height, width: box.width,
      top: box.top, bottom: box.bottom, baseline: text?.bottom ?? null,
      current: item.getAttribute('aria-current'), decoration: getComputedStyle(item).textDecorationLine,
      underlineOffset: getComputedStyle(item).textUnderlineOffset };
  });
  return {
    row: { left: row.getBoundingClientRect().left, right: row.getBoundingClientRect().right,
      width: row.getBoundingClientRect().width, height: row.getBoundingClientRect().height,
      maxWidth: parseFloat(style.maxWidth), columnGap: parseFloat(style.columnGap), alignItems: style.alignItems,
      overflowX: style.overflowX, scrollWidth: row.scrollWidth, clientWidth: row.clientWidth },
    tokens: { chipsGap: resolve('--chips-gap'), chipsTargetMin: resolve('--chips-target-min'), rowGapMin: resolve('--row-gap-min') },
    brand: { baseline: brand ? textBox(brand)?.bottom ?? null : null, box: brand?.getBoundingClientRect().toJSON() ?? null },
    index: index ? { left: index.getBoundingClientRect().left } : null,
    naavi: naavi ? { left: naavi.getBoundingClientRect().left, right: naavi.getBoundingClientRect().right } : null,
    items,
    pageOverflow: document.documentElement.scrollWidth - innerWidth,
  };
});

const positions = (page, selectors) => page.evaluate(list => Object.fromEntries(list.map(selector => {
  const box = document.querySelector(selector);
  if (!box) return [selector, null];
  const anchor = box.getBoundingClientRect();
  // Both axes are row-relative: a page shift caused by a taller row must not
  // read as a geometry change inside another row.
  return [selector, [...box.querySelectorAll('.row-item')].map(item => {
    const rect = item.getBoundingClientRect();
    return [Math.round((rect.left - anchor.left) * 10) / 10, Math.round((rect.top - anchor.top) * 10) / 10, Math.round(rect.width * 10) / 10];
  })];
})), selectors);

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width > 1000 ? 1000 : 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const entry = { width };
    try {
      await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      report.build ||= await page.locator('html').getAttribute('data-build');
      await page.waitForTimeout(250);
      entry.activeCurrent = await measure(page);

      // Same row without the current marker: height must not move.
      await page.evaluate(() => document.querySelector('.work-filters .filter-link[aria-current]')?.removeAttribute('aria-current'));
      await page.waitForTimeout(120);
      entry.withoutCurrent = await measure(page);

      // Pressed state: hold the first chip and measure while :active applies.
      const first = page.locator('.work-filters .filter-link').first();
      const box = await first.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(120);
      entry.pressed = await measure(page);
      await page.mouse.up();

      // Coupling: one token at a time, only its own type may move.
      const selectors = ['.category-strip', '.work-filters', '.footer-left', '.footer-details'];
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await page.locator('.category-strip').scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const snapshotSelectors = ['.rubric-cross-links', '.footer-left', '.footer-details', '.work-filters'];
      await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await page.locator('.rubric-cross-links').scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const before = await positions(page, snapshotSelectors);
      await page.evaluate(() => document.documentElement.style.setProperty('--chips-gap', '80px'));
      await page.waitForTimeout(150);
      const afterChips = await positions(page, snapshotSelectors);
      await page.evaluate(() => document.documentElement.style.removeProperty('--chips-gap'));
      await page.evaluate(() => document.documentElement.style.setProperty('--row-gap-min', '900px'));
      await page.waitForTimeout(150);
      const afterRow = await positions(page, snapshotSelectors);
      await page.evaluate(() => document.documentElement.style.removeProperty('--row-gap-min'));
      entry.coupling = {
        before, afterChips, afterRow,
        chipsGapMovesOnlyChips: {
          crossLinks: JSON.stringify(before['.rubric-cross-links']) === JSON.stringify(afterChips['.rubric-cross-links']),
          footerLeft: JSON.stringify(before['.footer-left']) === JSON.stringify(afterChips['.footer-left']),
          footerDetails: JSON.stringify(before['.footer-details']) === JSON.stringify(afterChips['.footer-details']),
          chipsMoved: JSON.stringify(before['.work-filters']) !== JSON.stringify(afterChips['.work-filters']),
        },
        rowGapMovesOnlyDistributed: {
          chips: JSON.stringify(before['.work-filters']) === JSON.stringify(afterRow['.work-filters']),
          footerLeft: JSON.stringify(before['.footer-left']) === JSON.stringify(afterRow['.footer-left']),
          footerDetails: JSON.stringify(before['.footer-details']) === JSON.stringify(afterRow['.footer-details']),
          crossLinksMoved: JSON.stringify(before['.rubric-cross-links']) !== JSON.stringify(afterRow['.rubric-cross-links']),
        },
        selectors: snapshotSelectors,
      };
      report.widths.push(entry);
      const active = entry.activeCurrent;
      console.log(`${width}px: brand baseline ${active.brand.baseline?.toFixed(2)}, chips ${active.items.map(i => i.baseline?.toFixed(2)).join('/')}, gap ${active.row.columnGap} (token ${active.tokens.chipsGap.toFixed(2)}), heights ${active.items.map(i => i.height.toFixed(1)).join('/')}, coupling ${JSON.stringify(entry.coupling.chipsGapMovesOnlyChips)} ${JSON.stringify(entry.coupling.rowGapMovesOnlyDistributed)}`);
    } catch (error) {
      report.failures.push({ width, error: error.stack });
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(new URL('chips-verification.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
