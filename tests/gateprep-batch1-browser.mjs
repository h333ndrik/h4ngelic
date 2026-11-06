import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../docs/validation/GATEPREP/BATCH-1/gallery/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, build: '', profiles: [], failures: [] };
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function findHit(page, width, height) {
  return page.evaluate(({ width, height }) => {
    const canvas = document.getElementById('logo-canvas');
    canvas.setPointerCapture = () => {};
    canvas.releasePointerCapture = () => {};
    canvas.hasPointerCapture = () => false;
    const fire = (type, x, y, buttons, button) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 73, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: x, clientY: y, buttons, button,
    }));
    // Real geometry is only reachable through the raycast, so scan the canvas
    // rectangle densely. dispatchEvent is synchronous, so no frame waits needed.
    const rect = canvas.getBoundingClientRect();
    for (let yf = .12; yf <= .9; yf += .04) for (let xf = .08; xf <= .94; xf += .03) {
      const x = rect.left + rect.width * xf, y = rect.top + rect.height * yf;
      fire('pointerdown', x, y, 1, 0);
      if (canvas.classList.contains('is-dragging')) { fire('pointerup', x, y, 0, 0); return { x, y }; }
    }
    return { miss: true, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      stage: document.getElementById('stage')?.className, hero: document.querySelector('.hero')?.getBoundingClientRect().toJSON() };
  }, { width, height });
}

async function fling(page, hit) {
  return page.evaluate(async ({ x, y }) => {
    const canvas = document.getElementById('logo-canvas');
    const fire = (type, cx, cy, buttons, button) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 73, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: cx, clientY: cy, buttons, button,
    }));
    for (let step = 1; step <= 5; step += 1) {
      fire('pointermove', x + step * 36, y, 1, -1);
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    fire('pointerup', x + 180, y, 0, 0);
    await new Promise(resolve => requestAnimationFrame(resolve));
    return { dragging: canvas.classList.contains('is-dragging'), width: canvas.getBoundingClientRect().width,
      height: canvas.getBoundingClientRect().height };
  }, hit);
}

try {
  for (const width of [1440, 390, 320]) {
    const height = width === 1440 ? 900 : 844;
    const mobile = width < 600;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
      isMobile: mobile, hasTouch: mobile, reducedMotion: 'no-preference' });
    await context.addInitScript(() => {
      localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({ count: 5, lastSeen: Date.now() }));
      localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .2 }));
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
      report.build ||= await page.locator('html').getAttribute('data-build');

      // Freeze the ambient 15 s base cycle near its upright start pose so the
      // fling frames show the interaction rotation alone.
      await page.locator('#pause-control').click();
      await page.waitForFunction(() => document.getElementById('pause-control').getAttribute('aria-pressed') === 'true');

      // B-F1 is now owned by the browser: the native cursor disappears with the
      // pointer and there is no overlay left that could freeze on screen.
      await page.mouse.move(width * .5, height * .45); await frames(page);
      const cursor = await page.evaluate(() => ({ overlay: Boolean(document.querySelector('[data-h4-cursor]')),
        classGate: document.documentElement.classList.contains('h4-custom-cursor'),
        body: getComputedStyle(document.body).cursor,
        naavi: getComputedStyle(document.querySelector('[data-naavi]')).cursor }));
      assert.deepEqual({ overlay: cursor.overlay, classGate: cursor.classGate }, { overlay: false, classGate: false },
        'No JS overlay or CSS gate may survive the native restore.');
      const fine = await page.evaluate(() => matchMedia('(any-hover: hover) and (any-pointer: fine)').matches);
      if (fine) {
        assert.match(cursor.body, /h4ngelic-cursor\.svg["']?\)\s+8\s+2/);
        assert.match(cursor.naavi, /h4ngelic-cursor\.svg["']?\)\s+8\s+2/);
      } else {
        assert.doesNotMatch(cursor.body, /h4ngelic-cursor/, 'Touch keeps the system cursor.');
        assert.doesNotMatch(cursor.naavi, /h4ngelic-cursor/, 'Touch keeps the system cursor.');
      }

      const bar = await page.evaluate(() => {
        const hero = document.querySelector('.hero'), nav = document.querySelector('.hero-nav'), controls = document.querySelector('.controls');
        const box = element => { const rect = element.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }; };
        return { insideHero: hero.contains(nav) && hero.contains(controls), position: getComputedStyle(nav).position,
          controlsPosition: getComputedStyle(controls).position, nav: box(nav), controls: box(controls),
          heroHeight: hero.getBoundingClientRect().height, docHeight: document.documentElement.scrollHeight };
      });
      assert.equal(bar.insideHero, true);
      assert.equal(bar.position, 'absolute');
      assert.equal(bar.controlsPosition, 'absolute');
      await page.screenshot({ path: new URL(`after-bar-top-${width}.png`, output).pathname });
      await page.evaluate(() => scrollTo({ top: 180, behavior: 'instant' })); await frames(page);
      const scrolled = await page.evaluate(() => {
        const nav = document.querySelector('.hero-nav').getBoundingClientRect();
        const controls = document.querySelector('.controls').getBoundingClientRect();
        return { scrollY, navTop: nav.top, controlsTop: controls.top, docHeight: document.documentElement.scrollHeight,
          heroBarState: document.querySelector('.hero').dataset.heroBarState || null };
      });
      assert.ok(Math.abs(scrolled.navTop - (bar.nav.top - 180)) <= 1);
      assert.ok(Math.abs(scrolled.controlsTop - (bar.controls.top - 180)) <= 1);
      assert.equal(scrolled.docHeight, bar.docHeight);
      assert.equal(scrolled.heroBarState, null);
      await page.screenshot({ path: new URL(`after-bar-scrolled-${width}.png`, output).pathname });

      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await frames(page);
      await page.screenshot({ path: new URL(`rest-${width}.png`, output).pathname });
      const hit = await findHit(page, width, height);
      assert.ok(hit && !hit.miss, `The logo must expose a real drag hit at ${width}px: ${JSON.stringify(hit)}`);
      const released = await fling(page, hit);
      assert.equal(released.dragging, false);
      assert.ok(released.width > 0 && released.height > 0);
      let elapsed = 0;
      for (const at of [350, 650, 1000]) {
        await page.waitForTimeout(at - elapsed); elapsed = at;
        await page.screenshot({ path: new URL(`after-fling-${width}-${at}.png`, output).pathname });
      }
      await page.screenshot({ path: new URL(`after-fling-${width}.png`, output).pathname });
      assert.deepEqual(errors, []);
      report.profiles.push({ width, cursor, bar, scrolled, hit, released, errors, passed: true });
      console.log(`PASS batch 1 ${width}px: pointerout hide, hero-flow bar and bounded fling path.`);
    } catch (error) {
      report.failures.push({ width, error: error.stack, errors });
      await page.screenshot({ path: new URL(`failure-${width}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
