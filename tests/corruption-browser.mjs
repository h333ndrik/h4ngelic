import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

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
  await context.addInitScript(() => {
    window.__corruptionProbe = { imageDraws: 0, historyDraws: 0, fills: 0, sources: [] };
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
      if (this.canvas.hasAttribute('data-corruption-region')) {
        const probe = window.__corruptionProbe;
        if (source instanceof HTMLImageElement) {
          probe.imageDraws++;
          if (probe.sources.length < 12 && !probe.sources.includes(source.currentSrc || source.src)) probe.sources.push(source.currentSrc || source.src);
        } else if (source instanceof HTMLCanvasElement) probe.historyDraws++;
      }
      return draw.call(this, source, ...args);
    };
    const fill = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (...args) {
      if (this.canvas.hasAttribute('data-corruption-region')) window.__corruptionProbe.fills++;
      return fill.apply(this, args);
    };
  });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto(route('/work?test=1'), { waitUntil: 'networkidle' });
  await page.locator('html[data-xray-ready][data-mode="normal"]').waitFor();
  return { context, page, errors, requests };
}

async function hold(page, expected) {
  await page.keyboard.down('4');
  try { await page.waitForFunction(value => document.documentElement.dataset.mode === value, expected); }
  finally { await page.keyboard.up('4'); }
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
  const before = await page.evaluate(() => ({ draws: window.__corruptionProbe.imageDraws + window.__corruptionProbe.historyDraws, snapshot: window.__H4_CORRUPTION__?.snapshot() }));
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ draws: window.__corruptionProbe.imageDraws + window.__corruptionProbe.historyDraws, snapshot: window.__H4_CORRUPTION__?.snapshot() }));
  assert.equal(after.draws, before.draws, 'Recovered surfaces must perform no further image/history rendering.');
  if (after.snapshot) {
    assert.equal(after.snapshot.queued, false);
    assert.equal(after.snapshot.regions, 0);
    assert.equal(after.snapshot.frames, before.snapshot.frames);
  }
}

