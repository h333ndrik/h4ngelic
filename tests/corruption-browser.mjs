import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { livingDecayMaterialAssets } from '../src/data/livingDecaySettings.js';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const output = new URL('../artifacts/control-corruption/', import.meta.url);
await mkdir(output, { recursive: true });
const server = await chromium.launchServer({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  // These interior-route checks use Canvas2D; a forced WebGL backend adds no
  // coverage. The homepage's WebGL scene is exercised by its dedicated suite.
  args: ['--no-sandbox'],
});
// A browser-command timeout does not stop a stalled renderer process. Bound the
// entire harness as well, killing only the Chromium instance owned here.
const deadline = setTimeout(() => { console.error('Corruption browser check exceeded its 150-second process deadline.'); server.process().kill('SIGKILL'); }, 150000);
const browser = await chromium.connect(server.wsEndpoint());
const route = path => new URL(path, baseURL).href;
const reports = [];

async function setup(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, ...options });
  await context.addInitScript((materialPaths) => {
    window.__corruptionProbe = { imageDraws: 0, filmDraws: 0, historyDraws: 0, ambientDraws: 0, fills: 0, webGL: 0, sources: [] };
    const getContext = HTMLCanvasElement.prototype.getContext;
    const seen = new WeakSet();
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const context = getContext.call(this, type, ...args);
      if (context && /webgl/.test(type) && !seen.has(context)) { seen.add(context); window.__corruptionProbe.webGL++; }
      return context;
    };
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
      if (this.canvas.hasAttribute('data-corruption-ambient')) window.__corruptionProbe.ambientDraws++;
      if (this.canvas.hasAttribute('data-corruption-region')) {
        const probe = window.__corruptionProbe;
        if (source instanceof HTMLImageElement) {
          probe.imageDraws++;
          if (materialPaths.includes(new URL(source.currentSrc || source.src, location.href).pathname)) probe.filmDraws++;
          if (probe.sources.length < 12 && !probe.sources.includes(source.currentSrc || source.src)) probe.sources.push(source.currentSrc || source.src);
        } else if (source instanceof HTMLCanvasElement) {
          if (source.hasAttribute('data-corruption-ambient')) {
            probe.filmDraws++;
            if (!probe.sources.includes('canvas:corruption-ambient')) probe.sources.push('canvas:corruption-ambient');
          } else probe.historyDraws++;
        }
      }
      return draw.call(this, source, ...args);
    };
    const fill = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (...args) {
      if (this.canvas.hasAttribute('data-corruption-region') || this.canvas.hasAttribute('data-corruption-ambient')) window.__corruptionProbe.fills++;
      return fill.apply(this, args);
    };
  }, Object.values(livingDecayMaterialAssets));
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto(route('/work?test=1'), { waitUntil: 'networkidle' });
  await page.locator('html[data-xray-ready][data-mode="normal"]').waitFor();
  return { context, page, errors, requests };
}

async function changeMode(page, expected) {
  if (expected === 'normal') {
    for (let index = 0; index < 3; index++) await page.keyboard.press('3');
  } else await page.keyboard.down('4');
  try { await page.waitForFunction(value => document.documentElement.dataset.mode === value, expected); }
  finally { if (expected === 'xray') await page.keyboard.up('4'); }
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-xray-transition'));
  if (expected === 'xray') {
    await page.locator('.corruption-background').waitFor({ state: 'attached', timeout: 20000 });
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-xray-transition'));
  }
}

async function pixels(page, selector = '[data-corruption-region]') {
  return page.locator(selector).evaluateAll(canvases => {
    let painted = 0;
    let alpha = 0;
    const colors = new Set();
    const boxes = [];
    for (const canvas of canvases) {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      const box = canvas.getBoundingClientRect();
      let localPainted = 0;
      for (let index = 0; index < data.length; index += 4) {
        alpha += data[index + 3];
        if (data[index + 3] < 5) continue;
        painted++;
        localPainted++;
        if (colors.size < 4096) colors.add(`${data[index] >> 2},${data[index + 1] >> 2},${data[index + 2] >> 2}`);
      }
      boxes.push({ id: canvas.dataset.corruptionRegion, left: canvas.style.left, top: canvas.style.top,
        width: canvas.width, height: canvas.height, x: box.x, y: box.y, frame: Number(canvas.dataset.corruptionFrame),
        painted: localPainted, parent: canvas.parentElement.className, inDialog: Boolean(canvas.closest('.artwork-dialog[open]')) });
    }
    return { regions: canvases.length, painted, alpha, colors: colors.size, boxes };
  });
}

