import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Type A row rhythm: the frontpage strip and the rubric cross-links stretch
 * between the same insets, share one baseline and give every label pair the
 * same visible distance. The old shared --rubric-gap is retired (B-F25). */
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const output = new URL('../docs/validation/B-F25-ROW-MECHANISM/', import.meta.url);
await mkdir(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), build: '', profiles: [], failures: [] };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function settle(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForFunction(sel => {
    const item = document.querySelector(`${sel} .kinetic-item`);
    if (!item) return true;
    const transform = getComputedStyle(item).transform;
    return transform === 'none' || Math.abs(new DOMMatrixReadOnly(transform).m41) < .5;
  }, selector, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(150);
}

const measure = (page, selector) => page.evaluate((selector) => {
  const row = document.querySelector(selector);
  const box = row.getBoundingClientRect();
  const style = getComputedStyle(row);
  const insert = parseFloat(style.paddingLeft) || 0;
  const nodes = [...row.querySelectorAll('.row-item, .row-slot')];
  const label = element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node, rect = null;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim() || node.parentElement.closest('.arrow')) continue;
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      rect = rect ? { left: Math.min(rect.left, r.left), right: Math.max(rect.right, r.right), bottom: Math.max(rect.bottom, r.bottom) } : { left: r.left, right: r.right, bottom: r.bottom };
    }
    return rect;
  };
  const items = nodes.map(node => { const rect = node.getBoundingClientRect(); const text = label(node);
    return { text: node.textContent.trim().replace(/\s+/g, ' '), left: rect.left, right: rect.right, top: rect.top, width: rect.width,
      textLeft: text?.left ?? null, textRight: text?.right ?? null, bottom: text?.bottom ?? null, font: getComputedStyle(node).fontSize }; });
  const lines = [];
  for (const item of items) {
    const line = lines.find(entry => Math.abs(entry.top - item.top) <= 2);
    if (line) line.items.push(item); else lines.push({ top: item.top, items: [item] });
  }
  return { box: { left: box.left, right: box.right, width: box.width }, insert, token: parseFloat(style.columnGap),
    scrollWidth: row.scrollWidth, clientWidth: row.clientWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth,
    items, lines: lines.map(line => ({ count: line.items.length,
      gaps: line.items.slice(1).map((item, index) => item.textLeft - line.items[index].right),
      baselineSpread: Math.max(...line.items.map(item => item.bottom)) - Math.min(...line.items.map(item => item.bottom)),
      first: line.items[0].textLeft, last: line.items[line.items.length - 1].right })) };
}, selector);

try {
  for (const width of [1440, 390, 320]) {
    const height = width === 1440 ? 900 : 844;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      report.build ||= await page.locator('html').getAttribute('data-build');
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await settle(page, '#selected-work .category-strip');
      const home = await measure(page, '#selected-work .category-strip');
      const fonts = [...new Set(home.items.map(item => item.font))];
      assert.equal(fonts.length, 1, `All four rubric labels share one size (${fonts}).`);
      assert.equal(home.items.length, 4, 'The frontpage keeps its four rubric links.');
      assert.equal(home.lines.length, width < 600 ? 2 : 1, 'Two lines on phones, one line above 600px.');
      for (const line of home.lines) {
        if (width < 600) assert.equal(line.count, 2, 'The phone layout breaks into two pairs.');
        assert.ok(line.baselineSpread <= 1, `Baseline spread ${line.baselineSpread}px on one line.`);
        for (const gap of line.gaps) {
          assert.ok(gap >= home.token - 1, `Label gap ${gap}px respects --row-gap-min ${home.token}px.`);
          assert.ok(gap > 0, 'Labels never touch.');
        }
        const spread = Math.max(...line.gaps) - Math.min(...line.gaps);
        assert.ok(spread <= 2, `Visible gaps stay equal (${line.gaps}).`);
        assert.ok(Math.abs(line.first - (home.box.left + home.insert)) <= 2,
          `The first label starts on --row-inset (${line.first} vs ${home.box.left + home.insert}).`);
      }
      assert.ok(home.pageOverflow <= 1, 'The page never widens.');
      await page.screenshot({ path: new URL(`rubric-after-${width}.png`, output).pathname });

      await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await settle(page, '.rubric-cross-links');
      const cross = await measure(page, '.rubric-cross-links');
      assert.equal(cross.lines.length, width < 600 ? 2 : 1, 'Cross-links use the same line rhythm as the frontpage.');
      for (const line of cross.lines) {
        const spread = Math.max(...line.gaps) - Math.min(...line.gaps);
        assert.ok(spread <= 2, `Cross-link gaps stay equal (${line.gaps}).`);
        assert.ok(Math.abs(line.first - (cross.box.left + cross.insert)) <= 2, 'Cross-links start on the same inset as the frontpage.');
      }
      assert.ok(cross.pageOverflow <= 1, 'The cross-link row never widens the page.');
      await page.screenshot({ path: new URL(`cross-links-${width}.png`, output).pathname });

      assert.deepEqual(errors, []);
      report.profiles.push({ width, home, cross, errors, passed: true });
      console.log(`PASS rubric rhythm ${width}px: ${home.items[0].font}, gaps ${JSON.stringify(home.lines.map(line => line.gaps.map(gap => Math.round(gap * 10) / 10)))}, inset ${home.insert}px.`);
    } catch (error) {
      report.failures.push({ width, error: error.stack });
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await writeFile(new URL('rubric-gaps.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
