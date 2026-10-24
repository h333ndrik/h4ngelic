import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const out = new URL('../artifacts/ref09-phase4/', import.meta.url);
await mkdir(out, { recursive: true });
const server = await chromium.launchServer({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const deadline = setTimeout(() => server.process().kill('SIGKILL'), 90000);
const browser = await chromium.connect(server.wsEndpoint());
const reports = [];
const state = page => page.evaluate(() => window.__H4_CORRUPTION__?.snapshot());
async function settled(page, mode) {
  await page.waitForFunction(expected => document.documentElement.dataset.mode === expected
    && !document.documentElement.hasAttribute('data-xray-transition') && !document.documentElement.hasAttribute('data-mode-snapshot'), mode);
}
async function change(page, mode) {
  if (mode === 'xray') { await page.keyboard.down('4'); try { await settled(page, mode); } finally { await page.keyboard.up('4'); } }
  else { for (let index = 0; index < 3; index++) await page.keyboard.press('3'); await settled(page, mode); }
}
async function recover(page) {
  await page.waitForFunction(() => !document.querySelector('[data-corruption-region]')
    && !window.__H4_CORRUPTION__?.snapshot().queued, null, { timeout: 8000 });
}
async function stroke(page, from, to, delay) {
  await page.mouse.move(...from); await page.waitForTimeout(delay);
  await page.mouse.move(...to);
  const before = (await state(page)).frames;
  await page.waitForFunction(previous => window.__H4_CORRUPTION__.snapshot().frames > previous + 1, before);
  return page.locator('[data-corruption-region]').evaluateAll(canvases => ({
    pixels: canvases.reduce((sum, canvas) => { const values = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0; for (let index = 3; index < values.length; index += 4) if (values[index] > 16) count++; return sum + count; }, 0),
    boxes: canvases.map(canvas => ({ id: canvas.dataset.corruptionRegion, left: canvas.style.left, top: canvas.style.top, width: canvas.width, height: canvas.height })),
  }));
}
try {
  for (const width of [1000, 390, 320]) {
    const mobile = width < 600;
    const context = await browser.newContext({ viewport: { width, height: mobile ? 844 : 760 }, deviceScaleFactor: 1, reducedMotion: 'reduce', isMobile: mobile, hasTouch: mobile });
    try {
      await context.addInitScript(() => {
        window.__ambientDrawProbe = { source: 0, history: 0, fills: 0 };
        window.__ambientPointerEvents = [];
        document.addEventListener('pointermove', event => window.__ambientPointerEvents.push({ x: event.clientX, y: event.clientY, time: performance.now(), stamp: event.timeStamp }), true);
        document.addEventListener('pointerout', event => { if (!event.relatedTarget) window.__ambientPointerEvents.push({ out: true, time: performance.now() }); }, true);
        window.addEventListener('blur', () => window.__ambientPointerEvents.push({ blur: true, time: performance.now() }));
        const draw = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
          if (this.canvas.hasAttribute('data-corruption-region')) {
            if (source instanceof HTMLCanvasElement && source.hasAttribute('data-corruption-ambient')) window.__ambientDrawProbe.source++;
            else if (source instanceof HTMLCanvasElement) window.__ambientDrawProbe.history++;
          }
          return draw.call(this, source, ...args);
        };
        const fill = CanvasRenderingContext2D.prototype.fillRect;
        CanvasRenderingContext2D.prototype.fillRect = function (...args) { if (this.canvas.hasAttribute('data-corruption-region')) window.__ambientDrawProbe.fills++; return fill.apply(this, args); };
      });
      const page = await context.newPage(); const errors = []; const requests = [];
      page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url()));
      await page.goto(new URL('/work?test=1', base).href, { waitUntil: 'networkidle' });
      await page.locator('html[data-xray-ready]').waitFor();
      assert.equal(await page.locator('[data-corruption-ambient]').count(), 0);
      await change(page, 'xray');
      await page.waitForFunction(() => Boolean(window.__H4_CORRUPTION__));
      const reduced = await state(page);
      assert.equal(reduced.ambient.queued, false); assert.equal(reduced.ambient.frames, 0);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction(() => window.__H4_CORRUPTION__.snapshot().ambient.frames > 1);
      const before = await state(page);
      await page.locator('[data-corruption-ambient]').evaluate(canvas => { window.__filmBefore = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; });
      await page.waitForTimeout(1400);
      const changed = await page.locator('[data-corruption-ambient]').evaluate(canvas => {
        const after = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; let changed = 0;
        for (let index = 0; index < after.length; index += 4) if (Math.abs(after[index] - window.__filmBefore[index]) + Math.abs(after[index + 1] - window.__filmBefore[index + 1]) + Math.abs(after[index + 2] - window.__filmBefore[index + 2]) > 20) changed++;
        delete window.__filmBefore; return changed;
      });
      const moving = await state(page);
      assert.ok(moving.ambient.frames > before.ambient.frames + 1); assert.ok(changed > 1000, `Ambient image pixels must visibly evolve without pointer input: ${changed}.`);
      assert.equal(moving.regions, 0); assert.equal(moving.queued, false);
      assert.ok(moving.ambient.width <= (mobile ? 512 : 1120)); assert.ok(moving.ambient.height <= (mobile ? 768 : 800));
      assert.equal(await page.locator('[data-corruption-ambient]').evaluate(canvas => getComputedStyle(canvas).pointerEvents), 'none');
      let pointer;
      if (!mobile) {
        const slow = await stroke(page, [300, 490], [310, 490], 120); await recover(page);
        const fast = await stroke(page, [250, 490], [650, 500], 25);
        if (fast.pixels <= slow.pixels * 2) await writeFile(new URL('pointer-failure.json', out), JSON.stringify({ slow, fast, state: await state(page), events: await page.evaluate(() => window.__ambientPointerEvents) }, null, 2));
        assert.ok(fast.pixels > slow.pixels * 2, `${fast.pixels} should exceed ${slow.pixels}.`);
        assert.ok(fast.boxes.length <= 2 && fast.boxes.every(box => box.width <= 620 && box.height <= 420));
        const probe = await page.evaluate(() => window.__ambientDrawProbe);
        assert.ok(probe.source > 0 && probe.history > 0); assert.equal(probe.fills, 0);
        await page.screenshot({ path: new URL('ambient-pointer-damage.png', out).pathname });
        await recover(page);
        const idle = await state(page); const draws = await page.evaluate(() => window.__ambientDrawProbe);
        await page.waitForTimeout(400); const after = await state(page);
        assert.equal(after.frames, idle.frames); assert.ok(after.ambient.frames > idle.ambient.frames);
        assert.deepEqual(await page.evaluate(() => window.__ambientDrawProbe), draws);
        pointer = { slow, fast, probe };
      }
      await page.screenshot({ path: new URL(`ambient-${width}.png`, out).pathname });
      const atHide = await state(page);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(500); const hidden = await state(page);
      assert.equal(hidden.ambient.queued, false); assert.equal(hidden.ambient.frames, atHide.ambient.frames); assert.equal(hidden.queued, false);
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForFunction(() => window.__H4_CORRUPTION__.snapshot().ambient.queued);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => !window.__H4_CORRUPTION__.snapshot().ambient.queued);
      assert.equal((await state(page)).ambient.queued, false);
      await change(page, 'normal'); await page.emulateMedia({ reducedMotion: 'no-preference' });
      const normal = await state(page); await page.waitForTimeout(400);
      assert.equal((await state(page)).ambient.frames, normal.ambient.frames); assert.equal(normal.ambient.queued, false);
      assert.ok(!requests.some(url => /\/src\/main\.js|\/main-[^/]+\.js|wordmark\.typeface|tattoo-texture/.test(url)), 'Animated film on Work never loads a hero.');
      assert.deepEqual(errors, []);
      reports.push({ width, changedPixels: changed, pointer, renderer: moving, errors });
      console.log(`PASS ambient ${width}px: actual stationary film evolution, current-frame source, caps, idle ROI and Normal/hidden/reduced cleanup.`);
    } finally { await context.close(); }
  }
  await writeFile(new URL('ambient-results.json', out), JSON.stringify({ testedAt: new Date().toISOString(), reports }, null, 2));
} finally { clearTimeout(deadline); await browser.close().catch(() => {}); await server.close().catch(() => {}); }
