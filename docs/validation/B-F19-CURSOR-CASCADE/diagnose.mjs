/** B-F19 diagnosis (GATEPREP-2, Batch 2, Phase 0).
 *
 * Reports, for every region the user reported: the computed cursor, the CSS
 * rule that actually wins (source, specificity, !important), the inline style,
 * whether the point sits on a native scroll gutter, and the elementsFromPoint
 * chain. Read-only.
 *
 *   H4_BASE_URL=http://127.0.0.1:55232 node docs/validation/B-F19-CURSOR-CASCADE/diagnose.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installCursorCascadeProbe } from '../../../tests/helpers/cursor-cascade.mjs';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const output = new URL('./', import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, build: '', profiles: [], gutter: [], failures: [] };

const probe = (target) => {
  const describe = element => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className && typeof element.className === 'string' ? `.${element.className.trim().replace(/\s+/g, '.')}` : ''}`;
  const element = document.querySelector(target.selector);
  if (!element) return { target: target.name, selector: target.selector, missing: true };
  const style = getComputedStyle(element);
  const winners = window.__h4CursorCascade?.winners(element) || [];
  const winner = winners[0] || null;
  return {
    target: target.name, selector: target.selector, element: describe(element),
    cursor: style.cursor, pointerEvents: style.pointerEvents, display: style.display,
    inlineCursor: element.style.cursor || null,
    winner: winner ? { selector: winner.selector, value: winner.value, important: winner.important,
      spec: winner.spec, href: winner.href, media: winner.media || '' } : null,
    runnersUp: winners.slice(1, 4).map(entry => ({ selector: entry.selector, value: entry.value,
      important: entry.important, spec: entry.spec, href: entry.href })),
    scrolls: { scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
      overflowX: style.overflowX, scrollbarWidth: style.scrollbarWidth },
  };
};

const pointAt = (point) => {
  const describe = element => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className && typeof element.className === 'string' ? `.${element.className.trim().replace(/\s+/g, '.')}` : ''}`;
  const stack = document.elementsFromPoint(point.x, point.y);
  const top = stack.find(element => getComputedStyle(element).pointerEvents !== 'none') || document.documentElement;
  const winner = window.__h4CursorCascade?.winners(top)[0] || null;
  return { x: point.x, y: point.y, cursor: getComputedStyle(top).cursor, element: describe(top),
    winner: winner ? { selector: winner.selector, important: winner.important, href: winner.href } : null,
    stack: stack.slice(0, 5).map(element => ({ element: describe(element), cursor: getComputedStyle(element).cursor,
      pointerEvents: getComputedStyle(element).pointerEvents })) };
};

// A point sits on a native gutter when the element under it scrolls and the
// point lies within the last few pixels of that scroller's client box.
const gutterAt = (point) => {
  const describe = element => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className && typeof element.className === 'string' ? `.${element.className.trim().replace(/\s+/g, '.')}` : ''}`;
  const element = document.elementFromPoint(point.x, point.y);
  const chain = [];
  for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (!['auto', 'scroll'].includes(style.overflowX)) continue;
    const rect = node.getBoundingClientRect();
    chain.push({ element: describe(node), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
      scrollable: node.scrollWidth > node.clientWidth,
      offsetFromRight: Math.round(rect.right - point.x), offsetFromLeft: Math.round(point.x - rect.left),
      offsetFromBottom: Math.round(rect.bottom - point.y), offsetFromTop: Math.round(point.y - rect.top),
      scrollbarWidth: style.scrollbarWidth });
  }
  return { x: point.x, y: point.y, chain, top: element ? describe(element) : null };
};

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width > 1000 ? 950 : 844 }, deviceScaleFactor: 1 });
    await context.addInitScript(installCursorCascadeProbe);
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const entry = { width, targets: [], points: [], gutter: [] };
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      report.build ||= await page.locator('html').getAttribute('data-build');
      await page.waitForTimeout(400);

      const homeTargets = [
        { name: 'naavi-link', selector: '[data-naavi]' },
        { name: 'naavi-slash', selector: '[data-naavi] .chapter-total' },
        { name: 'naavi-count', selector: '[data-naavi] .chapter-digit' },
        { name: 'footer-left', selector: '.footer-left' },
        { name: 'footer-brand', selector: '.footer-left .footer-brand' },
        { name: 'footer-visit', selector: '.footer-visit' },
        { name: 'footer-moshlab', selector: '.footer-moshlab' },
        { name: 'footer-details', selector: '.footer-details' },
        { name: 'footer-instagram', selector: '.footer-instagram' },
        { name: 'index-closed', selector: '[data-global-index] summary' },
        { name: 'hero-canvas', selector: '#stage canvas' },
        { name: 'rubric-link', selector: '.category-link' },
        { name: 'form-field', selector: '#home-inquiry-name' },
      ];
      for (const target of homeTargets) entry.targets.push(await page.evaluate(probe, target));

      // INDEX open.
      await page.locator('[data-global-index] summary').click();
      await page.waitForTimeout(250);
      entry.targets.push(await page.evaluate(probe, { name: 'index-open', selector: '[data-global-index] nav a' }));
      entry.targets.push(await page.evaluate(probe, { name: 'index-panel', selector: '[data-global-index] nav' }));
      await page.keyboard.press('Escape').catch(() => {});

      // Ten points across the footer and the NAAVI. The footer sits far below
      // the fold, so it must be scrolled in before points can hit it.
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(350);
      for (const [name, selector] of [['footer', '.footer-identity'], ['naavi', '[data-naavi]']]) {
        const box = await page.locator(selector).boundingBox();
        if (!box) continue;
        for (let index = 0; index < 10; index += 1) {
          const x = box.x + (box.width * (index + .5)) / 10;
          const y = box.y + box.height / 2;
          entry.points.push({ region: name, ...await page.evaluate(pointAt, { x, y }) });
        }
      }
      // Gutters: 2px inside and outside every edge of the scroll clusters.
      for (const selector of ['.footer-left', '.footer-details']) {
        const box = await page.locator(selector).boundingBox();
        if (!box) continue;
        for (const [label, x, y] of [
          ['left-in', box.x + 2, box.y + box.height / 2], ['left-out', box.x - 2, box.y + box.height / 2],
          ['right-in', box.x + box.width - 2, box.y + box.height / 2], ['right-out', box.x + box.width + 2, box.y + box.height / 2],
        ]) entry.gutter.push({ selector, label, ...await page.evaluate(gutterAt, { x, y }) });
      }

      // Work page: rubric bar, tool bar, viewer navigation.
      await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await page.waitForTimeout(300);
      entry.targets.push(await page.evaluate(probe, { name: 'work-filters', selector: '.work-filters' }));
      entry.targets.push(await page.evaluate(probe, { name: 'work-filter-link', selector: '.work-filters .filter-link' }));
      const bar = await page.locator('.work-filters').boundingBox();
      if (bar) {
        for (const [label, x, y] of [
          ['bar-left-in', bar.x + 2, bar.y + bar.height / 2], ['bar-left-out', bar.x - 2, bar.y + bar.height / 2],
          ['bar-right-in', bar.x + bar.width - 2, bar.y + bar.height / 2], ['bar-right-out', bar.x + bar.width + 2, bar.y + bar.height / 2],
        ]) entry.gutter.push({ selector: '.work-filters', label, ...await page.evaluate(gutterAt, { x, y }) });
      }
      await page.evaluate(() => document.querySelector('[data-artwork-open]')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForTimeout(400);
      const openBox = await page.locator('[data-artwork-open]').first().boundingBox().catch(() => null);
      if (openBox) {
        await page.mouse.click(openBox.x + openBox.width / 2, openBox.y + openBox.height / 2);
        await page.locator('.artwork-dialog[open]').waitFor({ timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(900);
        entry.targets.push(await page.evaluate(probe, { name: 'viewer-nav', selector: '.artwork-viewer-navigation' }));
        entry.targets.push(await page.evaluate(probe, { name: 'viewer-button', selector: '.artwork-viewer-navigation button' }));
        entry.targets.push(await page.evaluate(probe, { name: 'viewer-caption', selector: '.artwork-viewer-caption' }));
        const backdrop = await page.evaluate(() => {
          const stack = document.elementsFromPoint(6, 6);
          const top = stack.find(element => getComputedStyle(element).pointerEvents !== 'none') || document.documentElement;
          const winner = window.__h4CursorCascade?.winners(top)[0] || null;
          return { cursor: getComputedStyle(top).cursor, tag: top.tagName, className: String(top.className || ''),
            winner: winner ? { selector: winner.selector, important: winner.important } : null,
            backdrop: (() => { const dialog = document.querySelector('dialog[open]'); if (!dialog) return null;
              return getComputedStyle(dialog, '::backdrop').cursor; })() };
        });
        entry.backdrop = backdrop;
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(400);
      }

      await page.goto(new URL('/creative/tools/m4shlab', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await page.waitForTimeout(250);
      entry.targets.push(await page.evaluate(probe, { name: 'tool-filters', selector: '.work-filters' }));

      report.profiles.push(entry);
      const bad = entry.targets.filter(target => target.cursor && !/url\(/.test(target.cursor));
      console.log(`${width}px: ${entry.targets.length} targets, ${bad.length} without cursor image${bad.length ? ': ' + bad.map(target => `${target.target}=${target.cursor}`).join(', ') : ''}`);
      for (const target of entry.targets) {
        console.log(`  ${width} ${target.target.padEnd(18)} ${String(target.cursor).slice(0, 28).padEnd(28)} winner=${target.winner ? `${target.winner.selector} [${target.winner.spec}] imp=${target.winner.important}` : 'none'}`);
      }
    } catch (error) {
      report.failures.push({ width, error: error.stack });
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(new URL('phase0-diagnosis.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
