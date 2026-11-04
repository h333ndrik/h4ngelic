import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createPreviewServer } from '../scripts/serve-preview.mjs';
import { mannequinVariant } from '../src/mannequin-preview-config.js';
import { artworks } from '../src/data/artworks.js';

const root = fileURLToPath(new URL('..', import.meta.url));
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
const glbRequests = (requests) => requests.filter((url) => /\/models\/mannequin-[a-z0-9.-]+\.glb$/.test(url));

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

const scrollSectionTo = async (page, selector, top) => page.evaluate(([name, position]) => {
  const element = document.querySelector(name);
  scrollTo({ top: Math.max(0, element.getBoundingClientRect().top + scrollY - position), behavior: 'instant' });
}, [selector, top]);

const waitReady = (page) => page.waitForFunction(
  () => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'ready',
  null, { timeout: 60000 },
);

/** Liesst die Einfahrt-Pose der Modell-Section. */
const sectionPose = (page) => page.evaluate(() => {
  const section = document.querySelector('#model-3d');
  const style = getComputedStyle(section);
  const read = (name, fallback) => {
    const value = Number.parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    x: read('--entrance-x', 0),
    opacity: read('--entrance-opacity', 1),
    transform: style.transform,
    top: section.getBoundingClientRect().top,
  };
});

/**
 * Liesst die Pose des Frontpage-Elements "01 / creative": dort laeuft die
 * Einfahrt ueber die Rubrik-Links (--kinetic-x/--kinetic-opacity), waehrend der
 * Titel statisch bleibt.
 */
