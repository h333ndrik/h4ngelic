import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { CURSOR_TOKENS, cursorSpec, matchesContract } from './helpers/cursor-contract.mjs';

/** Production-side proof for the native cursor: the emitted stylesheet may only
 * consume the cursor tokens, no overlay or blanket rule may survive, and the
 * pointer stays the h4 silhouette with or without the app bundle. */
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_CURSOR_ARTIFACTS || 'docs/validation/CURSOR-NATIVE'}/`, import.meta.url);
const reportName = process.env.H4_CURSOR_REPORT_NAME || 'production-cursor.json';
await mkdir(output, { recursive: true });
const index = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const cssName = [...await readdir(new URL('../dist/assets/', import.meta.url))].find(name => /^index-.*\.css$/.test(name));
assert.ok(cssName, 'The production build emits its entry stylesheet.');
const css = await readFile(new URL(`../dist/assets/${cssName}`, import.meta.url), 'utf8');
const declarations = [...css.matchAll(/(?<![-\w])cursor\s*:\s*([^;}]+)/g)].map(match => match[1].trim());
const literals = declarations.filter(value => !/^var\(--h4-cursor(?:-interactive|-pressed|-xray|-xray-pressed)?\)$/.test(value));
assert.deepEqual(literals, [], `Only the cursor tokens may be consumed: ${JSON.stringify(literals)}`);
assert.deepEqual([...new Set(declarations)].sort(), ['var(--h4-cursor)', 'var(--h4-cursor-interactive)', 'var(--h4-cursor-pressed)', 'var(--h4-cursor-xray)', 'var(--h4-cursor-xray-pressed)'],
  `cursor.css owns every emitted declaration: ${JSON.stringify(declarations)}`);
assert.match(css, /@media \(any-hover:hover\) and \(any-pointer:fine\)/, 'The capability query must survive minification.');
assert.doesNotMatch(css, /cursor:none/, 'The blanket rule must not be emitted.');
assert.doesNotMatch(css, /h4-custom-cursor/, 'The class gate must not be emitted.');
assert.doesNotMatch(index, /data-h4-cursor|data-cursor-preload|h4-custom-cursor/, 'The shell carries no overlay, preload or gate.');
for (const token of Object.values(CURSOR_TOKENS)) {
  assert.ok(index.includes(token.svg.path) || css.includes(token.svg.path), `The shell or stylesheet references ${token.svg.path}`);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const report = { checkedAt: new Date().toISOString(), base, css: cssName, declarations, literals, build: '', states: [], noScript: null };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
  report.build = await page.locator('html').getAttribute('data-build');
  assert.match(report.build, /^[a-f0-9]{7,40}$/i);
  assert.equal(await page.locator('meta[name="h4-build"]').getAttribute('content'), report.build);
  assert.equal(await page.locator('[data-h4-cursor]').count(), 0);
  for (const selector of ['.footer-moshlab', '.footer-instagram', '[data-naavi]', '.floating-brand']) {
    const target = page.locator(selector).first();
    if (!await target.count()) continue;
    await target.scrollIntoViewIfNeeded();
    const rest = await target.evaluate(element => getComputedStyle(element).cursor);
    assert.ok(matchesContract(rest, { mode: 'normal', spec: cursorSpec }), `${selector} rest: ${rest}`);
    const box = await target.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const active = await target.evaluate(element => getComputedStyle(element).cursor);
    await page.mouse.move(2, 2);
    await page.mouse.up();
    assert.ok(matchesContract(active, { mode: 'normal', spec: cursorSpec }), `${selector} active: ${active}`);
    report.states.push({ selector, rest, active });
  }
  const pngs = await page.evaluate(async urls => Promise.all(urls.map(async url => {
    const response = await fetch(url).catch(() => null);
    return { url, status: response?.status || 0 };
  })), [...new Set(Object.values(CURSOR_TOKENS).map(token => token.png.path))]);
  for (const png of pngs) assert.equal(png.status, 200, `The PNG fallback must ship: ${JSON.stringify(png)}`);
  report.pngs = pngs;
  await context.close();

  const noScript = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, javaScriptEnabled: false });
  const staticPage = await noScript.newPage();
  await staticPage.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'domcontentloaded' });
  report.noScript = await staticPage.evaluate(() => ({
    body: getComputedStyle(document.body).cursor,
    link: getComputedStyle(document.querySelector('.floating-brand')).cursor,
    overlay: document.querySelectorAll('[data-h4-cursor]').length,
    cursorNone: [...document.styleSheets].flatMap(sheet => {
      try { return [...sheet.cssRules].map(rule => rule.cssText); } catch { return []; }
    }).filter(text => /cursor:\s*none/.test(text)).length }));
  assert.equal(report.noScript.overlay, 0, 'With JavaScript disabled no overlay ghost exists.');
  assert.equal(report.noScript.cursorNone, 0, 'No cursor:none rule is reachable.');
  for (const value of [report.noScript.body, report.noScript.link]) {
    assert.ok(matchesContract(value, { mode: 'normal', spec: cursorSpec }), `Without JavaScript the native cursor remains: ${value}`);
  }
  await noScript.close();

  await writeFile(new URL(reportName, output), JSON.stringify({ ...report, passed: true }, null, 2) + '\n');
  console.log(`PASS production cursor ${report.build}: ${declarations.length} token declarations, ${report.states.length} targets, PNG fallbacks 200, no overlay, no-JS native cursor.`);
} catch (error) {
  await writeFile(new URL(reportName, output), JSON.stringify({ ...report, passed: false, error: error.stack }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
