import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_POINTER_ARTIFACTS || 'artifacts/v312/V11'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const visual = element => {
  const style = getComputedStyle(element);
  return { focus: element === document.activeElement, focusVisible: element.matches(':focus-visible'),
    outline: `${style.outlineStyle} ${style.outlineWidth}`, outlineColor: style.outlineColor,
    boxShadow: style.boxShadow, textDecoration: style.textDecorationLine, cursor: style.cursor };
};

async function auditPointer(page, profile, kinds) {
  const records = [];
  for (const kind of kinds) {
    const locator = page.locator(kind);
    for (let index = 0; index < await locator.count(); index++) {
      const element = locator.nth(index);
      if (!await element.isVisible()) continue;
      await page.evaluate(() => { document.activeElement?.blur(); });
      await element.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
      await frames(page);
      if (await element.evaluate(node => Boolean(node.closest('[data-horizontal-drift]')))) {
        await page.locator('[data-horizontal-drift]').first().evaluate(node => node.focus({ preventScroll: true }));
        await page.keyboard.press('Home');
        await page.keyboard.press('Shift');
        await frames(page);
      }
      const box = await element.boundingBox();
      if (!box) continue;
      const rest = await element.evaluate(visual);
      if (profile.width < 600) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await frames(page);
      const past = await element.evaluate(visual);
      assert.equal(past.outline, rest.outline, `Pointer activation must not add an outline to ${kind}: ${JSON.stringify({ rest, past })}`);
      assert.equal(past.boxShadow, rest.boxShadow, `Pointer activation must not add a box to ${kind}: ${JSON.stringify({ rest, past })}`);
      assert.equal(past.textDecoration, rest.textDecoration, `Pointer activation must not add an underline to ${kind}: ${JSON.stringify({ rest, past })}`);
      if (kind !== '[data-horizontal-drift="tattoos"] [data-artwork-open]') {
        assert.equal(past.focusVisible, false, `Pointer activation must not expose a keyboard focus ring on ${kind}.`);
      }
      records.push({ kind, index, rest, past });
    }
  }
  return records;
}

async function keyboardContract(page) {
  await page.evaluate(() => { document.activeElement?.blur(); scrollTo({ top: 0, behavior: 'instant' }); });
  await frames(page);
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => {
    const element = document.activeElement, style = getComputedStyle(element);
    return { tag: element.tagName, className: element.className, focusVisible: element.matches(':focus-visible'),
      outline: `${style.outlineStyle} ${style.outlineWidth}`, transform: style.transform };
  });
  assert.equal(first.focusVisible, true);
  assert.notEqual(first.outline, 'none 0px', 'Keyboard focus must remain visible.');
  assert.ok(first.className.includes('skip-link') || first.tag === 'A');
  return first;
}

try {
  for (const profile of profiles) {
    console.log(`CHECK pointer focus ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 },
      reducedMotion: profile.reduced ? 'reduce' : 'no-preference', isMobile: profile.width < 600, hasTouch: profile.width < 600 });
    await context.addInitScript(() => {
      localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .25 }));
      window.addEventListener('click', event => {
        if (!window.__pointerFocusAudit) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await page.evaluate(() => { window.__pointerFocusAudit = true; });
      const home = await auditPointer(page, profile, ['[data-floating-brand]', '.hero-nav a',
        '#selected-work .category-link', '#about-preview .text-link', '#contact .contact-link', '.page-footer a']);

      await page.goto(new URL('/creative/onskin', base).href, { waitUntil: 'networkidle' });
      const section = page.locator('[data-horizontal-drift="tattoos"]');
      await section.evaluate(element => {
        element.focus({ preventScroll: true });
        const port = element.querySelector('.drift-viewport').getBoundingClientRect();
        scrollTo({ top: port.top + scrollY - 150, behavior: 'instant' });
      });
      await page.keyboard.press('Home'); await page.keyboard.press('Shift');
      await page.evaluate(() => { window.__pointerFocusAudit = true; });
      const work = await auditPointer(page, profile, ['.work-filters a', '[data-drift-previous]',
        '[data-drift-next]', '[data-horizontal-drift="tattoos"] [data-artwork-open]', '[data-naavi]']);

      await page.evaluate(() => { window.__pointerFocusAudit = false; });
      const menu = page.locator('[data-global-index]');
      if (!await menu.evaluate(element => element.open)) await menu.locator('summary').click();
      await page.evaluate(() => { window.__pointerFocusAudit = true; });
      const index = await auditPointer(page, profile, ['[data-global-index] summary', '[data-index-page]']);
      const keyboard = await keyboardContract(page);
      await page.screenshot({ path: new URL(`pointer-${profile.width}-${profile.reduced}.png`, output).pathname });
      assert.deepEqual(errors, []);
      reports.push({ profile, home, work, index, keyboard, errors });
      console.log(`PASS pointer focus ${profile.width}px reduced=${profile.reduced}: no pointer outline/box/underline; keyboard focus retained.`);
      await save();
    } catch (error) {
      failures.push({ profile, error: error.stack || String(error) });
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      await save(); throw error;
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