const homepagePose = (page) => page.evaluate(() => {
  const section = document.querySelector('#selected-work');
  const item = section.querySelector('.category-link .kinetic-item');
  const style = getComputedStyle(item);
  const read = (name, fallback) => {
    const value = Number.parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    x: read('--kinetic-x', 0),
    opacity: read('--kinetic-opacity', 1),
    top: section.getBoundingClientRect().top,
  };
});

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
    assert.equal(await preview.getAttribute('data-mannequin-variant'), 'C', 'C is the only visible variant.');
    assert.equal(await page.locator('[data-mannequin-variant-option]').count(), 0, 'There is no visible variant switcher.');
    assert.equal(await page.evaluate(() => window.__webglContexts), 0, 'Cold Work must not create a WebGL context.');
    assert.equal(glbRequests(requests).length, 0, 'Cold Work must not request a GLB.');
    assert.equal(requests.filter((url) => url.endsWith('/textures/designs/demo-mark.png')).length, 0);
    assert.ok(!requests.some((url) => /mannequin-preview-|three\.module|DracoLoader|KTX2Loader/.test(url)), 'The Three.js stack waits for visibility.');

    // Einfahrt: Startpose vor dem Viewport ist unsichtbar und eingerueckt.
    const startPose = await sectionPose(page);
    assert.ok(startPose.opacity < 0.05, `The section starts hidden (${startPose.opacity}).`);
    const expectedInset = Math.min(28, width * 0.045);
    assert.ok(Math.abs(startPose.x - expectedInset) < 0.5, `The section starts inset by ${expectedInset}px (got ${startPose.x}).`);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await scrollSectionTo(page, '#model-3d', 120);
    await waitReady(page);
    await page.waitForTimeout(250);
    assert.deepEqual(errors, [], `no console errors at ${width}px`);

    const glbs = glbRequests(requests);
    assert.equal(await page.evaluate(() => window.__webglContexts), 1, 'Exactly one WebGL context.');
    assert.equal(await page.locator('.mannequin-preview-canvas').count(), 1);
    assert.equal(glbs.length, 1, 'Exactly one GLB request for the visible variant.');
    assert.match(glbs[0], /mannequin-c\.[a-f0-9]+\.glb$/);
    assert.equal(glbs.filter((url) => /mannequin-female-[ab]\.glb$/.test(url)).length, 0, 'A/B stay unrequested in the production build.');
    assert.equal(await preview.getAttribute('data-mannequin-polygons'), '49838');
    assert.equal(await preview.getAttribute('data-mannequin-design'), 'unsupported');
    assert.match(await preview.getAttribute('data-mannequin-material'), /skincolor/);

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

    const designButton = page.locator('[data-mannequin-design-toggle]');
    assert.equal(await designButton.isEnabled(), false, 'C disables the demo design.');
    assert.equal(await designButton.getAttribute('aria-disabled'), 'true');
    assert.equal(await page.locator('[data-mannequin-design-hint]').isVisible(), true);
    assert.match(await page.locator('[data-mannequin-design-hint]').textContent(), /no decals/i);

    const file = `variant-c-${width}.png`;
    await page.locator('.mannequin-preview').screenshot({ path: fileURLToPath(new URL(file, evidence)) });

    // Reduced Motion: Section steht sofort, keine Auto-Rotation.
    assert.equal((await sectionPose(page)).opacity, 1);
    assert.equal((await sectionPose(page)).x, 0);
    await page.waitForTimeout(2200);
    assert.equal(Number(await preview.getAttribute('data-mannequin-angle')), mannequinVariant('C').initialYaw);

    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Auto-Rotation, Drag-Pause, Flick und Rueckkehr.
    const angle = async () => Number(await preview.getAttribute('data-mannequin-angle'));
    await page.waitForTimeout(2600);
    const angleAuto = await angle();
    assert.ok(angleAuto > mannequinVariant('C').initialYaw + 0.02, `Auto rotation must run (${angleAuto} rad).`);
    const box = await page.locator('.mannequin-preview-frame').boundingBox();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    const angleHeldA = await angle();
    await page.waitForTimeout(500);
    const angleHeldB = await angle();
    assert.ok(Math.abs(angleHeldB - angleHeldA) < 0.02, `Rotation pauses while dragging (${angleHeldA} -> ${angleHeldB}).`);
    await page.mouse.move(centerX + 240, centerY, { steps: 6 });
    await page.waitForTimeout(60);
    assert.ok(Math.abs(await angle() - angleHeldB) > 0.1, 'Dragging rotates the model.');
    await page.mouse.up();
    await page.waitForTimeout(120);
    assert.equal(await preview.getAttribute('data-mannequin-flicks'), '1',
      `A strong flick triggers the documented fallback animation (peak ${await preview.getAttribute('data-mannequin-peak')}).`);
    assert.equal(await preview.getAttribute('data-mannequin-shoot'), 'playing');
    await page.waitForTimeout(1800);
    assert.equal(await preview.getAttribute('data-mannequin-shoot'), 'idle', 'The model returns into the viewport.');

    const figureCount = await page.locator('figure.project-image').count();
    assert.ok(figureCount >= mockupCount, `The tattoo mockups stay mounted (${figureCount} >= ${mockupCount}).`);
    assert.deepEqual(errors, [], `no console errors after interactions at ${width}px`);

    results.push({
      width, height, variant: 'C', glbRequests: glbs.length,
      switcherButtons: 0, screenshot: file, autoAngle: angleAuto, mockups: figureCount, errors,
    });
    await context.close();
  }

  // Einfahrt identisch zur Frontpage: bei gleicher Section-Position im Viewport
  // muss die Modell-Section dieselbe Pose zeigen wie die Rubrik-Links von
  // "01 / creative".
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page, errors } = await trackPage(context);
    const targets = [240, 340, 460, 580, 660];
    const sampleAt = async (path, selector, read, target, { waitForModel = false } = {}) => {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      if (waitForModel) {
        await page.evaluate(() => {
          const section = document.querySelector('#model-3d');
          scrollTo({ top: Math.max(0, section.getBoundingClientRect().top + scrollY - 120), behavior: 'instant' });
        });
        await waitReady(page);
        await page.waitForTimeout(250);
      }
      await page.evaluate(([name, top]) => {
        const section = document.querySelector(name);
        scrollTo({ top: Math.max(0, section.getBoundingClientRect().top + scrollY - top), behavior: 'instant' });
      }, [selector, target]);
      await page.waitForTimeout(350);
      return read(page);
    };
    const home = [];
    for (const target of targets) home.push(await sampleAt('/', '#selected-work', homepagePose, target));
    const model = [];
    for (const target of targets) model.push(await sampleAt('/work/tattoos', '#model-3d', sectionPose, target, { waitForModel: true }));
    let compared = 0;
    for (let index = 0; index < targets.length; index += 1) {
      const expected = home[index];
      const actual = model[index];
      if (Math.abs(expected.top - targets[index]) > 3 || Math.abs(actual.top - targets[index]) > 3) continue;
      compared += 1;
      assert.ok(Math.abs(actual.x - expected.x) <= 0.6,
        `Entrance x must match the frontpage curve at top ${targets[index]}px (${actual.x} vs ${expected.x}).`);
      assert.ok(Math.abs(actual.opacity - expected.opacity) <= 0.02,
        `Entrance opacity must match the frontpage curve at top ${targets[index]}px (${actual.opacity} vs ${expected.opacity}).`);
    }
    assert.ok(compared >= 3, `At least three scroll positions must be comparable (got ${compared}).`);
    assert.ok(model.some((entry) => entry.opacity > 0 && entry.opacity < 1), 'The entrance must pass through a visible intermediate state.');
    assert.deepEqual(errors, []);
    results.push({ entrance: { compared, model: model.map((entry) => ({ top: Math.round(entry.top), x: entry.x, opacity: Number(entry.opacity.toFixed(3)) })) } });
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
    await scrollSectionTo(page, '#model-3d', 120);
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

  // Leak-Probe: 5 Route-Wechsel (Mount/Unmount) mit erneutem Laden.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page, errors } = await trackPage(context);
    await page.goto(`${base}/work/tattoos`, { waitUntil: 'networkidle' });
    await scrollSectionTo(page, '#model-3d', 120);
    await waitReady(page);
    for (let cycle = 0; cycle < 5; cycle += 1) {
      await page.evaluate(() => { history.pushState({}, '', '/about'); dispatchEvent(new PopStateEvent('popstate')); });
      await page.waitForFunction(() => !document.querySelector('[data-mannequin-preview]'), null, { timeout: 30000 });
      await page.evaluate(() => { history.pushState({}, '', '/work/tattoos'); dispatchEvent(new PopStateEvent('popstate')); });
      await page.waitForFunction(() => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'deferred', null, { timeout: 30000 });
      await scrollSectionTo(page, '#model-3d', 120);
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
    results.push({ leak: { mounts: 5, ...leaked } });
    await context.close();
  }

  // Der Viewer bleibt in der Tattoo-Rubrik.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page } = await trackPage(context);
    for (const route of ['/work/jewellery', '/work/digital-artworks', '/tools/m4shlab']) {
      const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      assert.ok(response.status() === 200 || response.status() === 404);
      assert.equal(await page.locator('[data-mannequin-preview]').count(), 0, `${route} must not mount the mannequin viewer.`);
    }
    results.push({ isolation: ['/work/jewellery', '/work/digital-artworks', '/tools/m4shlab'] });
    await context.close();
  }

  // ?variant=a|b ist Production tot: keine A/B-Anfrage, C bleibt sichtbar.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page, requests } = await trackPage(context);
    await page.goto(`${base}/work/tattoos?variant=b`, { waitUntil: 'networkidle' });
    await scrollSectionTo(page, '#model-3d', 120);
    await waitReady(page);
    assert.equal(await page.locator('[data-mannequin-preview]').getAttribute('data-mannequin-variant'), 'C');
    assert.equal(glbRequests(requests).filter((url) => /mannequin-female-[ab]\.glb$/.test(url)).length, 0);
    results.push({ variantQueryInProduction: 'ignored' });
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

// Bundle-Nachweis: kein LICENSE-NOTE-String und kein docs-Ordner im Build.
{
  const dist = join(root, 'dist');
  const hits = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(js|css|html|json|txt|xml|map)$/.test(entry.name) && (await readFile(path, 'utf8')).includes('LICENSE-NOTE')) hits.push(path);
    }
  };
  await walk(dist);
  assert.deepEqual(hits, [], 'The built output must not mention LICENSE-NOTE.');
  assert.equal(existsSync(join(dist, 'docs')), false, 'Validation docs are never bundled.');
  results.push({ bundle: { licenseNoteHits: hits.length, docsBundled: false } });
}

await writeFile(new URL('requests.json', evidence), JSON.stringify({
  checkedAt: new Date().toISOString(),
  route: '/work/tattoos',
  source: 'production preview build',
  profiles,
  visibleVariant: mannequinVariant('C').model,
  hiddenVariants: ['A', 'B'],
  results,
  passed: true,
}, null, 2) + '\n');
console.log(`PASS mannequin preview: ${profiles.length} viewports, nur C sichtbar, Einfahrt identisch zur Frontpage, reduced motion, no-WebGL, Leak-Probe, Bundle ohne LICENSE-NOTE.`);
