/** B-F19-r4 — deep footer-zone probe (cursor + ink, one band).
 *
 * 1. Zone bounds and every footer item.
 * 2. Scroll metrics of the two clusters (does a native scrollbar own part of
 *    the band? does the content overflow its column?).
 * 3. 2-px raster over the whole band: computed cursor at every point, counted
 *    by value. A fallback such as `auto` would show up here as a system arrow.
 * 4. Cursor assets: every url() in the cursor token is fetched AND decoded —
 *    a 404 keeps the CSS string intact while the browser falls back to `auto`.
 * 5. Ink: one press in the free band surface and one in the strip below it.
 *
 *   H4_BASE_URL=http://127.0.0.1:55232 node docs/validation/B-F19-FOOTER-ZONE/probe-zone-deep.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const label = process.env.H4_PROBE_LABEL || 'local';
const output = new URL('./', import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, label, build: '', profiles: [], failures: [] };

const measureZone = () => {
  const describe = element => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${typeof element.className === 'string' && element.className ? `.${element.className.trim().replace(/\s+/g, '.')}` : ''}`;
  const box = element => { const rect = element.getBoundingClientRect();
    return { top: +rect.top.toFixed(1), bottom: +rect.bottom.toFixed(1), left: +rect.left.toFixed(1), right: +rect.right.toFixed(1),
      width: +rect.width.toFixed(1), height: +rect.height.toFixed(1) }; };
  const cluster = element => {
    const style = getComputedStyle(element);
    return { element: describe(element), ...box(element), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight, offsetHeight: element.offsetHeight,
      overflowX: style.overflowX, overflowY: style.overflowY, scrollbarWidth: style.scrollbarWidth,
      touchAction: style.touchAction, pointerEvents: style.pointerEvents, cursor: style.cursor, tabIndex: element.tabIndex };
  };
  const identity = document.querySelector('.footer-identity');
  const footer = document.querySelector('.page-footer');
  const items = [...document.querySelectorAll('.footer-identity .row-item, .footer-identity .footer-visit, .footer-identity [data-naavi]')]
    .map(element => ({ element: describe(element), ...box(element), pointerEvents: getComputedStyle(element).pointerEvents }));
  return {
    page: { scrollY, innerHeight, scrollHeight: document.documentElement.scrollHeight, innerWidth },
    footer: box(footer), identity: box(identity), items,
    clusters: ['.footer-left', '.footer-details'].map(selector => cluster(document.querySelector(selector))),
    build: document.documentElement.dataset.build || null,
  };
};

const raster = () => {
  const identity = document.querySelector('.footer-identity').getBoundingClientRect();
  const values = new Map();
  const offenders = [];
  let points = 0;
  for (let y = identity.top + 1; y < identity.bottom - 1; y += 2) {
    for (let x = identity.left + 1; x < identity.right - 1; x += 2) {
      const element = document.elementFromPoint(x, y);
      if (!element) { offenders.push({ x: +x.toFixed(1), y: +y.toFixed(1), element: 'none', cursor: 'none' }); continue; }
      const cursor = getComputedStyle(element).cursor;
      points += 1;
      const key = /url\(/.test(cursor) ? `image:${(cursor.match(/url\("?([^")]+)"?\)/) || [])[1] || 'unknown'}` : cursor;
      values.set(key, (values.get(key) || 0) + 1);
      if (!/url\(/.test(cursor) && offenders.length < 20) offenders.push({ x: +x.toFixed(1), y: +y.toFixed(1),
        element: `${element.tagName.toLowerCase()}.${String(element.className)}`, cursor });
    }
  }
  return { points, values: [...values.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count })), offenders };
};

const assets = async urls => {
  const results = [];
  for (const url of urls) {
    const decoded = await new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve({ ok: true, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ ok: false });
      image.src = url;
    });
    const response = await fetch(url, { cache: 'no-store' }).then(reply => ({ status: reply.status, type: reply.headers.get('content-type') })).catch(error => ({ error: String(error) }));
    results.push({ url, ...decoded, ...response });
  }
  return results;
};

try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width > 1000 ? 950 : 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const entry = { width, clicks: [], assets: [] };
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('.footer-identity') !== null);
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true', { timeout: 8000 }).catch(() => {});
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(400);
      entry.zone = await page.evaluate(measureZone);
      report.build ||= entry.zone.build;
      entry.raster = await page.evaluate(raster);
      const urls = [...new Set(entry.raster.values.map(value => value.value).filter(value => value.startsWith('image:'))
        .map(value => value.slice(6)))];
      entry.assets = await page.evaluate(assets, urls);

      const free = await page.evaluate(() => {
        const identity = document.querySelector('.footer-identity').getBoundingClientRect();
        const blocked = 'a,button,input,textarea,select,label,form,nav,summary,canvas,dialog,[controls],[draggable="true"],[role="button"],[role="link"],[role="checkbox"],[role="switch"],[role="radio"],[role="tab"],[role="menuitem"],[role="combobox"],[role="slider"],[role="spinbutton"],[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"]),[aria-disabled="true"],.is-unconfigured,[data-no-ink]';
        for (let y = identity.bottom - 4; y > identity.top + 4; y -= 4) {
          for (let x = identity.left + 6; x < identity.right - 6; x += 4) {
            const hit = document.elementFromPoint(x, y);
            if (!hit) continue;
            const blocker = hit.closest(blocked);
            if (!blocker) return { x: +x.toFixed(1), y: +y.toFixed(1), hit: `${hit.tagName.toLowerCase()}.${String(hit.className).trim()}` };
          }
        }
        return null;
      });
      entry.free = free;
      if (free) {
        const before = await page.evaluate(() => document.querySelectorAll('.ink-mark').length);
        await page.mouse.move(free.x, free.y);
        await page.mouse.down();
        await page.waitForTimeout(80);
        await page.mouse.up();
        await page.waitForTimeout(300);
        const after = await page.evaluate(() => document.querySelectorAll('.ink-mark').length);
        entry.clicks.push({ where: 'band-free-space', ...free, before, after });
      }
      const lower = await page.evaluate(() => {
        const footer = document.querySelector('.page-footer').getBoundingClientRect();
        return { x: +(footer.left + footer.width / 2).toFixed(1), y: +(footer.bottom - 2).toFixed(1) };
      });
      if (lower.y < entry.zone.page.innerHeight - 2) {
        const before = await page.evaluate(() => document.querySelectorAll('.ink-mark').length);
        await page.mouse.move(lower.x, lower.y);
        await page.mouse.down();
        await page.waitForTimeout(80);
        await page.mouse.up();
        await page.waitForTimeout(300);
        entry.clicks.push({ where: 'below-band', ...lower, before, after: await page.evaluate(() => document.querySelectorAll('.ink-mark').length) });
      }
      report.profiles.push(entry);
      const rasterValues = entry.raster.values.map(value => `${value.value}=${value.count}`).join(', ');
      console.log(`${label} ${width}px build=${entry.zone.build} zone ${entry.zone.identity.top}..${entry.zone.identity.bottom}`);
      console.log(`  raster ${entry.raster.points} points: ${rasterValues}`);
      console.log(`  assets: ${entry.assets.map(asset => `${asset.url.split('/').pop()} ${asset.status ?? asset.error} ${asset.ok ? `${asset.width}x${asset.height}` : 'DECODE-FAIL'}`).join(' | ')}`);
      console.log(`  clusters: ${entry.zone.clusters.map(cluster => `${cluster.element} ${cluster.clientWidth}/${cluster.scrollWidth} overflow=${cluster.overflowX}`).join(' | ')}`);
      console.log(`  ink clicks: ${entry.clicks.map(click => `${click.where} ${click.before}->${click.after}`).join('; ')}`);
    } catch (error) {
      report.failures.push({ width, error: error.stack });
      console.log(`${label} ${width}px FAILED: ${error.message}`);
    } finally { await context.close(); }
  }
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(new URL(`zone-deep-${label}.json`, output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
