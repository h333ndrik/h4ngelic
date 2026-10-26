import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { BoxGeometry, PlaneGeometry } from 'three';
import { renderFlashMannequin } from '../src/flash-mannequin-content.js';

// A deliberately synthetic box + textured plane, served ONLY by Playwright.
// This tests the real renderer and material separation, not a supplied human
// mannequin, its UV repairs, Procreate compatibility or final placement.
async function fixture() {
  const chunks = [], bufferViews = [], accessors = [];
  let byteLength = 0;
  const append = bytes => {
    const buffer = Buffer.from(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength);
    const index = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: buffer.length });
    const padding = Buffer.alloc((4 - buffer.length % 4) % 4);
    chunks.push(buffer, padding); byteLength += buffer.length + padding.length;
    return index;
  };
  const accessor = (attribute, type) => {
    const values = attribute.array;
    const index = accessors.length;
    const entry = { bufferView: append(values), componentType: values instanceof Float32Array ? 5126 : 5123,
      count: attribute.count, type };
    if (type === 'VEC3') {
      entry.min = [Infinity, Infinity, Infinity]; entry.max = [-Infinity, -Infinity, -Infinity];
      for (let vertex = 0; vertex < attribute.count; vertex++) for (let axis = 0; axis < 3; axis++) {
        entry.min[axis] = Math.min(entry.min[axis], values[vertex * 3 + axis]);
        entry.max[axis] = Math.max(entry.max[axis], values[vertex * 3 + axis]);
      }
    }
    accessors.push(entry); return index;
  };
  const primitive = (geometry, material) => ({ attributes: {
    POSITION: accessor(geometry.attributes.position, 'VEC3'), NORMAL: accessor(geometry.attributes.normal, 'VEC3'),
    TEXCOORD_0: accessor(geometry.attributes.uv, 'VEC2'),
  }, indices: accessor(geometry.index, 'SCALAR'), material });
  const body = new BoxGeometry(.6, 1.5, .3), tattoo = new PlaneGeometry(.22, .3);
  const meshes = [{ primitives: [primitive(body, 0)] }, { primitives: [primitive(tattoo, 1)] }];
  const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 255, g: 0, b: 255, alpha: 1 } } }).png().toBuffer();
  const imageView = append(png);
  const json = { asset: { version: '2.0', generator: 'H4 test-only synthetic placement' }, scene: 0,
    scenes: [{ nodes: [0, 1] }], nodes: [{ mesh: 0 }, { mesh: 1, translation: [0, .3, .16] }],
    meshes, materials: [
      { name: 'Body', pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1] } },
      { name: 'Tattoo', doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 0 } }, extensions: { KHR_materials_unlit: {} } },
    ], extensionsUsed: ['KHR_materials_unlit'], images: [{ bufferView: imageView, mimeType: 'image/png' }],
    textures: [{ source: 0 }], buffers: [{ byteLength }], bufferViews, accessors };
  let encoded = Buffer.from(JSON.stringify(json));
  encoded = Buffer.concat([encoded, Buffer.alloc((4 - encoded.length % 4) % 4, 32)]);
  const binary = Buffer.concat(chunks);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + encoded.length + 8 + binary.length, 8);
  const jhead = Buffer.alloc(8); jhead.writeUInt32LE(encoded.length); jhead.writeUInt32LE(0x4e4f534a, 4);
  const bhead = Buffer.alloc(8); bhead.writeUInt32LE(binary.length); bhead.writeUInt32LE(0x004e4942, 4);
  body.dispose(); tattoo.dispose();
  return Buffer.concat([header, jhead, encoded, bhead, binary]);
}

