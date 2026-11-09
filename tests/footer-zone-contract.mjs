/** B-F19-r4 — the footer band is one surface: cursor and ink together.
 *
 * The band carried two symptoms at once: the logo cursor was reported missing
 * and presses left no ink. Both are pointer-surface questions, so they are
 * checked here in one suite against the production build, never only in dev:
 *
 *  1. a 2-px raster over the full band resolves to the logo cursor everywhere,
 *     and every image in that token actually fetches AND decodes (a 404 keeps
 *     the CSS string intact while the browser falls back to the system arrow);
 *  2. every empty point of the band paints: a press leaves a visible mark;
 *  3. real actions still win: links do not paint and still navigate;
 *  4. the band keeps its geometry — 44-px targets, token gaps, no page overflow.
 *
 *   H4_BASE_URL=http://127.0.0.1:55233 node tests/footer-zone-contract.mjs
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { INK_INTERACTIVE_SELECTOR } from '../src/ink-guard.js';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../docs/validation/B-F19-FOOTER-ZONE/', import.meta.url);
await mkdir(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), base, build: '', guard: INK_INTERACTIVE_SELECTOR, profiles: [], failures: [] };
const save = () => writeFile(new URL('footer-zone-contract.json', output), JSON.stringify(report, null, 2) + '\n');
const round = value => Math.round(value * 100) / 100;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const measure = selector => {
  const round = value => Math.round(value * 100) / 100;
  const identity = document.querySelector('.footer-identity');
  const row = identity.getBoundingClientRect();
  const items = [...document.querySelectorAll('.footer-identity .row-item, .footer-identity [data-visit-count], .footer-identity [data-naavi]')]
    .map(element => { const rect = element.getBoundingClientRect();
      return { element: `${element.tagName.toLowerCase()}.${String(element.className).trim()}`, left: rect.left, right: rect.right,
        top: rect.top, bottom: rect.bottom, height: rect.height, width: rect.width,
        pointerEvents: getComputedStyle(element).pointerEvents, cursor: getComputedStyle(element).cursor }; });
  const cursorValues = new Map();
  const offenders = [];
  let points = 0;
  for (let y = row.top + 1; y < row.bottom - 1; y += 2) {
    for (let x = row.left + 1; x < row.right - 1; x += 2) {
      const element = document.elementFromPoint(x, y);
      if (!element) continue;
      const cursor = getComputedStyle(element).cursor;
      points += 1;
      const key = /url\(/.test(cursor) ? `image:${(cursor.match(/url\("?([^")]+)"?\)/) || [])[1] || 'unknown'}` : cursor;
      cursorValues.set(key, (cursorValues.get(key) || 0) + 1);
      if (!/url\(/.test(cursor) && offenders.length < 10) offenders.push({ x: round(x), y: round(y),
        element: `${element.tagName.toLowerCase()}.${String(element.className).trim()}`, cursor });
    }
  }
  const clusters = ['.footer-left', '.footer-details'].map(clusterSelector => {
    const element = document.querySelector(clusterSelector);
    const style = getComputedStyle(element);
    return { selector: clusterSelector, gap: style.columnGap, tokenGap: style.getPropertyValue('--cluster-gap').trim(), left: element.getBoundingClientRect().left,
      right: element.getBoundingClientRect().right, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
  });
  return {
    build: document.documentElement.dataset.build || null,
    zone: { top: round(row.top), bottom: round(row.bottom), left: round(row.left), right: round(row.right), height: round(row.height) },
    page: { innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollY },
    items: items.map(item => ({ ...item, left: round(item.left), right: round(item.right), top: round(item.top), bottom: round(item.bottom),
      height: round(item.height), width: round(item.width) })),
    clusters, raster: { points, values: [...cursorValues.entries()].map(([value, count]) => ({ value, count })), offenders },
    marks: document.querySelectorAll('.ink-mark').length,
  };
};

/** Points that belong to the band itself, never to an item or an action. */
const freePoints = selector => {
  const round = value => Math.round(value * 100) / 100;
  const row = document.querySelector('.footer-identity').getBoundingClientRect();
  const found = [];
  const clusters = ['.footer-left', '.footer-details'];
  for (let index = 0; index < clusters.length; index += 1) {
    const cluster = document.querySelector(clusters[index]).getBoundingClientRect();
    let point = null;
    for (let y = row.top + row.height / 2; y < row.bottom - 4 && !point; y += 3) {
      for (let x = Math.max(cluster.left, 0) + 2; x < Math.min(cluster.right, innerWidth) - 2; x += 2) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || hit.closest(selector) || hit.closest('.row-item') || hit.closest('.arrow')) continue;
        if (hit === hit.closest('.footer-left, .footer-details')) { point = { x: round(x), y: round(y), cluster: clusters[index] }; break; }
      }
    }
    if (point) found.push(point);
  }
  return found;
};

