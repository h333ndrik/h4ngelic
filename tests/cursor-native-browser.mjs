import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { CURSOR_TOKENS, cursorSpec, matchesContract } from './helpers/cursor-contract.mjs';

/** Replaces the retired overlay suites (cursor-kernel, cursor-fade): the native
 * strategy has no DOM node to track, fade or freeze, so the contract now lives
 * in the stylesheet, the asset budget and the pressed swap. */
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_CURSOR_NATIVE_ARTIFACTS || 'docs/validation/CURSOR-NATIVE'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const cssName = [...await readdir(new URL('../dist/assets/', import.meta.url))].find(name => /^index-.*\.css$/.test(name));
assert.ok(cssName, 'The production build emits its entry stylesheet.');
const emitted = await readFile(new URL(`../dist/assets/${cssName}`, import.meta.url), 'utf8');
const declarations = [...emitted.matchAll(/(?<![-\w])cursor\s*:\s*([^;}]+)/g)].map(match => match[1].trim());
const literals = declarations.filter(value => !/^var\(--h4-cursor(?:-interactive|-pressed|-xray|-xray-pressed)?\)$/.test(value));
assert.deepEqual(literals, [], `The emitted CSS may only consume the cursor tokens: ${JSON.stringify(literals)}`);
assert.deepEqual([...new Set(declarations)].sort(), ['var(--h4-cursor)', 'var(--h4-cursor-interactive)', 'var(--h4-cursor-pressed)', 'var(--h4-cursor-xray)', 'var(--h4-cursor-xray-pressed)'],
  `cursor.css owns every declaration: ${JSON.stringify(declarations)}`);
assert.doesNotMatch(emitted, /cursor\s*:\s*none/, 'The blanket none rule must never reach production.');
assert.doesNotMatch(emitted, /h4-custom-cursor/, 'The runtime class gate is retired.');
assert.doesNotMatch(emitted, /h4ngelic-cursor-last/, 'The build no longer appends a blanket defense.');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, css: cssName, declarations, literals, build: '', overlay: null,
  pressed: null, assets: null, fade: null, noScript: null, touch: null, failures: [] };
const save = () => writeFile(new URL('native-cursor.json', output), JSON.stringify(report, null, 2) + '\n');

async function seeded(viewport, extra = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
  await context.addInitScript(() => {
    localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({ count: 5, lastSeen: Date.now() }));
    localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .2 }));
  });
  return context;
}

