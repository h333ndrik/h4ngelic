import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { visitorMessage } from '../src/data/easterSettings.js';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_VISITOR_ARTIFACTS || 'artifacts/v312/V7'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })));
const counts = [1, 2, 3, 4, 5, 6, 9, 10, 42];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
try {
  for (const profile of profiles) {
    console.log(`CHECK V7 visitor tiers ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 }, deviceScaleFactor: 1,
      isMobile: profile.width < 600, hasTouch: profile.width < 600, reducedMotion: profile.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); const errors = [];
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      const params = new URLSearchParams(location.search);
      if (params.has('v7first')) localStorage.removeItem('h4ngelic.visits.v1');
      const tier = Number(params.get('v7tier'));
      if (Number.isSafeInteger(tier) && tier > 0) {
        localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({ count: tier, lastSeen: Date.now() }));
      }
    });
    try {
      await page.goto(new URL('/?v7first=1', base).href, { waitUntil: 'networkidle' });
      const tiers = [];
      for (const count of counts) {
        await page.goto(new URL(`/?v7tier=${count}`, base).href, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true');
        const line = page.locator('[data-returning-visitor]');
        const counterNumber = page.locator('[data-visit-number]');
        if (profile.width >= 600) {
          await page.mouse.move(profile.width / 2, 30);
          await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-returning-visitor]')).opacity) >= .349);
        }
        assert.equal(await line.isVisible(), true);
        const expected = visitorMessage(count);
        assert.equal(await line.textContent(), expected, `Hero tier ${count}`);
        assert.equal(await counterNumber.textContent(), `visit ${String(count).padStart(4, '0')}`, `Footer counter keeps tier ${count}`);
        const box = await line.evaluate(element => {
          const r = element.getBoundingClientRect(), s = getComputedStyle(element);
          const range = document.createRange(); range.selectNodeContents(element);
          const textBox = range.getBoundingClientRect();
          const brand = document.querySelector('[data-floating-brand]').getBoundingClientRect();
          const index = document.querySelector('[data-global-index] summary').getBoundingClientRect();
          return { left: r.left, right: r.right, centre: r.left + r.width / 2, top: r.top, height: r.height,
            textHeight: textBox.height,
            lineHeight: parseFloat(s.lineHeight), fontSize: parseFloat(s.fontSize), position: s.position,
            brand: { left: brand.left, right: brand.right }, index: { left: index.left, right: index.right } };
        });
        const gapCentre = (box.brand.right + box.index.left) / 2;
        assert.ok(Math.abs(box.centre - gapCentre) < 1, `Recognition stays centered in the branding-to-INDEX gap: ${JSON.stringify(box)}`);
        assert.equal(box.position, 'fixed');
        assert.ok(Math.abs(box.top - (profile.width < 600 ? 16 : 21)) < 1, `Recognition shares the floating-brand top: ${JSON.stringify(box)}`);
        assert.ok(box.left >= box.brand.right - .5 && box.right <= box.index.left + .5, `Recognition never overlaps branding or INDEX: ${JSON.stringify(box)}`);
        assert.ok(box.textHeight <= box.lineHeight + 1, 'The fixed recognition row remains one line.');
        tiers.push({ count, expected });
      }
      const visit = page.locator('[data-visit-count]');
      const row = page.locator('[data-footer-row]');
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); await frames(page);
      const before = await row.evaluate(element => { const r = element.getBoundingClientRect(); return { width: r.width, height: r.height, page: document.documentElement.scrollWidth }; });
      // B-F8: the counter is permanent static ghost text — no tap, hover or phrase.
      assert.equal(await page.locator('[data-visit-message]').count(), 0, 'The footer counter hides no phrase.');
      assert.equal(await visit.evaluate(element => getComputedStyle(element).pointerEvents), 'none');
      if (profile.width >= 600) {
        await visit.hover({ force: true });
        await page.waitForTimeout(250);
      }
      const after = await row.evaluate(element => { const r = element.getBoundingClientRect(); return { width: r.width, height: r.height, page: document.documentElement.scrollWidth }; });
      assert.deepEqual(after, before, 'Hovering the counter changes nothing.');
      assert.ok(after.page <= profile.width + 1, 'The footer never creates horizontal overflow.');
      await page.screenshot({ path: new URL(`tier-${profile.width}-${profile.reduced}.png`, output).pathname });
      await page.goto(new URL('/?v7first=1', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true');
      const firstLine = page.locator('[data-returning-visitor]');
      if (profile.width < 600) {
        await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-returning-visitor]')).opacity) >= .34);
        assert.equal((await firstLine.innerText()).trim(), 'nice to meet you.', 'A first visit gets the ghost greeting on touch.');
      } else {
        assert.equal(await firstLine.isVisible(), false, 'First visit keeps the desktop recognition line at rest hidden.');
      }
      assert.deepEqual(errors, []);
      reports.push({ ...profile, tiers, before, after, errors }); await save();
      console.log(`PASS V7 ${profile.width}px reduced=${profile.reduced}: nine count samples map to seven hero phrases plus the matching static counter, recognition centered in the fixed branding gap, no counter hover or reflow, first visit ${profile.width < 600 ? 'greets as a ghost' : 'hidden at rest'}.`);
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors }); await save();
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