const markState = () => [...document.querySelectorAll('.ink-mark')].map(mark => {
  const round = value => Math.round(value * 100) / 100;
  const rect = mark.getBoundingClientRect();
  return { left: round(rect.left), top: round(rect.top), width: round(rect.width), height: round(rect.height),
    opacity: getComputedStyle(mark).opacity, visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight };
});

const decodeAssets = async urls => {
  const decoded = [];
  for (const url of urls) {
    const response = await fetch(url, { cache: 'no-store' });
    const image = await new Promise(resolve => {
      const probe = new Image();
      probe.onload = () => resolve({ ok: true, width: probe.naturalWidth, height: probe.naturalHeight });
      probe.onerror = () => resolve({ ok: false });
      probe.src = url;
    });
    decoded.push({ url, status: response.status, type: response.headers.get('content-type'), ...image });
  }
  return decoded;
};

try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width > 1000 ? 950 : 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const entry = { width, presses: [] };
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('.footer-identity') !== null);
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await page.evaluate(() => document.querySelector('.page-footer').scrollIntoView({ block: 'end', behavior: 'instant' }));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.waitForTimeout(350);

      const measured = await page.evaluate(measure, INK_INTERACTIVE_SELECTOR);
      report.build ||= measured.build;
      entry.measured = measured;
      assert.ok(measured.build, `[${width}] the page carries data-build`);
      assert.ok(measured.zone.height >= 43.5, `[${width}] the band keeps its 44-px line (${measured.zone.height})`);
      assert.ok(measured.page.scrollWidth <= width + 1, `[${width}] the band never widens the page (${measured.page.scrollWidth} <= ${width + 1})`);
      assert.equal(measured.raster.offenders.length, 0,
        `[${width}] every point of the band resolves to the logo cursor: ${JSON.stringify(measured.raster.offenders.slice(0, 3))}`);
      assert.ok(measured.raster.points > width, `[${width}] the raster actually covered the band (${measured.raster.points} points)`);

      const urls = [...new Set(measured.raster.values.map(value => value.value).filter(value => value.startsWith('image:'))
        .map(value => value.slice(6)))];
      assert.ok(urls.length > 0, `[${width}] the cursor token names an image`);
      const assets = await page.evaluate(decodeAssets, urls);
      entry.assets = assets;
      for (const asset of assets) {
        assert.equal(asset.status, 200, `[${width}] ${asset.url} is served`);
        assert.ok(asset.ok && asset.width > 0 && asset.height > 0, `[${width}] ${asset.url} decodes to a real cursor image`);
      }

      // B-F36: below 600 px the two footer clusters wrap onto two lines inside
      // the 90-px band. Desktop keeps the single line. The old assertion
      // demanded one baseline everywhere and was red since that change.
      const rows = [];
      for (const item of measured.items) {
        assert.ok(item.height >= 43.5, `[${width}] ${item.element} keeps a 44-px target (${item.height})`);
        const row = rows.find(candidate => Math.abs(candidate.top - item.top) <= 2);
        if (row) row.items.push(item);
        else rows.push({ top: item.top, items: [item] });
      }
      assert.ok(rows.length <= (width <= 600 ? 2 : 1),
        `[${width}] the band uses ${width <= 600 ? 'at most two' : 'one'} line(s) (${rows.map(row => row.top).join(', ')})`);
      assert.ok(Math.abs(rows[0].top - measured.zone.top) <= 2, `[${width}] the first line starts on the band top`);
      for (const row of rows) {
        const bottom = Math.max(...row.items.map(item => item.bottom));
        assert.ok(bottom <= measured.zone.bottom + 2, `[${width}] line ${row.top} stays inside the band (${bottom} <= ${measured.zone.bottom + 2})`);
      }
      for (let index = 1; index < rows.length; index++) {
        const previousBottom = Math.max(...rows[index - 1].items.map(item => item.bottom));
        assert.ok(rows[index].top >= previousBottom - 2, `[${width}] the two lines never overlap`);
      }
      const naavi = measured.items.find(item => item.element.includes('naavi'));
      if (naavi) assert.ok(Math.abs((naavi.top + naavi.height / 2) - (measured.zone.top + measured.zone.height / 2)) <= 2,
        `[${width}] NAAVI is centred in the band`);
      const gaps = new Set(measured.clusters.map(cluster => cluster.gap));
      assert.equal(gaps.size, 1, `[${width}] both clusters share one gap (${[...gaps].join(', ')})`);
      for (const cluster of measured.clusters) {
        assert.ok(parseFloat(cluster.gap) >= 8, `[${width}] ${cluster.selector} keeps a readable gap (${cluster.gap})`);
        assert.ok(cluster.tokenGap, `[${width}] ${cluster.selector} resolves its gap from --cluster-gap`);
        if (/^[0-9]/.test(cluster.tokenGap)) assert.equal(parseFloat(cluster.gap), parseFloat(cluster.tokenGap),
          `[${width}] ${cluster.selector} gap equals its token (${cluster.gap} vs ${cluster.tokenGap})`);
      }

      const points = await page.evaluate(freePoints, INK_INTERACTIVE_SELECTOR);
      assert.ok(points.length > 0, `[${width}] the band has a paintable surface`);
      entry.freePoints = points;
      for (const point of points) {
        const before = await page.evaluate(() => document.querySelectorAll('.ink-mark').length);
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.waitForTimeout(70);
        await page.mouse.up();
        await page.waitForTimeout(240);
        const after = await page.evaluate(markState);
        entry.presses.push({ ...point, before, after: after.length, marks: after });
        assert.equal(after.length, before + 1, `[${width}] a press on ${point.cluster} paints (${before} -> ${after.length})`);
        const mark = after.at(-1);
        assert.ok(mark.visible, `[${width}] the mark is inside the viewport ${JSON.stringify(mark)}`);
        assert.ok(Number(mark.opacity) > 0, `[${width}] the mark is visible (opacity ${mark.opacity})`);
      }

      const beforeLink = await page.evaluate(() => document.querySelectorAll('.ink-mark').length);
      const footerLink = page.locator('.footer-instagram');
      await footerLink.scrollIntoViewIfNeeded();

      // B-016 removed the impressum link and B-F29 removed the placeholder, so
      // link reachability is proven on the anchor that remains: a real press
      // reaches the link element itself and paints nothing. The press is
      // cancelled after the probe so the external target never opens here.
      await page.evaluate(() => {
        window.__h4LinkHit = null;
        document.querySelector('.footer-instagram').addEventListener('click', event => {
          window.__h4LinkHit = { trusted: event.isTrusted, tag: event.target.tagName,
            onLink: Boolean(event.target.closest('.footer-instagram')) };
          event.preventDefault();
        }, { once: true });
      });
      await footerLink.click();
      await page.waitForTimeout(120);
      const reached = await page.evaluate(() => window.__h4LinkHit);
      assert.equal(reached?.trusted, true, `[${width}] a real press still reaches the footer link`);
      assert.equal(reached?.onLink, true, `[${width}] the press lands on the link element`);
      assert.equal(await page.evaluate(() => document.querySelectorAll('.ink-mark').length), beforeLink,
        `[${width}] the link press paints nothing`);
      const external = await page.evaluate(() => {
        const link = document.querySelector('.footer-instagram');
        return link ? { href: link.getAttribute('href'), target: link.getAttribute('target'), rel: link.getAttribute('rel') } : null;
      });
      assert.ok(external?.href?.startsWith('https://') && external.target === '_blank' && external.rel.includes('noopener'),
        `[${width}] the remaining footer link keeps href/target/rel: ${JSON.stringify(external)}`);

      const cursorSummary = measured.raster.values.map(value => `${value.value}=${value.count}`).join(', ');
      console.log(`PASS B-F19 footer zone ${width}px build=${measured.build} raster=${measured.raster.points} (${cursorSummary}) ` +
        `presses=${entry.presses.length} marks-visible`);
    } catch (error) {
      entry.error = error.message;
      report.failures.push({ width, error: error.message, entry });
      console.log(`FAIL B-F19 footer zone ${width}px: ${error.message}`);
    } finally {
      report.profiles.push(entry);
      await save();
      await context.close();
    }
  }
} finally {
  await save();
  await browser.close();
}

assert.deepEqual(report.failures.map(failure => failure.width), [], `Footer zone contract failed at ${report.failures.map(failure => failure.width).join(', ')}`);
console.log(`PASS B-F19 footer zone contract — ${report.profiles.length}/3 viewports, build ${report.build}`);
