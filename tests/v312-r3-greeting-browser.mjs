import assert from 'node:assert/strict';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { visitorMessage } from '../src/data/easterSettings.js';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_GREETING_ARTIFACTS || 'artifacts/v312/f21-r4'}/`, import.meta.url);
await mkdir(output, { recursive: true });
await copyFile(new URL('../docs/validation/v3.1.2/F21-r3/after-1440-hover.png', import.meta.url),
  new URL('before-1440.png', output)).catch(() => {});
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = {};
const longestGreeting = visitorMessage(10);
const seed = async context => context.addInitScript(({ count }) => {
  localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({ count, lastSeen: Date.now() }));
  localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .2 }));
  window.__h4LayoutShifts = [];
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) window.__h4LayoutShifts.push({ value: entry.value, hadRecentInput: entry.hadRecentInput });
  }).observe({ type: 'layout-shift', buffered: true });
}, { count: 10 });
const styles = locator => locator.evaluate(element => {
  const style = getComputedStyle(element), box = element.getBoundingClientRect();
  const range = document.createRange(); range.selectNodeContents(element); const textBox = range.getBoundingClientRect();
  return { color: style.color, opacity: Number(style.opacity), letterSpacing: style.letterSpacing,
    fontSize: style.fontSize, lineHeight: style.lineHeight, textTransform: style.textTransform,
    textShadow: style.textShadow, whiteSpace: style.whiteSpace, transitionProperty: style.transitionProperty,
    transitionDuration: style.transitionDuration, visibility: style.visibility,
    left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height,
    textLeft: textBox.left, textRight: textBox.right, textWidth: textBox.width, textHeight: textBox.height,
    clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
});
const alignment = page => page.evaluate(() => {
  const rectOf = element => {
    const range = document.createRange(); range.selectNodeContents(element);
    const box = range.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
      centerX: box.left + box.width / 2, centerY: box.top + box.height / 2 };
  };
  const boxOf = element => { const box = element.getBoundingClientRect(); return {
    left: box.left, right: box.right, top: box.top, bottom: box.bottom,
    centerX: box.left + box.width / 2, centerY: box.top + box.height / 2 }; };
  const brand = document.querySelector('[data-floating-brand]');
  const greeting = document.querySelector('[data-returning-visitor]');
  const index = document.querySelector('[data-global-index] > summary');
  const sign = index.querySelector('.index-sign');
  const brandBox = boxOf(brand), brandText = rectOf(brand), greetingBox = boxOf(greeting), greetingText = rectOf(greeting);
  const indexBox = boxOf(index), indexText = rectOf(sign);
  return { brandBox, brandText, greetingBox, greetingText, indexBox, indexText,
    centerDelta: { brand: greetingText.centerY - brandText.centerY, index: greetingText.centerY - indexText.centerY },
    topDelta: { brand: greetingBox.top - brandBox.top, index: greetingBox.top - indexBox.top },
    gaps: { left: greetingText.left - brandBox.right, right: indexBox.left - greetingText.right },
    gapDelta: (indexBox.left - greetingText.right) - (greetingText.left - brandBox.right) };
});
const waitForGreetingOpacity = (page, minimum) => page.waitForFunction(value =>
  Number(getComputedStyle(document.querySelector('[data-returning-visitor]')).opacity) >= value, minimum);
const contrast = (foreground, background, alpha) => {
  const channel = value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
  const luminance = ([r, g, b]) => .2126 * channel(r) + .7152 * channel(g) + .0722 * channel(b);
  const mixed = foreground.map((value, index) => value * alpha + background[index] * (1 - alpha));
  return (luminance(mixed) + .05) / (luminance(background) + .05);
};
try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await seed(desktopContext);
  const page = await desktopContext.newPage(); page.setDefaultTimeout(60000);
  await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true');
  await page.waitForTimeout(250);
  assert.equal(await page.locator('[data-returning-visitor]').textContent(), longestGreeting);
  const rest = await styles(page.locator('[data-returning-visitor]'));
  await page.evaluate(() => { window.__h4LayoutShifts = []; });
  await page.mouse.move(720, 30);
  await waitForGreetingOpacity(page, .349999);
  const greeting = await styles(page.locator('[data-returning-visitor]'));
  await page.locator('[data-other-side-hint] .secret-message').evaluate(element => element.classList.add('is-discovered'));
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-other-side-hint] .secret-message')).opacity) >= .349999);
  const hint = await styles(page.locator('[data-other-side-hint] .secret-message'));
  assert.equal(greeting.color, hint.color, 'The greeting uses the exact HOLD-4 ghost color.');
  assert.equal(greeting.letterSpacing, hint.letterSpacing, 'Tracking matches the HOLD-4 hint exactly.');
  assert.equal(greeting.opacity, hint.opacity, 'The hover state shares the HOLD-4 ghost opacity.');
  assert.equal(greeting.textTransform, 'lowercase');
  assert.equal(greeting.textShadow, 'none');
  assert.match(greeting.transitionProperty, /opacity/);
  assert.doesNotMatch(greeting.transitionProperty, /color|letter-spacing|text-transform/);
  const aligned = await alignment(page);
  assert.ok(Math.abs(aligned.centerDelta.brand) < 1.5 && Math.abs(aligned.centerDelta.index) < 1.5,
    `Greeting shares the brand/INDEX optical centre line: ${JSON.stringify(aligned.centerDelta)}`);
  assert.ok(Math.abs(aligned.topDelta.brand) < .5 && Math.abs(aligned.topDelta.index) < .5,
    `Greeting starts on the same 44px header row: ${JSON.stringify(aligned.topDelta)}`);
  assert.ok(Math.abs(aligned.gapDelta) < 1.5,
    `Branding and INDEX gaps stay symmetric: ${JSON.stringify(aligned.gaps)}`);
  await page.screenshot({ path: new URL('after-1440-hover.png', output).pathname });
  await page.screenshot({ path: new URL('header-1440.png', output).pathname, clip: { x: 0, y: 0, width: 1440, height: 88 } });
  await page.locator('[data-floating-brand]').focus();
  await waitForGreetingOpacity(page, .519999);
  const focused = await styles(page.locator('[data-returning-visitor]'));
  assert.equal(focused.opacity, .52);
  assert.ok(focused.opacity > greeting.opacity, 'Focus is one readability step above the resting ghost.');
  assert.ok(Math.abs(rest.width - greeting.width) < .5 && Math.abs(rest.height - greeting.height) < .5,
    'Hovering keeps the reserved greeting box unchanged.');
  assert.ok(Math.abs(greeting.width - focused.width) < .5 && Math.abs(greeting.height - focused.height) < .5,
    'Focus keeps the reserved greeting box unchanged.');
  const layoutShifts = await page.evaluate(() => window.__h4LayoutShifts);
  assert.ok(layoutShifts.reduce((sum, entry) => sum + entry.value, 0) < .01,
    `Greeting reveal is layout-shift-free: ${JSON.stringify(layoutShifts)}`);
  await page.screenshot({ path: new URL('after-1440-focus.png', output).pathname });
  const build = await page.evaluate(() => document.documentElement.dataset.build || '');
  const contrasts = { hover: contrast([240, 239, 235], [36, 36, 36], greeting.opacity),
    focus: contrast([240, 239, 235], [36, 36, 36], focused.opacity) };
  assert.ok(contrasts.focus >= 4.5, `Focused greeting meets WCAG AA normal-text contrast: ${contrasts.focus}`);
  results.desktop = { rest, greeting, hint, focused, aligned, layoutShifts, contrast: contrasts };
  await desktopContext.close();

  const narrowContext = await browser.newContext({ viewport: { width: 320, height: 844 }, deviceScaleFactor: 1 });
  await seed(narrowContext);
  const narrow = await narrowContext.newPage(); narrow.setDefaultTimeout(60000);
  await narrow.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  await narrow.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true');
  assert.equal(await narrow.locator('[data-returning-visitor]').textContent(), longestGreeting);
  await narrow.mouse.move(160, 30);
  await waitForGreetingOpacity(narrow, .349999);
  const narrowGreeting = await styles(narrow.locator('[data-returning-visitor]'));
  const narrowAligned = await alignment(narrow);
  assert.equal(narrowGreeting.whiteSpace, 'nowrap');
  assert.equal(narrowGreeting.height, 44, 'The greeting keeps the shared 44px header row at 320px.');
  assert.ok(narrowGreeting.textHeight <= parseFloat(narrowGreeting.lineHeight) + 1, 'The longest 320px greeting stays on one line.');
  assert.ok(narrowGreeting.left >= -.5 && narrowGreeting.right <= 320.5
    && narrowGreeting.textLeft >= -.5 && narrowGreeting.textRight <= 320.5,
    `The longest 320px greeting text stays inside the viewport: ${narrowGreeting.textLeft}–${narrowGreeting.textRight}.`);
  assert.ok(narrowGreeting.textLeft >= narrowGreeting.left - .5 && narrowGreeting.textRight <= narrowGreeting.right + .5,
    `The longest 320px greeting text stays inside its header slot: slot ${narrowGreeting.left}–${narrowGreeting.right}, text ${narrowGreeting.textLeft}–${narrowGreeting.textRight}.`);
  assert.ok(Math.abs(narrowAligned.centerDelta.brand) < 1.5 && Math.abs(narrowAligned.centerDelta.index) < 1.5,
    `The 320px greeting shares the brand/INDEX centre line: ${JSON.stringify(narrowAligned.centerDelta)}`);
  assert.ok(await narrow.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await narrow.screenshot({ path: new URL('after-320-hover.png', output).pathname });
  await narrow.screenshot({ path: new URL('header-320.png', output).pathname, clip: { x: 0, y: 0, width: 320, height: 72 } });
  results.narrow = { greeting: narrowGreeting, aligned: narrowAligned };
  await narrowContext.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true });
  await seed(touchContext);
  const touch = await touchContext.newPage(); touch.setDefaultTimeout(60000);
  await touch.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  await touch.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true');
  results.touch = await styles(touch.locator('[data-returning-visitor]'));
  assert.equal(results.touch.opacity, .35);
  assert.equal(results.touch.visibility, 'visible');
  await touchContext.close();

  const reducedContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await seed(reducedContext);
  const reduced = await reducedContext.newPage(); reduced.setDefaultTimeout(60000);
  await reduced.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  await reduced.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true');
  await reduced.mouse.move(720, 30);
  results.reduced = await styles(reduced.locator('[data-returning-visitor]'));
  assert.equal(results.reduced.transitionDuration, '0s');
  assert.equal(results.reduced.opacity, .35);
  await reducedContext.close();

  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), base, build, results, passed: true }, null, 2) + '\n');
  console.log(`PASS greeting: color ${greeting.color}, tracking ${greeting.letterSpacing}, hover ${greeting.opacity}, focus ${focused.opacity}, 320 one line, reduced instant.`);
} catch (error) {
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), base, results, error: error.stack }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