async function recovered(page) {
  await page.waitForFunction(() => !document.querySelector('[data-corruption-region]')
    && !document.documentElement.hasAttribute('data-corruption-running')
    && !window.__H4_CORRUPTION__?.snapshot().queued, null, { timeout: 7000 });
  await page.waitForTimeout(150);
}

async function stableIdle(page) {
  await recovered(page);
  const before = await page.evaluate(() => ({ draws: window.__corruptionProbe.imageDraws + window.__corruptionProbe.filmDraws + window.__corruptionProbe.historyDraws, snapshot: window.__H4_CORRUPTION__?.snapshot() }));
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ draws: window.__corruptionProbe.imageDraws + window.__corruptionProbe.filmDraws + window.__corruptionProbe.historyDraws, snapshot: window.__H4_CORRUPTION__?.snapshot() }));
  assert.equal(after.draws, before.draws, 'Recovered photograph regions perform no further ROI work; the shared ambient scheduler remains independent.');
  if (after.snapshot) {
    assert.equal(after.snapshot.queued, false);
    assert.equal(after.snapshot.regions, 0);
    assert.equal(after.snapshot.frames, before.snapshot.frames);
  }
}

async function freezeBackground(page, seed = 6831) {
  await page.evaluate(value => {
    const controller = window.__H4_CORRUPTION__;
    controller.configureLivingDecay({ idleIntensity: 0, mutationSpeed: 0, scrollMosh: 0, parallaxStrength: 0,
      heroMosh: 0, sectionMosh: 0, typographyMosh: 0, hoverMosh: 0, clickMosh: 0, navigationMosh: 0,
      cursorMosh: 1.25, cursorRadius: 35 });
    controller.regenerateLivingDecay(value);
    const canvas = document.querySelector('[data-corruption-ambient]');
    window.__corruptionBaseline = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  }, seed);
}

async function backgroundPixels(page) {
  return page.locator('[data-corruption-ambient]').evaluate(canvas => {
    const bytes = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const before = window.__corruptionBaseline;
    let changed = 0, difference = 0;
    const colors = new Set();
    for (let index = 0; index < bytes.length; index += 4) {
      const delta = Math.abs(bytes[index] - before[index]) + Math.abs(bytes[index + 1] - before[index + 1])
        + Math.abs(bytes[index + 2] - before[index + 2]);
      if (delta > 12) { changed++; difference += delta; }
      if (colors.size < 4096) colors.add(`${bytes[index] >> 2},${bytes[index + 1] >> 2},${bytes[index + 2] >> 2}`);
    }
    return { changed, difference, colors: colors.size, width: canvas.width, height: canvas.height,
      snapshot: window.__H4_CORRUPTION__.snapshot().ambient };
  });
}

async function stroke(page, from, to, milliseconds = 30, selector) {
  const prior = await page.evaluate(() => window.__H4_CORRUPTION__.snapshot().ambient.advectedBlocks);
  await page.mouse.move(from.x, from.y);
  await page.waitForTimeout(milliseconds);
  await page.mouse.move(to.x, to.y);
  if (selector) await page.waitForFunction(value => [...document.querySelectorAll(value)].some(canvas => Number(canvas.dataset.corruptionFrame) >= 1), selector);
  else await page.waitForFunction(value => window.__H4_CORRUPTION__.snapshot().ambient.advectedBlocks > value, prior);
  await page.waitForTimeout(55);
  return selector ? pixels(page, selector) : backgroundPixels(page);
}

async function addPhotographFixtures(page) {
  // This is supplied reflection artwork used only in a browser fixture. No
  // fictitious portfolio project or stock photo is added to production data.
  await page.evaluate(() => {
    const section = document.createElement('section');
    section.dataset.corruptionTestFixture = '';
    section.style.cssText = 'margin:24px auto;width:min(600px,calc(100vw - 44px));';
    section.innerHTML = `<figure class="project-image"><button class="artwork-open" type="button" style="--artwork-ratio:1024/1448" aria-label="open provided texture test view">
      <img src="/assets/tattoo-texture.webp" width="1024" height="1448" alt="provided reflection artwork, browser test only" decoding="async"></button></figure>`;
    document.querySelector('.page-shell').append(section);
    const dialog = document.createElement('dialog');
    dialog.className = 'artwork-dialog';
    dialog.style.cssText = 'opacity:1;';
    dialog.innerHTML = `<button type="button" data-test-close>close test view</button><div class="artwork-viewer-stage"><img class="artwork-viewer-image" src="/assets/tattoo-texture.webp" width="1024" height="1448" alt="provided reflection artwork test dialog"></div>`;
    document.body.append(dialog);
    section.querySelector('button').addEventListener('click', () => { dialog.showModal(); window.__fixtureOpened = true; });
    dialog.querySelector('[data-test-close]').addEventListener('click', () => dialog.close());
  });
  await page.locator('[data-corruption-test-fixture] img').evaluate(image => image.decode());
}