try {
  const context = await seeded({ width: 1440, height: 900 });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(new URL('/creative', base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
  report.build = await page.locator('html').getAttribute('data-build');
  report.overlay = await page.evaluate(() => ({ nodes: document.querySelectorAll('[data-h4-cursor]').length,
    classGate: document.documentElement.classList.contains('h4-custom-cursor'),
    inlineScript: Boolean(document.querySelector('script:not([src]):not([type])')?.textContent.includes('h4-custom-cursor')) }));
  assert.deepEqual(report.overlay, { nodes: 0, classGate: false, inlineScript: false }, 'No overlay, gate or head script may survive.');

  // Asset budget: every image the tokens reference must load and stay <= 32 CSS px.
  const urls = [...new Set(Object.values(CURSOR_TOKENS).flatMap(token => [token.svg.path, token.png.path]))];
  report.assets = await page.evaluate(async urls => Promise.all(urls.map(url => new Promise(resolve => {
    const probe = async () => {
      if (url.endsWith('.svg')) {
        const image = new Image();
        return new Promise(done => {
          image.onload = () => done({ url, ok: true, width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () => done({ url, ok: false, width: 0, height: 0 });
          image.src = url;
        });
      }
      const response = await fetch(url).catch(() => null);
      if (!response?.ok) return { url, ok: false, status: response?.status || 0, width: 0, height: 0 };
      const bitmap = await createImageBitmap(await response.blob());
      return { url, ok: true, status: response.status, width: bitmap.width, height: bitmap.height };
    };
    return probe().then(resolve);
  }))), urls);
  for (const asset of report.assets) {
    assert.equal(asset.ok, true, `Cursor asset must load: ${JSON.stringify(asset)}`);
    assert.ok(asset.width <= 32 && asset.height <= 32, `Cursor asset must fit 32 CSS px: ${JSON.stringify(asset)}`);
  }
  const pngs = report.assets.filter(asset => asset.url.endsWith('.png'));
  assert.equal(pngs.length, 4, 'Every token carries its own PNG fallback.');
  for (const png of pngs) assert.equal(png.status, 200);

  // Pressed contract: the swap is a pre-scaled file. The browser rounds the SVG
  // natural size to integers, so the exact ratio comes from the SVG header.
  const sprite = async name => {
    const source = await readFile(new URL(`../public/assets/${name}`, import.meta.url), 'utf8');
    const [width, height] = source.match(/width="([\d.]+)" height="([\d.]+)"/).slice(1).map(Number);
    return { name, width, height };
  };
  const baseSprite = await sprite('h4ngelic-cursor.svg');
  const pressedSprite = await sprite('h4ngelic-cursor-pressed.svg');
  const scale = pressedSprite.width / baseSprite.width;
  assert.ok(Math.abs(scale - 1.08) < .005 && Math.abs((pressedSprite.height / baseSprite.height) - 1.08) < .005,
    `The pressed sprite must be the 1.08x silhouette: ${JSON.stringify({ baseSprite, pressedSprite, scale })}`);
  const target = page.locator('[data-naavi]').first();
  const box = await target.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const rest = await target.evaluate(element => getComputedStyle(element).cursor);
  await page.mouse.down();
  const pressed = await target.evaluate(element => getComputedStyle(element).cursor);
  await page.mouse.move(2, 2);
  await page.mouse.up();
  assert.match(rest, /h4ngelic-cursor\.svg["']?\)\s+8\s+2/, 'The resting state uses the base sprite.');
  assert.match(pressed, /h4ngelic-cursor-pressed\.svg["']?\)\s+8\s+2/, 'The pressed state uses the pre-scaled sprite.');
  report.pressed = { rest, pressed, scale: Number(scale.toFixed(4)), hotspot: '8 2',
    pressedSize: `${pressedSprite.width}x${pressedSprite.height}` };

  // The 108 % swap is instantaneous: two samples inside one frame are already pressed.
  report.fade = await page.evaluate(async () => {
    const link = document.querySelector('[data-naavi]');
    const before = getComputedStyle(link).cursor;
    return { transition: getComputedStyle(link).transitionProperty, before };
  });
  assert.ok(!/cursor/.test(report.fade.transition), 'Cursor must not be transitioned (no lag).');

  // Pseudo-elements inherit the same token.
  const pseudo = await page.evaluate(() => ['.arrow', '[data-outline-arrow]', '.category-link .interaction-visual'].flatMap(selector => {
    const element = document.querySelector(selector);
    if (!element) return [];
    const style = getComputedStyle(element, '::before');
    if (!style.content || style.content === 'none') return [];
    return [{ selector, cursor: style.cursor }];
  }));
  assert.ok(pseudo.length > 0, 'At least one decorative pseudo-element must be measurable.');
  for (const item of pseudo) assert.ok(matchesContract(item.cursor, { mode: 'normal', spec: cursorSpec }),
    `Pseudo-element keeps the native cursor: ${JSON.stringify(item)}`);
  report.pseudo = pseudo;
  await page.screenshot({ path: new URL('pressed-1440.png', output).pathname });
  await context.close();
  await save();

  // Fail-safe: without JavaScript the stylesheet still paints the cursor and no overlay ghost remains.
  const noScript = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, javaScriptEnabled: false });
  const staticPage = await noScript.newPage();
  await staticPage.goto(new URL('/creative', base).href, { waitUntil: 'domcontentloaded' });
  report.noScript = await staticPage.evaluate(() => ({
    body: getComputedStyle(document.body).cursor,
    link: getComputedStyle(document.querySelector('[data-naavi]') || document.body).cursor,
    overlay: document.querySelectorAll('[data-h4-cursor]').length }));
  assert.equal(report.noScript.overlay, 0, 'A disabled script must not leave an overlay ghost behind.');
  for (const value of [report.noScript.body, report.noScript.link]) {
    assert.ok(matchesContract(value, { mode: 'normal', spec: cursorSpec }), `No-JS keeps the h4 cursor: ${value}`);
  }
  await noScript.close();

  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const touchPage = await touch.newPage();
  await touchPage.goto(new URL('/creative', base).href, { waitUntil: 'domcontentloaded' });
  await touchPage.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
  report.touch = await touchPage.locator('body').evaluate(body => ({ fine: matchMedia('(any-hover: hover) and (any-pointer: fine)').matches,
    body: getComputedStyle(body).cursor }));
  assert.equal(report.touch.fine, false);
  assert.doesNotMatch(report.touch.body, /h4ngelic-cursor/, 'Touch devices keep their system cursor.');
  await touch.close();

  await save();
  console.log(`PASS native cursor ${report.build}: ${declarations.length} token declarations, 6 assets <= 32px, pressed 1.08x at 8 2, no overlay, no-JS and touch intact.`);
} catch (error) {
  report.failures.push({ error: error.stack });
  await save();
  throw error;
} finally { await browser.close(); }
