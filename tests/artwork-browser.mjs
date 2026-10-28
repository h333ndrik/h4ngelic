import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const artifacts = new URL('../artifacts/', import.meta.url);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(new URL('/?test=1', baseURL).href, { waitUntil: 'networkidle' });
  await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => {
    if (!(window.__H4_TEST__?.snapshot().revealOpacity > .85)) return false;
    // Pause in the same animation frame as the detected reveal angle.
    document.getElementById('pause-control').click();
    return true;
  }, undefined, { timeout: 45000, polling: 'raf' });
  const nextFrame = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await nextFrame();
  const before = await page.evaluate(() => window.__H4_TEST__.snapshot());
  assert.ok(before.revealOpacity > .85, 'Actual displayed orientation must reveal the supplied artwork.');
  await page.screenshot({ path: new URL('reveal-on.png', artifacts).pathname });
  // Exclude the controls so their changing label cannot satisfy the visual test.
  const clip = { x: 0, y: 190, width: 1440, height: 650 };
  const on = await page.screenshot({ clip });
  await page.evaluate(() => document.getElementById('reveal-control').click());
  await nextFrame();
  const after = await page.evaluate(() => window.__H4_TEST__.snapshot());
  assert.equal(after.revealOpacity, 0, 'Reveal off must remove the shader contribution.');
  assert.equal(after.baseTime, before.baseTime, 'A/B images must use exactly the same base pose.');
  assert.deepEqual(after.position, before.position, 'A/B images must use exactly the same position.');
  await page.screenshot({ path: new URL('reveal-off.png', artifacts).pathname });
  const off = await page.screenshot({ clip });

  const comparison = await page.evaluate(async ({ on, off }) => {
    const pixels = async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const [a, b] = await Promise.all([pixels(on), pixels(off)]);
    let changed = 0;
    let changedOutsideMesh = 0;
    let maximumDelta = 0;
    for (let i = 0; i < a.length; i += 4) {
      const delta = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      maximumDelta = Math.max(maximumDelta, delta);
      if (delta > 15) {
        changed++;
        if (Math.abs(b[i] - 48) + Math.abs(b[i + 1] - 48) + Math.abs(b[i + 2] - 51) < 3) changedOutsideMesh++;
      }
    }
    return { changed, changedOutsideMesh, maximumDelta };
  }, { on: on.toString('base64'), off: off.toString('base64') });
  assert.ok(comparison.changed > 200, `Artwork must visibly affect chrome pixels: ${JSON.stringify(comparison)}`);
  assert.ok(comparison.maximumDelta > 60, 'White outlines must have visible contrast.');
  assert.ok(comparison.changedOutsideMesh / comparison.changed < .02, 'Artwork must remain on the chrome surface, without a paper rectangle.');
  assert.deepEqual(errors, [], 'Artwork must render without shader or JavaScript errors.');
  console.log('PASS artwork A/B: real angle-triggered reflection changes mesh pixels only.', comparison);
} finally {
  await browser.close();
}
