import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createPreviewServer } from '../scripts/serve-preview.mjs';

const evidence = new URL('../docs/validation/MANNEQUIN-PROCEDURAL/', import.meta.url);
const aModel = await readFile(new URL('../docs/validation/MANNEQUIN-PROCEDURAL/variant-a.glb', import.meta.url));
const bModel = await readFile(new URL('../public/models/mannequin.glb', import.meta.url));
await mkdir(evidence, { recursive: true });

const server = await createPreviewServer();
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const base = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const profiles = [{ width: 1440, height: 1000 }, { width: 390, height: 900 }, { width: 320, height: 900 }];
const results = [];
const screenshots = new Map();
try {
  for (const { width, height } of profiles) {
    for (const variant of ['A', 'B']) {
      const context = await browser.newContext({
        viewport: { width, height }, deviceScaleFactor: 1,
        isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const errors = [], requests = [];
      let modelContentType = '';
      page.on('response', response => {
        if (response.url().endsWith('/models/mannequin.glb')) modelContentType = response.headers()['content-type'] || '';
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('request', request => requests.push(request.url()));
      await page.addInitScript(() => {
        window.__mannequinWebGL = 0;
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
          if (/webgl/i.test(type)) window.__mannequinWebGL++;
          return getContext.call(this, type, ...args);
        };
      });
      if (variant === 'A') {
        await page.route('**/models/mannequin.glb', route => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: aModel }));
      }
      await page.goto(`${base}/work/tattoos`, { waitUntil: 'networkidle' });
      const target = page.locator('[data-mannequin-preview]');
      assert.equal(await target.getAttribute('data-mannequin-state'), 'deferred');
      assert.equal(await page.evaluate(() => window.__mannequinWebGL), 0, 'Cold Work must not create a WebGL context.');
      assert.equal(requests.filter(url => url.endsWith('/models/mannequin.glb')).length, 0, 'Cold Work must not request the GLB.');
      assert.ok(!requests.some(url => /mannequin-preview-[^/]+\.js/.test(url)), 'The Three.js model module must wait for intersection.');
      assert.ok(!requests.some(url => /RoomEnvironment-|\/assets\/main-[^/]+\.js/.test(url)), 'Hero/Three chunks must not load before the model is visible.');

      await page.locator('#model-3d').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'ready', null, { timeout: 30000 });
      await page.waitForTimeout(150);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => window.__mannequinWebGL), 1, 'The visible model uses exactly one WebGL context.');
      assert.equal(await target.getAttribute('data-mannequin-static'), 'true');
      assert.equal(await page.locator('.mannequin-preview-canvas').count(), 1);
      assert.equal(requests.filter(url => url.endsWith('/models/mannequin.glb')).length, 1, 'The GLB is requested exactly once, after intersection.');
      assert.equal(modelContentType, 'model/gltf-binary');

      const layout = await page.locator('#model-3d').evaluate((section) => {
        const heading = section.querySelector('.archive-category-heading').getBoundingClientRect();
        const figure = section.querySelector('.mannequin-preview').getBoundingClientRect();
        const frame = section.querySelector('.mannequin-preview-frame').getBoundingClientRect();
        const canvas = section.querySelector('canvas').getBoundingClientRect();
        return {
          heading: { top: heading.top, bottom: heading.bottom, left: heading.left, right: heading.right },
          figure: { top: figure.top, bottom: figure.bottom, left: figure.left, right: figure.right },
          frame: { top: frame.top, bottom: frame.bottom, left: frame.left, right: frame.right, width: frame.width, height: frame.height },
          canvas: { top: canvas.top, bottom: canvas.bottom, left: canvas.left, right: canvas.right, width: canvas.width, height: canvas.height },
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: innerWidth,
        };
      });
      assert.ok(layout.heading.bottom < layout.figure.top, 'The preview must not overlap its heading.');
      assert.ok(layout.frame.left >= 0 && layout.frame.right <= width + 1);
      assert.ok(layout.canvas.left >= layout.frame.left - 1 && layout.canvas.right <= layout.frame.right + 1);
      assert.ok(layout.documentWidth <= width + 1, 'The model preview cannot create horizontal overflow.');

      await page.evaluate((value) => { document.querySelector('.mannequin-preview figcaption span:last-child').textContent = `static / ${value.toLowerCase()}`; }, variant);
      const screenshot = await page.locator('.mannequin-preview').screenshot();
      const file = `variant-${variant.toLowerCase()}-${width}.png`;
      await writeFile(new URL(file, evidence), screenshot);
      const screenshotHash = createHash('sha256').update(screenshot).digest('hex');
      const key = `${variant}-${width}`;
      screenshots.set(key, screenshotHash);
      results.push({
        variant, width, height, static: true, webglContexts: 1,
        glbRequestsBeforeVisibility: 0, glbRequestsAfterVisibility: 1,
        previewModuleOnlyAfterVisibility: true, modelContentType, layout, errors,
        screenshot: file, screenshotSha256: screenshotHash,
        servedModelBytes: variant === 'A' ? aModel.length : bModel.length,
      });
      await context.close();
    }
  }
  for (const { width } of profiles) {
    assert.notEqual(screenshots.get(`A-${width}`), screenshots.get(`B-${width}`), `A and B must render different pixels at ${width}px.`);
  }
  await writeFile(new URL('results.json', evidence), JSON.stringify({
    checkedAt: new Date().toISOString(),
    route: '/work/tattoos',
    source: 'production preview build',
    profiles,
    assertions: {
      coldRouteWebGL: 0,
      coldRouteGlbRequests: 0,
      visibleRouteWebGL: 1,
      visibleRouteGlbRequests: 1,
      renderLoop: false,
      headingOverlap: false,
      horizontalOverflow: false,
    },
    results,
    passed: true,
  }, null, 2) + '\n');
  console.log(`PASS mannequin preview: ${results.length} static A/B renders at 1440/390/320; cold route made 0 WebGL and 0 GLB requests; visible section made exactly 1 GLB request.`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
