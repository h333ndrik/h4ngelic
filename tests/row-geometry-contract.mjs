import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Geometry is structure, not a number: every registered row must put its items
 * on one baseline, keep one gap between them and carry its arrow inside the
 * link. The suite is row-agnostic — the manifest names the containers. */
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const manifest = JSON.parse(await readFile(new URL('./rows.manifest.json', import.meta.url), 'utf8'));
const output = new URL(`../${process.env.H4_ROW_ARTIFACTS || 'docs/validation/R12-RUBRIC-GEOMETRY'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), base, build: '', profiles: [], fontFallback: null, failures: [] };
const save = () => writeFile(new URL('row-geometry.json', output), JSON.stringify(report, null, 2) + '\n');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function measureRows(page, rows) {
  return page.evaluate(({ rows }) => {
    const textBox = element => {
      const range = document.createRange();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const rects = [];
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        if (node.parentElement?.closest('.arrow')) continue;
        range.selectNodeContents(node);
        rects.push(range.getBoundingClientRect());
      }
      if (!rects.length) return null;
      return { left: Math.min(...rects.map(rect => rect.left)), right: Math.max(...rects.map(rect => rect.right)),
        top: Math.min(...rects.map(rect => rect.top)), bottom: Math.max(...rects.map(rect => rect.bottom)) };
    };
    const baselineOf = element => {
      const probe = document.createElement('span');
      probe.style.cssText = 'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline';
      element.prepend(probe);
      const value = probe.getBoundingClientRect().top;
      probe.remove();
      return value;
    };
    // display:contents wrappers are line hints, not items.
    const flatten = element => [...element.children].flatMap(child => getComputedStyle(child).display === 'contents' ? flatten(child) : [child]);
    return rows.map(row => {
      const box = document.querySelector(row.container);
      if (!box) return { id: row.id, missing: true };
      const style = getComputedStyle(box);
      const children = flatten(box);
      const items = [...box.querySelectorAll(row.item)];
      const nodes = [...box.childNodes];
      const measured = items.map(element => {
        const text = textBox(element);
        const arrow = element.querySelector('.arrow');
        const arrowBox = arrow ? arrow.getBoundingClientRect() : null;
        const box = element.getBoundingClientRect();
        const itemStyle = getComputedStyle(element);
        return { text: (element.textContent || '').trim().replace(/\s+/g, ' '), tag: element.tagName.toLowerCase(),
          href: element.getAttribute('href'), baseline: baselineOf(element),
          left: text?.left ?? box.left, right: text?.right ?? box.right,
          arrow: arrowBox ? { left: arrowBox.left, right: arrowBox.right, top: arrowBox.top, bottom: arrowBox.bottom } : null,
          marginInline: `${itemStyle.marginInlineStart} ${itemStyle.marginInlineEnd}`,
          display: itemStyle.display };
      });
      const lines = [];
      for (const item of measured) {
        const line = lines.find(entry => Math.abs(entry.baseline - item.baseline) <= 1);
        if (line) line.items.push(item); else lines.push({ baseline: item.baseline, items: [item] });
      }
      return {
        id: row.id, page: row.page, container: row.container,
        display: style.display, justifyContent: style.justifyContent, alignItems: style.alignItems,
        columnGap: parseFloat(style.columnGap) || 0, gridTemplateColumns: style.gridTemplateColumns,
        children: children.map(child => `${child.tagName.toLowerCase()}${child.className ? '.' + String(child.className).trim().split(/\s+/).join('.') : ''}`),
        whitespaceBetweenItems: nodes.filter((node, index) => node.nodeType === 3
          && node.textContent.trim() === '' && index > 0 && index < nodes.length - 1).length,
        arrowsOutsideLinks: children.filter(child => child.querySelector?.(':scope > .arrow')).length,
        lines: lines.map(line => ({
          baseline: line.baseline,
          items: line.items,
          gaps: line.items.slice(1).map((item, index) => {
            const previous = line.items[index];
            const anchor = Math.max(previous.right, previous.arrow?.right ?? -Infinity);
            return { from: previous.text, to: item.text, gap: Number((item.left - anchor).toFixed(2)),
              wordToArrow: previous.arrow ? Number((previous.arrow.left - previous.right).toFixed(2)) : null };
          }),
          arrowOffsets: line.items.filter(item => item.arrow).map(item => Number((item.arrow.bottom - item.baseline).toFixed(2))),
        })),
      };
    });
  }, { rows });
}

function assertRow(row, { label, expectLines }) {
  assert.equal(row.missing, undefined, `${label}: the registered row must exist.`);
  assert.equal(row.display, 'flex', `${label}: the row is a flex line, not equal columns (${row.display}).`);
  assert.notEqual(row.justifyContent, 'space-between', `${label}: space-between distributes by content, forbidden.`);
  assert.equal(row.whitespaceBetweenItems, 0, `${label}: no whitespace text node may sit between two items.`);
  assert.ok(row.lines.every(line => line.items.every(item => item.display === 'inline-flex' || item.display === 'flex')),
    `${label}: every item is a flex item.`);
  assert.ok(row.lines.every(line => line.items.every(item => item.marginInline === '0px 0px')),
    `${label}: items carry no local margin (${JSON.stringify(row.lines.map(line => line.items.map(item => item.marginInline)))}).`);
  for (const line of row.lines) {
    const spread = Math.max(...line.items.map(item => item.baseline)) - Math.min(...line.items.map(item => item.baseline));
    assert.ok(spread <= 1, `${label}: baseline spread ${spread.toFixed(2)}px on one line: ${JSON.stringify(line.items.map(item => [item.text, item.baseline]))}`);
    if (line.gaps.length > 1) {
      const values = line.gaps.map(gap => gap.gap);
      const delta = Math.max(...values) - Math.min(...values);
      assert.ok(delta <= 2, `${label}: gaps differ by ${delta.toFixed(2)}px (${JSON.stringify(values)}).`);
    }
    for (const gap of line.gaps) {
      assert.ok(Math.abs(gap.gap - row.columnGap) <= 2,
        `${label}: "${gap.from}" → "${gap.to}" gap ${gap.gap}px must match the row gap ${row.columnGap}px.`);
      if (gap.wordToArrow !== null) assert.ok(gap.wordToArrow >= 2, `${label}: the arrow needs room after its word (${gap.wordToArrow}px).`);
    }
    if (line.arrowOffsets.length > 1) {
      const delta = Math.max(...line.arrowOffsets) - Math.min(...line.arrowOffsets);
      assert.ok(delta <= 1, `${label}: arrow baseline offset differs by ${delta.toFixed(2)}px (${JSON.stringify(line.arrowOffsets)}).`);
    }
  }
  if (expectLines) assert.equal(row.lines.length, expectLines, `${label}: ${expectLines} lines expected, got ${row.lines.length}.`);
}

try {
  for (const viewport of manifest.viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const byPage = new Map();
    for (const row of manifest.rows) {
      if (!byPage.has(row.page)) byPage.set(row.page, []);
      byPage.get(row.page).push(row);
    }
    const results = [];
    try {
      for (const [route, rows] of byPage) {
        await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
        await page.waitForTimeout(250);
        report.build ||= await page.locator('html').getAttribute('data-build');
        const measured = await measureRows(page, rows);
        for (const row of measured) {
          const source = rows.find(entry => entry.id === row.id);
          assertRow(row, { label: `${row.id} @${viewport.width}px`, expectLines: source.expectLines?.[String(viewport.width)] });
        }
        for (const row of rows) {
          const element = page.locator(row.container);
          if (await element.count()) {
            await element.scrollIntoViewIfNeeded();
            await element.screenshot({ path: new URL(`${row.id}-${viewport.width}.png`, output).pathname }).catch(() => {});
          }
        }
        results.push(...measured);
      }
      assert.deepEqual(errors, [], 'No runtime errors while measuring rows.');
      const summary = results.map(row => ({ id: row.id, lines: row.lines.length,
        baselineSpread: Number(Math.max(...row.lines.map(line => Math.max(...line.items.map(item => item.baseline)) - Math.min(...line.items.map(item => item.baseline)))).toFixed(2)),
        gaps: [...new Set(row.lines.flatMap(line => line.gaps.map(gap => gap.gap)))] }));
      report.profiles.push({ ...viewport, rows: summary, errors, passed: true });
      console.log(`PASS rows ${viewport.width}px: ${summary.map(row => `${row.id}×${row.lines}`).join(', ')}`);
    } catch (error) {
      report.failures.push({ ...viewport, error: error.stack, rows: results });
      throw error;
    } finally { await context.close(); await save(); }
  }

  // Forced font fallback: block the brand font and prove the arrow stays on the baseline.
  const fallback = manifest.fontFallbackViewport;
  const context = await browser.newContext({ viewport: fallback, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await context.route('**/*.{woff,woff2,ttf,otf,json}', route => route.abort());
  try {
    const results = [];
    for (const [route, rows] of new Map([['/', manifest.rows.filter(row => row.page === '/')],
      ['/creative', manifest.rows.filter(row => row.page === '/creative')],
      ['/creative/tattoos', manifest.rows.filter(row => row.page === '/creative/tattoos')]])) {
      if (!rows.length) continue;
      await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await page.waitForTimeout(250);
      const measured = await measureRows(page, rows);
      for (const row of measured) {
        const source = rows.find(entry => entry.id === row.id);
        assertRow(row, { label: `${row.id} @${fallback.width}px fallback font`, expectLines: source.expectLines?.[String(fallback.width)] });
      }
      results.push(...measured);
    }
    report.fontFallback = { ...fallback, rows: results.map(row => ({ id: row.id, gaps: [...new Set(row.lines.flatMap(line => line.gaps.map(gap => gap.gap)))],
      arrowOffsets: row.lines.flatMap(line => line.arrowOffsets) })), passed: true };
    console.log(`PASS rows with forced font fallback at ${fallback.width}px.`);
  } catch (error) {
    report.failures.push({ fontFallback: true, error: error.stack });
    throw error;
  } finally { await context.close(); await save(); }

  console.log(`PASS row geometry: ${report.profiles.length} viewports, ${manifest.rows.length} registered rows, ${report.build}.`);
} catch (error) {
  await save();
  throw error;
} finally { await browser.close(); }
