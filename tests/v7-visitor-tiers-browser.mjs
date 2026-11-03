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
        const message = page.locator('[data-visit-message]');
        assert.equal(await line.isVisible(), true);
        const expected = visitorMessage(count);
        assert.equal(await line.textContent(), expected, `Hero tier ${count}`);
        assert.equal(await message.textContent(), expected, `Footer tier ${count}`);
        const box = await line.evaluate(element => {
          const r = element.getBoundingClientRect(), s = getComputedStyle(element);
          const brand = document.querySelector('[data-floating-brand]').getBoundingClientRect();
          const index = document.querySelector('[data-global-index] summary').getBoundingClientRect();
          return { left: r.left, right: r.right, centre: r.left + r.width / 2, top: r.top, height: r.height,
            lineHeight: parseFloat(s.lineHeight), fontSize: parseFloat(s.fontSize), position: s.position,
            brand: { left: brand.left, right: brand.right }, index: { left: index.left, right: index.right } };
        });
        const gapCentre = (box.brand.right + box.index.left) / 2;
        assert.ok(Math.abs(box.centre - gapCentre) < 1, `Recognition stays centered in the branding-to-INDEX gap: ${JSON.stringify(box)}`);
        assert.equal(box.position, 'fixed');
        assert.ok(Math.abs(box.top - 21) < 1, `Recognition shares the floating-brand top: ${JSON.stringify(box)}`);
        assert.ok(box.left >= box.brand.right - .5 && box.right <= box.index.left + .5, `Recognition never overlaps branding or INDEX: ${JSON.stringify(box)}`);
        assert.ok(box.height <= box.lineHeight + 1, 'The fixed recognition row remains one line.');
        tiers.push({ count, expected });
      }
      const visit = page.locator('[data-visit-counter-hotspot]');
      const row = page.locator('[data-footer-row]');
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); await frames(page);
      const before = await row.evaluate(element => { const r = element.getBoundingClientRect(); return { width: r.width, height: r.height, page: document.documentElement.scrollWidth }; });
      const phrase = page.locator('[data-visit-message]');
      if (profile.width < 600) await visit.tap(); else await visit.hover();
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-visit-message]')).opacity) > .45, null, { timeout: 3000 });
      const reveal = await phrase.evaluate(element => { const s = getComputedStyle(element), r = element.getBoundingClientRect(), host = element.closest('[data-visit-counter-hotspot]').getBoundingClientRect();
        return { opacity: Number(s.opacity), above: r.bottom <= host.top + 1, phrase: { top: r.top, bottom: r.bottom }, host: { top: host.top, bottom: host.bottom }, width: r.width, height: r.height }; });
      assert.ok(reveal.opacity > .45, `Phrase reveals: ${JSON.stringify(reveal)}`);
      assert.equal(reveal.above, true, `The portal phrase floats above the counter: ${JSON.stringify(reveal)}`);
      const after = await row.evaluate(element => { const r = element.getBoundingClientRect(); return { width: r.width, height: r.height, page: document.documentElement.scrollWidth }; });
      assert.ok(Math.abs(after.width - before.width) < 1 && Math.abs(after.height - before.height) < 1, 'Revealing the phrase never reflows the footer row.');
      assert.ok(after.page <= profile.width + 1, 'The portal phrase never creates horizontal overflow.');
      await page.screenshot({ path: new URL(`tier-${profile.width}-${profile.reduced}.png`, output).pathname });
      await page.goto(new URL('/?v7first=1', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true');
      assert.equal(await page.locator('[data-returning-visitor]').isVisible(), false, 'First visit keeps the recognition line hidden.');
      assert.deepEqual(errors, []);
      reports.push({ ...profile, tiers, reveal, before, after, errors }); await save();
      console.log(`PASS V7 ${profile.width}px reduced=${profile.reduced}: nine count samples map to seven shared phrases, hero/footer match, recognition centered in the fixed branding gap, ${profile.width < 600 ? 'tap' : 'hover'} reveals an absolute portal with no reflow, first visit hidden.`);
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors }); await save();
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
