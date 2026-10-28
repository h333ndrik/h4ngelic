import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { livingDecayDefaults, livingDecaySchema } from '../src/data/livingDecaySettings.js';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const destination = new URL('../artifacts/living-decay/', import.meta.url);
const widths = (process.env.H4_LIVING_WIDTHS || '1000,390,320').split(',').map(Number);
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const deadline = setTimeout(() => void browser.close(), 150000);
const reports = [];
const state = page => page.evaluate(() => window.__H4_CORRUPTION__?.snapshot());

async function settled(page, mode) {
  await page.waitForFunction(expected => document.documentElement.dataset.mode === expected
    && !document.documentElement.hasAttribute('data-xray-transition')
    && !document.documentElement.hasAttribute('data-mode-snapshot'), mode);
}

async function change(page, mode) {
  if (mode === 'xray') {
    await page.keyboard.down('4');
    try { await settled(page, mode); } finally { await page.keyboard.up('4'); }
    await page.waitForFunction(() => Boolean(window.__H4_CORRUPTION__));
  } else {
    for (let index = 0; index < 3; index++) await page.keyboard.press('3');
    await settled(page, mode);
  }
}

async function pixels(page, name) {
  return page.locator('[data-corruption-ambient]').evaluate((canvas, key) => {
    const bytes = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    if (key) { window.__livingPixels ||= {}; window.__livingPixels[key] = bytes; }
    let dark = 0; let light = 0; let changed = 0;
    const before = window.__livingPixels?.before;
    for (let index = 0; index < bytes.length; index += 4) {
      const sum = bytes[index] + bytes[index + 1] + bytes[index + 2];
      if (sum < 65) dark++;
      if (sum > 575) light++;
      if (before && Math.abs(bytes[index] - before[index]) + Math.abs(bytes[index + 1] - before[index + 1])
        + Math.abs(bytes[index + 2] - before[index + 2]) > 12) changed++;
    }
    return { dark, light, changed, count: bytes.length / 4 };
  }, name);
}

async function pointerArea(page, radius) {
  const start = { x: 470, y: 505 }, end = { x: 500, y: 505 };
  await page.mouse.move(start.x - 100, start.y - 100);
  await page.evaluate(value => {
    window.__H4_CORRUPTION__.configureLivingDecay({ cursorRadius: value, cursorMosh: 1.25,
      idleIntensity: 0, mutationSpeed: 0, scrollMosh: 0, hoverMosh: 0, clickMosh: 0,
      sectionMosh: 0, typographyMosh: 0, heroMosh: 0, navigationMosh: 0,
      colorBleeding: 0, negativeExposure: 0, parallaxStrength: 0,
      feedbackPersistence: .997, recoverySpeed: .1 });
    window.__H4_CORRUPTION__.regenerateLivingDecay(6831);
  }, radius);
  // A first physical position establishes the pointer baseline. Read actual
  // opaque shared-history pixels, not alpha from an obsolete background ROI.
  await page.mouse.move(start.x, start.y);
  await page.waitForTimeout(35);
  const before = await page.evaluate(() => {
    const canvas = document.querySelector('[data-corruption-ambient]');
    window.__livingCursorBefore = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return window.__H4_CORRUPTION__.snapshot().ambient;
  });
  await page.mouse.move(end.x, end.y);
  await page.waitForFunction(previous => {
    const ambient = window.__H4_CORRUPTION__.snapshot().ambient;
    return (ambient.memory.byKind.cursor || 0) > previous.accepted && ambient.advectedBlocks > previous.advected;
  }, { accepted: before.memory.byKind.cursor || 0, advected: before.advectedBlocks });
  return page.locator('[data-corruption-ambient]').evaluate((canvas, { radius, start, end }) => {
    const bytes = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const before = window.__livingCursorBefore;
    const snapshot = window.__H4_CORRUPTION__.snapshot();
    const cell = snapshot.ambient.memory.cellSize;
    const margin = radius + cell * Math.SQRT2 * innerWidth / canvas.width;
    let pixels = 0, outside = 0;
    for (let index = 0; index < bytes.length; index += 4) {
      if (Math.abs(bytes[index] - before[index]) + Math.abs(bytes[index + 1] - before[index + 1])
        + Math.abs(bytes[index + 2] - before[index + 2]) <= 12) continue;
      pixels++;
      const pixel = index / 4;
      const x = (pixel % canvas.width + .5) * innerWidth / canvas.width;
      const y = (Math.floor(pixel / canvas.width) + .5) * innerHeight / canvas.height;
      const nearestX = Math.max(start.x, Math.min(end.x, x));
      if (Math.hypot(x - nearestX, y - start.y) > margin) outside++;
    }
    delete window.__livingCursorBefore;
    return { pixels, outside, count: bytes.length / 4, radius, cellSize: cell,
      regions: snapshot.regions, memory: snapshot.ambient.memory, advectedBlocks: snapshot.ambient.advectedBlocks };
  }, { radius, start, end });
}

