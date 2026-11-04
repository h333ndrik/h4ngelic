import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { findCursorOffenders, cursorOf } from './helpers/cursor-contract.mjs';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_CURSOR_ARTIFACTS || 'artifacts/v312/r4-cursor'}/`, import.meta.url);
const reportName = process.env.H4_CURSOR_REPORT_NAME || 'results.json';
await mkdir(output, { recursive: true });
const index = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const cssName = [...await readdir(new URL('../dist/assets/', import.meta.url))].find(name => /^index-.*\.css$/.test(name));
assert.ok(cssName, 'The production build emits its entry stylesheet.');
const css = await readFile(new URL(`../dist/assets/${cssName}`, import.meta.url), 'utf8');
const defense = '@media (hover:hover) and (pointer:fine){html.h4-custom-cursor[data-cursor="xray"],html.h4-custom-cursor [data-cursor="xray"],html.h4-custom-cursor[data-cursor="xray"] *,html.h4-custom-cursor [data-cursor="xray"] *{cursor:var(--h4-native-cursor)!important}html.h4-custom-cursor *{cursor:none!important}}';
const declarations = [...css.matchAll(/(?<![-\w])cursor\s*:\s*[^;}]+/g)].map(match => match[0]);
assert.equal(declarations.length, 3, `Only the root fallback, xray allowlist and blanket rule may declare cursor: ${declarations.join(' | ')}`);
assert.ok(declarations.some(value => /^cursor:var\(--h4-native-cursor\)$/.test(value)), 'The html root keeps its class-gated fallback.');
assert.ok(declarations.some(value => /^cursor:var\(--h4-native-cursor\)!important$/.test(value)), 'The xray allowlist keeps the mode material cursor.');
assert.ok(declarations.some(value => /^cursor:none!important$/.test(value)), 'The blanket rule hides every non-allowlisted native pointer.');
assert.ok(css.endsWith(defense), 'The xray allowlist plus blanket rule are the final emitted CSS.');
assert.match(css, /html\.h4-custom-cursor\{cursor:var\(--h4-native-cursor\)\}/);
assert.doesNotMatch(index, /cursor:\s*(?:pointer|grab|grabbing|wait|auto|default)/i, 'The document contains no secondary cursor declaration.');
assert.match(index, /data-h4-cursor/, 'The production shell contains the real pointer overlay.');
assert.match(index, /data-cursor-preload/, 'The overlay artwork is preloaded before the app bundle.');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.route('**/*.js', route => route.abort('failed'));
const report = { checkedAt: new Date().toISOString(), base, css: cssName, declarations,
  inlineCursor: index.includes("classList.add('h4-custom-cursor')") };
try {
  await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'domcontentloaded' });
  const marker = await page.evaluate(() => ({ html: document.documentElement.dataset.build || '',
    meta: document.querySelector('meta[name="h4-build"]')?.content || '',
    cursorClass: document.documentElement.classList.contains('h4-custom-cursor') }));
  assert.match(marker.html, /^[a-f0-9]{7,40}$/i);
  assert.equal(marker.meta, marker.html);
  assert.equal(marker.cursorClass, true, 'Inline head JavaScript activates the blanket cursor contract without the app bundle.');
  await page.mouse.move(240, 180);
  const overlay = await page.evaluate(() => {
    const node = document.querySelector('[data-h4-cursor]'), image = node?.querySelector('img'), style = node ? getComputedStyle(node) : null;
    const box = node?.getBoundingClientRect();
    return { exists: Boolean(node), opacity: Number(style?.opacity || 0), visibility: style?.visibility || 'missing',
      display: style?.display || 'missing', pointerEvents: style?.pointerEvents || 'missing', box: box?.toJSON() || null,
      xError: box ? box.left + 9 - 240 : Infinity, yError: box ? box.top + 2 - 180 : Infinity,
      imageLoaded: Boolean(image?.complete && image?.naturalWidth > 0) };
  });
  assert.equal(overlay.exists, true);
  assert.equal(overlay.opacity, 1);
  assert.equal(overlay.visibility, 'visible');
  assert.equal(overlay.pointerEvents, 'none');
  assert.ok(overlay.box.width > 0 && overlay.box.height > 0);
  assert.ok(Math.abs(overlay.xError) <= .25 && Math.abs(overlay.yError) <= .25, `The overlay hotspot follows the pointer: ${JSON.stringify(overlay)}`);
  assert.equal(overlay.imageLoaded, true);
  const withClass = await findCursorOffenders(page);
  assert.equal(withClass.mode, 'blanket');
  assert.deepEqual(withClass.offenders, []);
  await page.evaluate(() => document.documentElement.classList.remove('h4-custom-cursor'));
  const withoutClass = await findCursorOffenders(page);
  assert.equal(withoutClass.mode, 'system');
  assert.deepEqual(withoutClass.offenders, [], 'Blocking the runtime class restores ordinary system cursors.');
  const states = [];
  await page.evaluate(() => document.documentElement.classList.add('h4-custom-cursor'));
  for (const selector of ['.footer-moshlab', '.footer-instagram', '[data-naavi]']) {
    const target = page.locator(selector);
    await target.scrollIntoViewIfNeeded();
    const rest = await cursorOf(target); assert.equal(rest.ok, true, `${selector} rest`); assert.equal(rest.cursor, 'none');
    await target.hover(); const hover = await cursorOf(target); assert.equal(hover.ok, true, `${selector} hover`);
    await target.focus(); const focus = await cursorOf(target); assert.equal(focus.ok, true, `${selector} focus`);
    const box = await target.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    const active = await cursorOf(target); await page.mouse.move(4, 4); await page.mouse.up();
    assert.equal(active.ok, true, `${selector} active`);
    states.push({ selector, rest: rest.cursor, hover: hover.cursor, focus: focus.cursor, active: active.cursor });
  }
  report.marker = marker; report.overlay = overlay; report.withClass = withClass; report.withoutClass = withoutClass; report.states = states;

  const noScript = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    javaScriptEnabled: false });
  const staticPage = await noScript.newPage();
  await staticPage.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'domcontentloaded' });
  const staticReport = await staticPage.locator('body').evaluate(body => {
    const html = document.documentElement;
    const sample = selector => getComputedStyle(document.querySelector(selector)).cursor;
    return { cursorClass: html.classList.contains('h4-custom-cursor'), dataCursor: html.dataset.cursor || '',
      body: getComputedStyle(body).cursor, link: sample('.floating-brand'), naavi: sample('[data-naavi]'),
      footer: sample('.footer-moshlab'), overlayOpacity: Number(getComputedStyle(document.querySelector('[data-h4-cursor]')).opacity),
      overlayVisibility: getComputedStyle(document.querySelector('[data-h4-cursor]')).visibility };
  });
  assert.equal(staticReport.cursorClass, false, 'With all JavaScript disabled there is no custom-cursor class.');
  assert.equal(staticReport.dataCursor, '');
  for (const [label, cursor] of Object.entries(staticReport)) {
    if (['cursorClass', 'dataCursor', 'overlayOpacity', 'overlayVisibility'].includes(label)) continue;
    assert.notEqual(cursor, 'none', `${label} keeps a system cursor without JavaScript.`);
    assert.doesNotMatch(cursor, /h4ngelic-cursor/, `${label} does not request the custom cursor without JavaScript.`);
  }
  assert.equal(staticReport.overlayOpacity, 0);
  assert.equal(staticReport.overlayVisibility, 'hidden');
  report.noScript = staticReport;
  await noScript.close();

  await writeFile(new URL(reportName, output), JSON.stringify({ ...report, passed: true }, null, 2) + '\n');
  console.log(`PASS production cursor ${marker.html}: 3 declarations, final blanket rule, xray allowlist and no-JS system fallback.`);
} catch (error) {
  await writeFile(new URL(reportName, output), JSON.stringify({ ...report, passed: false, error: error.stack }, null, 2) + '\n');
  throw error;
} finally { await context.close(); await browser.close(); }
