import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createPreviewServer } from '../scripts/serve-preview.mjs';
import { mannequinVariant, mannequinVariantList } from '../src/mannequin-preview-config.js';
import { artworks } from '../src/data/artworks.js';

const evidence = new URL('../docs/validation/MANNEQUIN-C/', import.meta.url);
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
const mockupCount = artworks.filter((artwork) => artwork.published !== false && artwork.category === 'tattoos'
  && Array.isArray(artwork.images) && artwork.images.length).length;

const trackPage = async (context) => {
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', (request) => requests.push(request.url()));
  await page.addInitScript(() => {
    window.__webglContexts = 0;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (/webgl/i.test(type) && getContext.call(this, type, ...args)) window.__webglContexts += 1;
      return getContext.call(this, type, ...args);
    };
  });
  return { page, errors, requests };
};

const scrollToModel = async (page) => {
  await page.evaluate(() => {
    const section = document.querySelector('#model-3d');
    scrollTo({ top: Math.max(0, section.getBoundingClientRect().top + scrollY - 120), behavior: 'instant' });
  });
};

const waitReady = (page) => page.waitForFunction(
  () => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'ready',
  null, { timeout: 60000 },
);

const results = [];
try {
  for (const { width, height } of profiles) {
    const context = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600,
    });
    const { page, errors, requests } = await trackPage(context);
    await page.goto(`${base}/work/tattoos`, { waitUntil: 'networkidle' });

    const preview = page.locator('[data-mannequin-preview]');
    assert.equal(await preview.getAttribute('data-mannequin-state'), 'deferred');
    assert.equal(await preview.getAttribute('data-mannequin-variant'), 'C', 'C must be the default variant.');
    assert.equal(await page.evaluate(() => window.__webglContexts), 0, 'Cold Work must not create a WebGL context.');
    assert.equal(requests.filter((url) => url.endsWith('.glb')).length, 0, 'Cold Work must not request a GLB.');
    assert.equal(requests.filter((url) => url.endsWith('/textures/designs/demo-mark.png')).length, 0);
    assert.ok(!requests.some((url) => /mannequin-preview-|three\.module|DracoLoader|KTX2Loader/.test(url)), 'The Three.js stack waits for visibility.');

    await scrollToModel(page);
    await waitReady(page);
    await page.waitForTimeout(200);
    assert.deepEqual(errors, [], `no console errors at ${width}px`);

    const glbRequests = () => requests.filter((url) => /\/models\/mannequin-[a-z0-9.-]+\.glb$/.test(url));
    assert.equal(await page.evaluate(() => window.__webglContexts), 1, 'Exactly one WebGL context.');
    assert.equal(await page.locator('.mannequin-preview-canvas').count(), 1);
    assert.equal(glbRequests().length, 1, 'Exactly one GLB request for the default variant.');
    assert.match(glbRequests()[0], /mannequin-c\.[a-f0-9]+\.glb$/);
    assert.equal(await preview.getAttribute('data-mannequin-polygons'), '49838');
    assert.equal(await preview.getAttribute('data-mannequin-design'), 'unsupported');
    assert.match(await page.locator('[data-mannequin-preview]').getAttribute('data-mannequin-material'), /skincolor/);

    const layout = await page.evaluate(() => {
      const section = document.querySelector('#model-3d');
      const heading = section.querySelector('.archive-category-heading').getBoundingClientRect();
      const figure = section.querySelector('.mannequin-preview').getBoundingClientRect();
      const frame = section.querySelector('.mannequin-preview-frame').getBoundingClientRect();
      const canvas = section.querySelector('canvas').getBoundingClientRect();
      return {
        headingBottom: heading.bottom, figureTop: figure.top,
        frame: { left: frame.left, right: frame.right, width: frame.width },
        canvas: { left: canvas.left, right: canvas.right, width: canvas.width },
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    assert.ok(layout.headingBottom < layout.figureTop, 'The preview must not overlap its heading.');
    assert.ok(layout.frame.left >= 0 && layout.frame.right <= width + 1);
    assert.ok(Math.abs(layout.canvas.width - layout.frame.width) <= 1);
    assert.ok(layout.documentWidth <= width + 1, 'No horizontal overflow.');

    // Auto-Rotation laeuft und pausiert waehrend des Ziehens.
    const angle = async () => Number(await preview.getAttribute('data-mannequin-angle'));
    await page.waitForTimeout(2600);
    const angleAuto = await angle();
    assert.ok(angleAuto > 0.02, `Auto rotation must run (${angleAuto} rad).`);
    const box = await page.locator('.mannequin-preview-frame').boundingBox();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    const angleHeldA = await angle();
    await page.waitForTimeout(500);
    const angleHeldB = await angle();
    assert.ok(Math.abs(angleHeldB - angleHeldA) < 0.02, `Rotation pauses while dragging (${angleHeldA} -> ${angleHeldB}).`);
    await page.mouse.move(centerX + 240, centerY, { steps: 12 });
    await page.waitForTimeout(60);
    const angleDragged = await angle();
    assert.ok(Math.abs(angleDragged - angleHeldB) > 0.1, 'Dragging rotates the model.');
    await page.mouse.up();
    await page.waitForTimeout(120);
    assert.equal(await preview.getAttribute('data-mannequin-flicks'), '1',
      `A strong flick triggers the documented fallback animation (peak ${await preview.getAttribute('data-mannequin-peak')}).`);
    assert.equal(await preview.getAttribute('data-mannequin-shoot'), 'playing');
    await page.waitForTimeout(1800);
    assert.equal(await preview.getAttribute('data-mannequin-shoot'), 'idle', 'The model returns into the viewport.');

    // Variantenwechsel ohne Reload, alter Buffer wird disposed.
    const screenshots = {};
    const variantList = mannequinVariantList();
    for (const variant of variantList) {
      const previousVariant = await preview.getAttribute('data-mannequin-variant');
      const disposedBefore = Number(await preview.getAttribute('data-mannequin-disposed') || 0);
      if (previousVariant !== variant.key) {
        await page.locator(`[data-mannequin-variant-option="${variant.key}"]`).click();
        await waitReady(page);
        await page.waitForTimeout(300);
        assert.equal(await preview.getAttribute('data-mannequin-variant'), variant.key);
        assert.equal(await page.evaluate(() => window.__webglContexts), 1, 'Variant switches reuse the single renderer.');
        const glbs = glbRequests();
        assert.equal(new Set(glbs).size, glbs.length, 'No GLB is fetched twice.');
        const visited = new Set(['C', ...variantList.slice(0, variantList.indexOf(variant) + 1).map((entry) => entry.key)]);
        assert.equal(glbs.length, visited.size, 'Exactly one request per visited variant, never a refetch.');
        assert.equal(Number(await preview.getAttribute('data-mannequin-disposed')), disposedBefore + 1, 'The previous model buffers are disposed.');
        assert.equal(await page.locator('.mannequin-preview-canvas').count(), 1);
      }
      const designButton = page.locator('[data-mannequin-design-toggle]');
      if (mannequinVariant(variant.key).design) {
        assert.equal(await designButton.isEnabled(), true, `${variant.key} keeps the demo design.`);
        assert.equal(await designButton.getAttribute('aria-disabled'), 'false');
        assert.equal(await page.locator('[data-mannequin-design-hint]').isVisible(), false);
      } else {
        assert.equal(await designButton.isEnabled(), false, 'C disables the demo design.');
        assert.equal(await designButton.getAttribute('aria-disabled'), 'true');
        assert.equal(await page.locator('[data-mannequin-design-hint]').isVisible(), true);
        assert.match(await page.locator('[data-mannequin-design-hint]').textContent(), /no decals/i);
      }
      const file = `variant-${variant.key.toLowerCase()}-${width}.png`;
      await page.locator('.mannequin-preview').screenshot({ path: fileURLToPath(new URL(file, evidence)) });
      screenshots[variant.key] = file;
    }

    // Zurueck zu A: kein zweiter Request, Buffer-Cache greift.
    const before = glbRequests().length;
    await page.locator('[data-mannequin-variant-option="A"]').click();
    await waitReady(page);
    await page.waitForTimeout(200);
    assert.equal(glbRequests().length, before, 'Switching back must not refetch a cached variant.');
    assert.equal(await page.evaluate(() => window.__webglContexts), 1);
    await page.locator('[data-mannequin-variant-option="C"]').click();
    await waitReady(page);

    // Demo-Design bleibt an A/B funktional (Deferred, genau ein PNG-Request).
    await page.locator('[data-mannequin-variant-option="B"]').click();
    await waitReady(page);
    const designButton = page.locator('[data-mannequin-design-toggle]');
    await designButton.click();
    await page.waitForFunction(() => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinDecal === 'applied', null, { timeout: 30000 });
    assert.equal(requests.filter((url) => url.endsWith('/textures/designs/demo-mark.png')).length, 1);
    await designButton.click();
    assert.equal(await designButton.getAttribute('aria-pressed'), 'false');
    await page.locator('[data-mannequin-variant-option="C"]').click();
    await waitReady(page);
    assert.equal(await preview.getAttribute('data-mannequin-design'), 'unsupported');

    // Mockups bleiben unangetastet.
    const figureCount = await page.locator('figure.project-image').count();
    assert.ok(figureCount >= mockupCount, `The tattoo mockups stay mounted (${figureCount} >= ${mockupCount}).`);
    assert.deepEqual(errors, [], `no console errors after interactions at ${width}px`);

    results.push({
      width, height, defaultVariant: 'C', glbRequests: glbRequests().length,
      variants: mannequinVariantList().map((variant) => variant.key),
      screenshots, webglContexts: await page.evaluate(() => window.__webglContexts),
      autoAngle: angleAuto, mockups: figureCount, errors,
    });
    await context.close();
  }

  // Reduced motion: keine Auto-Rotation, Drag bleibt.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const { page, errors } = await trackPage(context);
    await page.goto(`${base}/work/tattoos`, { waitUntil: 'networkidle' });
    await scrollToModel(page);
    await waitReady(page);
    await page.waitForTimeout(2400);
    const preview = page.locator('[data-mannequin-preview]');
    assert.equal(Number(await preview.getAttribute('data-mannequin-angle')), 0, 'Reduced motion disables auto rotation.');
    const box = await page.locator('.mannequin-preview-frame').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    assert.ok(Number(await preview.getAttribute('data-mannequin-angle')) > 0.5, 'Drag still rotates with reduced motion.');
    assert.equal(await preview.getAttribute('data-mannequin-flicks'), null, 'Reduced motion disables the flick.');
    assert.deepEqual(errors, []);
    results.push({ reducedMotion: true, angle: await preview.getAttribute('data-mannequin-angle'), errors });
    await context.close();
  }

  // Kein WebGL: Poster bleibt, kein Canvas.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page } = await trackPage(context);
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (/webgl/i.test(type)) return null;
        return getContext.call(this, type, ...args);
      };
    });
    await page.goto(`${base}/work/tattoos`, { waitUntil: 'networkidle' });
    await scrollToModel(page);
    await page.waitForFunction(() => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'failed', null, { timeout: 30000 });
    const fallback = await page.locator('[data-mannequin-preview]').evaluate((node) => ({
      webgl: node.dataset.mannequinWebgl,
      poster: getComputedStyle(node.querySelector('.mannequin-preview-poster')).opacity,
      canvases: document.querySelectorAll('.mannequin-preview-canvas').length,
    }));
    assert.equal(fallback.webgl, 'unavailable');
    assert.equal(fallback.canvases, 0);
    assert.ok(Number(fallback.poster) > 0, 'The poster remains the fallback.');
    await page.locator('.mannequin-preview').screenshot({ path: fileURLToPath(new URL('fallback-poster-1440.png', evidence)) });
    results.push({ noWebgl: fallback });
    await context.close();
  }

  // Leak-Probe: 5 Route-Wechsel (Mount/Unmount) + 10 Variantenwechsel.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page, errors } = await trackPage(context);
    await page.goto(`${base}/work/tattoos`, { waitUntil: 'networkidle' });
    await scrollToModel(page);
    await waitReady(page);
    const preview = page.locator('[data-mannequin-preview]');
    let switches = 0;
    for (let cycle = 0; cycle < 5; cycle += 1) {
      for (const key of ['A', 'C']) {
        await page.locator(`[data-mannequin-variant-option="${key}"]`).click();
        await waitReady(page);
        switches += 1;
      }
      await page.evaluate(() => { history.pushState({}, '', '/about'); dispatchEvent(new PopStateEvent('popstate')); });
      await page.waitForFunction(() => !document.querySelector('[data-mannequin-preview]'), null, { timeout: 30000 });
      await page.evaluate(() => { history.pushState({}, '', '/work/tattoos'); dispatchEvent(new PopStateEvent('popstate')); });
      await page.waitForFunction(() => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'deferred', null, { timeout: 30000 });
      await scrollToModel(page);
      await waitReady(page);
    }
    await page.waitForTimeout(400);
    const leaked = await page.evaluate(() => ({
      canvases: document.querySelectorAll('.mannequin-preview-canvas').length,
      contexts: window.__webglContexts,
    }));
    assert.equal(leaked.canvases, 1, 'Exactly one canvas survives the cycles.');
    assert.ok(leaked.contexts <= 6, `WebGL contexts must not grow unbounded (${leaked.contexts} for 5 mounts).`);
    assert.deepEqual(errors, [], 'No console errors during the leak probe.');
    results.push({ leak: { switches, mounts: 5, ...leaked } });
    await context.close();
  }

  // B-F14-Regression: der Viewer bleibt in der Tattoo-Rubrik.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page } = await trackPage(context);
    await page.goto(`${base}/work/tattoos`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-mannequin-preview]').count(), 1);
    for (const route of ['/work/jewellery', '/work/digital-artworks', '/tools/m4shlab']) {
      const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      assert.ok(response.status() === 200 || response.status() === 404);
      assert.equal(await page.locator('[data-mannequin-preview]').count(), 0, `${route} must not mount the mannequin viewer.`);
    }
    results.push({ isolation: ['/work/tattoos', '/work/jewellery', '/work/digital-artworks', '/tools/m4shlab'] });
    await context.close();
  }

  await writeFile(new URL('requests.json', evidence), JSON.stringify({
    checkedAt: new Date().toISOString(),
    route: '/work/tattoos',
    source: 'production preview build',
    profiles,
    variants: mannequinVariantList().map((variant) => variant.model),
    results,
    passed: true,
  }, null, 2) + '\n');
  const screenshots = results.filter((entry) => entry.screenshots).flatMap((entry) => Object.values(entry.screenshots));
  console.log(`PASS mannequin preview: ${profiles.length} viewports × A/B/C, ${screenshots.length} screenshots, rotation + drag + flick + reduced motion + no-WebGL fallback + leak probe.`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