try {
  for (const width of widths) {
    const mobile = width < 600;
    const context = await browser.newContext({ viewport: { width, height: mobile ? 844 : 760 }, deviceScaleFactor: 1,
      isMobile: mobile, hasTouch: mobile, reducedMotion: 'no-preference' });
    try {
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 8 });
        Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 });
        window.__livingProbe = { token: String(performance.timeOrigin), webGL: 0, seeds: [], scroll: [], impulses: [] };
        const original = HTMLCanvasElement.prototype.getContext;
        const seen = new WeakSet();
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
          const result = original.call(this, type, ...args);
          if (result && /webgl/.test(type) && !seen.has(result)) { seen.add(result); window.__livingProbe.webGL++; }
          return result;
        };
        document.addEventListener('h4:livingseed', event => window.__livingProbe.seeds.push(event.detail.seed));
        document.addEventListener('h4:scrollmotion', event => {
          if (window.__livingProbe.scroll.length < 200) window.__livingProbe.scroll.push(event.detail);
        });
        document.addEventListener('h4:moshimpulse', event => window.__livingProbe.impulses.push(event.detail.kind));
      });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const errors = []; const requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push(new URL(request.url()).pathname));
      await page.goto(new URL('/work?test=1', base).href, { waitUntil: 'networkidle' });
      await page.locator('html[data-xray-ready]').waitFor();
      assert.equal(await page.locator('[data-corruption-ambient]').count(), 0);
      assert.ok(!requests.some(path => /living-decay-material|\/src\/ambient-film\.js|\/src\/corruption\.js/.test(path)), 'Normal Work loads no effect material or renderer.');
      assert.equal(await page.evaluate(() => window.__livingProbe.webGL), 0);

      await change(page, 'xray');
      await page.waitForFunction(() => window.__H4_CORRUPTION__.snapshot().ambient.frames > 1);
      const first = await state(page);
      assert.ok(Number.isInteger(first.ambient.seed));
      assert.match(first.source, /living-decay-material(?:-mobile)?\.webp$/);
      assert.ok(requests.some(path => path === `/assets/living-decay-material${mobile ? '-mobile' : ''}.webp`));
      assert.equal(first.ambient.settings.cursorRadius, 35);
      assert.ok(first.ambient.width <= (mobile ? 512 : 1120) && first.ambient.height <= (mobile ? 768 : 800));
      assert.ok(first.ambient.framesPerSecond <= (mobile ? 3 : 6));
      assert.ok(first.ambient.activeFramesPerSecond <= (mobile ? 18 : 24)
        && first.ambient.activeFramesPerSecond >= first.ambient.framesPerSecond, 'One adaptive scheduler caps idle and active rendering separately.');
      assert.ok(first.ambient.memory.cells <= (mobile ? 600 : 1400));
      assert.ok(first.ambient.material.codecFragments <= (mobile ? 64 : 156));
      assert.equal(await page.evaluate(() => window.__livingProbe.webGL), 0, 'Material allocates no WebGL renderer.');

      await pixels(page, 'before');
      const idleBefore = await state(page);
      await page.waitForTimeout(1800);
      const idlePixels = await pixels(page);
      const idleAfter = await state(page);
      assert.ok(idleAfter.ambient.frames > idleBefore.ambient.frames + 1);
      assert.ok(idlePixels.changed > 500, `Independent idle material must change real image pixels: ${idlePixels.changed}`);
      assert.equal(idleAfter.ambient.seed, first.ambient.seed);

      const token = await page.evaluate(() => window.__livingProbe.token);
      const beforeNavigation = await state(page);
      await page.locator('.page-nav a[href="/about"]').click();
      await page.waitForURL(url => url.pathname === '/about');
      await settled(page, 'xray');
      const afterNavigation = await state(page);
      assert.equal(await page.evaluate(() => window.__livingProbe.token), token, 'Internal navigation preserves the renderer document.');
      assert.equal(afterNavigation.ambient.seed, first.ambient.seed);
      assert.ok(afterNavigation.ambient.elapsed >= beforeNavigation.ambient.elapsed);
      assert.equal(afterNavigation.ambient.regenerations, beforeNavigation.ambient.regenerations, 'Navigation must not regenerate shared image history.');
      assert.ok(afterNavigation.ambient.memory.accepted >= beforeNavigation.ambient.memory.accepted);
      assert.ok(afterNavigation.ambient.advectedBlocks >= beforeNavigation.ambient.advectedBlocks);
      assert.ok((afterNavigation.ambient.memory.byKind.navigation || 0) > (beforeNavigation.ambient.memory.byKind.navigation || 0),
        'Native route capture also drives the existing shared image field.');
      await page.locator('.page-nav a[href="/work"]').click();
      await page.waitForURL(url => url.pathname === '/work');
      await settled(page, 'xray');
      assert.equal((await state(page)).ambient.seed, first.ambient.seed);

      const controls = await page.evaluate(({ defaults, schema }) => {
        const controller = window.__H4_CORRUPTION__;
        const extreme = Object.fromEntries(Object.entries(schema).filter(([key]) => key !== 'seed').map(([key, value]) => [key, value.maximum + 100]));
        const bounded = controller.configureLivingDecay(extreme);
        const stable = controller.readLivingDecaySettings() === controller.readLivingDecaySettings();
        controller.configureLivingDecay(defaults);
        return { bounded, stable };
      }, { defaults: livingDecayDefaults, schema: livingDecaySchema });
      assert.equal(controls.stable, true);
      for (const [key, value] of Object.entries(livingDecaySchema)) if (key !== 'seed') assert.equal(controls.bounded[key], value.maximum, `${key} is live and bounded.`);

      const reproduction = await page.evaluate(defaults => {
        const controller = window.__H4_CORRUPTION__;
        controller.configureLivingDecay({ ...defaults, idleIntensity: 0, mutationSpeed: 0, scrollMosh: 0,
          cursorMosh: 0, sectionMosh: 0, typographyMosh: 0, heroMosh: 0,
          hoverMosh: 0, clickMosh: 0, navigationMosh: 0, parallaxStrength: 0 });
        controller.regenerateLivingDecay(6831);
        const snapshot = controller.snapshot().ambient;
        const canvas = document.querySelector('[data-corruption-ambient]');
        const read = () => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        const before = read();
        const materialControls = {};
        for (const [key, value] of Object.entries({ organicDecay: 0, colorVariation: 0, voidCoverage: 0, bleachCoverage: 0, blockSize: 64 })) {
          controller.configureLivingDecay({ [key]: value });
          controller.regenerateLivingDecay(snapshot.seed);
          const tuned = read();
          let changedPixels = 0;
          for (let index = 0; index < before.length; index += 4) if (Math.abs(before[index] - tuned[index])
            + Math.abs(before[index + 1] - tuned[index + 1]) + Math.abs(before[index + 2] - tuned[index + 2]) > 2) changedPixels++;
          materialControls[key] = changedPixels;
          controller.restoreLivingDecay(snapshot);
        }
        controller.regenerateLivingDecay(123);
        const other = read();
        let changed = 0;
        for (let index = 0; index < before.length; index += 4) if (Math.abs(before[index] - other[index])
          + Math.abs(before[index + 1] - other[index + 1]) + Math.abs(before[index + 2] - other[index + 2]) > 30) changed++;
        controller.restoreLivingDecay(snapshot);
        const restored = read();
        let mismatch = 0;
        for (let index = 0; index < before.length; index++) if (before[index] !== restored[index]) mismatch++;
        return { changed, mismatch, materialControls, count: before.length / 4, seed: controller.snapshot().ambient.seed };
      }, livingDecayDefaults);
      assert.ok(reproduction.changed > reproduction.count * .25, 'Different seeds produce substantially different material pixels.');
      assert.equal(reproduction.mismatch, 0, 'A stored seed/settings/time snapshot reproduces the initial field exactly.');
      assert.equal(reproduction.seed, 6831);
      for (const [key, changed] of Object.entries(reproduction.materialControls)) assert.ok(changed > 100, `${key} must change actual material pixels.`);

      let pointer;
      if (!mobile) {
        const small = await pointerArea(page, 25);
        const large = await pointerArea(page, 45);
        assert.ok(small.pixels > 0 && large.pixels > small.pixels * 1.2, `Live cursor radius must affect real damaged pixel area: ${small.pixels} / ${large.pixels}`);
        for (const result of [small, large]) {
          assert.ok(result.outside <= result.pixels * .01, 'Cursor damage remains local, allowing the real macroblock footprint.');
          assert.ok(result.pixels < result.count * .08, 'A local cursor stroke must not become full-screen damage.');
          assert.equal(result.regions, 0, 'Background input uses the shared history, not independent ROI canvases.');
          assert.ok(result.memory.byKind.cursor > 0 && result.advectedBlocks > 0, 'Actual movement must advect shared previous-output pixels.');
        }
        pointer = { radius25: small, radius45: large };
      }
      await page.evaluate(defaults => {
        window.__H4_CORRUPTION__.configureLivingDecay(defaults);
        window.__H4_CORRUPTION__.regenerateLivingDecay(6831);
      }, livingDecayDefaults);
      await page.waitForTimeout(700);
      const visual = await pixels(page);
      assert.ok(visual.dark > visual.count * .08 && visual.light > visual.count * .01, 'Material has real dark voids and bleached information.');
      await page.screenshot({ path: new URL(`other-${width}.png`, destination).pathname });
      await page.locator('[data-corruption-ambient]').screenshot({ path: new URL(`material-${width}.png`, destination).pathname });

      await page.mouse.wheel(0, 420);
      await page.waitForTimeout(180);
      const scroll = await page.evaluate(() => window.__livingProbe.scroll);
      assert.ok(scroll.some(event => Math.abs(event.y) > .01 && event.strength > 0), 'Real scrolling drives the shared material motion bus.');
      assert.equal((await state(page)).ambient.seed, 6831);

      const hidden = await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        return window.__H4_CORRUPTION__.snapshot();
      });
      await page.waitForTimeout(450);
      assert.equal((await state(page)).ambient.frames, hidden.ambient.frames);
      assert.equal((await state(page)).ambient.queued, false);
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => !window.__H4_CORRUPTION__.snapshot().ambient.queued);
      const reduced = await state(page);
      await page.waitForTimeout(400);
      assert.equal((await state(page)).ambient.frames, reduced.ambient.frames);
      await page.emulateMedia({ reducedMotion: 'no-preference' });

      const oldSeed = (await state(page)).ambient.seed;
      await change(page, 'normal');
      const normal = await state(page);
      await page.waitForTimeout(350);
      assert.equal((await state(page)).ambient.frames, normal.ambient.frames);
      assert.equal(normal.ambient.queued, false);
      await change(page, 'xray');
      assert.notEqual((await state(page)).ambient.seed, oldSeed, 'A real fresh hold-4 activation creates a new composition.');
      assert.ok(!requests.some(path => /\/src\/main\.js|wordmark\.typeface|tattoo-texture/.test(path)), 'Work/About material rendering never downloads the hero.');
      assert.equal(await page.evaluate(() => window.__livingProbe.webGL), 0);
      assert.deepEqual(errors, []);
      reports.push({ width, firstSeed: first.ambient.seed, nextSeed: (await state(page)).ambient.seed,
        idleChangedPixels: idlePixels.changed, reproduction, pointer, visual, renderer: await state(page), errors });
      await writeFile(new URL('results.json', destination), JSON.stringify({ testedAt: new Date().toISOString(), base, reports }, null, 2) + '\n');
      console.log(`PASS Living Decay ${width}px: seeded material pixels, navigation continuity, live controls, idle motion and lifecycle budgets.`);
    } finally { await context.close(); }
  }
  if (process.env.H4_LIVING_PANEL !== '0') {
    const context = await browser.newContext({ viewport: { width: 320, height: 844 }, deviceScaleFactor: 1 });
    try {
      await context.addInitScript(() => {
        window.__livingPanelWebGL = 0;
        const original = HTMLCanvasElement.prototype.getContext;
        const seen = new WeakSet();
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
          const result = original.call(this, type, ...args);
          if (result && /webgl/.test(type) && !seen.has(result)) { seen.add(result); window.__livingPanelWebGL++; }
          return result;
        };
      });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const errors = []; const requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push(new URL(request.url()).pathname));
      await page.goto(new URL('/work?test=1&fx=1', base).href, { waitUntil: 'networkidle' });
      const panel = page.locator('.living-decay-panel');
      await panel.waitFor();
      const sliderCount = Object.keys(livingDecaySchema).filter(key => key !== 'seed').length;
      assert.equal(await panel.getByRole('slider').count(), sliderCount);
      assert.equal(await panel.locator('[data-living-setting="seed"]').count(), 1);
      const regenerate = panel.getByRole('button', { name: 'Regenerate composition', exact: true });
      assert.equal(await regenerate.isDisabled(), true);
      assert.ok(!requests.some(path => /living-decay-material/.test(path)), 'Opening calibration does not prepare the material.');
      const bounds = await panel.boundingBox();
      assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= 321, 'Calibration stays within a 320px viewport.');
      await change(page, 'xray');
      await page.waitForFunction(() => !document.querySelector('.living-decay-panel__regenerate').disabled);
      assert.equal((await state(page)).ambient.settings.cursorRadius, 35);
      const seedInput = panel.locator('[data-living-setting="seed"]');
      assert.equal(await seedInput.inputValue(), 'auto');
      await regenerate.click();
      const autoOne = (await state(page)).ambient.seed;
      await regenerate.click();
      const autoTwo = (await state(page)).ambient.seed;
      assert.notEqual(autoOne, autoTwo, 'Auto regeneration remains random after runtime seed notifications.');
      assert.equal(await seedInput.inputValue(), 'auto');

      const radius = panel.locator('[data-living-setting="cursorRadius"]');
      await radius.focus(); await radius.press('Home');
      assert.equal((await state(page)).ambient.settings.cursorRadius, 25);
      await radius.press('End');
      assert.equal((await state(page)).ambient.settings.cursorRadius, 45);
      for (const key of ['idleIntensity', 'mutationSpeed', 'scrollStrength', 'scrollMosh', 'sectionMosh', 'typographyMosh',
        'heroMosh', 'cursorMosh', 'hoverMosh', 'clickMosh', 'navigationMosh', 'colorBleeding', 'negativeExposure', 'parallaxStrength']) {
        const slider = panel.locator(`[data-living-setting="${key}"]`);
        await slider.focus(); await slider.press('Home');
        assert.equal((await state(page)).ambient.settings[key], 0, `${key} can be disabled from its actual control.`);
      }
      await seedInput.fill('321');
      await regenerate.click();
      const checksum = () => page.locator('[data-corruption-ambient]').evaluate(canvas => {
        const bytes = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let hash = 2166136261;
        for (let index = 0; index < bytes.length; index += 13) hash = Math.imul(hash ^ bytes[index], 16777619);
        return hash >>> 0;
      });
      const manualOne = await checksum();
      await regenerate.click();
      assert.equal(await checksum(), manualOne, 'Manual seed 321 reproduces the visible material through the panel.');
      assert.equal((await state(page)).ambient.seed, 321);
      assert.equal(await panel.locator('.living-decay-panel__seed-current output').textContent(), '321');
      await page.screenshot({ path: new URL('calibration-320.png', destination).pathname });

      const toggle = panel.getByRole('button', { name: /Living decay calibration/ });
      await toggle.focus(); await toggle.press('Enter');
      assert.equal(await panel.locator('form').isHidden(), true);
      const accepted = (await state(page)).ambient.memory.accepted;
      await page.locator('.page-nav a[href="/about"]').hover();
      await page.locator('.page-nav a[href="/about"]').click();
      await page.waitForURL(url => url.pathname === '/about');
      await settled(page, 'xray');
      assert.equal((await state(page)).ambient.memory.accepted, accepted, 'Zero channels accept no hover/click/navigation/entrance damage into the shared image field.');
      assert.equal((await state(page)).ambient.seed, 321);
      await toggle.focus(); await toggle.press('Enter');
      assert.equal(await panel.locator('form').isHidden(), false);
      const close = panel.getByRole('button', { name: 'Close living decay calibration', exact: true });
      await close.focus(); await close.press('Enter');
      assert.equal(await page.locator('.living-decay-panel').count(), 0);
      assert.equal(await page.evaluate(() => window.__livingPanelWebGL), 0);
      assert.deepEqual(errors, []);
      const controls = sliderCount + 2;
      reports.push({ profile: 'calibration-320', controls, autoSeeds: [autoOne, autoTwo], manualSeed: 321,
        manualChecksum: manualOne, bounds, errors });
      console.log(`PASS Living Decay DEV panel 320px: ${controls} controls, fresh auto/manual reproduction, radius bounds, zero channels and keyboard lifecycle.`);
    } finally { await context.close(); }
  }
  await writeFile(new URL('results.json', destination), JSON.stringify({ testedAt: new Date().toISOString(), base, reports }, null, 2) + '\n');
} finally { clearTimeout(deadline); await browser.close(); }
