import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { modeIconSettings as settings } from '../src/data/modeIconSettings.js';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const directory = new URL('../artifacts/ref09-phase3/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
const url = path => new URL(path, base).href;
const icons = page => page.locator('[data-mode-icon]').evaluateAll(links => Object.fromEntries(links.map(link => [link.dataset.modeIcon, link.getAttribute('href')])));
const cursor = target => target.evaluate(element => getComputedStyle(element).cursor);
async function state(page, expected) {
  await page.waitForFunction(value => document.documentElement.dataset.mode === value
    && document.documentElement.hasAttribute('data-xray-ready')
    && !document.documentElement.hasAttribute('data-xray-transition')
    && !document.documentElement.hasAttribute('data-mode-snapshot'), expected, { timeout: 15000 }).catch(async error => {
      console.log('ICON MODE DIAGNOSTIC', JSON.stringify(await page.evaluate(() => ({ mode: document.documentElement.dataset.mode, hidden: document.hidden, focused: document.hasFocus(), active: document.activeElement?.outerHTML?.slice(0,300), trace: window.__iconFlow, attributes: Object.fromEntries([...document.documentElement.attributes].map(a=>[a.name,a.value])) }))));
      throw error;
    });
}
async function enter(page) {
  await page.keyboard.down('4');
  try { await state(page, 'xray'); } finally { await page.keyboard.up('4'); }
}
async function reverse(page) { for (let index = 0; index < 3; index++) await page.keyboard.press('3'); await state(page, 'normal'); }
function expected(path, hotspot, fallback = 'pointer') { return `url("${url(path)}") ${hotspot}, ${fallback}`; }

try {
  for (const profile of [
    { label: 'desktop', viewport: { width: 1440, height: 1000 } },
    { label: 'reduced', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' },
    { label: 'touch-390', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    { label: 'touch-320', viewport: { width: 320, height: 844 }, hasTouch: true, isMobile: true },
  ]) {
    const { label, ...options } = profile;
    const context = await browser.newContext({ deviceScaleFactor: 1, ...options });
    await context.addInitScript(() => {
      window.__iconWarm = [];
      window.__iconFlow = [];
      for (const type of ['keydown','keyup','h4:pagechange','h4:modechange','blur','focus']) document.addEventListener(type, event => {
        if ((type==='keydown'||type==='keyup') && !['3','4'].includes(event.key)) return;
        window.__iconFlow.push({ type, key:event.key, repeat:event.repeat, prevented:event.defaultPrevented, mode:document.documentElement.dataset.mode, time:performance.now(), target:event.target?.nodeName });
      });
      const Native = window.Image;
      const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      window.Image = class extends Native {
        set src(value) { window.__iconWarm.push(value); src.set.call(this, value); }
        get src() { return src.get.call(this); }
      };
    });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    try {
      await page.goto(url('/work'), { waitUntil: 'networkidle' });
      await state(page, 'normal');
      assert.deepEqual(await icons(page), settings.favicon.normal);
      assert.equal(await page.locator('link[rel="icon"]').count(), 3, 'Mode changes must not accumulate favicon links.');
      assert.ok(!requests.some(href => /h4ngelic-(?:cursor-other|favicon-other)/.test(href)), 'Normal browsing must not request alternate icon resources.');
      assert.deepEqual(await page.evaluate(() => window.__iconWarm.filter(href => /h4ngelic-(?:cursor-other|favicon-other)/.test(href))), []);

      const touch = Boolean(options.hasTouch), reduced = options.reducedMotion === 'reduce';
      await page.locator('[data-global-index] summary').click();
      const target = page.locator('[data-index-page="about"]');
      if (!touch) {
        assert.equal(await cursor(page.locator('body')), expected(settings.cursor.normal.base, '9 2', 'auto'));
        await target.hover();
        assert.equal(await cursor(target), expected(settings.cursor.normal[reduced ? 'base' : 'hover'], reduced ? '9 2' : '10 2'));
      } else assert.equal(await cursor(page.locator('body')), 'auto');

      await enter(page);
      assert.deepEqual(await icons(page), settings.favicon.other, 'Every favicon variant follows the authoritative mode without reload.');
      if (!touch) {
        assert.equal(await cursor(page.locator('body')), expected(settings.cursor.other.base, '9 2', 'auto'));
        await target.hover();
        assert.equal(await cursor(target), expected(settings.cursor.other[reduced ? 'base' : 'hover'], reduced ? '9 2' : '10 2'));
        if (!reduced) {
          await page.mouse.down();
          assert.equal(await cursor(target), expected(settings.cursor.other.pressed, '9 2'));
          await page.mouse.move(10, 600); await page.mouse.up();
          assert.equal(new URL(page.url()).pathname, '/work', 'A cancelled press must preserve navigation.');
        }
      } else {
        assert.equal(await cursor(page.locator('body')), 'auto');
        assert.ok(!requests.some(href => /h4ngelic-cursor-other-(?:hover|pressed)/.test(href)),
          'Touch devices must not request native hover/pressed cursor feedback.');
        assert.equal(await page.locator('[data-mobile-mode] img').getAttribute('src'), settings.cursor.other.base,
          'The established touch control reuses the exact Other Side brand asset as an image.');
        assert.deepEqual(await page.evaluate(() => window.__iconWarm.filter(href => /h4ngelic-cursor-other/.test(href))), [],
          'Touch controls must not warm native cursor resources through the cursor preloader.');
      }

      await page.evaluate(() => {
        window.__iconPageChanged = false;
        document.addEventListener('h4:pagechange', () => { window.__iconPageChanged = true; }, { once: true });
      });
      await target.click(); await page.waitForURL(value => value.pathname === '/about');
      await page.waitForFunction(() => window.__iconPageChanged && document.documentElement.dataset.page === 'about');
      await page.evaluate(async () => { await document.activeViewTransition?.finished.catch(() => {}); });
      assert.deepEqual(await icons(page), settings.favicon.other, 'Enhanced navigation retains favicon mode.');
      await reverse(page);
      assert.deepEqual(await icons(page), settings.favicon.normal, '333 must restore the exact original SVG href and both PNG fallbacks.');
      await enter(page); await reverse(page);
      const warmed = await page.evaluate(() => window.__iconWarm);
      const preloadPaths = [...Object.values(settings.favicon.other), ...(!touch ? [settings.cursor.other.base, ...(!reduced ? [settings.cursor.other.hover, settings.cursor.other.pressed] : [])] : [])];
      for (const href of preloadPaths) assert.equal(warmed.filter(value => value === href).length, 1, 'Each appropriate icon is warmed once, even across repeated mode changes.');
      if (!touch) assert.equal(await cursor(page.locator('body')), expected(settings.cursor.normal.base, '9 2', 'auto'));
      assert.ok(!requests.some(href => /\/src\/main\.js|\/main-[^/]+\.js|wordmark\.typeface|tattoo-texture|LiberationSans/.test(href)), 'Icon switching on Work/About must never load the hero.');
      assert.deepEqual(errors, []);
      reports.push({ label, iconsRestored: true, cursor: touch ? 'native touch, no custom cursor' : reduced ? 'original base hotspot; hover/press size feedback disabled' : 'base/hover/pressed hotspots preserved', appropriatePrefetchCount: preloadPaths.length, runtimeErrors: errors.length });
      console.log(`PASS Phase3 ${label}: exact native cursor URLs/hotspots, favicon switching and restoration, one-time appropriate prefetch, navigation and no interior hero.`);
    } finally { await context.close(); }
  }

  // The same browser SVG decoder used by native cursors must decode the
  // embedded PNG correctly; screenshots do not capture the operating-system cursor.
  {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await page.goto(url('/work'), { waitUntil: 'networkidle' });
    const comparison = await page.evaluate(async pairs => {
      const result = [];
      for (const [normal, other] of pairs) {
        const buffers = [];
        for (const path of [normal, other]) {
          const image = new Image(); image.src = path; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth * 4; canvas.height = image.naturalHeight * 4;
          const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, canvas.width, canvas.height);
          buffers.push({ data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height });
        }
        let alphaChanged = 0, colorChanged = 0;
        for (let index = 0; index < buffers[0].data.length; index += 4) {
          if (buffers[0].data[index + 3] !== buffers[1].data[index + 3]) alphaChanged++;
          if (Math.abs(buffers[0].data[index] - buffers[1].data[index]) + Math.abs(buffers[0].data[index + 1] - buffers[1].data[index + 1]) + Math.abs(buffers[0].data[index + 2] - buffers[1].data[index + 2]) > 30) colorChanged++;
        }
        result.push({ normal, other, alphaChanged, colorChanged, width: buffers[0].width, height: buffers[0].height });
      }
      return result;
    }, ['base', 'hover', 'pressed'].map(key => [settings.cursor.normal[key], settings.cursor.other[key]]));
    for (const result of comparison) { assert.equal(result.alphaChanged, 0); assert.ok(result.colorChanged > 100); }
    reports.push({ label: 'browser-svg-decoder', comparisons: comparison });
    console.log('PASS Phase3 browser SVG decode: exact alpha/cutouts/perimeter and real interior color changes in all three native sizes.');

    await enter(page);
    await page.evaluate(async () => {
      // Vite may add a cache-busting query to the app's actual module URL.
      // Reuse that instance rather than constructing an unrelated WeakMap.
      const moduleURL = performance.getEntriesByType('resource').map(entry => entry.name)
        .find(href => /\/src\/mode-icons\.js(?:\?|$)/.test(href));
      const { initModeIcons } = await import(moduleURL || '/src/mode-icons.js');
      initModeIcons()(); // Dispose the current document-level instance.
      const stop = initModeIcons(); // Reattach late, while already in Other Side.
      window.__stopModeIcons = stop;
    });
    assert.deepEqual(await icons(page), settings.favicon.other, 'A late initializer must read the current mode.');
    await page.evaluate(() => window.__stopModeIcons());
    assert.deepEqual(await icons(page), settings.favicon.normal, 'Disposal restores the original favicon hrefs.');
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('h4:modechange', { detail: { mode: 'xray' } })));
    assert.deepEqual(await icons(page), settings.favicon.normal, 'Disposed listeners must no longer update icon links.');
    await page.close();
  }
  await writeFile(new URL('results.json', directory), JSON.stringify({ measuredAt: new Date().toISOString(), base, reports,
    limitations: 'Native CSS asset/hotspot values and browser SVG rasterization are verified; Playwright screenshots do not capture operating-system cursor or browser tab chrome.' }, null, 2) + '\n');
} finally { await browser.close(); }
