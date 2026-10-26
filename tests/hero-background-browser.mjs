import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const destination = new URL('../artifacts/spatial-master/', import.meta.url);
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
const deadline = setTimeout(() => void browser.close(), 240000);

async function pigment(page, x, y) {
  const buffer = await page.screenshot();
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let pixels = 0, largestChroma = 0;
  for (let py = Math.max(0, y - 25); py < Math.min(info.height, y + 26); py++) {
    for (let px = Math.max(0, x - 25); px < Math.min(info.width, x + 26); px++) {
      const at = (Math.floor(py) * info.width + Math.floor(px)) * 3;
      const values = [data[at], data[at + 1], data[at + 2]];
      const chroma = Math.max(...values) - Math.min(...values);
      largestChroma = Math.max(largestChroma, chroma);
      if (chroma > 35 && Math.max(...values) > 65) pixels++;
    }
  }
  return { pixels, largestChroma };
}

try {
  for (const width of [1000, 390, 320]) {
    const mobile = width < 600;
    const height = mobile ? 844 : 760;
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile,
      deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('/?test=1', base).href, { waitUntil: 'networkidle' });
    await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
    // Keep the upper interior sample clear of the genuine visitor-message
    // button: mobile browsers can enlarge nearby semantic touch targets.
    const points = [[2, 1], [width - 3, 1], [Math.floor(width * .15), 3],
      [10, Math.floor(height * .5)], [width - 11, Math.floor(height * .57)], [11, Math.floor(height * .8)]];
    const splash = [];
    for (const [x, y] of points) {
      await page.evaluate(() => { window.__previousHeroBackgroundMark = document.querySelector('[data-ink-mark]:last-child'); });
      const beforeMesh = await page.evaluate(() => window.__H4_TEST__.snapshot().heroInk.created);
      if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
      await page.waitForFunction(({ x, y }) => {
        const mark = document.querySelector('[data-ink-mark]:last-child');
        return mark && mark !== window.__previousHeroBackgroundMark
          && Math.abs(parseFloat(mark.style.left) - x - scrollX) < 1
          && Math.abs(parseFloat(mark.style.top) - y - scrollY) < 1;
      }, { x, y });
      const mark = await page.locator('[data-ink-mark]').last().evaluate(mark => ({
        x: parseFloat(mark.style.left), y: parseFloat(mark.style.top),
        opacity: Number(getComputedStyle(mark).opacity), pointerEvents: getComputedStyle(mark).pointerEvents,
      }));
      const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
      assert.ok(Math.abs(mark.x - x - scroll.x) < 1 && Math.abs(mark.y - y - scroll.y) < 1,
        `Ink follows real input in document coordinates: ${JSON.stringify({ width, x, y, mark, scroll })}`);
      assert.equal(mark.pointerEvents, 'none');
      assert.equal(await page.evaluate(() => window.__H4_TEST__.snapshot().heroInk.created), beforeMesh);
      // A random white pigment may have little chroma; geometry/opacity plus
      // later saturated samples establish coverage without rejecting white.
      const raster = await pigment(page, x, y);
      splash.push({ x, y, mark, raster });
    }
    assert.ok(splash.some(sample => sample.raster.pixels > 5), 'Real rendered pigment must be visible, including clipped edge splashes.');
    const flatBefore = await page.locator('[data-ink-mark]').count();
    await page.evaluate(() => { window.__heroFlatMarks = new Set(document.querySelectorAll('[data-ink-mark]')); });
    const hit = await page.evaluate(() => window.__H4_TEST__.hitPoint());
    assert.ok(hit);
    const meshBefore = await page.evaluate(() => window.__H4_TEST__.snapshot().heroInk.created);
    if (mobile) await page.touchscreen.tap(hit.x, hit.y); else await page.mouse.click(hit.x, hit.y);
    await page.waitForFunction(count => window.__H4_TEST__.snapshot().heroInk.created > count, meshBefore);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('[data-ink-mark]')].every(mark => window.__heroFlatMarks.has(mark))),
      'Mesh paint has priority and never duplicates a flat splash, even while older marks expire.');
    await page.locator('#speed-control').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#speed-control').getAttribute('aria-pressed'), 'true');
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('[data-ink-mark]')].every(mark => window.__heroFlatMarks.has(mark))),
      'Controls stay functional and do not paint.');
    await page.screenshot({ path: new URL(`hero-background-${width}.png`, destination).pathname });

    const strip = page.locator('.category-strip');
    await strip.scrollIntoViewIfNeeded();
    const labels = await strip.locator('.category-link').allTextContents();
    assert.deepEqual(labels.map(value => value.trim()), ['tattoos', 'jewellery', 'more']);
    const bounds = await strip.locator('.category-link').evaluateAll(links => links.map(link => {
      const { x, y, width, height } = link.getBoundingClientRect(); return { x, y, width, height };
    }));
    assert.ok(Math.max(...bounds.map(box => box.y)) - Math.min(...bounds.map(box => box.y)) < 2);
    assert.ok(Math.max(...bounds.map(box => box.width)) - Math.min(...bounds.map(box => box.width)) < 2);
    const children = await strip.locator('.category-sublinks a').allTextContents();
    assert.deepEqual(children.map(value => value.trim()), ['tattoos', 'flashes', 'analog photography', 'digital artworks']);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: new URL(`archive-strip-${width}.png`, destination).pathname });
    assert.deepEqual(errors, []);
    reports.push({ width, splash, meshPaint: true, controls: true, bounds, children, errors });
    await context.close();
    console.log(`PASS hero background ${width}: actual top/side/bottom splashes, registered pixels, mesh priority, controls, horizontal grouped navigation.`);
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
    isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext,
    { apply(target, receiver, args) { return /webgl/.test(args[0]) ? null : Reflect.apply(target, receiver, args); } }); });
  await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  await page.locator('#stage.is-fallback').waitFor({ timeout: 60000 });
  await page.touchscreen.tap(4, 2);
  await page.locator('[data-ink-mark]').waitFor();
  assert.ok(await page.locator('.hero-nav a[href="/work"]').isVisible());
  reports.push({ profile: 'no-webgl', topBackgroundInk: true });
  await context.close();
  await writeFile(new URL('hero-background-results.json', destination), JSON.stringify({ passed: true, reports }, null, 2));
} finally { clearTimeout(deadline); await browser.close(); }
