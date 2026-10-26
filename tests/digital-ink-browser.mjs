import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
await mkdir('artifacts/digital-ink', { recursive: true });
const deadline = setTimeout(() => void browser.close(), 180000);
try {
  for (const width of [1000, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/images/ink-test-only.svg', route => route.fulfill({ contentType: 'image/svg+xml', body:
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#19b76e"/><path d="M0 0L600 800M600 0L0 800" stroke="#13231c" stroke-width="60"/><circle cx="300" cy="400" r="100" fill="#abe7d4"/></svg>' }));
    const requests = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await page.goto(`${base}/work/digital-artworks?test=1`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.is-ink-enhanced');
    const original = await page.locator('.digital-ink-open img').evaluate(image => ({
      source: image.currentSrc, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
      alt: image.alt, count: document.querySelectorAll('[data-digital-ink]').length,
    }));
    assert.equal(original.count, 1, 'The real supplied original is published once.');
    assert.ok(original.source.includes('green-black-original'));
    assert.ok(Math.abs(original.naturalWidth / original.naturalHeight - .75) < .001);
    const realPose = async progress => {
      await page.evaluate(progress => {
        const section = document.querySelector('[data-digital-ink]');
        const bounds = section.getBoundingClientRect();
        scrollTo({ top: bounds.top + scrollY - innerHeight * .12 + (bounds.height - innerHeight) * progress, behavior: 'instant' });
      }, progress);
      await page.waitForFunction(progress => Math.abs(Number(document.querySelector('[data-digital-ink]').dataset.inkProgress) - progress) < .002, progress);
      return page.locator('.digital-ink-canvas').evaluate(canvas => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let visible = 0, hash = 2166136261;
        const alpha = new Uint8Array(pixels.length / 4);
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index]) visible++;
          hash = Math.imul(hash ^ pixels[index], 16777619) >>> 0;
          alpha[(index - 3) / 4] = pixels[index];
        }
        const section = document.querySelector('[data-digital-ink]');
        const progress = Number(section.dataset.inkProgress);
        let repeatDelta;
        if (!window.__originalInkAlpha) window.__originalInkAlpha = { progress, alpha };
        else if (progress === window.__originalInkAlpha.progress && alpha.length === window.__originalInkAlpha.alpha.length) {
          let sum = 0, maximum = 0;
          for (let index = 0; index < alpha.length; index++) {
            const delta = Math.abs(alpha[index] - window.__originalInkAlpha.alpha[index]);
            sum += delta; maximum = Math.max(maximum, delta);
          }
          repeatDelta = { maximum, mean: sum / alpha.length };
        }
        return { visible, hash, width: canvas.width, height: canvas.height,
          progress, repeatDelta, scroll: scrollY,
          sectionTop: section.getBoundingClientRect().top, sectionHeight: section.getBoundingClientRect().height };
      });
    };
    const originalFirst = await realPose(.32);
    await page.screenshot({ path: `artifacts/digital-ink/original-first-${width}.png` });
    const originalLater = await realPose(.72);
    await page.screenshot({ path: `artifacts/digital-ink/original-later-${width}.png` });
    const originalReverse = await realPose(.32);
    assert.ok(originalLater.visible > originalFirst.visible);
    assert.ok(originalReverse.repeatDelta?.maximum <= 2 && originalReverse.repeatDelta.mean < .1,
      `The real original must reverse to its mask with only 8-bit raster rounding: ${JSON.stringify({ originalFirst, originalLater, originalReverse })}`);
    await realPose(1);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(450);
    const image = page.locator('.digital-ink-open img');
    const fullState = await image.evaluate(image => {
      const style = getComputedStyle(image), visual = image.closest('.interaction-visual');
      const parentStyle = visual && getComputedStyle(visual);
      const bounds = image.getBoundingClientRect();
      return { visibility: style.visibility, imageFilter: style.filter, parentFilter: parentStyle?.filter,
        parentTransform: parentStyle?.transform, canvasDisplay: getComputedStyle(document.querySelector('.digital-ink-canvas')).display,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
    });
    assert.equal(fullState.visibility, 'visible');
    assert.equal(fullState.canvasDisplay, 'none');
    assert.equal(fullState.imageFilter, 'none');
    assert.ok(!fullState.parentFilter || fullState.parentFilter === 'none');
    const full = await image.screenshot();
    // Compare actual completed page pixels with a clean, unfiltered <img> of
    // the exact same responsive file at the same position. This detects a
    // remaining mask, blur, color filter, cropping or canvas resampling.
    await image.evaluate(image => {
      const bounds = image.getBoundingClientRect();
      const visual = image.closest('.interaction-visual');
      const parentBounds = visual?.getBoundingClientRect() || bounds;
      const host = document.createElement('div');
      host.id = 'clean-original-reference-host';
      // Use the same stationary parent geometry/identity transform so the
      // reference has the same subpixel sampling phase as the original.
      Object.assign(host.style, { position: 'fixed', left: `${parentBounds.left}px`, top: `${parentBounds.top}px`,
        width: `${parentBounds.width}px`, height: `${parentBounds.height}px`,
        transform: visual ? getComputedStyle(visual).transform : 'none', filter: 'none',
        zIndex: '2147483647', pointerEvents: 'none' });
      const clone = new Image();
      clone.src = image.currentSrc;
      clone.id = 'clean-original-pixel-reference';
      Object.assign(clone.style, { display: 'block',
        width: `${bounds.width}px`, height: `${bounds.height}px`, maxWidth: 'none', maxHeight: 'none',
        margin: '0 auto', padding: '0', border: '0', objectFit: 'contain', filter: 'none', pointerEvents: 'none' });
      host.append(clone); document.body.append(host);
      return clone.decode();
    });
    const clean = await page.locator('#clean-original-pixel-reference').screenshot();
    const actualPixels = await sharp(full).removeAlpha().raw().toBuffer();
    const cleanPixels = await sharp(clean).removeAlpha().raw().toBuffer();
    assert.equal(actualPixels.length, cleanPixels.length);
    let channelDifference = 0, maximumDifference = 0;
    for (let index = 0; index < actualPixels.length; index++) {
      const delta = Math.abs(actualPixels[index] - cleanPixels[index]);
      channelDifference += delta; maximumDifference = Math.max(maximumDifference, delta);
    }
    const meanChannelDifference = channelDifference / actualPixels.length;
    await writeFile('artifacts/digital-ink/partial-original-results.json', JSON.stringify({ width, original,
      originalFirst, originalLater, originalReverse, fullState, meanChannelDifference, maximumDifference }, null, 2));
    assert.ok(meanChannelDifference < .05, `Completed artwork must match the clean original image (${meanChannelDifference}).`);
    await page.locator('#clean-original-reference-host').evaluate(host => host.remove());
    await page.screenshot({ path: `artifacts/digital-ink/original-complete-${width}.png` });
    let otherSide;
    if (width === 1000) {
      await page.evaluate(() => {
        window.__originalInkNode = document.querySelector('[data-digital-ink]');
        window.__digitalEdges = [];
        document.addEventListener('h4:visualmotion', event => {
          for (const sample of event.detail.samples || []) if (sample.target?.classList?.contains('digital-ink-canvas')) {
            window.__digitalEdges.push({ kind: sample.kind, points: sample.points });
          }
        });
      });
      await page.keyboard.down('4');
      try {
        await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray'
          && !document.documentElement.hasAttribute('data-mode-snapshot')
          && !document.documentElement.hasAttribute('data-xray-transition'), null, { timeout: 20000 });
      } finally { await page.keyboard.up('4'); }
      assert.equal(await page.evaluate(() => window.__originalInkNode === document.querySelector('[data-digital-ink]')), true);
      await realPose(.32);
      await page.waitForTimeout(120);
      await realPose(.62);
      await page.waitForFunction(() => window.__digitalEdges.length >= 2);
      otherSide = await page.evaluate(() => ({ sameNode: window.__originalInkNode === document.querySelector('[data-digital-ink]'),
        progress: Number(document.querySelector('[data-digital-ink]').dataset.inkProgress), events: window.__digitalEdges }));
      assert.ok(otherSide.events.every(event => event.points.length === 8));
      assert.notDeepEqual(otherSide.events[0].points, otherSide.events.at(-1).points, 'Real moving mask edges feed different geometric motion samples to shared corruption.');
      for (let index = 0; index < 3; index++) await page.keyboard.press('3');
      await page.waitForFunction(() => document.documentElement.dataset.mode === 'normal'
        && !document.documentElement.hasAttribute('data-mode-snapshot')
        && !document.documentElement.hasAttribute('data-xray-transition'), null, { timeout: 20000 });
      assert.equal(await page.evaluate(() => window.__originalInkNode === document.querySelector('[data-digital-ink]')), true);
    }
    assert.ok(!requests.some(path => /\/src\/main\.js|\/three(?:\/|\.)|wordmark\.typeface/.test(path)), 'A cold digital archive never downloads the hero or Three.js.');
    await page.goto(`${base}/work/jewellery?test=1`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const { renderDigitalInk } = await import('/src/digital-ink-content.js');
      const { initDigitalInk } = await import('/src/digital-ink.js');
      const root = document.getElementById('page-content');
      root.innerHTML = '<div style="height:30vh"></div>' + renderDigitalInk([{ id: 'browser-only-fixture',
        category: 'digital-artworks', title: 'test fixture — not portfolio artwork', images: [{ src: '/images/ink-test-only.svg',
          alt: 'test geometry', width: 600, height: 800 }] }]) + '<div style="height:100vh"></div>';
      window.stopTestInk = initDigitalInk(root);
    });
    await page.waitForSelector('.is-ink-enhanced');
    async function pose(progress) {
      await page.evaluate(progress => {
        const section = document.querySelector('[data-digital-ink]');
        const bounds = section.getBoundingClientRect();
        const top = bounds.top + scrollY;
        scrollTo({ top: top - innerHeight * .12 + (bounds.height - innerHeight) * progress, behavior: 'instant' });
      }, progress);
      await page.waitForFunction(progress => Math.abs(Number(document.querySelector('[data-digital-ink]').dataset.inkProgress) - progress) < .002, progress);
      return page.evaluate(() => {
        const canvas = document.querySelector('.digital-ink-canvas');
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let sum = 0, visible = 0, hash = 2166136261;
        const alpha = new Uint8Array(pixels.length / 4);
        for (let index = 3; index < pixels.length; index += 4) {
          sum += pixels[index]; if (pixels[index]) visible++;
          hash = Math.imul(hash ^ pixels[index], 16777619) >>> 0;
          alpha[(index - 3) / 4] = pixels[index];
        }
        const progress = Number(document.querySelector('[data-digital-ink]').dataset.inkProgress);
        let repeatDelta;
        if (progress > .31 && progress < .33) {
          if (!window.__fixtureInkAlpha) window.__fixtureInkAlpha = alpha;
          else {
            let total = 0, maximum = 0;
            for (let index = 0; index < alpha.length; index++) {
              const difference = Math.abs(alpha[index] - window.__fixtureInkAlpha[index]);
              total += difference; maximum = Math.max(maximum, difference);
            }
            repeatDelta = { mean: total / alpha.length, maximum };
          }
        }
        return { progress, sum, visible, hash, repeatDelta };
      });
    }
    const initial = await pose(.05), first = await pose(.32);
    await page.screenshot({ path: `artifacts/digital-ink/first-${width}.png` });
    const later = await pose(.72);
    await page.screenshot({ path: `artifacts/digital-ink/later-${width}.png` });
    const reverse = await pose(.32);
    assert.ok(later.visible > first.visible && first.visible > initial.visible);
    assert.ok(reverse.repeatDelta?.maximum <= 2 && reverse.repeatDelta.mean < .1,
      `Reverse scrolling restores the mask within measured 8-bit raster rounding: ${JSON.stringify(reverse.repeatDelta)}`);
    await pose(1);
    const complete = await page.evaluate(() => ({
      canvas: getComputedStyle(document.querySelector('.digital-ink-canvas')).display,
      image: getComputedStyle(document.querySelector('.digital-ink-open img')).visibility,
      width: document.documentElement.scrollWidth,
    }));
    assert.equal(complete.canvas, 'none'); assert.equal(complete.image, 'visible'); assert.ok(complete.width <= width);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('.is-ink-enhanced'));
    const reduced = await page.evaluate(() => ({ visibility: getComputedStyle(document.querySelector('.digital-ink-open img')).visibility,
      position: getComputedStyle(document.querySelector('.digital-ink-sticky')).position }));
    assert.equal(reduced.visibility, 'visible'); assert.equal(reduced.position, 'static');
    await page.evaluate(() => window.stopTestInk());
    assert.deepEqual(errors, []);
    results.push({ width, original, originalFirst, originalLater, originalReverse,
      originalFidelity: { meanChannelDifference, maximumDifference, fullState }, otherSide, initial, first, later, reverse, complete, reduced, errors });
    await writeFile('artifacts/digital-ink-results.json', JSON.stringify({ passed: false, results }, null, 2));
    await page.close();
  }
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/digital-ink-results.json', JSON.stringify({ passed: true, checkedAt: new Date().toISOString(), results }, null, 2));
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} finally { clearTimeout(deadline); await browser.close(); }
