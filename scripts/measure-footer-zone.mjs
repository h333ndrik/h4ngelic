/** B-F19 measurement only: the footer clusters are native scroll containers.
 * This script records their scroll metrics, forces a classic scrollbar to show
 * how much of the 44px row a real gutter would eat, and samples the footer zone
 * on a 2px grid to prove which element actually owns every point.
 *
 *   H4_BASE_URL=http://127.0.0.1:55173 node scripts/measure-footer-zone.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../docs/validation/B-F19-CURSOR-FOOTER-ZONE/', import.meta.url);
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

// Everything below the page boundary must be self-contained: Playwright
// serialises the function, so helpers live inside it.
const readMetrics = () => {
  const activeWebkitRules = element => {
    const rules = [];
    for (const sheet of document.styleSheets) {
      let list; try { list = sheet.cssRules; } catch { continue; }
      for (const rule of list) {
        if (!rule.selectorText?.includes('-webkit-scrollbar')) continue;
        let matched = false;
        try { matched = element.matches(rule.selectorText.split('::-webkit-scrollbar')[0] || '*'); } catch { matched = false; }
        if (matched) rules.push(`${rule.selectorText} { ${rule.style.cssText} }`);
      }
    }
    return rules;
  };
  return Array.from(document.querySelectorAll('.footer-left, .footer-details')).map(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      container: element.className,
      scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
      scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
      offsetHeight: element.offsetHeight, overflowX: style.overflowX, overflowY: style.overflowY,
      scrollbarWidth: style.scrollbarWidth, scrollbarGutter: style.scrollbarGutter,
      webkitScrollbarRules: activeWebkitRules(element),
      gutter: +(element.offsetHeight - element.clientHeight).toFixed(2),
      rect: { left: +rect.left.toFixed(2), right: +rect.right.toFixed(2), top: +rect.top.toFixed(2), bottom: +rect.bottom.toFixed(2) },
    };
  });
};
const readMetricsWithRules = () => readMetrics();

const reports = [];
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      // The home page grows while it settles (end reveal), so scroll twice and
      // confirm the footer row is actually inside the viewport before sampling.
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(400);
      await page.evaluate(() => { document.querySelector('[data-footer-row]').scrollIntoView({ block: 'end', behavior: 'instant' }); });
      await page.waitForTimeout(400);
      const inView = await page.evaluate(() => {
        const rect = document.querySelector('[data-footer-row]').getBoundingClientRect();
        return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), viewport: innerHeight, inside: rect.top >= 0 && rect.bottom <= innerHeight + 1 };
      });
      if (!inView.inside) throw new Error(`footer row not in view: ${JSON.stringify(inView)}`);

      const natural = await page.evaluate(readMetrics);

      // Gutter experiment: force a classic, space-taking scrollbar.
      const gutter = await page.evaluate(() => {
        const before = Array.from(document.querySelectorAll('.footer-left, .footer-details')).map(element => element.clientHeight);
        const style = document.createElement('style');
        style.id = 'h4-gutter-probe';
        style.textContent = '*::-webkit-scrollbar { display: block !important; width: 16px !important; height: 16px !important; }'
          + '.footer-left, .footer-details { scrollbar-width: auto !important; }';
        document.head.append(style);
        const after = Array.from(document.querySelectorAll('.footer-left, .footer-details')).map(element => ({
          clientHeight: element.clientHeight, offsetHeight: element.offsetHeight,
          clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
        return { before, after };
      });
      await page.waitForTimeout(120);
      const gutterMetrics = await page.evaluate(readMetrics);
      await page.screenshot({ path: new URL(`gutter-forced-${width}.png`, output).pathname, clip: { x: 0, y: 780, width, height: 120 } });
      await page.evaluate(() => document.getElementById('h4-gutter-probe')?.remove());
      await page.waitForTimeout(120);
      await page.screenshot({ path: new URL(`zone-${width}.png`, output).pathname, clip: { x: 0, y: 780, width, height: 120 } });

      // 2px point sampling over the clusters plus 8px outside their edges.
      const sampling = await page.evaluate(() => {
        const cursorRuleWinner = element => {
          const winners = [];
          for (const sheet of document.styleSheets) {
            let list; try { list = sheet.cssRules; } catch { continue; }
            for (const rule of list) {
              if (!rule.selectorText || !rule.style?.cursor) continue;
              let matched = false;
              try { matched = element.matches(rule.selectorText.replace(/::?(?:before|after)/g, '')); } catch { matched = false; }
              if (matched) winners.push({ selector: rule.selectorText, cursor: rule.style.cursor, important: rule.style.getPropertyPriority('cursor') === 'important' });
            }
          }
          return winners;
        };
        // Compare the image part only: the trailing generic keyword (auto vs
        // pointer) is the documented per-level fallback, not a foreign cursor.
        const imagePart = value => value.split(/,\s*(?:auto|pointer|default|none|grab|grabbing)\s*$/)[0];
        const logo = imagePart(getComputedStyle(document.querySelector('.footer-brand')).cursor);
        const zones = ['.footer-left', '.footer-details', '[data-naavi]'].flatMap(selector => {
          const element = document.querySelector(selector); if (!element) return [];
          const r = element.getBoundingClientRect();
          return [{ selector, left: r.left, right: r.right, top: r.top, bottom: r.bottom }];
        });
        const points = [], deviations = [];
        const seen = new Set();
        for (const zone of zones) {
          for (let y = Math.max(0, zone.top - 8); y <= zone.bottom + 8; y += 2) {
            for (let x = Math.max(0, zone.left - 8); x <= Math.min(innerWidth - 1, zone.right + 8); x += 2) {
              const key = `${x}:${y}`;
              if (seen.has(key)) continue;
              seen.add(key);
              const stack = document.elementsFromPoint(x, y).slice(0, 4).map(element => ({
                tag: element.tagName, className: typeof element.className === 'string' ? element.className : '',
                cursor: getComputedStyle(element).cursor,
                pointerEvents: getComputedStyle(element).pointerEvents,
              }));
              const top = stack.find(entry => entry.pointerEvents !== 'none') || stack[0];
              if (!top) continue;
              points.push({ x, y, top });
              if (imagePart(top.cursor) !== logo) {
                const element = document.elementsFromPoint(x, y)[0];
                const scroller = element?.closest('.footer-left, .footer-details');
                deviations.push({ x, y, top, scroller: scroller?.className || null, rules: element ? cursorRuleWinner(element) : [] });
              }
            }
          }
        }
        return { logo, sampled: points.length, deviations, directBelow: points.filter(point => point.y > 780 && point.y < 900).length };
      });

      // Where does a point 8px below the cluster bottom land?
      const below = await page.evaluate(() => Array.from(document.querySelectorAll('.footer-left, .footer-details')).map(element => {
        const r = element.getBoundingClientRect();
        const stack = document.elementsFromPoint(r.left + 4, r.bottom + 8).slice(0, 4).map(node => ({
          tag: node.tagName, className: typeof node.className === 'string' ? node.className : '',
          cursor: getComputedStyle(node).cursor }));
        return { container: element.className, stack };
      }));

      // Rule out the remaining candidates with facts, not opinions.
      const hypotheses = await page.evaluate(() => {
        const row = document.querySelector('[data-footer-row]');
        const rect = row.getBoundingClientRect();
        const centre = { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
        const covering = Array.from(document.querySelectorAll('body *')).filter(element => {
          const style = getComputedStyle(element);
          if (!['fixed', 'absolute'].includes(style.position) || style.display === 'none' || style.visibility === 'hidden') return false;
          if (style.pointerEvents === 'none') return false;
          const box = element.getBoundingClientRect();
          return box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top
            && !row.contains(element) && !element.contains(row);
        }).map(element => ({ tag: element.tagName, className: String(element.className).slice(0, 60), pointerEvents: getComputedStyle(element).pointerEvents }));
        const layers = [];
        for (let node = row; node && node !== document.documentElement; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.transform !== 'none' || style.filter !== 'none' || style.willChange !== 'auto'
            || style.contain !== 'none' || style.perspective !== 'none') {
            layers.push({ tag: node.tagName, className: String(node.className).slice(0, 40),
              transform: style.transform, filter: style.filter, willChange: style.willChange, contain: style.contain });
          }
        }
        const cursorMedia = [];
        for (const sheet of document.styleSheets) {
          let list; try { list = sheet.cssRules; } catch { continue; }
          const walk = (rules, context) => {
            for (const rule of rules) {
              if (rule.cssRules) { walk(rule.cssRules, rule.conditionText || rule.media?.mediaText || context); continue; }
              if (rule.style?.cursor) cursorMedia.push({ context: context || null, selector: rule.selectorText, cursor: rule.style.cursor });
            }
          };
          walk(list, null);
        }
        return {
          iframes: document.querySelectorAll('iframe').length,
          coveringLayers: covering,
          compositingAncestors: layers,
          cursorDeclarationsInMediaQueries: cursorMedia.filter(entry => entry.context),
          cursorDeclarationCount: cursorMedia.length,
        };
      });
      reports.push({ width, natural, gutter, gutterMetrics, hypotheses, sampling: { ...sampling, deviations: sampling.deviations.slice(0, 25) }, below });
      console.log(`MEASURED ${width}px: ${sampling.sampled} points, ${sampling.deviations.length} cursor deviations, gutter ${gutter.before} -> ${gutter.after.map(a => a.clientHeight).join('/')}px client height.`);
    } finally {
      await context.close();
    }
  }
} finally {
  await writeFile(new URL('measurement.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), base, reports }, null, 2));
  await browser.close();
}