async function touch(session, type, x, y) {
  let timer;
  try {
    await Promise.race([
      session.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Touch dispatch stalled: ${type}.`)), 7000); }),
    ]);
  } catch (error) {
    console.error(`Touch input error: ${type}: ${error.message}`);
    throw error;
  } finally { clearTimeout(timer); }
}

try {
  if (process.env.H4_CORRUPTION_MOBILE_ONLY !== '1') {
    const { context, page, errors, requests } = await setup();
    try {
    assert.equal(await page.locator('.corruption-background,[data-corruption-region]').count(), 0, 'Normal browsing must not initialize effect surfaces.');
    assert.ok(!requests.some(url => Object.values(livingDecayMaterialAssets).includes(new URL(url).pathname)), 'The Living Decay material is noncritical and must wait for user discovery.');
    assert.ok(!requests.some(url => /\/src\/main\.js|\/main-[^/]+\.js|wordmark\.typeface|tattoo-texture/.test(url)), 'Direct Work must not download the hero.');
    const originalText = await page.locator('.page-heading,.archive-empty,.work-filters').allTextContents();
    await changeMode(page, 'xray');
    const contrast = await page.evaluate(() => ({
      main: Number(getComputedStyle(document.querySelector('body > main')).zIndex),
      heading: getComputedStyle(document.querySelector('.page-heading')).textShadow,
    }));
    assert.ok(contrast.main >= 1 && contrast.heading !== 'none', 'Essential live content must paint above the damaged film with legible edge separation.');
    await recovered(page);
    await freezeBackground(page);
    const slow = await stroke(page, { x: 680, y: 600 }, { x: 690, y: 600 }, 100);
    assert.ok(slow.changed > 30 && slow.colors > 5, `Slow physical movement must displace actual shared-history pixels: ${JSON.stringify(slow)}.`);
    assert.ok(slow.snapshot.memory.byKind.cursor > 0 && slow.snapshot.memory.movingCells > 0);
    assert.equal(await page.locator('[data-corruption-region]').count(), 0, 'Background inputs share one image history rather than allocating independent ROI histories.');
    await stableIdle(page);
    const accepted = (await page.evaluate(() => window.__H4_CORRUPTION__.snapshot())).ambient.memory.accepted;
    await page.evaluate(() => {
      for (let index = 0; index < 12; index++) document.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, isPrimary: true, pointerType: 'mouse', clientX: 690, clientY: 600,
      }));
    });
    await page.waitForTimeout(150);
    assert.equal((await page.evaluate(() => window.__H4_CORRUPTION__.snapshot())).ambient.memory.accepted, accepted,
      'Same-position layout/hover pointer events must not introduce new movement into the shared field.');
    await freezeBackground(page);
    const fast = await stroke(page, { x: 450, y: 600 }, { x: 750, y: 600 }, 25);
    assert.ok(fast.changed > slow.changed * 1.2, `Fast movement must damage more actual image surface (${fast.changed} vs ${slow.changed} pixels).`);
    assert.ok(fast.difference > slow.difference, 'Fast movement must produce stronger sampled-image displacement.');
    assert.ok(fast.width <= 1120 && fast.height <= 800 && fast.snapshot.memory.cells <= 1400);
    const anchored = await page.locator('[data-corruption-ambient]').boundingBox();
    // Pixel readback may take longer than the physical gesture reset window
    // on software GPUs. Establish a fresh real path before reversing it.
    await page.mouse.move(740, 600);
    await page.waitForTimeout(25);
    await page.mouse.move(470, 650);
    await page.waitForFunction(before => window.__H4_CORRUPTION__.snapshot().ambient.memory.accepted > before,
      fast.snapshot.memory.accepted);
    const moved = await backgroundPixels(page);
    assert.ok(moved.snapshot.memory.accepted > fast.snapshot.memory.accepted, 'A physical direction reversal enters the existing global field.');
    assert.ok(moved.changed > 30 && moved.snapshot.memory.heldCells > 0, 'Old damaged pixels remain while new movement is applied.');
    assert.deepEqual(await page.locator('[data-corruption-ambient]').boundingBox(), anchored, 'History remains in its fixed bounded buffer; pointer input never moves the canvas.');
    assert.deepEqual(await page.locator('.page-heading,.archive-empty,.work-filters').allTextContents(), originalText, 'Live semantic UI remains intact.');
    await page.screenshot({ path: new URL('background-damage.png', output).pathname });
    const drawing = await page.evaluate(() => window.__corruptionProbe);
    assert.ok(drawing.ambientDraws > 0 && moved.snapshot.advectedBlocks > fast.snapshot.advectedBlocks,
      'Successive motion transports the actual preceding shared output.');
    assert.equal(drawing.fills, 0, 'The distortion may not substitute solid-color square particles.');
    assert.equal(drawing.webGL, 0, 'The shared history allocates no extra WebGL renderer on Work.');
    const recoveryBefore = moved.snapshot.memory.energy;
    await page.waitForTimeout(1400);
    const recoveryAfter = (await backgroundPixels(page)).snapshot.memory;
    assert.ok(recoveryAfter.energy < recoveryBefore, 'Without new input, the signed field progressively recovers instead of being reset or randomly rehashed.');
    assert.ok(recoveryAfter.accepted >= moved.snapshot.memory.accepted, 'Recovery preserves field identity and cumulative history counters.');
    await stableIdle(page);

    await addPhotographFixtures(page);
    const photo = page.locator('[data-corruption-test-fixture] .artwork-open');
    await photo.scrollIntoViewIfNeeded();
    const photoBox = await photo.boundingBox();
    await stroke(page, { x: photoBox.x + photoBox.width * .2, y: photoBox.y + Math.min(220, photoBox.height * .35) },
      { x: photoBox.x + photoBox.width * .7, y: photoBox.y + Math.min(230, photoBox.height * .4) }, 30, '[data-corruption-test-fixture] [data-corruption-region]');
    assert.ok(await photo.locator('[data-corruption-region]').count(), 'The actual photograph receives its own clipped sampling surface.');
    assert.ok((await pixels(page, '[data-corruption-test-fixture] [data-corruption-region]')).painted > 30);
    assert.equal(await photo.locator('img').getAttribute('alt'), 'provided reflection artwork, browser test only');
    await photo.click({ position: { x: 30, y: 30 } });
    await page.waitForFunction(() => window.__fixtureOpened === true);
    const dialog = page.locator('.artwork-dialog[open]');
    await dialog.locator('img').evaluate(image => image.decode());
    // Exercise the live dialog after any outstanding route/mode capture. Local
    // click effects never use native snapshots or suspend its hit testing.
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-mode-snapshot'));
    const dialogImage = await dialog.locator('img').boundingBox();
    const modalPixels = await stroke(page, { x: dialogImage.x + dialogImage.width * .2, y: dialogImage.y + dialogImage.height * .4 },
      { x: dialogImage.x + dialogImage.width * .7, y: dialogImage.y + dialogImage.height * .45 }, 30, '.artwork-dialog[open] .artwork-viewer-stage [data-corruption-region]');
    assert.ok(modalPixels.boxes.some(box => box.inDialog && box.parent.includes('artwork-viewer-stage') && box.painted > 30), `Viewer corruption must paint inside the native dialog top layer: ${JSON.stringify(modalPixels)}.`);
    await page.mouse.move(dialogImage.x + dialogImage.width * .75, dialogImage.y + dialogImage.height * .5);
    await page.screenshot({ path: new URL('dialog-damage.png', output).pathname });
    await dialog.locator('[data-test-close]').click();
    await stableIdle(page);

    await page.evaluate(() => {
      document.querySelector('[data-corruption-test-fixture]').remove();
      document.querySelector('.artwork-dialog').remove();
      scrollTo({ top: 0, behavior: 'instant' });
    });
    await stroke(page, { x: 450, y: 600 }, { x: 750, y: 600 });
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.locator('[data-corruption-region]').count(), 0, 'A hidden document clears damage immediately.');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await stroke(page, { x: 450, y: 600 }, { x: 750, y: 600 });
    const beforeNavigation = await page.evaluate(() => window.__H4_CORRUPTION__.snapshot().ambient);
    await page.locator('.page-nav a[href="/about"]').click();
    await page.waitForFunction(() => document.documentElement.dataset.page === 'about');
    const afterNavigation = await page.evaluate(() => window.__H4_CORRUPTION__.snapshot().ambient);
    assert.equal(await page.locator('[data-corruption-region]').count(), 0, 'Page replacement discards obsolete photo ROI nodes.');
    assert.equal(afterNavigation.seed, beforeNavigation.seed);
    assert.equal(afterNavigation.regenerations, beforeNavigation.regenerations, 'Internal navigation must not reset the shared image memory.');
    assert.ok(afterNavigation.memory.accepted >= beforeNavigation.memory.accepted && afterNavigation.advectedBlocks >= beforeNavigation.advectedBlocks);
    await page.mouse.move(600, 500);
    await changeMode(page, 'normal');
    assert.equal(await page.locator('[data-corruption-region]').count(), 0, 'Returning to Normal cancels the render loop and damage.');
    await page.mouse.move(700, 550);
    await page.waitForTimeout(200);
    assert.equal(await page.locator('[data-corruption-region]').count(), 0);
    assert.deepEqual(errors, []);
    reports.push({ profile: 'desktop', slow, fast, drawing,
      renderer: await page.evaluate(() => window.__H4_CORRUPTION__?.snapshot() || null) });
    console.log('PASS corruption desktop: real shared pixel displacement, velocity response, repeated inputs, bounded buffers, photo/modal containment, progressive recovery, navigation memory continuity and lifecycle cleanup.');
    } finally { await context.close(); }
  }

  for (const width of [390, 320]) {
    const { context, page, errors, requests } = await setup({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    try {
      console.log(`START corruption ${width}px touch: mode activation`);
      await changeMode(page, 'xray');
      await page.waitForTimeout(300);
      await freezeBackground(page);
      const session = await context.newCDPSession(page);
      console.log(`START corruption ${width}px touch: gesture`);
      // Move left from the interior: a right swipe from the viewport edge is
      // reserved by Chromium for browser history navigation on touch devices.
      await touch(session, 'touchStart', width - 70, 550);
      await touch(session, 'touchMove', width - 130, 550);
      await touch(session, 'touchMove', 80, 550);
      await touch(session, 'touchEnd');
      await page.waitForTimeout(150);
      console.log(`START corruption ${width}px touch: readback`);
      const state = await backgroundPixels(page);
      assert.ok(state.changed > 20, `Touch movement must displace real shared image pixels: ${JSON.stringify({state, errors})}.`);
      assert.ok(state.width <= 512 && state.height <= 768 && state.snapshot.memory.cells <= 600);
      assert.ok(state.snapshot.memory.byKind.cursor > 0);
      assert.equal(await page.locator('[data-corruption-region]').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile damage must not expand the document width.');
      assert.ok(requests.some(url => new URL(url).pathname === livingDecayMaterialAssets.mobile), 'Constrained touch profiles use the smaller Living Decay source.');
      console.log(`START corruption ${width}px touch: screenshot`);
      await page.screenshot({ path: new URL(`mobile-${width}.png`, output).pathname });
      console.log(`START corruption ${width}px touch: recovery`);
      await stableIdle(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const reduced = await page.evaluate(() => window.__H4_CORRUPTION__.snapshot().ambient);
      await touch(session, 'touchStart', width - 70, 550);
      await touch(session, 'touchMove', 80, 550);
      await touch(session, 'touchEnd');
      await page.waitForTimeout(150);
      assert.equal(await page.locator('[data-corruption-region]').count(), 0, 'Reduced motion removes interactive distortion while retaining static art direction.');
      const reducedAfter = await page.evaluate(() => window.__H4_CORRUPTION__.snapshot().ambient);
      assert.equal(reducedAfter.frames, reduced.frames);
      assert.equal(reducedAfter.memory.accepted, reduced.memory.accepted);
      assert.equal(reducedAfter.queued, false);
      assert.equal(await page.evaluate(() => window.__corruptionProbe.webGL), 0);
      assert.deepEqual(errors, []);
      reports.push({ profile: `touch-${width}`, state });
      await session.detach();
      console.log(`PASS corruption ${width}px touch: sampled image damage, small texture/regions, recovery, no overflow and reduced-motion cleanup.`);
    } finally { await context.close(); }
  }
  await writeFile(new URL('browser-results.json', output), JSON.stringify({ measuredAt: new Date().toISOString(), baseURL, reports }, null, 2));
} finally { await browser.close(); await server.close(); clearTimeout(deadline); }
