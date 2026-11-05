import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_INDEX_GLOW_ARTIFACTS || 'artifacts/v312/V19'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255)
  .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const pixelLuma = (buffer, width, x, y) => {
  const offset = (Math.round(y) * width + Math.round(x)) * 4;
  return buffer[offset] * .2126 + buffer[offset + 1] * .7152 + buffer[offset + 2] * .0722;
};
try {
  for (const profile of profiles) {
    console.log(`CHECK V19 INDEX glow ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 }, deviceScaleFactor: 1,
      isMobile: profile.width < 600, hasTouch: profile.width < 600, reducedMotion: profile.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); const errors = [];
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.locator('[data-global-index] > summary').click();
      const panel = page.locator('.global-index-links');
      await panel.waitFor();
      await panel.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
      const style = await panel.evaluate(element => {
        const s = getComputedStyle(element), box = element.getBoundingClientRect();
        return { shadow: s.boxShadow, surface: s.backgroundColor, border: s.borderTopWidth, radius: s.borderRadius,
          filter: s.filter, linkColors: [...element.querySelectorAll('a, .index-static')].map(item => getComputedStyle(item).color),
          box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height } };
      });
      assert.match(style.shadow, /rgba\(0, 0, 0/, 'The panel receives a dark depth halo.');
      assert.equal(style.surface, 'rgb(48, 48, 51)', 'The F1 field surface is unchanged.');
      assert.equal(style.border, '0px'); assert.equal(style.radius, '4px'); assert.equal(style.filter, 'none');
      const contrast = style.linkColors.map(color => (luminance(color) + .05) / (luminance(style.surface) + .05));
      assert.ok(contrast.every(ratio => ratio >= 4.5), 'Panel readability remains above 4.5:1.');
      const fields = await page.locator('.inquiry-field input, .inquiry-field textarea').evaluateAll(nodes => nodes.map(node => {
        const s = getComputedStyle(node); return { shadow: s.boxShadow, border: s.borderTopWidth };
      }));
      assert.ok(fields.length >= 2 && fields.every(field => field.shadow === 'none'), 'Contact form boxes stay flat.');
      await page.screenshot({ path: new URL(`dark-${profile.width}-${profile.reduced}.png`, output).pathname });
      await page.evaluate(() => {
        const composition = document.querySelector('[data-page-composition]');
        composition.style.background = '#fff';
        document.querySelector('main').style.visibility = 'hidden';
        document.querySelector('[data-floating-brand]').style.visibility = 'hidden';
        document.querySelector('[data-naavi]').style.visibility = 'hidden';
      });
      await page.waitForTimeout(100);
      const flatShot = await page.screenshot({ path: new URL(`bright-flat-${profile.width}-${profile.reduced}.png`, output).pathname });
      const { data, info } = await sharp(flatShot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const x = style.box.left + style.box.width / 2;
      const ys = [style.box.bottom + 4, style.box.bottom + 10, style.box.bottom + 18, style.box.bottom + 30, style.box.bottom + 48, style.box.bottom + 90];
      const samples = ys.map(y => pixelLuma(data, info.width, x, y));
      const near = samples.at(-1) - samples[0];
      const jumps = samples.slice(1).map((value, index) => Math.abs(value - samples[index]));
      assert.ok(near > 4, `The dark halo remains visible over a bright background: ${JSON.stringify(samples)}`);
      assert.ok(Math.max(...jumps) < 70, `The halo falls off without a hard band: ${JSON.stringify(samples)}`);
      await page.evaluate(() => {
        const composition = document.querySelector('[data-page-composition]');
        composition.style.background = 'linear-gradient(#ffffff55, #ffffff55), url("/images/tattoos/tattoo-01.jpg") center / cover';
      });
      await page.waitForTimeout(100);
      await page.screenshot({ path: new URL(`bright-image-${profile.width}-${profile.reduced}.png`, output).pathname });
      assert.deepEqual(errors, []);
      reports.push({ ...profile, style, contrast, samples, near, jumps, errors }); await save();
      console.log(`PASS V19 ${profile.width}px reduced=${profile.reduced}: dark depth halo, F1 surface, 4.5:1 contrast, flat form boxes, visible falloff over a bright image.`);
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors }); await save();
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
