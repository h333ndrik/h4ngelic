import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

// The supplied artwork exists only in this browser fixture; the public archive
// remains empty. Hide the underlying main after opening the real native viewer
// so bright image pixels can only originate in the currently visible dialog.
const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const width = Number(process.env.H4_MODAL_WIDTH) === 320 ? 320 : 390;
const destination = new URL('../artifacts/mode-snapshot-modal/', import.meta.url);
const limitBytes = (Number(process.env.H4_MAX_RSS_MB) || 2048) * 1048576;
const report = { viewport: { width, height: 700 }, limitBytes, maximumTreeRssBytes: 0, aborted: null };
const fixture = { id: 'modal-pixel-probe', category: 'tattoos', title: 'browser-only supplied artwork', images: [
  { src: '/assets/tattoo-texture-640.webp', alt: 'supplied artwork used only in browser fixture', width: 640, height: 905 },
] };
await mkdir(destination, { recursive: true });
let browser;
let sampling = false;
let tree = [];
let failure;

async function abort(message) {
  if (report.aborted) return;
  report.aborted = message;
  const timer = setTimeout(() => {
    for (const entry of tree) if (entry.pid !== process.pid) try { process.kill(entry.pid, 'SIGKILL'); } catch {}
  }, 1000);
  timer.unref();
  try { await browser?.close(); } catch {}
  clearTimeout(timer);
}

async function sample() {
  if (sampling || report.aborted) return;
  sampling = true;
  try {
    const records = (await Promise.all((await readdir('/proc')).filter(name => /^\d+$/.test(name)).map(async name => {
      try {
        const value = await readFile(`/proc/${name}/status`, 'utf8');
        return { pid: Number(name), parent: Number(value.match(/^PPid:\s+(\d+)/m)?.[1]), rss: Number(value.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0) * 1024 };
      } catch { return null; }
    }))).filter(Boolean);
    const children = new Set([process.pid]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const entry of records) if (children.has(entry.parent) && !children.has(entry.pid)) { children.add(entry.pid); changed = true; }
    }
    tree = records.filter(entry => children.has(entry.pid));
    const rss = tree.reduce((total, entry) => total + entry.rss, 0);
    report.maximumTreeRssBytes = Math.max(report.maximumTreeRssBytes, rss);
    if (rss > limitBytes) await abort(`Browser process-tree RSS exceeded ${limitBytes / 1048576}MiB guard.`);
  } finally { sampling = false; }
}

