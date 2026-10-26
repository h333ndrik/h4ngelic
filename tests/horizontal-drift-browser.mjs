import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const artifacts = new URL('../artifacts/spatial-archives/', import.meta.url);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const deadline = setTimeout(() => void browser.close(), 240000);

async function position(page) {
  return page.locator('[data-horizontal-drift]').evaluate(section => ({
    position: Number(section.dataset.driftPosition), travel: Number(section.dataset.driftTravel),
    start: section.getBoundingClientRect().top + scrollY - 12, scroll: scrollY,
    transform: section.querySelector('.drift-track').style.transform,
  }));
}

async function settled(page) {
  await page.waitForFunction(() => {
    const section = document.querySelector('[data-horizontal-drift]');
    const start = section.getBoundingClientRect().top + scrollY - 12;
    const expected = Math.max(0, Math.min(Number(section.dataset.driftTravel), scrollY - start));
    return Math.abs(Number(section.dataset.driftPosition) - expected) < .3;
  });
  return position(page);
}

try {
  for (const width of (process.env.H4_DRIFT_WIDTHS || '1000,390,320').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: width === 320 ? 'reduce' : 'no-preference', hasTouch: width < 600, isMobile: width < 600 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('/work/tattoos?test=1', base).href, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-horizontal-drift]').count(), 0, 'Production must not invent an artwork collection.');
    await page.evaluate(async () => {
      const { renderHorizontalDrift } = await import('/src/horizontal-drift-content.js');
      const { initHorizontalDrift } = await import('/src/horizontal-drift.js');
      const { initGallery } = await import('/src/gallery.js');
      const archive = document.querySelector('.portfolio-archive');
      // Browser fixture only: repeat the real supplied reflection artwork to
      // exercise a future populated archive; nothing is published as a work.
      archive.innerHTML = renderHorizontalDrift(Array.from({ length: 6 }, (_, index) => ({
        id: `drift-test-${index}`, category: 'tattoos', title: `fixture ${index + 1}`, year: 2026,
        images: [
          { src: '/assets/tattoo-texture.webp', alt: 'supplied artwork fixture', width: 1024, height: 1448 },
          { src: '/assets/tattoo-texture.webp?detail=1', alt: 'supplied detail fixture', width: 1024, height: 1448 },
        ],
      })), { category: 'tattoos', label: 'tattoos' });
      const stopDrift = initHorizontalDrift(archive);
      const stopGallery = initGallery(archive);
      window.__stopDriftFixture = () => { stopGallery(); stopDrift(); };
      // Only the harness eagerly decodes every fixture image. Production's
      // hidden detail images remain lazy until the visitor requests them.
      await Promise.all([...archive.querySelectorAll('img')].map(image => {
        image.loading = 'eager';
        return image.decode();
      }));
    });
    let state = await position(page);
    assert.ok(state.travel > width, 'A populated archive must have meaningful horizontal travel.');
    await page.evaluate(start => scrollTo({ top: start, behavior: 'instant' }), state.start);
    await page.waitForFunction(() => Math.abs(Number(document.querySelector('[data-horizontal-drift]').dataset.driftPosition)) < 1);
    await page.mouse.move(width / 2, 420);
    await page.mouse.wheel(0, 300);
    await page.waitForFunction(() => Number(document.querySelector('[data-horizontal-drift]').dataset.driftPosition) > 200);
    const forward = await settled(page);
    await page.mouse.wheel(0, -120);
    await page.waitForFunction(previous => Number(document.querySelector('[data-horizontal-drift]').dataset.driftPosition) < previous - 70, forward.position);
    const reverse = await settled(page);
    await page.mouse.wheel(150, 0);
    await page.waitForFunction(previous => Number(document.querySelector('[data-horizontal-drift]').dataset.driftPosition) > previous + 70, reverse.position);
    let touch;
    if (width < 600) {
      const session = await context.newCDPSession(page);
      await page.evaluate(() => {
        const section = document.querySelector('[data-horizontal-drift]');
        scrollTo({ top: section.getBoundingClientRect().top + scrollY - 12 + 160, behavior: 'instant' });
      });
      await page.waitForFunction(() => Math.abs(Number(document.querySelector('[data-horizontal-drift]').dataset.driftPosition) - 160) < 1);
      const initial = await position(page);
      const startX = Math.floor(width * .8), startY = 460;
      const touchTarget = await page.evaluate(({ x, y }) => {
        window.__driftTouches = [];
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type,
          event => window.__driftTouches.push({ type, x: event.clientX, y: event.clientY, primary: event.isPrimary,
            target: event.target.tagName + '.' + event.target.className }), { capture: true });
        const node = document.elementFromPoint(x, y);
        return { tag: node?.tagName, className: node?.className, anchor: node?.closest('a')?.outerHTML };
      }, { x: startX, y: startY });
      await page.screenshot({ path: new URL(`before-touch-${width}.png`, artifacts).pathname });
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY }] });
      for (let index = 1; index <= 7; index++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX - index * 22, y: startY }] });
        await page.waitForTimeout(24);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(before => Number(document.querySelector('[data-horizontal-drift]').dataset.driftPosition) > before + 60,
        initial.position, { timeout: 4000 }).catch(async error => {
          console.log(JSON.stringify({ initial, after: await position(page), touchTarget,
            events: await page.evaluate(() => window.__driftTouches) }));
          throw error;
        });
      const horizontal = await position(page);
      // Let the finite drag inertia settle before testing genuine browser pan.
      await page.waitForTimeout(900);
      const nativeBefore = await position(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: width / 2, y: 540 }] });
      for (let index = 1; index <= 7; index++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: width / 2, y: 540 - index * 22 }] });
        await page.waitForTimeout(24);
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(before => scrollY > before + 30, nativeBefore.scroll);
      const vertical = await position(page);
      assert.equal(await page.locator('.artwork-dialog[open]').count(), 0, 'Touch dragging and native panning must not accidentally open artwork.');
      await page.waitForFunction(() => {
        const now = performance.now();
        if (!window.__driftNativeRest || window.__driftNativeRest.y !== scrollY) window.__driftNativeRest = { y: scrollY, at: now };
        return now - window.__driftNativeRest.at > 180;
      });
      touch = { initial, horizontal, nativeBefore, vertical };
      await session.detach();
    }
    // A normal image selection must fly from its own existing plane. Closing
    // restores exactly the native scroll offset and the existing track pose.
    await page.evaluate(() => scrollTo({ top: document.querySelector('[data-horizontal-drift]').getBoundingClientRect().top + scrollY - 12, behavior: 'instant' }));
    await page.waitForFunction(() => Number(document.querySelector('[data-horizontal-drift]').dataset.driftPosition) < 1);
    const opener = page.locator('[data-drift-item]').first().locator('[data-artwork-open]').first();
    let rect = await opener.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.waitForTimeout(500);
    const before = await settled(page);
    rect = await opener.boundingBox();
    // Dispatch at the actually visible plane. Locator.click() invokes its own
    // scrollIntoView and can change a sticky archive before the real click.
    if (width < 600) await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
    else await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.waitForFunction(() => document.querySelector('.artwork-dialog')?.open && document.querySelector('.artwork-viewer-status')?.textContent === 'image 1 of 2');
    assert.equal(await page.locator('[data-horizontal-drift][data-drift-paused]').count(), 1);
    await page.locator('.artwork-next').click();
    await page.waitForFunction(() => document.querySelector('.artwork-viewer-status')?.textContent === 'image 2 of 2');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.artwork-dialog')?.open);
    const after = await position(page);
    assert.ok(Math.abs(after.scroll - before.scroll) < 1, `Closing must restore the exact document scroll position (${JSON.stringify({ before, after })}).`);
    assert.ok(Math.abs(after.position - before.position) < 1, `Closing must retain the same spatial track position (${JSON.stringify({ before, after })}).`);
    assert.equal(await opener.evaluate(element => element === document.activeElement), true);
    let worlds;
    if (width === 1000) {
      await page.evaluate(() => { window.__driftBeforeWorld = document.querySelector('[data-horizontal-drift]'); });
      await page.keyboard.down('4');
      try {
        await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray'
          && !document.documentElement.hasAttribute('data-mode-snapshot')
          && !document.documentElement.hasAttribute('data-xray-transition'), null, { timeout: 20000 });
      } finally { await page.keyboard.up('4'); }
      const other = await position(page);
      assert.equal(await page.evaluate(() => window.__driftBeforeWorld === document.querySelector('[data-horizontal-drift]')), true);
      assert.ok(Math.abs(other.position - after.position) < 1 && Math.abs(other.scroll - after.scroll) < 1,
        'World switching must preserve the actual archive node, scroll and spatial pose.');
      for (let index = 0; index < 3; index++) await page.keyboard.press('3');
      await page.waitForFunction(() => document.documentElement.dataset.mode === 'normal'
        && !document.documentElement.hasAttribute('data-mode-snapshot')
        && !document.documentElement.hasAttribute('data-xray-transition'), null, { timeout: 20000 });
      const normal = await position(page);
      assert.equal(await page.evaluate(() => window.__driftBeforeWorld === document.querySelector('[data-horizontal-drift]')), true);
      assert.ok(Math.abs(normal.position - after.position) < 1 && Math.abs(normal.scroll - after.scroll) < 1);
      worlds = { other, normal, sameNode: true };
    }
    // At the end there is no JavaScript wheel cancellation: normal page
    // scrolling continues into the footer, rather than trapping the visitor.
    await page.evaluate(start => scrollTo({ top: start, behavior: 'instant' }), after.start + after.travel);
    await page.mouse.wheel(0, 180);
    await page.waitForFunction(end => scrollY > end + 20, after.start + after.travel, { timeout: 4000 }).catch(async error => {
      console.log(JSON.stringify({ boundaryBefore: after, now: await position(page), dimensions: await page.evaluate(() => ({
        maximum: document.documentElement.scrollHeight - innerHeight, height: document.documentElement.scrollHeight,
        viewport: innerHeight, overflow: document.body.style.overflow, active: document.activeElement?.outerHTML,
      })) }));
      throw error;
    });
    const boundary = await position(page);
    await page.locator('[data-horizontal-drift]').focus();
    await page.keyboard.press('Home');
    await page.waitForFunction(() => Number(document.querySelector('[data-horizontal-drift]').dataset.driftPosition) < 1);
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => Number(document.querySelector('[data-horizontal-drift]').dataset.driftPosition) > 80);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Spatial composition must not cause document horizontal overflow.');
    await page.screenshot({ path: new URL(`horizontal-drift-${width}.png`, artifacts).pathname });
    await page.evaluate(() => window.__stopDriftFixture());
    assert.equal(await page.locator('[data-horizontal-drift].is-drift-enhanced').count(), 0);
    assert.deepEqual(errors, []);
    results.push({ width, forward, reverse, touch, before, after, worlds, boundary, errors });
    await writeFile(new URL('horizontal-drift-results.json', artifacts), JSON.stringify({ passed: false, results }, null, 2));
    console.log(`PASS Horizontal Drift ${width}px: native wheel/reverse/horizontal input, image flight/detail, exact close restore, boundary release, keyboard and cleanup.`);
    await context.close();
  }
  await writeFile(new URL('horizontal-drift-results.json', artifacts), JSON.stringify({ passed: true, results }, null, 2));
} finally { clearTimeout(deadline); await browser.close(); }