async function stroke(page, from, to, milliseconds = 30, selector = '[data-corruption-region]') {
  await page.mouse.move(from.x, from.y);
  await page.waitForTimeout(milliseconds);
  await page.mouse.move(to.x, to.y);
  await page.waitForFunction(value => [...document.querySelectorAll(value)].some(canvas => Number(canvas.dataset.corruptionFrame) >= 1), selector);
  await page.waitForTimeout(55);
  return pixels(page);
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
    assert.ok(!requests.some(url => /corrupted-film(?:-mobile)?\.webp/.test(url)), 'The film texture is noncritical and must wait for user discovery.');
    assert.ok(!requests.some(url => /\/src\/main\.js|\/main-[^/]+\.js|wordmark\.typeface|tattoo-texture/.test(url)), 'Direct Work must not download the hero.');
    const originalText = await page.locator('.page-heading,.archive-empty,.work-filters').allTextContents();
    await hold(page, 'xray');
    const contrast = await page.evaluate(() => ({
      main: Number(getComputedStyle(document.querySelector('body > main')).zIndex),
      heading: getComputedStyle(document.querySelector('.page-heading')).textShadow,
    }));
    assert.ok(contrast.main >= 1 && contrast.heading !== 'none', 'Essential live content must paint above the damaged film with legible edge separation.');
    await recovered(page);
    const slow = await stroke(page, { x: 680, y: 600 }, { x: 690, y: 600 }, 100);
    assert.ok(slow.painted > 30 && slow.colors > 5, `Even slow movement must alter a localized region with varied image pixels: ${JSON.stringify(slow)}.`);
    await stableIdle(page);
    await page.evaluate(() => {
      for (let index = 0; index < 12; index++) document.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, isPrimary: true, pointerType: 'mouse', clientX: 690, clientY: 600,
      }));
    });
    await page.waitForTimeout(150);
    assert.equal(await page.locator('[data-corruption-region]').count(), 0, 'Same-position layout/hover pointer events must not restart recovered damage.');
    const fast = await stroke(page, { x: 450, y: 600 }, { x: 750, y: 600 }, 25);
    assert.ok(fast.painted > slow.painted * 1.2, `Fast movement should damage more image surface (${fast.painted} vs ${slow.painted} pixels).`);
    assert.ok(fast.alpha > slow.alpha, 'Fast movement must produce stronger sampled-pixel corruption.');
    assert.ok(fast.boxes.every(box => box.width <= 620 && box.height <= 420));
    assert.ok(fast.regions <= 2);
    const anchored = fast.boxes.at(-1);
    await page.mouse.move(1180, 650);
    await page.waitForTimeout(90);
    const moved = await pixels(page);
    assert.ok(moved.regions <= 2);
    const old = moved.boxes.find(box => box.id === anchored.id);
    assert.ok(old, 'Leaving an active region retains its cooling history rather than moving that canvas.');
    assert.equal(old.left, anchored.left);
    assert.equal(old.top, anchored.top);
    assert.deepEqual(await page.locator('.page-heading,.archive-empty,.work-filters').allTextContents(), originalText, 'Live semantic UI remains intact.');
    await page.screenshot({ path: new URL('background-damage.png', output).pathname });
    const drawing = await page.evaluate(() => window.__corruptionProbe);
    assert.ok(drawing.imageDraws > 0 && drawing.sources.some(url => /corrupted-film/.test(url)), 'Displaced blocks must draw from the real film bitmap.');
    assert.ok(drawing.historyDraws > 0, 'Fast motion must reuse actual preceding damaged pixels.');
    assert.equal(drawing.fills, 0, 'The distortion may not substitute solid-color square particles.');
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
    await page.locator('.page-nav a[href="/about"]').click();
    await page.waitForFunction(() => document.documentElement.dataset.page === 'about');
    assert.equal(await page.locator('[data-corruption-region]').count(), 0, 'Page replacement discards obsolete photo/background history.');
    await page.mouse.move(600, 500);
    await hold(page, 'normal');
    assert.equal(await page.locator('[data-corruption-region]').count(), 0, 'Returning to Normal cancels the render loop and damage.');
    await page.mouse.move(700, 550);
    await page.waitForTimeout(200);
    assert.equal(await page.locator('[data-corruption-region]').count(), 0);
    assert.deepEqual(errors, []);
    reports.push({ profile: 'desktop', slow, fast, drawing,
      renderer: await page.evaluate(() => window.__H4_CORRUPTION__?.snapshot() || null) });
    console.log('PASS corruption desktop: actual film/photo/history sampling, velocity response, fixed cooling anchors, bounded regions, native-dialog containment, UI operation, recovery/idle, hidden/navigation/mode cleanup and no interior hero.');
    } finally { await context.close(); }
  }

  for (const width of [390, 320]) {
    const { context, page, errors, requests } = await setup({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    try {
      console.log(`START corruption ${width}px touch: mode activation`);
      await hold(page, 'xray');
      await page.waitForTimeout(300);
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
      const state = await pixels(page);
      assert.ok(state.painted > 20, `Touch movement must also displace actual surface pixels: ${JSON.stringify({state, runtime: await page.evaluate(() => ({ snapshot: window.__H4_CORRUPTION__?.snapshot(), url:location.href, mode:document.documentElement.dataset.mode, background:document.querySelector('.corruption-background')?.className, hidden:document.hidden })), errors})}.`);
      assert.ok(state.regions <= 2 && state.boxes.every(box => box.width <= 360 && box.height <= 300));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile damage must not expand the document width.');
      assert.ok(requests.some(url => /corrupted-film-mobile\.webp/.test(url)), 'Constrained touch profiles use the smaller texture.');
      console.log(`START corruption ${width}px touch: screenshot`);
      await page.screenshot({ path: new URL(`mobile-${width}.png`, output).pathname });
      console.log(`START corruption ${width}px touch: recovery`);
      await stableIdle(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await touch(session, 'touchStart', width - 70, 550);
      await touch(session, 'touchMove', 80, 550);
      await touch(session, 'touchEnd');
      await page.waitForTimeout(150);
      assert.equal(await page.locator('[data-corruption-region]').count(), 0, 'Reduced motion removes interactive distortion while retaining static art direction.');
      assert.deepEqual(errors, []);
      reports.push({ profile: `touch-${width}`, state });
      await session.detach();
      console.log(`PASS corruption ${width}px touch: sampled image damage, small texture/regions, recovery, no overflow and reduced-motion cleanup.`);
    } finally { await context.close(); }
  }
  await writeFile(new URL('browser-results.json', output), JSON.stringify({ measuredAt: new Date().toISOString(), baseURL, reports }, null, 2));
} finally { await browser.close(); await server.close(); clearTimeout(deadline); }
