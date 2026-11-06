import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const output = new URL('../docs/validation/GATEPREP/BATCH-2.5/gallery/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), build: '', profiles: [], failures: [] };

async function settle(page) {
  await page.locator('#selected-work .category-strip').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => {
    const items = [...document.querySelectorAll('#selected-work .category-link')];
    return items.length === 4 && items.every(link => {
      const visual = link.querySelector('.interaction-visual');
      if (!visual) return false;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(visual).transform === 'none' ? undefined : getComputedStyle(visual).transform);
      return Math.abs(matrix.m41) < .5;
    });
  }, null, { timeout: 8000 });
}

const geometry = () => {
  const strip = document.querySelector('#selected-work .category-strip');
  return [...strip.querySelectorAll('.category-link')].map(link => {
    const cell = link.getBoundingClientRect();
    const visual = link.querySelector('.interaction-visual');
    const box = visual.getBoundingClientRect();
    const arrow = link.querySelector('.arrow').getBoundingClientRect();
    const centerY = box.top + box.height / 2;
    const at = (x, y) => {
      const hit = document.elementFromPoint(x, y);
      return { isSameLink: Boolean(hit?.closest('.category-link') === link), sameVisual: hit?.closest('.interaction-visual') === visual,
        owner: hit?.closest('.category-link')?.textContent.trim() || null };
    };
    return {
      text: link.textContent.trim(),
      cell: { width: Math.round(cell.width), height: Math.round(cell.height) },
      visual: { left: Math.round(box.left), right: Math.round(box.right), height: Math.round(box.height) },
      arrow: { left: Math.round(arrow.left), right: Math.round(arrow.right) },
      textHit: at(box.left + Math.min(8, box.width / 2), centerY),
      arrowHit: at(arrow.left + arrow.width / 2, arrow.top + arrow.height / 2),
      leftPad: at(box.left - 3, centerY),
      rightBeyond: at(arrow.right + 20, centerY),
      up20: at(box.left + Math.min(8, box.width / 2), centerY - 20),
      down20: at(box.left + Math.min(8, box.width / 2), centerY + 20),
      up26: at(box.left + Math.min(8, box.width / 2), centerY - 26),
      deadLeft: at(cell.left - 6, centerY),
      deadTop: at(box.left + Math.min(8, box.width / 2), cell.top + 8),
    };
  });
};

try {
  for (const width of [1440, 390, 320]) {
    const height = width === 1440 ? 900 : 844;
    const touch = width < 600;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      report.build ||= await page.locator('html').getAttribute('data-build');
      await settle(page);

      // Evidence: the old full-cell hit area, then the constrained label area.
      await page.evaluate(() => {
        for (const link of document.querySelectorAll('#selected-work .category-link')) link.style.outline = '1px solid #ff5c5c';
      });
      await page.screenshot({ path: new URL(`hit-before-${width}.png`, output).pathname });
      await page.evaluate(() => {
        for (const link of document.querySelectorAll('#selected-work .category-link')) link.style.outline = '';
        for (const visual of document.querySelectorAll('#selected-work .category-link .interaction-visual')) {
          visual.style.outline = '2px solid #29e3ff';
          visual.style.outlineOffset = '4px';
        }
      });
      await page.screenshot({ path: new URL(`hit-after-${width}.png`, output).pathname });

      const rows = await page.evaluate(geometry);
      assert.equal(rows.length, 4);
      for (const row of rows) {
        assert.equal(row.textHit.isSameLink, true, `${row.text}: the label is clickable.`);
        assert.equal(row.arrowHit.isSameLink, true, `${row.text}: the arrow glyph belongs to the link.`);
        assert.equal(row.leftPad.isSameLink, true, `${row.text}: up to 4px left padding stays clickable.`);
        assert.equal(row.rightBeyond.isSameLink, false, `${row.text}: 20px right of the arrow is not the link (owner: ${row.rightBeyond.owner}).`);
        assert.equal(row.deadLeft.isSameLink, false, `${row.text}: the strip gap left of the cell is not a link (owner: ${row.deadLeft.owner}).`);
        assert.equal(row.deadTop.isSameLink, false, `${row.text}: the cell's vertical padding is not a link (owner: ${row.deadTop.owner}).`);
        assert.equal(row.up20.isSameLink, true, `${row.text}: the touch target is at least 40px high.`);
        assert.equal(row.down20.isSameLink, true, `${row.text}: the touch target is at least 40px high.`);
        const hitHeight = Math.max(44, row.visual.height);
        assert.equal(row.up26.isSameLink, hitHeight / 2 >= 26,
          `${row.text}: the hit height (${hitHeight}px) must stop beyond its own half-height.`);
      }

      // A real click 20px right of the last arrow must not navigate.
      const last = rows.at(-1);
      const lastCenterY = await page.evaluate(() => {
        const box = [...document.querySelectorAll('#selected-work .category-link')].at(-1).querySelector('.interaction-visual').getBoundingClientRect();
        return box.top + box.height / 2;
      });
      await page.mouse.click(last.arrow.right + 20, lastCenterY);
      await page.waitForTimeout(400);
      assert.equal(new URL(page.url()).pathname, '/', 'A click beyond the arrow must not navigate.');
      // A real click on the label navigates.
      await page.mouse.click(last.visual.left + 10, await page.evaluate(() => {
        const row = [...document.querySelectorAll('#selected-work .category-link')].at(-1);
        const box = row.querySelector('.interaction-visual').getBoundingClientRect();
        return box.top + box.height / 2;
      }));
      await page.waitForFunction(() => location.pathname !== '/', null, { timeout: 8000 });
      assert.equal(new URL(page.url()).pathname, '/creative/more', 'The label itself still navigates.');

      assert.deepEqual(errors, []);
      report.profiles.push({ width, rows, click: { beyond: 'no navigation', label: '/creative/more' }, errors, passed: true });
      console.log(`PASS rubric hit area ${width}px: 4 labels text+arrow clickable, +20px outside inert, 40px+ tall, cell ${rows[0].cell.width}px vs label.`);
    } catch (error) {
      report.failures.push({ width, error: error.stack, errors });
      await page.screenshot({ path: new URL(`failure-hit-${width}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await writeFile(new URL('hit-areas.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