const monitor = setInterval(() => void sample().catch(error => abort(error.message)), 100);
const deadline = setTimeout(() => void abort('20-second bounded modal pixel-proof deadline.'), 20000);
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 1 });
  await context.route('**/src/data/artworks.js*', request => request.fulfill({ contentType: 'application/javascript', body: `export const artworks = ${JSON.stringify([fixture])};` }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Enter through the real category route: the dev server correctly returns a
  // static 404 for a fixture-only detail URL that does not exist on the server.
  await page.goto(new URL('/work/tattoos', baseURL).href, { waitUntil: 'networkidle', timeout: 10000 });
  await page.locator('[data-artwork-link]').first().click({ timeout: 3000 });
  await page.waitForFunction(() => document.documentElement.dataset.page === 'artwork', null, { timeout: 3000 });
  await page.waitForFunction(() => !document.getAnimations().some(animation => animation.effect?.pseudoElement?.startsWith('::view-transition-')), null, { timeout: 3000 });
  await page.locator('[data-artwork-open]').first().click({ timeout: 3000 });
  await page.waitForFunction(() => document.querySelector('.artwork-dialog[open] .artwork-viewer-status')?.textContent === 'image 1 of 1', null, { timeout: 4000 });
  await page.waitForFunction(() => !document.querySelector('[data-artwork-flight-copy]'));
  await page.waitForFunction(() => {
    const dialog = document.querySelector('.artwork-dialog');
    const image = dialog?.querySelector('.artwork-viewer-image');
    return image && getComputedStyle(dialog).opacity === '1' && getComputedStyle(image).opacity === '1'
      && !dialog.querySelector('.is-switching');
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.mouse.move(0, 0);
  await page.addStyleTag({ content: 'main { visibility: hidden !important; }' });
  const clip = await page.locator('.artwork-viewer-image').evaluate(image => {
    const bounds = image.getBoundingClientRect();
    const clipWidth = Math.min(220, Math.floor(bounds.width) - 16);
    const clipHeight = Math.min(260, Math.floor(bounds.height) - 16);
    return { x: Math.round(bounds.left + (bounds.width - clipWidth) / 2), y: Math.round(bounds.top + (bounds.height - clipHeight) / 2), width: clipWidth, height: clipHeight };
  });
  assert.ok(clip.width > 120 && clip.height > 160, 'The real artwork viewer must expose a useful image interior.');
  report.clip = clip;
  const original = await page.screenshot({ clip, path: new URL('original-dialog-image.png', destination).pathname, timeout: 3000 });
  await page.evaluate(async () => {
    const { createModeSnapshotTransition } = await import('/src/mode-snapshot.js');
    const probe = window.__modalSnapshotProbe = { calls: [], controller: createModeSnapshotTransition({ settings: { colorStrength: 0, channelOffsetPx: 0 } }) };
    probe.controller.prepare({ variant: 1947 });
    probe.handle = probe.controller.run(detail => probe.calls.push(detail), { mode: 'xray', duration: 1000, variant: 1947 });
  });
  await page.waitForFunction(() => Number(document.documentElement.dataset.modeSnapshotFrame) >= 3, null, { timeout: 3000 });
  // Freeze only this small structural readback, following the native clock.
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) if (animation.effect?.pseudoElement?.startsWith('::view-transition-')) {
      animation.pause(); animation.currentTime = 400;
    }
  });
  await page.waitForTimeout(90);
  const displaced = await page.screenshot({ clip, path: new URL('displaced-dialog-image.png', destination).pathname, timeout: 3000 });
  report.metadata = await page.evaluate(() => ({
    calls: window.__modalSnapshotProbe.calls,
    dialogOpen: document.querySelector('.artwork-dialog')?.open,
    image: document.querySelector('.artwork-viewer-image')?.getAttribute('src'),
    dialogName: getComputedStyle(document.querySelector('.artwork-dialog')).viewTransitionName,
    filter: getComputedStyle(document.documentElement, '::view-transition-old(root)').filter,
  }));
  await page.evaluate(async () => { window.__modalSnapshotProbe.controller.skip(); await window.__modalSnapshotProbe.handle.finished; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const [before, after] = await Promise.all([original, displaced].map(value => sharp(value).removeAlpha().raw().toBuffer()));
  const pixels = report.pixels = { brightBefore: 0, brightAfter: 0, darkAfter: 0, movedOutsideMask: 0, changed: 0, unexpectedChroma: 0 };
  for (let offset = 0; offset < before.length; offset += 3) {
    const brightBefore = before[offset] > 150;
    const brightAfter = after[offset] > 150;
    if (brightBefore) pixels.brightBefore++;
    if (brightAfter) pixels.brightAfter++;
    if (after[offset] < 100) pixels.darkAfter++;
    if (brightAfter && !brightBefore) pixels.movedOutsideMask++;
    if (Math.abs(after[offset] - before[offset]) > 35) pixels.changed++;
    if (Math.abs(after[offset] - after[offset + 1]) > 12 || Math.abs(after[offset + 1] - after[offset + 2]) > 12) pixels.unexpectedChroma++;
  }
  assert.deepEqual(report.metadata.calls.map(detail => detail.captured), [true]);
  assert.equal(report.metadata.dialogOpen, true);
  assert.ok(pixels.brightBefore > 2000 && pixels.brightAfter > 1000 && pixels.darkAfter > 500, 'Captured pixels must retain the real grayscale artwork contrast.');
  assert.ok(pixels.changed > 600 && pixels.movedOutsideMask > 300, `Actual modal image pixels must displace, not remain unchanged: ${JSON.stringify(pixels)}`);
  assert.ok(pixels.unexpectedChroma < 100, 'The UV control map must never become a visible colored overlay.');
  const restored = await page.screenshot({ clip, path: new URL('restored-dialog-image.png', destination).pathname, timeout: 3000 });
  const recovered = await sharp(restored).removeAlpha().raw().toBuffer();
  const restoration = report.restoration = { changedChannels: 0, maximumDelta: 0, meanDelta: 0 };
  for (let index = 0; index < before.length; index++) {
    const delta = Math.abs(recovered[index] - before[index]);
    if (delta) restoration.changedChannels++;
    restoration.maximumDelta = Math.max(restoration.maximumDelta, delta);
    restoration.meanDelta += delta / before.length;
  }
  // Releasing a native capture can re-composite the resampled modal image.
  // SwiftShader changes a few channels by one quantization level even after
  // opacity and two paint frames settle. No displaced/image-filtered result
  // may survive; keep both per-channel and whole-image error bounds strict.
  assert.ok(restoration.maximumDelta <= 1 && restoration.meanDelta < .001,
    `The modal image must restore within sparse one-level raster rounding: ${JSON.stringify(restoration)}`);
  assert.equal(await page.locator('.artwork-viewer-image').evaluate(image => getComputedStyle(image).filter), 'none');
  assert.equal(await page.locator('html').getAttribute('data-mode-snapshot'), null);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.artwork-dialog').open);
  await page.evaluate(() => window.__modalSnapshotProbe.controller.dispose());
  assert.deepEqual(errors, []);
  report.passed = true;
} catch (error) { failure = error; report.failure = error.message; }
finally {
  clearInterval(monitor); clearTimeout(deadline);
  try { await browser?.close(); } catch {}
  report.finishedAt = new Date().toISOString();
  await writeFile(new URL('results.json', destination), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
if (failure || report.aborted) process.exitCode = 1;
