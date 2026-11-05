/** B-F19-r4 — footer zone diagnosis (cursor + ink together).
 *
 * Measures the band that carries the footer items: exact bounds, the element
 * chain at ten points, why a click there does or does not create ink, the
 * stacking chain, shadow-root membership and the ink layer height.
 *
 *   H4_BASE_URL=http://127.0.0.1:55232 node docs/validation/B-F19-FOOTER-ZONE/diagnose-zone.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installCursorCascadeProbe } from '../../../tests/helpers/cursor-cascade.mjs';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const output = new URL('./', import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, build: '', profiles: [], failures: [] };

const zone = () => {
  const describe = element => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${typeof element.className === 'string' && element.className ? `.${element.className.trim().replace(/\s+/g, '.')}` : ''}`;
  const box = element => { if (!element) return null; const rect = element.getBoundingClientRect();
    return { top: +rect.top.toFixed(1), bottom: +rect.bottom.toFixed(1), left: +rect.left.toFixed(1), right: +rect.right.toFixed(1), height: +rect.height.toFixed(1) }; };
  const footer = document.querySelector('.page-footer');
  const identity = document.querySelector('.footer-identity');
  const items = [...document.querySelectorAll('.footer-identity .row-item, .footer-identity .footer-visit, [data-naavi]')]
    .map(element => ({ element: describe(element), ...box(element) }));
  const layer = document.querySelector('.ink-layer');
  const composition = document.querySelector('[data-page-composition]');
  const chain = [];
  for (let node = footer; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    chain.push({ element: describe(node), position: style.position, zIndex: style.zIndex, transform: style.transform,
      filter: style.filter, willChange: style.willChange, contain: style.contain, overflow: style.overflow,
      cursor: style.cursor, root: node.getRootNode() === document ? 'document' : 'other' });
  }
  return {
    footer: box(footer), identity: box(identity), items,
    zoneTop: identity ? box(identity).top : null, zoneBottom: identity ? box(identity).bottom : null,
    scrollY: scrollY, innerHeight, scrollHeight: document.documentElement.scrollHeight,
    inkLayer: layer ? { ...box(layer), clientHeight: layer.clientHeight, zIndex: getComputedStyle(layer).zIndex,
      position: getComputedStyle(layer).position, offsetParent: describe(layer.offsetParent), marks: layer.querySelectorAll('.ink-mark').length } : null,
    composition: composition ? { ...box(composition), clientHeight: composition.clientHeight, position: getComputedStyle(composition).position } : null,
    stacking: chain,
    shadow: [...document.querySelectorAll('.page-footer, .page-footer *')].some(element => element.getRootNode() !== document),
  };
};

const point = ({ x, y }) => {
  const describe = element => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${typeof element.className === 'string' && element.className ? `.${element.className.trim().replace(/\s+/g, '.')}` : ''}`;
  const stack = document.elementsFromPoint(x, y);
  const interactive = 'a,button,input,textarea,select,label,form,nav,summary,canvas,dialog,[controls],[draggable="true"],[role="button"],[role="link"],[role="checkbox"],[role="switch"],[role="radio"],[role="tab"],[role="menuitem"],[role="combobox"],[role="slider"],[role="spinbutton"],[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"]),[aria-disabled="true"],.is-unconfigured,[data-no-ink]';
  const hit = stack.find(element => getComputedStyle(element).pointerEvents !== 'none') || document.documentElement;
  const blocker = hit?.closest(interactive);
  const winner = window.__h4CursorCascade?.winners(hit)[0] || null;
  return {
    x: +x.toFixed(1), y: +y.toFixed(1),
    hit: describe(hit), cursor: getComputedStyle(hit).cursor,
    inkBlockedBy: blocker ? describe(blocker) : null,
    matchedSelector: blocker ? interactive.split(',').find(selector => { try { return blocker.matches(selector.trim()); } catch { return false; } }) : null,
    winner: winner ? { selector: winner.selector, important: winner.important } : null,
    stack: stack.slice(0, 6).map(element => ({ element: describe(element), pointerEvents: getComputedStyle(element).pointerEvents,
      cursor: getComputedStyle(element).cursor, zIndex: getComputedStyle(element).zIndex })),
  };
};

const inkCount = () => document.querySelectorAll('.ink-mark').length;

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width > 1000 ? 950 : 844 }, deviceScaleFactor: 1 });
    await context.addInitScript(installCursorCascadeProbe);
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const entry = { width, points: [], clicks: [] };
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      report.build ||= await page.locator('html').getAttribute('data-build');
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(500);
      entry.zone = await page.evaluate(zone);

      const band = entry.zone.identity;
      for (let index = 0; index < 10; index += 1) {
        const x = band.left + (band.right - band.left) * ((index + .5) / 10);
        const y = band.top + band.height / 2;
        await page.mouse.move(x, y);
        entry.points.push(await page.evaluate(point, { x, y }));
      }

      // Free-space click inside the band (between two items), then the same
      // gesture 40px below the band.
      const free = await page.evaluate(() => {
        const identity = document.querySelector('.footer-identity').getBoundingClientRect();
        const items = [...document.querySelectorAll('.footer-identity .row-item')].map(element => element.getBoundingClientRect());
        for (let x = identity.left + 4; x < identity.right - 4; x += 4) {
          const y = identity.top + identity.height / 2;
          if (items.some(item => x >= item.left - 2 && x <= item.right + 2 && y >= item.top && y <= item.bottom)) continue;
          const hit = document.elementFromPoint(x, y);
          if (hit) return { x, y, hit: `${hit.tagName}.${String(hit.className)}` };
        }
        return null;
      });
      if (free) {
        const before = await page.evaluate(inkCount);
        await page.mouse.move(free.x, free.y);
        await page.mouse.down();
        await page.waitForTimeout(80);
        await page.mouse.up();
        await page.waitForTimeout(260);
        const after = await page.evaluate(inkCount);
        entry.clicks.push({ where: 'band-free-space', ...free, before, after,
          reason: await page.evaluate(point, free),
          mark: await page.evaluate(() => {
            const mark = document.querySelector('.ink-mark');
            if (!mark) return null;
            const rect = mark.getBoundingClientRect();
            return { top: +rect.top.toFixed(1), left: +rect.left.toFixed(1), width: +rect.width.toFixed(1),
              opacity: getComputedStyle(mark).opacity, zIndex: getComputedStyle(mark).zIndex,
              layer: mark.parentElement?.className, layerHeight: mark.parentElement?.clientHeight };
          }) });
      }
      const below = { x: entry.zone.footer.left + entry.zone.footer.width / 2, y: entry.zone.footer.bottom + 8 };
      if (below.y < entry.zone.innerHeight - 4) {
        const before = await page.evaluate(inkCount);
        await page.mouse.move(below.x, below.y);
        await page.mouse.down();
        await page.waitForTimeout(80);
        await page.mouse.up();
        await page.waitForTimeout(260);
        entry.clicks.push({ where: 'below-band', ...below, before, after: await page.evaluate(inkCount),
          reason: await page.evaluate(point, below) });
      }

      report.profiles.push(entry);
      const inkPoints = entry.points.filter(sample => sample.inkBlockedBy);
      console.log(`${width}px zone ${entry.zone.zoneTop}..${entry.zone.zoneBottom}, points with ink blocker: ${inkPoints.length}/10`);
      console.log(`  blockers: ${[...new Set(inkPoints.map(sample => `${sample.inkBlockedBy} via ${sample.matchedSelector}`))].join(' | ')}`);
      console.log(`  clicks: ${entry.clicks.map(click => `${click.where}: ${click.before}->${click.after}`).join('; ')}`);
      console.log(`  ink layer: ${entry.zone.inkLayer ? `${entry.zone.inkLayer.clientHeight}px vs doc ${entry.zone.scrollHeight}px` : 'missing'}`);
      console.log(`  cursor values: ${[...new Set(entry.points.map(sample => /url\(/.test(sample.cursor) ? 'image' : sample.cursor))].join(',')}`);
    } catch (error) {
      report.failures.push({ width, error: error.stack });
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(new URL('zone-diagnosis.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
