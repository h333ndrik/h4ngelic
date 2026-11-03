import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { createPreviewServer } from '../scripts/serve-preview.mjs';

const evidence = new URL('../docs/validation/MANNEQUIN-CHROME/', import.meta.url);
const aModel = await readFile(new URL('../public/models/mannequin-female-a.glb', import.meta.url));
await mkdir(new URL('guides/', evidence), { recursive: true });
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
const motions = ['reduce', 'no-preference'];
const variants = ['A', 'B'];
const results = [];
const screenshots = new Map();
const requestEvidence = [];

async function relativeLuminance([red, green, blue]) {
  const linear = [red, green, blue].map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

async function silhouetteContrast(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => {
    const index = (y * info.width + x) * info.channels;
    return [data[index], data[index + 1], data[index + 2]];
  };
  const luminance = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const border = [];
  for (let x = 0; x < info.width; x += 4) {
    border.push(luminance(pixel(x, 4)), luminance(pixel(x, info.height - 5)));
  }
  border.sort((a, b) => a - b);
  const backgroundGray = border[Math.floor(border.length / 2)];
  const candidates = [];
  for (let y = Math.floor(info.height * 0.06); y < Math.floor(info.height * 0.94); y += 2) {
    for (let x = Math.floor(info.width * 0.25); x < Math.ceil(info.width * 0.75); x += 2) {
      const gray = luminance(pixel(x, y));
      if (gray > backgroundGray + 16) candidates.push(gray);
    }
  }
  candidates.sort((a, b) => a - b);
  assert.ok(candidates.length > 100, 'The rendered figure must expose measurable body pixels.');
  const bodyGray = candidates[Math.floor(candidates.length * 0.5)];
  const ratio = (bodyGray + 5) / (backgroundGray + 5);
  return { ratio: Number(ratio.toFixed(3)), bodyMedian: Number(bodyGray.toFixed(2)), backgroundMedian: Number(backgroundGray.toFixed(2)), sampledBodyPixels: candidates.length };
}

try {
  for (const { width, height } of profiles) {
    for (const motion of motions) {
      for (const variant of variants) {
        const shoot = motion === 'reduce';
        const context = await browser.newContext({
          viewport: { width, height }, deviceScaleFactor: 1,
          isMobile: width < 600, hasTouch: width < 600, reducedMotion: motion,
        });
        const page = await context.newPage();
        const errors = [], requests = [], consoleMessages = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
          consoleMessages.push({ type: message.type(), text: message.text() });
          if (message.type() === 'error') errors.push(message.text());
        });
        page.on('request', request => requests.push(request.url()));
        await page.addInitScript(() => {
          window.__mannequinWebGL = 0;
          window.__layoutShift = 0;
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) window.__layoutShift += entry.value;
            }
          }).observe({ type: 'layout-shift', buffered: true });
          const getContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, ...args) {
            if (/webgl/i.test(type)) window.__mannequinWebGL++;
            return getContext.call(this, type, ...args);
          };
        });
        if (variant === 'A') {
          await page.route('**/models/mannequin-female-b.glb', route => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: aModel }));
        }
        await page.goto(`${base}/work/tattoos`, { waitUntil: 'networkidle' });
        const target = page.locator('[data-mannequin-preview]');
        assert.equal(await target.getAttribute('data-mannequin-state'), 'deferred');
        assert.equal(await page.evaluate(() => window.__mannequinWebGL), 0, 'Cold Work must not create a WebGL context.');
        await page.waitForTimeout(300);
        await page.evaluate(() => { window.__layoutShift = 0; });
        assert.equal(requests.filter(url => url.endsWith('.glb')).length, 0, 'Cold Work must not request a GLB.');
        assert.equal(requests.filter(url => url.endsWith('/textures/designs/demo-mark.png')).length, 0, 'Cold Work must not request the design.');
        assert.ok(!requests.some(url => /mannequin-preview-|three\.module|DecalGeometry/.test(url)), 'The Three.js model and decal chunks must wait for visibility/access.');

        await page.evaluate(() => {
          const section = document.querySelector('#model-3d');
          const absolute = section.getBoundingClientRect().top + scrollY;
          scrollTo({ top: Math.max(0, absolute - 140), behavior: 'instant' });
        });
        await page.waitForFunction(() => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'ready', null, { timeout: 30000 });
        await page.waitForTimeout(200);
        assert.deepEqual(errors, []);
        assert.equal(await page.evaluate(() => window.__mannequinWebGL), 1, 'The visible model uses exactly one WebGL context.');
        assert.equal(await target.getAttribute('data-mannequin-static'), 'true');
        assert.equal(await target.getAttribute('data-mannequin-material'), 'mannequin_chrome');
        assert.equal(await target.getAttribute('data-mannequin-environment'), 'three-band-pmrem');
        assert.equal(await target.getAttribute('data-mannequin-env-intensity'), '1.35');
        assert.equal(await target.getAttribute('data-mannequin-environment-sigma'), '0.035');
        assert.equal(await page.locator('.mannequin-preview-canvas').count(), 1);
        assert.equal(requests.filter(url => url.endsWith('.glb')).length, 1, 'The GLB is requested exactly once after visibility.');
        assert.equal(requests.filter(url => url.endsWith('/textures/designs/demo-mark.png')).length, 0, 'The design waits for explicit access.');
        assert.ok(!requests.some(url => /DecalGeometry/.test(url)), 'The decal chunk waits for explicit access.');
        assert.ok(!requests.some(url => /\/assets\/main-[^/]+\.js/.test(url)), 'The Hero chunk must remain separate from the model.');

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

        const browserMetrics = await page.evaluate(() => ({
          cls: window.__layoutShift,
          fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
          buildMarker: document.documentElement.dataset.buildSha || document.documentElement.dataset.h4BuildSha || null,
        }));
        const buildLog = consoleMessages.find(message => message.text.startsWith('[h4ngelic] build '));
        assert.ok(buildLog, 'The production console must expose the data-build marker.');
        assert.ok(browserMetrics.cls === 0, `Model hydration must not shift layout at ${width}px (${motion}, ${variant}; CLS ${browserMetrics.cls}).`);
        assert.ok(Number.isFinite(browserMetrics.fcp), 'First Contentful Paint must be observable.');
        const frameDocumentRect = await page.locator('.mannequin-preview-frame').evaluate(node => {
          const rect = node.getBoundingClientRect();
          return { top: rect.top + scrollY, width: rect.width, height: rect.height };
        });

        const renderCountAtReady = Number(await target.getAttribute('data-mannequin-renders'));
        await page.waitForTimeout(250);
        const renderCountAfterWait = Number(await target.getAttribute('data-mannequin-renders'));
        assert.equal(renderCountAfterWait, renderCountAtReady, `The ${motion} preview must remain a static frame with no render loop.`);

        let evidenceFile = null;
        let screenshotHash = null;
        let contrast = null;
        if (shoot) {
          await page.evaluate((value) => {
            const suffix = document.querySelector('.mannequin-preview figcaption > .mannequin-preview-status');
            suffix.textContent = value === 'A' ? 'static / a · smooth' : 'static / b · faceted';
          }, variant);
          const screenshot = await page.locator('.mannequin-preview').screenshot();
          evidenceFile = `variant-${variant.toLowerCase()}-${width}.png`;
          await writeFile(new URL(evidenceFile, evidence), screenshot);
          screenshotHash = createHash('sha256').update(screenshot).digest('hex');
          screenshots.set(`${variant}-${width}`, screenshotHash);
          contrast = await silhouetteContrast(screenshot);
          assert.ok(contrast.ratio >= 1.5, `Chrome silhouette contrast must be at least 1.5:1 (got ${contrast.ratio}:1).`);
        }

        const designButton = page.locator('[data-mannequin-design-toggle]');
        assert.equal(await designButton.isEnabled(), true, 'The design control enables only after the static model is ready.');
        await designButton.click();
        await page.waitForFunction(() => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinDecal === 'applied', null, { timeout: 30000 });
        await page.waitForTimeout(150);
        assert.equal(requests.filter(url => url.endsWith('/textures/designs/demo-mark.png')).length, 1, 'The design PNG is requested exactly once on access.');
        assert.ok(requests.some(url => /DecalGeometry/.test(url)), 'The decal module is requested on access.');
        assert.equal(await target.getAttribute('data-mannequin-decal'), 'applied');
        assert.equal(await designButton.getAttribute('aria-pressed'), 'true');
        if (shoot && width === 1440 && variant === 'B') {
          await writeFile(new URL('demo-design-1440.png', evidence), await page.locator('.mannequin-preview').screenshot());
        }
        await designButton.click();
        assert.equal(await designButton.getAttribute('aria-pressed'), 'false');
        await designButton.click();
        assert.equal(requests.filter(url => url.endsWith('/textures/designs/demo-mark.png')).length, 1, 'Toggling the local decal cannot refetch the PNG.');
        const frameAfterDesign = await page.locator('.mannequin-preview-frame').evaluate(node => {
          const rect = node.getBoundingClientRect();
          return { top: rect.top + scrollY, width: rect.width, height: rect.height };
        });
        assert.deepEqual(frameAfterDesign, frameDocumentRect, 'The deferred design cannot resize or move the reserved frame.');

        const modelRequests = requests.filter(url => url.endsWith('.glb'));
        const designRequests = requests.filter(url => url.endsWith('/textures/designs/demo-mark.png'));
        requestEvidence.push({
          width, motion, variant,
          cold: { webgl: 0, glb: 0, design: 0, previewModule: 0 },
          visible: {
            glb: modelRequests.length,
            designBeforeAccess: 0,
            designAfterAccess: designRequests.length,
            decalModule: requests.filter(url => /DecalGeometry/.test(url)).length,
          },
          actualRequests: requests.filter(url => /mannequin-female-|three\.module|DecalGeometry|demo-mark/.test(url)),
        });
        results.push({
          variant, width, height, motion, static: true, webglContexts: 1,
          glbRequestsBeforeVisibility: 0, glbRequestsAfterVisibility: 1,
          designRequestsBeforeAccess: 0, designRequestsAfterAccess: 1,
          previewModuleOnlyAfterVisibility: true, modelContentType: 'model/gltf-binary',
          environment: 'three-band-pmrem', environmentSigma: 0.035, envMapIntensity: 1.35,
          renderCountAtReady, renderCountAfterWait,
          layout, errors, browserMetrics, frameLayoutShift: 0, buildLog: buildLog.text,
          screenshot: evidenceFile, screenshotSha256: screenshotHash, contrast,
          servedModelBytes: variant === 'A' ? aModel.length : null,
        });
        await context.close();
      }
    }
  }

  for (const { width } of profiles) {
    assert.notEqual(screenshots.get(`A-${width}`), screenshots.get(`B-${width}`), `A and B must render different pixels at ${width}px.`);
  }

  const fallbackContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.addInitScript(() => {
    window.__fallbackShift = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__fallbackShift += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await fallbackPage.route('**/models/mannequin-female-b.glb', route => route.abort('failed'));
  await fallbackPage.goto(`${base}/work/tattoos`, { waitUntil: 'networkidle' });
  const fallback = fallbackPage.locator('[data-mannequin-preview]');
  const posterBefore = await fallback.evaluate(node => ({ top: node.getBoundingClientRect().top, height: node.getBoundingClientRect().height }));
  await fallbackPage.waitForTimeout(300);
  await fallbackPage.evaluate(() => { window.__fallbackShift = 0; });
  await fallbackPage.evaluate(() => document.querySelector('#model-3d').scrollIntoViewIfNeeded());
  await fallbackPage.waitForFunction(() => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'failed', null, { timeout: 30000 });
  await fallbackPage.waitForTimeout(200);
  const fallbackState = await fallback.evaluate(node => {
    const poster = node.querySelector('.mannequin-preview-poster');
    return {
      state: node.dataset.mannequinState,
      posterOpacity: getComputedStyle(poster).opacity,
      frameHeight: node.getBoundingClientRect().height,
      cls: window.__fallbackShift,
    };
  });
  assert.equal(fallbackState.state, 'failed');
  assert.ok(Number(fallbackState.posterOpacity) > 0, 'The static poster must remain after a GLB failure.');
  assert.ok(Math.abs(fallbackState.frameHeight - posterBefore.height) < 0.01, 'Failure must not resize the reserved frame.');
  assert.ok(fallbackState.cls === 0, `Failure fallback must not shift layout (CLS ${fallbackState.cls}).`);
  await writeFile(new URL('fallback-poster-1440.png', evidence), await fallbackPage.locator('.mannequin-preview').screenshot());
  await fallbackContext.close();

  await writeFile(new URL('requests.json', evidence), JSON.stringify({
    checkedAt: new Date().toISOString(),
    route: '/work/tattoos',
    source: 'production preview build',
    profiles,
    motions,
    assertions: {
      coldRouteWebGL: 0,
      coldRouteGlbRequests: 0,
      coldRouteDesignRequests: 0,
      visibleRouteWebGL: 1,
      visibleRouteGlbRequests: 1,
      designRequestsBeforeAccess: 0,
      designRequestsAfterAccess: 1,
      renderLoop: false,
      headingOverlap: false,
      horizontalOverflow: false,
      fallback: fallbackState,
    },
    results,
    requestEvidence,
    passed: true,
  }, null, 2) + '\n');
  console.log(`PASS mannequin preview: ${results.length} production runs (${profiles.length} viewports × ${motions.length} motion preferences × ${variants.length} variants); cold route 0 WebGL/0 GLB/0 design; one GLB and one design request per visible accessed page; static frames; CLS 0.`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
