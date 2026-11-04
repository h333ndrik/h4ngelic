import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_CURSOR_HIT_ARTIFACTS || 'artifacts/v312/r4-hit'}/`, import.meta.url);
const reportName = process.env.H4_CURSOR_HIT_REPORT_NAME || 'results.json';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, build: '', profiles: [], xray: null, failures: [] };
const save = () => writeFile(new URL(reportName, output), JSON.stringify(report, null, 2) + '\n');
const expectedCursor = mode => mode === 'xray' ? /url\(["']?[^"')]*h4ngelic-cursor-other-r09\.svg["']?\)\s+9\s+2/ : 'none';

async function seed(context) {
  await context.addInitScript(() => {
    localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({ count: 5, lastSeen: Date.now() }));
    localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .2 }));
  });
}

async function pointAt(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const stack = document.elementsFromPoint(x, y);
    const top = stack.find(element => getComputedStyle(element).pointerEvents !== 'none') || document.documentElement;
    const style = getComputedStyle(top);
    return { x, y, cursor: style.cursor, tag: top.tagName, id: top.id,
      className: String(top.className?.baseVal ?? top.className ?? ''),
      stack: stack.slice(0, 6).map(element => ({ tag: element.tagName, id: element.id,
        className: String(element.className?.baseVal ?? element.className ?? ''), pointerEvents: getComputedStyle(element).pointerEvents,
        cursor: getComputedStyle(element).cursor })) };
  }, { x, y });
}

function accepted(sample, mode) {
  const expected = expectedCursor(mode);
  return expected === 'none' ? sample.cursor === 'none' : expected.test(sample.cursor);
}

async function overlayAt(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const overlay = document.querySelector('[data-h4-cursor]');
    const image = overlay?.querySelector('img');
    if (!overlay || !image) return { exists: false };
    const style = getComputedStyle(overlay), box = overlay.getBoundingClientRect();
    return { exists: true, opacity: Number(style.opacity), visibility: style.visibility, display: style.display,
      pointerEvents: style.pointerEvents, left: box.left, top: box.top, width: box.width, height: box.height,
      xError: box.left + 9 - x, yError: box.top + 2 - y,
      containsPointer: x >= box.left && x <= box.right && y >= box.top && y <= box.bottom,
      imageLoaded: image.complete && image.naturalWidth > 0, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
  }, { x, y });
}

function overlayAccepted(overlay, mode) {
  if (mode === 'xray') return !overlay.exists || overlay.opacity === 0 || overlay.visibility === 'hidden';
  return overlay.exists && overlay.opacity === 1 && overlay.visibility === 'visible' && overlay.display !== 'none'
    && overlay.pointerEvents === 'none' && overlay.width > 0 && overlay.height > 0
    && overlay.containsPointer && Math.abs(overlay.xError) <= .25 && Math.abs(overlay.yError) <= .25
    && overlay.imageLoaded && overlay.naturalWidth > 0 && overlay.naturalHeight > 0;
}

async function checkPoint(page, { label, x, y, mode = 'blanket', offenders, counts }) {
  await page.mouse.move(x, y);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  const sample = await pointAt(page, x, y);
  const overlay = await overlayAt(page, x, y);
  counts.points += 1;
  if (!label.includes(':')) counts.regions[label] = (counts.regions[label] || 0) + 1;
  counts.cursors[sample.cursor] = (counts.cursors[sample.cursor] || 0) + 1;
  counts.overlayVisible = (counts.overlayVisible || 0) + (overlayAccepted(overlay, mode) ? 1 : 0);
  if (!accepted(sample, mode) || !overlayAccepted(overlay, mode)) {
    offenders.push({ label, ...sample, overlay,
      className: sample.className, top: `${sample.tag}${sample.id ? `#${sample.id}` : ''}${sample.className ? `.${sample.className.trim().replace(/\s+/g, '.')}` : ''}` });
  }
  return { ...sample, overlay };
}

async function scanViewport(page, { label, width, height, mode, offenders, counts, step = 24 }) {
  for (let y = step / 2; y < height; y += step) {
    for (let x = step / 2; x < width; x += step) {
      await checkPoint(page, { label: `${label}:${x}:${y}`, x, y, mode, offenders, counts });
    }
  }
}

async function centerPoint(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, 'The targeted cursor region must have a real painted box.');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function slashPoint(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('[data-naavi]');
    const walker = document.createTreeWalker(nav, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const index = node.textContent.indexOf('/');
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index); range.setEnd(node, index + 1);
      const box = range.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, slash: box.toJSON() };
    }
    return null;
  });
}

async function targetContracts(page, { mode, offenders, counts }) {
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(250);
  const regions = [];
  for (const [label, selector] of [['footer-moshlab', '.footer-moshlab'], ['visit', '[data-visit-counter-hotspot]'],
    ['smash', '.footer-smash'], ['instagram', '.footer-instagram'], ['naavi-footer', '[data-naavi]']]) {
    const locator = page.locator(selector).first();
    if (!await locator.count()) continue;
    const { x, y } = await centerPoint(locator);
    const sample = await checkPoint(page, { label, x, y, mode, offenders, counts });
    regions.push({ label, sample });
  }
  const slash = await slashPoint(page);
  assert.ok(slash, 'NAAVI exposes the literal slash glyph.');
  const slashSample = await checkPoint(page, { label: 'naavi-slash', ...slash, mode, offenders, counts });
  regions.push({ label: 'naavi-slash', sample: slashSample });
  const naaviAudit = await page.locator('[data-naavi]').evaluate(element => [element, ...element.querySelectorAll('*')].map(node => {
    const style = getComputedStyle(node);
    return { tag: node.tagName.toLowerCase(), className: String(node.className?.baseVal ?? node.className ?? ''),
      ariaHidden: node.getAttribute('aria-hidden'), pointerEvents: style.pointerEvents, cursor: style.cursor };
  }));

  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(150);
  const index = page.locator('[data-global-index]');
  if (!await index.evaluate(element => element.open)) await index.locator('summary').click();
  await page.waitForFunction(() => document.querySelector('[data-global-index]')?.open === true);
  for (const link of await index.locator('[data-index-page]:is(a)').all()) {
    const name = await link.getAttribute('data-index-page');
    const { x, y } = await centerPoint(link);
    regions.push({ label: `index-${name}`, sample: await checkPoint(page, { label: `index-${name}`, x, y, mode, offenders, counts }) });
  }
  await page.keyboard.press('Escape');

  const hit = await page.evaluate(() => {
    const point = window.__H4_TEST__?.hitPoint?.();
    if (point) return point;
    const box = document.querySelector('#logo-canvas').getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  await page.mouse.move(hit.x, hit.y);
  await page.mouse.down();
  const drag = [];
  const viewport = page.viewportSize();
  try {
    drag.push(await checkPoint(page, { label: 'canvas-drag-start', x: hit.x, y: hit.y, mode, offenders, counts }));
    for (let step = 1; step <= 4; step += 1) {
      const x = Math.min(viewport.width - 12, hit.x + step * 24);
      const y = Math.min(viewport.height - 12, hit.y - step * 8);
      drag.push(await checkPoint(page, { label: `canvas-drag-${step}`, x, y, mode, offenders, counts }));
    }
  } finally { await page.mouse.up(); }

  await page.evaluate(() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'instant' }));
  await page.waitForTimeout(200);
  const form = [];
  for (const selector of ['[data-inquiry-form] input[name="name"]', '[data-inquiry-form] input[name="email"]',
    '[data-inquiry-form] textarea[name="message"]', '[data-inquiry-form] input[type="file"]', '[data-inquiry-submit]']) {
    const locator = page.locator(selector).first();
    if (!await locator.count() || !await locator.isVisible()) continue;
    const { x, y } = await centerPoint(locator);
    form.push({ label: selector, sample: await checkPoint(page, { label: selector, x, y, mode, offenders, counts }) });
  }
  assert.equal(form.length, 5, 'The inquiry form field contract covers all visible controls.');
  return { regions, drag, naaviAudit, form };
}

async function browserPage(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await seed(context);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
  await page.locator('#stage.is-ready').waitFor({ timeout: 60000 }).catch(() => {});
  assert.equal(await page.locator('html').evaluate(element => element.classList.contains('h4-custom-cursor')), true);
  assert.equal(await page.locator('html').getAttribute('data-cursor'), null);
  return { context, page, errors };
}

try {
  for (const profile of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 844 }]) {
    console.log(`CHECK blanket cursor hit map ${profile.width}x${profile.height}`);
    const { context, page, errors } = await browserPage(profile);
    const offenders = [], counts = { points: 0, cursors: {}, regions: {} };
    try {
      report.build ||= await page.locator('html').getAttribute('data-build');
      const top = { label: 'top', width: profile.width, height: profile.height };
      await scanViewport(page, { ...top, mode: 'blanket', offenders, counts });
      await page.screenshot({ path: new URL(`top-${profile.width}.png`, output).pathname });
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(250);
      await scanViewport(page, { ...top, label: 'footer', mode: 'blanket', offenders, counts });
      await page.screenshot({ path: new URL(`footer-${profile.width}.png`, output).pathname });
      const targets = await targetContracts(page, { mode: 'blanket', offenders, counts });
      await page.screenshot({ path: new URL(`index-${profile.width}.png`, output).pathname });
      assert.deepEqual(offenders, [], `${profile.width}px has no foreign cursor: ${JSON.stringify(offenders.slice(0, 8))}`);
      assert.deepEqual(errors, []);
      report.profiles.push({ ...profile, points: counts.points, cursors: counts.cursors, offenders: [], targets, errors, passed: true });
    } catch (error) {
      report.failures.push({ ...profile, offenders, counts, error: error.stack });
      await page.screenshot({ path: new URL(`failure-${profile.width}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); await save(); }
  }

  const { context, page, errors } = await browserPage({ width: 1440, height: 900 });
  try {
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.down('4');
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray', null, { timeout: 60000 });
    await page.keyboard.up('4');
    await page.waitForFunction(() => document.documentElement.dataset.cursor === 'xray');
    const mode = { mode: await page.locator('html').getAttribute('data-mode'), cursor: await page.locator('html').getAttribute('data-cursor') };
    assert.deepEqual(mode, { mode: 'xray', cursor: 'xray' });
    const offenders = [], counts = { points: 0, cursors: {}, regions: {} };
    await scanViewport(page, { label: 'xray', width: 1440, height: 900, mode: 'xray', offenders, counts });
    const naavi = await centerPoint(page.locator('[data-naavi]'));
    const sample = await checkPoint(page, { label: 'xray-naavi', ...naavi, mode: 'xray', offenders, counts });
    assert.deepEqual(offenders, [], `The xray allowlist has no foreign cursor: ${JSON.stringify(offenders.slice(0, 8))}`);
    assert.deepEqual(errors, []);
    report.xray = { ...mode, points: counts.points, cursors: counts.cursors, naavi: sample, offenders: [], passed: true };
    await page.screenshot({ path: new URL('xray-1440.png', output).pathname });
  } catch (error) {
    report.failures.push({ xray: true, error: error.stack });
    await page.screenshot({ path: new URL('failure-xray.png', output).pathname }).catch(() => {});
    throw error;
  } finally { await context.close(); await save(); }

  console.log(`PASS cursor hit map: ${report.profiles.map(item => `${item.width}px ${item.points}`).join(', ')}; xray ${report.xray.points}; zero foreign cursors, logo overlay aligned at every blanket point.`);
} catch (error) {
  await save();
  throw error;
} finally { await browser.close(); }
