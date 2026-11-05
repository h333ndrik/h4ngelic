import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { findCursorOffenders, cursorOf } from './helpers/cursor-contract.mjs';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_CURSOR_ARTIFACTS || 'artifacts/v312/r3-cursor'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const index = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const cssName = [...await readdir(new URL('../dist/assets/', import.meta.url))].find(name => /^index-.*\.css$/.test(name));
assert.ok(cssName, 'The production build emits its entry stylesheet.');
const css = await readFile(new URL(`../dist/assets/${cssName}`, import.meta.url), 'utf8');
const defense = '@media (hover:hover) and (pointer:fine){html,html body,html body *,html body :is(a,button,summary,label,input,textarea,select,canvas,[role="button"],[data-cursor],[data-cursor-target]){cursor:var(--h4-native-cursor)!important}}';
assert.ok(css.endsWith(defense), 'The cursor defense is the final emitted CSS rule.');
assert.match(css, /\[data-cursor-target\]/);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.route('**/*.js', route => route.abort('failed'));
const report = { checkedAt: new Date().toISOString(), base, css: cssName, inlineCursor: index.includes("classList.add('h4-custom-cursor')") };
try {
  await page.goto(new URL('/work/tattoos', base).href, { waitUntil: 'domcontentloaded' });
  const marker = await page.evaluate(() => ({ html: document.documentElement.dataset.build || '',
    meta: document.querySelector('meta[name="h4-build"]')?.content || '',
    cursorClass: document.documentElement.classList.contains('h4-custom-cursor') }));
  assert.match(marker.html, /^[a-f0-9]{7,40}$/i);
  assert.equal(marker.meta, marker.html);
  assert.equal(marker.cursorClass, true, 'Inline head JavaScript activates the cursor contract without the app bundle.');
  const withClass = await findCursorOffenders(page);
  assert.deepEqual(withClass.offenders, []);
  await page.evaluate(() => document.documentElement.classList.remove('h4-custom-cursor'));
  const withoutClass = await findCursorOffenders(page);
  assert.deepEqual(withoutClass.offenders, [], 'The CSS contract works even before the cursor class exists.');
  const states = [];
  for (const selector of ['.footer-moshlab', '.footer-instagram', '[data-naavi]']) {
    const target = page.locator(selector);
    await target.scrollIntoViewIfNeeded();
    const rest = await cursorOf(target); assert.equal(rest.ok, true, `${selector} rest`);
    await target.hover(); const hover = await cursorOf(target); assert.equal(hover.ok, true, `${selector} hover`);
    await target.focus(); const focus = await cursorOf(target); assert.equal(focus.ok, true, `${selector} focus`);
    const box = await target.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    const active = await cursorOf(target); await page.mouse.move(4, 4); await page.mouse.up();
    assert.equal(active.ok, true, `${selector} active`);
    states.push({ selector, rest: rest.cursor, hover: hover.cursor, focus: focus.cursor, active: active.cursor });
  }
  report.marker = marker; report.withClass = withClass; report.withoutClass = withoutClass; report.states = states;
  await writeFile(new URL('results.json', output), JSON.stringify({ ...report, passed: true }, null, 2) + '\n');
  console.log(`PASS production cursor: ${cssName} ends with the defense; no-JS marker ${marker.html}, footer/NAAVI states exact.`);
} catch (error) {
  await writeFile(new URL('results.json', output), JSON.stringify({ ...report, passed: false, error: error.stack }, null, 2) + '\n');
  throw error;
} finally { await context.close(); await browser.close(); }