const glb = await fixture();
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const output = new URL('../artifacts/flash-mannequin/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const deadline = setTimeout(() => void browser.close(), 180000);
const reports = [];
const stats = page => page.evaluate(() => window.__placementGL.map(item => ({
  draws: item.draws, buffers: item.buffers.size, textures: item.textures.size, lost: item.gl.isContextLost(),
})));
async function pixels(page, label) {
  const buffer = await page.locator('[data-mannequin-view] canvas').screenshot({ path: new URL(`${label}.png`, output).pathname });
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let magenta = 0, red = 0, neutral = 0, sumX = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 100 && b > 100 && r > g * 1.7 && b > g * 1.7) { magenta++; sumX += x; }
    if (r > 100 && r > g * 1.7 && r > b * 1.7) red++;
    if (r > 50 && g > 50 && b > 50 && Math.max(r, g, b) - Math.min(r, g, b) < 18) neutral++;
  }
  return { width: info.width, height: info.height, magenta, red, neutral, centroidX: magenta ? sumX / magenta : null };
}

try {
  for (const profile of [
    { name: 'desktop', viewport: { width: 1000, height: 850 } },
    { name: 'touch-390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ]) {
    const { name, ...settings } = profile;
    const context = await browser.newContext({ ...settings, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    let delayed = false, releaseModel = null;
    await page.route('**/models/__test-placement.glb', async route => {
      if (delayed) await new Promise(resolve => { releaseModel = resolve; });
      await route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: glb });
    });
    await page.addInitScript(() => {
      window.__placementGL = [];
      const seen = new WeakSet(), original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        const gl = original.call(this, type, ...args);
        if (!gl || !String(type).startsWith('webgl') || seen.has(gl)) return gl;
        seen.add(gl);
        const item = { gl, draws: 0, buffers: new Set(), textures: new Set() };
        window.__placementGL.push(item);
        for (const kind of ['Buffer', 'Texture']) {
          const collection = item[`${kind.toLowerCase()}s`];
          const create = gl[`create${kind}`].bind(gl), destroy = gl[`delete${kind}`].bind(gl);
          gl[`create${kind}`] = (...values) => { const result = create(...values); collection.add(result); return result; };
          gl[`delete${kind}`] = value => { collection.delete(value); return destroy(value); };
        }
        for (const key of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
          const draw = gl[key].bind(gl); gl[key] = (...values) => { item.draws++; return draw(...values); };
        }
        return gl;
      };
    });
    try {
      await page.goto(new URL('/work/flashes', base).href, { waitUntil: 'networkidle' });
      assert.equal((await stats(page)).length, 0);
      assert.ok(!requests.some(url => /\/three(?:\.js|[/?])|GLTFLoader|wordmark\.typeface/.test(url)), 'A cold Flash route does not load Three or the hero.');
      const markup = renderFlashMannequin({ category: 'flashes', mannequin: {
        model: '/models/__test-placement.glb', validated: true, bodyMaterialNames: ['Body'], tattooMaterialNames: ['Tattoo'],
      } });
      await page.evaluate(async markup => {
        const wrapper = document.createElement('article'); wrapper.className = 'artwork-detail';
        wrapper.innerHTML = `<div class="project-images"><p>synthetic fixture flat view</p></div>${markup}`;
        const content = document.getElementById('page-content');
        const spacer = document.createElement('div'); spacer.style.height = '1200px'; spacer.setAttribute('aria-hidden', 'true');
        content.replaceChildren(wrapper, spacer);
        window.__stopPlacement = (await import('/src/flash-mannequin.js')).initFlashMannequins(wrapper);
      }, markup);
      await page.waitForTimeout(100);
      assert.equal((await stats(page)).length, 0, 'Importing the optional feature creates no WebGL context.');
      assert.ok(!requests.some(url => /__test-placement\.glb|\/three(?:\.js|[/?])|GLTFLoader/.test(url)), 'No model or Three request precedes an explicit choice.');
      await page.locator('[data-mannequin-toggle]').click();
      await page.waitForFunction(() => document.querySelector('[data-mannequin-status]').textContent === 'placement preview loaded', null, { timeout: 30000 });
      await page.waitForFunction(() => window.__placementGL.at(-1)?.draws > 0);
      assert.equal(await page.locator('.project-images').isVisible(), false);
      const initial = await pixels(page, `${name}-initial`);
      const loadedResources = (await stats(page)).at(-1);
      assert.ok(initial.magenta > 100 && initial.neutral > 1000, JSON.stringify(initial));
      assert.equal(initial.red, 0, 'Only the configured body changes from red to neutral; the magenta texture remains intact.');
      const paused = await stats(page); await page.waitForTimeout(250);
      assert.deepEqual(await stats(page), paused, 'Reduced motion renders only when a change needs a frame.');
      const box = await page.locator('[data-mannequin-view] canvas').boundingBox();
      if (profile.hasTouch) {
        const cdp = await context.newCDPSession(page);
        const x = box.x + box.width * .45, y = box.y + box.height * .5;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + box.width * .14, y }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
      } else {
        await page.mouse.move(box.x + box.width * .45, box.y + box.height * .5);
        await page.mouse.down(); await page.mouse.move(box.x + box.width * .59, box.y + box.height * .5, { steps: 3 }); await page.mouse.up();
      }
      const rotated = await pixels(page, `${name}-rotated`);
      assert.ok(rotated.magenta > 50 && Math.abs(rotated.centroidX - initial.centroidX) > 3, `${name}: real drag changes visible placement pixels.`);
      await page.locator('[data-mannequin-view] canvas').focus();
      await page.keyboard.press('Home');
      const restored = await pixels(page, `${name}-reset`);
      assert.ok(Math.abs(restored.centroidX - initial.centroidX) < 1);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const startDraws = (await stats(page)).at(-1).draws;
      await page.waitForFunction(start => window.__placementGL.at(-1).draws > start + 4, startDraws);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      const hidden = await stats(page); await page.waitForTimeout(200);
      assert.deepEqual(await stats(page), hidden, 'The visibility lifecycle signal suspends the actual renderer.');
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForFunction(start => window.__placementGL.at(-1).draws > start, hidden.at(-1).draws);
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(150);
      const offscreen = await stats(page); await page.waitForTimeout(200);
      assert.deepEqual(await stats(page), offscreen, 'The offscreen observer suspends the actual renderer.');
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForFunction(start => window.__placementGL.at(-1).draws > start, offscreen.at(-1).draws);
      await page.locator('[data-mannequin-toggle]').click();
      await page.waitForFunction(() => window.__placementGL.every(item => item.gl.isContextLost()));
      const cleanup = await stats(page);
      // Three keeps five renderer-owned fallback texture handles until the
      // context is lost. They are no longer live GPU allocations after loss;
      // distinguish those handles from the actual model texture's deletion.
      assert.ok(cleanup.every(item => item.buffers === 0 && item.lost), JSON.stringify(cleanup));
      assert.ok(cleanup.at(-1).textures < loadedResources.textures,
        `The actual model texture must be explicitly deleted: ${JSON.stringify({ loadedResources, cleanup })}`);
      assert.equal(await page.locator('.project-images').isVisible(), true);
      // A real pending network response after an explicit close must not mount
      // a scene or allocate another context when its eventual bytes arrive.
      delayed = true;
      await page.locator('[data-mannequin-toggle]').click();
      await page.waitForFunction(() => document.querySelector('[data-mannequin-status]').textContent === 'loading placement preview');
      for (let attempt = 0; attempt < 40 && !releaseModel; attempt++) await page.waitForTimeout(25);
      assert.ok(releaseModel, 'The second model request is actually pending.');
      await page.locator('[data-mannequin-toggle]').click();
      releaseModel(); await page.waitForTimeout(250);
      assert.equal((await stats(page)).length, 1, 'Stale loaded data allocates no new renderer.');
      assert.equal(await page.locator('[data-mannequin-view] canvas').count(), 0);
      await page.evaluate(() => window.__stopPlacement());
      assert.deepEqual(errors, []);
      reports.push({ name, passed: true, fixture: 'test-only textured box and plane, not supplied mannequin', initial, rotated, restored,
        reducedMotionDraws: paused.at(-1).draws, loadedResources, cleanup,
        contextLossReleasesRendererDefaults: true, errors });
    } finally { await context.close(); }
  }
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2));
  console.log(JSON.stringify({ passed: true, reports }, null, 2));
} finally { clearTimeout(deadline); await browser.close(); }
