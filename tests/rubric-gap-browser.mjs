import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const output = new URL('../docs/validation/GATEPREP/BATCH-3/gallery/', import.meta.url);
await mkdir(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), build: '', profiles: [], failures: [] };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600 });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      report.build ||= await page.locator('html').getAttribute('data-build');
      await page.locator('#selected-work').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1100);

      // Evidence: at 1440 the unfitted token really overlaps, then the fit lands.
      if (width === 1440) {
        await page.evaluate(() => document.querySelector('#selected-work .category-strip').style.removeProperty('--row-type-fit'));
        await page.waitForTimeout(160);
        await page.screenshot({ path: new URL(`rubric-before-${width}.png`, output).pathname });
        const before = await page.evaluate(() => {
          const links = [...document.querySelectorAll('#selected-work .category-link .interaction-visual')].map(node => node.getBoundingClientRect());
          return links.slice(1).map((box, index) => Math.round((box.left - links[index].right) * 10) / 10);
        });
        report.before = { width, labelGaps: before, overlap: before.some(gap => gap < 0) };
        assert.ok(report.before.overlap, `The unfitted 1440px row must reproduce the overlap: ${before}`);
        await page.evaluate(() => { window.dispatchEvent(new Event('resize')); });
        await page.waitForFunction(() => document.querySelector('#selected-work .category-strip').style.getPropertyValue('--row-type-fit') !== '',
          null, { timeout: 5000 });
        await page.waitForTimeout(220);
      }
      await page.screenshot({ path: new URL(`rubric-after-${width}.png`, output).pathname });

      const home = await page.evaluate(() => {
        const strip = document.querySelector('#selected-work .category-strip');
        const style = getComputedStyle(strip);
        const token = parseFloat(style.columnGap);
        const tracks = style.gridTemplateColumns.split(' ').map(parseFloat).filter(Number.isFinite);
        const links = [...strip.querySelectorAll('.category-link')];
        const cells = links.map(link => link.getBoundingClientRect());
        const labels = links.map(link => link.querySelector('.interaction-visual').getBoundingClientRect());
        const fonts = links.map(link => getComputedStyle(link).fontSize);
        const rows = new Map();
        cells.forEach((cell, index) => {
          const key = Math.round(cell.top);
          const bucket = rows.get(key) || { cells: [], labels: [] };
          bucket.cells.push(cell); bucket.labels.push(labels[index]);
          rows.set(key, bucket);
        });
        const rowReports = [...rows.values()].map(bucket => ({
          columns: bucket.cells.length,
          columnGaps: bucket.cells.slice(1).map((cell, index) => Math.round((cell.left - bucket.cells[index].right) * 100) / 100),
          labelGaps: bucket.labels.slice(1).map((label, index) => Math.round((label.left - bucket.labels[index].right) * 100) / 100),
          overflow: bucket.labels.map((label, index) => Math.round((label.right - bucket.cells[index].right) * 100) / 100),
        }));
        return { token, tracks, fonts, fit: strip.style.getPropertyValue('--row-type-fit'), rowReports };
      });
      assert.ok(home.fonts.every(font => font === home.fonts[0]), `Rubereitschaft: all four rubric labels share one size (${home.fonts}).`);
      assert.equal(home.tracks.length, width < 600 ? 2 : 4, 'The rubric grid keeps its designed column count.');
      for (const row of home.rowReports) {
        for (const gap of row.columnGaps) assert.ok(Math.abs(gap - home.token) <= 2,
          `${width}px: column gap ${gap} must equal the shared --rubric-gap ${home.token}.`);
        for (const gap of row.labelGaps) assert.ok(gap >= home.token - 2,
          `${width}px: labels stick together (${gap}px < ${home.token}px).`);
        for (const overflow of row.overflow) assert.ok(overflow <= .5,
          `${width}px: a rubric label leaves its column by ${overflow}px.`);
      }

      // B-F12: cross links keep the same column rhythm and start flush.
      await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
      await page.waitForTimeout(900);
      const cross = await page.evaluate(() => {
        const row = document.querySelector('.rubric-cross-links');
        const style = getComputedStyle(row);
        const contentLeft = parseFloat(style.paddingLeft) + row.getBoundingClientRect().left;
        const tracks = style.gridTemplateColumns.split(' ').map(parseFloat).filter(Number.isFinite);
        const links = [...row.querySelectorAll('a')].map(link => link.getBoundingClientRect());
        const cells = [...row.children].filter(node => getComputedStyle(node).display !== 'none')
          .map(node => node.getBoundingClientRect());
        return { contentLeft, tracks, gap: parseFloat(style.columnGap),
          items: links.map(box => ({ left: Math.round(box.left), right: Math.round(box.right), top: Math.round(box.top) })),
          firstCell: cells.length ? Math.round(cells[0].left) : null,
          first: links.length ? Math.round(links[0].left) : null,
          gapPlaceholderHidden: getComputedStyle(row.querySelector('.rubric-cross-gap')).display === 'none',
          columns: tracks.length };
      });
      assert.ok(Math.abs(cross.firstCell - cross.contentLeft) <= 2,
        `${width}px: the cross-link row must start flush on the content column (${cross.firstCell} vs ${cross.contentLeft}).`);
      assert.equal(cross.gapPlaceholderHidden, false, 'Every rubric keeps its own column (V25 slot contract).');
      for (const item of cross.items) assert.ok(item.right - item.left > 0, 'Every cross link keeps a real box.');
      const rowTops = [...new Set(cross.items.map(item => item.top))];
      assert.ok(rowTops.length <= 2, `${width}px: cross links must form at most two rows (${rowTops.length}).`);
      await page.locator('.rubric-cross-links').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await page.screenshot({ path: new URL(`cross-links-${width}.png`, output).pathname });

      assert.deepEqual(errors, []);
      report.profiles.push({ width, home, cross, errors, passed: true });
      console.log(`PASS rubric gaps ${width}px: ${home.fonts[0]} fit${home.fit ? ` (${home.fit})` : ''}, column gap ${home.token}px, no overlap, cross links flush.`);
    } catch (error) {
      report.failures.push({ width, error: error.stack, errors });
      throw error;
    } finally { await context.close(); }
  }
  report.passed = true;
} finally {
  await writeFile(new URL('rubric-gap.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
