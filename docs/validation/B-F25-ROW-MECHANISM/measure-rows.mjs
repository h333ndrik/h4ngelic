/** B-F25 evidence: the same inventory as inventory-before.json, measured on the
 * B-F25 build. Run against the local production preview:
 *   H4_BASE_URL=http://127.0.0.1:55232 node docs/validation/B-F25-ROW-MECHANISM/measure-rows.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const output = new URL('./', import.meta.url);
const rows = [
  { id: 'frontpage-strip', page: '/', selector: '.category-strip' },
  { id: 'cross-links', page: '/creative/tattoos', selector: '.rubric-cross-links' },
  { id: 'archive-filters', page: '/creative', selector: '.work-filters' },
  { id: 'footer-left', page: '/creative', selector: '.footer-left' },
  { id: 'footer-details', page: '/creative', selector: '.footer-details' },
];
const widths = [1440, 1920, 2560, 390, 320];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, build: '', widths: [] };
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width > 1000 ? 900 : 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const entry = { width, rows: [] };
    for (const row of rows) {
      await page.goto(new URL(row.page, base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      report.build ||= await page.locator('html').getAttribute('data-build');
      await page.locator(row.selector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(350);
      entry.rows.push(await page.evaluate(({ row }) => {
        const box = document.querySelector(row.selector);
        const rect = box.getBoundingClientRect();
        const style = getComputedStyle(box);
        const insert = parseFloat(style.paddingLeft) || 0;
        const nodes = [...box.querySelectorAll('.row-item, .row-slot')];
        const textOf = element => {
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          const range = document.createRange();
          let node, box = null;
          while ((node = walker.nextNode())) {
            if (!node.textContent.trim() || node.parentElement.closest('.arrow')) continue;
            range.selectNodeContents(node);
            const r = range.getBoundingClientRect();
            box = box ? { left: Math.min(box.left, r.left), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) } : { left: r.left, right: r.right, bottom: r.bottom };
          }
          return box;
        };
        const items = nodes.map(node => { const box = node.getBoundingClientRect(); const text = textOf(node);
          return { text: node.textContent.trim().replace(/\s+/g, ' '), slot: node.classList.contains('row-slot'), tag: node.tagName.toLowerCase(),
            x: +(box.left - rect.left).toFixed(2), top: +box.top.toFixed(2), right: +(box.right - rect.left).toFixed(2), width: +box.width.toFixed(2),
            textLeft: text ? +(text.left - rect.left).toFixed(2) : null }; });
        const lines = [];
        for (const item of items) {
          const line = lines.find(entry => Math.abs(entry.top - item.top) <= 2);
          if (line) line.items.push(item); else lines.push({ top: item.top, items: [item] });
        }
        return { id: row.id, page: row.page, selector: row.selector, type: box.dataset.row,
          display: style.display, justifyContent: style.justifyContent, alignItems: style.alignItems,
          columnGap: style.columnGap, paddingInline: `${style.paddingLeft} ${style.paddingRight}`,
          box: { left: +rect.left.toFixed(2), width: +rect.width.toFixed(2), height: +rect.height.toFixed(2) },
          scrollWidth: box.scrollWidth, clientWidth: box.clientWidth,
          pageOverflow: document.documentElement.scrollWidth - innerWidth,
          positions: items.length, links: items.filter(item => item.tag === 'a').length,
          items, gaps: lines.map(line => line.items.slice(1).map((item, index) => +(item.textLeft - line.items[index].right).toFixed(2))),
          rightMargin: +(rect.right - (items[items.length - 1]?.right ?? 0) + rect.left).toFixed(2) };
      }, { row }));
    }
    report.widths.push(entry);
    await context.close();
  }
  const flat = report.widths.flatMap(width => width.rows.map(row => `${width.width} ${row.id}: ${JSON.stringify(row.gaps)}`));
  console.log(flat.join('\n'));
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(new URL('inventory-after.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
