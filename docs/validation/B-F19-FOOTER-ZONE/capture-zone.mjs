/** B-F19-r4 — band evidence: hit-area map and ink press.
 *
 * The guard selector is read from the shipped source (src/ink-guard.js when it
 * exists, otherwise the inline constant in src/easter-eggs.js), so the map can
 * never drift from the code it documents.
 *
 *   H4_LABEL=before node docs/validation/B-F19-FOOTER-ZONE/capture-zone.mjs
 */
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const label = process.env.H4_LABEL || 'before';
const output = new URL('./', import.meta.url);
await mkdir(output, { recursive: true });

const shippedGuard = async () => {
  try {
    const module = await readFile(new URL('../../../src/ink-guard.js', import.meta.url), 'utf8');
    const match = module.match(/INK_INTERACTIVE_SELECTOR\s*=\s*'([^']+)'/);
    if (match) return { source: 'src/ink-guard.js', selector: match[1] };
  } catch { /* pre-fix tree: the selector still lives inline. */ }
  const inline = await readFile(new URL('../../../src/easter-eggs.js', import.meta.url), 'utf8');
  const match = inline.match(/const interactive = '([^']+)'/);
  if (!match) throw new Error('No ink guard selector found.');
  return { source: 'src/easter-eggs.js', selector: match[1] };
};
const guard = await shippedGuard();
console.log(`guard from ${guard.source}`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const paintMap = selector => {
  const identity = document.querySelector('.footer-identity').getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.dataset.zoneOverlay = '';
  Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '9999', pointerEvents: 'none' });
  let free = 0; let swallowed = 0;
  for (let y = identity.top + 2; y < identity.bottom - 2; y += 4) {
    for (let x = identity.left + 2; x < identity.right - 2; x += 4) {
      const hit = document.elementsFromPoint(x, y).find(element => getComputedStyle(element).pointerEvents !== 'none');
      if (!hit) continue;
      const isBlocked = Boolean(hit.closest(selector));
      if (isBlocked) swallowed += 1; else free += 1;
      const dot = document.createElement('i');
      Object.assign(dot.style, { position: 'fixed', left: `${x - 1.5}px`, top: `${y - 1.5}px`, width: '3px', height: '3px',
        background: isBlocked ? '#ff2d55' : '#2dff6a', opacity: '.85' });
      overlay.append(dot);
    }
  }
  document.body.append(overlay);
  return { free, swallowed };
};

const ringAt = point => {
  const ring = document.createElement('div');
  ring.dataset.zoneRing = '';
  Object.assign(ring.style, { position: 'fixed', left: `${point.x - 14}px`, top: `${point.y - 14}px`, width: '28px', height: '28px',
    border: '1px solid #ff2d55', borderRadius: '50%', zIndex: '9998', pointerEvents: 'none' });
  document.body.append(ring);
};

/** A point that belongs to the cluster surface itself — not to an item. */
const emptyClusterPoint = () => {
  const identity = document.querySelector('.footer-identity').getBoundingClientRect();
  for (const clusterSelector of ['.footer-left', '.footer-details']) {
    const cluster = document.querySelector(clusterSelector).getBoundingClientRect();
    for (let y = identity.top + identity.height / 2; y < identity.bottom - 4; y += 3) {
      for (let x = Math.max(cluster.left, 0) + 2; x < Math.min(cluster.right, innerWidth) - 2; x += 2) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || hit.closest('.row-item') || hit.closest('.arrow')) continue;
        if (hit === hit.closest('.footer-left, .footer-details')) {
          return { x: +x.toFixed(1), y: +y.toFixed(1), hit: `${hit.tagName.toLowerCase()}.${String(hit.className).trim()}` };
        }
      }
    }
  }
  return null;
};

for (const width of [1440, 390, 320]) {
  const context = await browser.newContext({ viewport: { width, height: width > 1000 ? 950 : 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(400);
  const bounds = await page.evaluate(() => {
    const identity = document.querySelector('.footer-identity').getBoundingClientRect();
    return { top: identity.top, bottom: identity.bottom };
  });
  const clip = { x: 0, y: Math.max(0, bounds.top - 26), width, height: Math.min(bounds.bottom - bounds.top + 52, 200) };
  await page.screenshot({ path: new URL(`band-${label}-${width}.png`, output).pathname, clip });

  const map = await page.evaluate(paintMap, guard.selector);
  await page.screenshot({ path: new URL(`hitarea-${label}-${width}.png`, output).pathname, clip });
  await page.evaluate(() => document.querySelector('[data-zone-overlay]')?.remove());

  const point = await page.evaluate(emptyClusterPoint);
  if (point) {
    await page.evaluate(ringAt, point);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.mouse.up();
    await page.waitForTimeout(280);
    await page.screenshot({ path: new URL(`ink-${label}-${width}.png`, output).pathname, clip });
    const marks = await page.evaluate(() => [...document.querySelectorAll('.ink-mark')].map(mark => {
      const rect = mark.getBoundingClientRect();
      return { left: +rect.left.toFixed(1), top: +rect.top.toFixed(1), width: +rect.width.toFixed(1), opacity: getComputedStyle(mark).opacity };
    }));
    console.log(`${label} ${width}: press at ${point.x},${point.y} on ${point.hit} -> ${marks.length} mark(s) ${JSON.stringify(marks)}`);
  } else {
    console.log(`${label} ${width}: no empty cluster point found`);
  }
  console.log(`${label} ${width}: hit-area ${map.free} paintable / ${map.swallowed} swallowed`);
  await context.close();
}
await browser.close();
