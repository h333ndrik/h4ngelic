import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

// A fixed real mesh pose separates material changes from camera/physics motion.
const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  await page.goto(new URL('/?test=1', baseURL).href, { waitUntil: 'networkidle' });
  await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => window.__H4_TEST__?.snapshot().frameCount > 2);
  assert.ok(!requests.some(url => /\/wordmark-xray(?:\.|-)/.test(url)), 'Normal startup must not load the optional damaged material.');
  const snapshot = () => page.evaluate(() => window.__H4_TEST__.snapshot());
  const before = await snapshot();
  assert.equal(before.xrayAmount, 0);
  const clip = { x: 0, y: 210, width: 1440, height: 600 };
  const normal = await page.screenshot({ clip, path: 'artifacts/material-normal.png' });
  const changeMode = async expected => {
    if (expected === 'normal') {
      for (let index = 0; index < 3; index++) await page.keyboard.press('3');
    } else await page.keyboard.down('4');
    try {
      await page.waitForFunction(mode => document.documentElement.dataset.mode === mode
        && !document.documentElement.hasAttribute('data-xray-transition'), expected, { timeout: 10000 });
    } finally { if (expected === 'xray') await page.keyboard.up('4'); }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  await changeMode('xray');
  await page.waitForFunction(() => window.__H4_TEST__.snapshot().xrayAmount === 1);
  // Wait for the actual film texture upload/render, not just the public mode flag.
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const alteredState = await snapshot();
  const altered = await page.screenshot({ clip, path: 'artifacts/material-other-side.png' });
  assert.deepEqual(alteredState.position, before.position, 'Material activation must preserve the fixed sculpture position.');
  assert.equal(alteredState.baseTime, before.baseTime);
  assert.ok(requests.some(url => /\/wordmark-xray(?:\.|-)/.test(url)), 'The first real hold must load and attach the material.');
  await changeMode('normal');
  await page.waitForFunction(() => window.__H4_TEST__.snapshot().xrayAmount === 0);
  const restoredState = await snapshot();
  const restored = await page.screenshot({ clip, path: 'artifacts/material-restored.png' });
  const [originalPixels, alteredPixels, restoredPixels] = await Promise.all([normal, altered, restored].map(async data =>
    sharp(data).removeAlpha().raw().toBuffer()));
  let meshPixels = 0;
  let alteredMeshPixels = 0;
  let restorationDifference = 0;
  for (let offset = 0; offset < originalPixels.length; offset += 3) {
    const contrast = Math.abs(originalPixels[offset] - 48) + Math.abs(originalPixels[offset + 1] - 48) + Math.abs(originalPixels[offset + 2] - 51);
    if (contrast > 18) {
      meshPixels++;
      const changed = Math.abs(originalPixels[offset] - alteredPixels[offset]) + Math.abs(originalPixels[offset + 1] - alteredPixels[offset + 1]) + Math.abs(originalPixels[offset + 2] - alteredPixels[offset + 2]);
      if (changed > 35) alteredMeshPixels++;
    }
    restorationDifference += Math.abs(originalPixels[offset] - restoredPixels[offset]) + Math.abs(originalPixels[offset + 1] - restoredPixels[offset + 1]) + Math.abs(originalPixels[offset + 2] - restoredPixels[offset + 2]);
  }
  const meanRestorationDifference = restorationDifference / originalPixels.length;
  assert.ok(meshPixels > 1000 && alteredMeshPixels / meshPixels > .5, 'The real wordmark pixels must visibly change, beyond a backdrop-only theme switch.');
  assert.ok(meanRestorationDifference < .5, `Normal must restore the original chrome pixels; mean channel delta=${meanRestorationDifference}.`);
  assert.deepEqual(restoredState.position, before.position);
  assert.deepEqual(restoredState.orientation, before.orientation);
  assert.deepEqual(restoredState.camera, before.camera);
  assert.deepEqual(errors, [], 'First material compilation and restoration must have no shader or browser errors.');
  console.log('PASS first wordmark material activation and restoration:', { meshPixels, alteredMeshPixels, meanRestorationDifference });
} finally { await browser.close(); }
