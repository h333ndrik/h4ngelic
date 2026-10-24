import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const output = new URL('../artifacts/ref09-ink/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];

async function pointInArchive(page) {
  const blank = page.locator('.archive-empty');
  await blank.scrollIntoViewIfNeeded();
  const box = await blank.boundingBox();
  return { x: box.x + box.width / 2, y: Math.min(page.viewportSize().height - 35, box.y + box.height - 35) };
}

async function tap(page, point, touch) {
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function markState(page) {
  return page.locator('[data-ink-mark]').first().evaluate(mark => ({
    pigments: [...new Set([...mark.querySelectorAll('[data-ink-pigment]')].map(path => getComputedStyle(path).fill))],
    images: mark.querySelectorAll('image[data-ink-film]').length,
    source: mark.querySelector('image[data-ink-film]').href.baseVal.includes('corrupted-film') || mark.querySelector('image[data-ink-film]').href.baseVal.startsWith('data:image/'),
    textureOpacity: Number(getComputedStyle(mark.querySelector('.ink-film')).opacity),
    fracture: getComputedStyle(mark.querySelector('.ink-tear')).animationName,
    filter: getComputedStyle(mark).filter,
    lifetime: Number.parseFloat(mark.style.getPropertyValue('--ink-lifetime')),
    position: getComputedStyle(mark.parentElement).position,
    pointerEvents: getComputedStyle(mark.parentElement).pointerEvents,
  }));
}

async function waitMode(page, expected) {
  await page.waitForFunction(mode => document.documentElement.dataset.mode === mode
    && !document.documentElement.hasAttribute('data-xray-transition'), expected, { timeout: 12000 });
}

try {
  for (const width of [1440, 390, 320]) {
    const touch = width < 600;
    const reduced = width === 320;
    const context = await browser.newContext({ viewport: { width, height: touch ? 844 : 1000 }, deviceScaleFactor: 1,
      isMobile: touch, hasTouch: touch, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(new URL('/work', base).href, { waitUntil: 'networkidle' });
      await waitMode(page, 'normal');
      await page.evaluate(() => {
        window.__inkChildEnds = 0;
        document.addEventListener('animationend', event => { if (event.target.matches('.ink-tear')) window.__inkChildEnds++; });
      });
      const point = await pointInArchive(page);
      const createdAt = await page.evaluate(() => performance.now());
      await tap(page, point, touch);
      await page.locator('[data-ink-mark]').waitFor();
      await page.evaluate(() => {
        window.__firstInk = document.querySelector('[data-ink-mark]');
        window.__firstInk.querySelector('.ink-tear').dispatchEvent(new AnimationEvent('animationend', { bubbles: true, animationName: 'ink-fracture' }));
      });
      await page.waitForTimeout(1250);
      assert.equal(await page.evaluate(() => window.__firstInk.isConnected), true, 'Child animation completion must not destroy the whole mark.');
      const normal = await markState(page);
      assert.ok(normal.pigments.length >= 3 && normal.source);
      assert.ok(normal.images >= 4 && normal.images <= 7);
      assert.equal(normal.textureOpacity, .54);
      assert.equal(normal.fracture, reduced ? 'none' : 'ink-fracture');
      assert.equal(normal.pointerEvents, 'none');
      assert.equal(normal.position, 'absolute');
      assert.ok(normal.lifetime >= 6000 && normal.lifetime <= 12000);
      if (!reduced) assert.ok(await page.evaluate(() => window.__inkChildEnds >= 4), 'Actual short tear animations finish while the parent survives.');

      const anchor = await page.evaluate(() => {
        const mark = window.__firstInk;
        const before = mark.getBoundingClientRect();
        const oldScroll = scrollY;
        const spacer = document.createElement('div'); spacer.style.height = '900px'; document.body.append(spacer);
        scrollTo({ top: oldScroll + 140, behavior: 'instant' });
        const after = mark.getBoundingClientRect();
        const result = { before: before.y + before.height / 2 + oldScroll, after: after.y + after.height / 2 + scrollY, shift: scrollY - oldScroll };
        scrollTo({ top: oldScroll, behavior: 'instant' }); spacer.remove(); return result;
      });
      assert.ok(anchor.shift > 100 && Math.abs(anchor.before - anchor.after) < .6, 'The mark stays at its original document location.');

      let changedMaterialPixels = null;
      if (!touch) {
        await page.evaluate(async () => {
          const image = new Image(); image.src = window.__firstInk.querySelector('image[data-ink-film]').href.baseVal; await image.decode();
        });
        const box = await page.locator('[data-ink-mark]').first().boundingBox();
        const clip = { x: Math.max(0, Math.floor(box.x - 10)), y: Math.max(0, Math.floor(box.y - 10)),
          width: Math.min(width - Math.max(0, Math.floor(box.x - 10)), Math.ceil(box.width + 20)),
          height: Math.min(1000 - Math.max(0, Math.floor(box.y - 10)), Math.ceil(box.height + 20)) };
        const source = await page.screenshot({ clip, path: new URL('normal-source-pixels.png', output).pathname });
        const hide = await page.addStyleTag({ content: '[data-ink-mark] image[data-ink-film] { visibility: hidden !important; }' });
        const without = await page.screenshot({ clip });
        await hide.evaluate(element => element.remove());
        const [a, b] = await Promise.all([source, without].map(buffer => sharp(buffer).removeAlpha().raw().toBuffer()));
        changedMaterialPixels = 0;
        for (let index = 0; index < a.length; index += 3) if (Math.abs(a[index] - b[index]) + Math.abs(a[index + 1] - b[index + 1]) + Math.abs(a[index + 2] - b[index + 2]) > 35) changedMaterialPixels++;
        assert.ok(changedMaterialPixels > 20, 'Actual embedded film pixels must affect the visible mark, not just its DOM.');
      }

      const age = await page.evaluate(start => performance.now() - start, createdAt);
      await page.waitForTimeout(Math.max(0, 5200 - age));
      assert.equal(await page.evaluate(() => window.__firstInk.isConnected), true, 'The stain survives beyond five seconds.');
      await page.waitForFunction(() => !window.__firstInk.isConnected, null, { timeout: 13000 });
      const actualLifetime = await page.evaluate(start => performance.now() - start, createdAt);
      assert.ok(actualLifetime >= 5900 && actualLifetime <= 12400, 'Natural removal follows the configured six-to-twelve-second lifetime.');

      for (let index = 0; index < 14; index++) await tap(page, point, touch);
      assert.equal(await page.locator('[data-ink-mark]').count(), 12);
      const shapes = await page.locator('[data-ink-pigment="base"]').evaluateAll(paths => paths.map(path => path.getAttribute('d')));
      assert.equal(new Set(shapes).size, shapes.length, 'Every click makes new contour geometry.');
      await page.evaluate(() => document.dispatchEvent(new CustomEvent('h4:pagechange')));
      assert.equal(await page.locator('[data-ink-mark]').count(), 0);

      await page.evaluate(() => {
        window.__inkControlClicks = 0;
        const fixture = document.createElement('div'); fixture.dataset.inkControlFixture = '';
        fixture.style.cssText = 'position:fixed;left:12px;top:12px;z-index:100;display:flex;gap:10px';
        fixture.innerHTML = '<button type="button">ink button check</button><a href="#" style="display:block;padding:12px">ink link check</a>';
        fixture.querySelectorAll('button,a').forEach(control => control.addEventListener('click', event => { event.preventDefault(); window.__inkControlClicks++; }));
        document.body.append(fixture);
      });
      for (const selector of ['button', 'a']) {
        const target = page.locator(`[data-ink-control-fixture] ${selector}`);
        if (touch) await target.tap(); else await target.click();
      }
      assert.equal(await page.evaluate(() => window.__inkControlClicks), 2);
      assert.equal(await page.locator('[data-ink-mark]').count(), 0, 'Functional controls remain clickable without leaving marks.');
      await page.locator('[data-ink-control-fixture]').evaluate(element => element.remove());

      await page.keyboard.down('4');
      try { await waitMode(page, 'xray'); } finally { await page.keyboard.up('4'); }
      await tap(page, point, touch);
      await page.locator('[data-ink-mark]').waitFor();
      const other = await markState(page);
      assert.ok(other.pigments.length >= 3 && other.source);
      assert.equal(other.textureOpacity, .79);
      assert.match(other.filter, /saturate\(1\.35\)/);
      await page.screenshot({ path: new URL(`other-${width}.png`, output).pathname });

      await page.locator('.page-nav a[href="/#contact"]').click();
      await page.waitForURL(url => url.pathname === '/' && url.hash === '#contact');
      await waitMode(page, 'xray');
      const hint = page.locator('[data-other-side-hint]');
      await hint.scrollIntoViewIfNeeded();
      const hintBox = await hint.boundingBox();
      const closePoint = hintBox.x > 15 ? { x: Math.max(5, hintBox.x - 10), y: hintBox.y + hintBox.height / 2 }
        : { x: hintBox.x + hintBox.width / 2, y: hintBox.y - 10 };
      await tap(page, closePoint, touch);
      assert.equal(await page.locator('[data-ink-mark]').count(), 0, 'A nearby mark must not spread over the persistent reverse instruction.');
      assert.equal(await hint.locator('[data-secret-message]').evaluate(element => Number(getComputedStyle(element).opacity)), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      for (let index = 0; index < 3; index++) await page.keyboard.press('3');
      await waitMode(page, 'normal');
      assert.deepEqual(errors, []);
      reports.push({ width, touch, reducedMotion: reduced, normal, other, actualLifetimeMs: actualLifetime, changedMaterialPixels, errors });
      console.log(`PASS chemical ink ${width}px: multicolor/material, child animation survival, ${Math.round(actualLifetime)}ms lifetime, anchor, cap12, controls and protected hint.`);
    } finally { await context.close(); }
  }
  await writeFile(new URL('browser-results.json', output), JSON.stringify({ measuredAt: new Date().toISOString(), base, reports }, null, 2) + '\n');
} finally { await browser.close(); }
