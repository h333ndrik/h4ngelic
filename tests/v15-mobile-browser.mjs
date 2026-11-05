import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { visitorMessage } from '../src/data/easterSettings.js';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_MOBILE_ARTIFACTS || 'artifacts/v312/V15'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const profiles = [390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
try {
  for (const profile of profiles) {
    console.log(`CHECK V15 mobile ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 }, deviceScaleFactor: 1,
      isMobile: true, hasTouch: true, reducedMotion: profile.reduced ? 'reduce' : 'no-preference' });
    await context.addInitScript(() => {
      if (!sessionStorage.getItem('v15-seeded')) {
        localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({ count: 5, lastSeen: Date.now() }));
        sessionStorage.setItem('v15-seeded', '1');
      }
    });
    const page = await context.newPage(); const errors = [];
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true');
      const line = page.locator('[data-returning-visitor]');
      await line.waitFor({ state: 'visible' });
      assert.equal(await line.textContent(), visitorMessage(5));
      const recognition = await line.evaluate(element => { const r = element.getBoundingClientRect(), s = getComputedStyle(element);
        const range = document.createRange(); range.selectNodeContents(element);
        return { centre: r.left + r.width / 2, top: r.top, height: r.height, textHeight: range.getBoundingClientRect().height,
          lineHeight: parseFloat(s.lineHeight) }; });
      const gap = await page.evaluate(() => {
        const brand = document.querySelector('[data-floating-brand]').getBoundingClientRect();
        const index = document.querySelector('[data-global-index] summary').getBoundingClientRect();
        return { top: brand.top, centre: (brand.right + index.left) / 2 };
      });
      assert.ok(Math.abs(recognition.centre - gap.centre) < 1, `Recognition line is centred inside the branding-to-INDEX gap; line=${recognition.centre}, gap=${gap.centre}.`);
      assert.ok(Math.abs(recognition.top - 16) < 1, `Recognition line shares the mobile header top (16px without a safe-area inset); line=${recognition.top}.`);
      assert.ok(recognition.textHeight <= recognition.lineHeight + 1);
      const index = page.locator('[data-global-index]');
      await index.locator('summary').click();
      assert.deepEqual(await index.locator('[data-index-page]').evaluateAll(nodes => nodes.map(node => node.dataset.indexPage)), ['home', 'creative', 'about', 'contact']);
      assert.equal(await index.locator('[data-index-page="creative"]').evaluate(element => element.tagName), 'SPAN');
      await page.keyboard.press('Escape');
      const cursor = await page.evaluate(() => ({ body: getComputedStyle(document.body).cursor, link: getComputedStyle(document.querySelector('.hero-nav a')).cursor }));
      assert.equal(cursor.body, 'auto'); assert.doesNotMatch(cursor.link, /h4ngelic/); assert.ok(['auto', 'pointer'].includes(cursor.link));
      const header = await page.evaluate(() => ({ brand: getComputedStyle(document.querySelector('[data-floating-brand]')).mixBlendMode,
        index: getComputedStyle(document.querySelector('[data-global-index] > summary')).mixBlendMode }));
      assert.ok(header.brand === 'difference' || header.index === 'difference');
      await page.screenshot({ path: new URL(`home-${profile.width}-${profile.reduced}.png`, output).pathname });

      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); await frames(page);
      await page.locator('.footer-left').evaluate(element => { element.scrollLeft = element.scrollWidth; });
      await frames(page);
      const footer = await page.evaluate(() => {
        const box = selector => { const element = document.querySelector(selector); if (!element) return null;
          const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        return { moshlab: box('.footer-moshlab'), counter: box('[data-visit-count]'), smash: box('.footer-smash'),
          instagram: box('.footer-instagram'), impressum: box('.footer-details .footer-impressum:not(.footer-impressum-other-side)'),
          location: box('.footer-location'), naavi: box('[data-naavi]'), pageWidth: document.documentElement.scrollWidth,
          count: document.querySelector('[data-visit-number]').textContent.trim(),
          opacity: Number(getComputedStyle(document.querySelector('[data-visit-number]')).opacity),
          message: document.querySelectorAll('[data-visit-message]').length };
      });
      assert.match(footer.count, /^visit \d{4,}$/, 'The ghost counter is permanently readable on touch.');
      assert.equal(footer.opacity, .35, 'B-F8: the counter keeps the HOLD-4 ghost opacity.');
      assert.equal(footer.message, 0, 'B-F8: the counter owns no hidden phrase.');
      assert.equal(overlap(footer.moshlab, footer.counter), false, 'visit and moshlab stay separate.');
      assert.equal(footer.smash, null, 'Normal mode keeps SMASH out of the DOM.');
      assert.equal(overlap(footer.instagram, footer.impressum), false);
      assert.equal(overlap(footer.impressum, footer.location), false);
      assert.equal(overlap(footer.instagram, footer.location), false);
      assert.equal(overlap(footer.counter, footer.naavi), false);
      assert.ok(footer.pageWidth <= profile.width + 1);
      await page.screenshot({ path: new URL(`footer-${profile.width}-${profile.reduced}.png`, output).pathname });

      await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('[data-horizontal-drift="tattoos"]')?.dataset.carouselPreload === 'idle');
      const carousel = page.locator('[data-horizontal-drift="tattoos"]');
      if (profile.reduced) assert.equal(await carousel.getAttribute('data-carousel-phase'), 'idle');
      else assert.equal(await carousel.getAttribute('data-carousel-phase'), 'drift');
      const style = await carousel.evaluate(element => ({ visibility: getComputedStyle(element.closest('.archive-category')).contentVisibility,
        heading: document.querySelector('.work-page .page-heading').textContent,
        categorySize: getComputedStyle(document.querySelector('.rubric-category-heading')).fontSize,
        frontSize: (() => { const probe = document.createElement('a'); probe.className = 'category-link'; probe.style.cssText = 'position:absolute;visibility:hidden'; document.body.append(probe); const size = getComputedStyle(probe).fontSize; probe.remove(); return size; })() }));
      assert.equal(style.heading, 'tattoos');
      assert.equal(style.categorySize, style.frontSize);
      const positionBefore = Number(await carousel.getAttribute('data-drift-position'));
      let positionAfter = positionBefore;
      if (!profile.reduced) {
        const box = await carousel.locator('.drift-viewport').boundingBox();
        const client = await context.newCDPSession(page);
        const y = box.y + Math.min(120, box.height / 2);
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * .75, y }] });
        for (let step = 1; step <= 5; step++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * (.75 - step * .08), y }] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(700);
        positionAfter = Number(await carousel.getAttribute('data-drift-position'));
        assert.ok(Math.abs(positionAfter - positionBefore) > 5, `Touch swipe moves the real carousel: ${positionBefore} -> ${positionAfter}`);
      }
      await page.screenshot({ path: new URL(`carousel-${profile.width}-${profile.reduced}.png`, output).pathname });
      await page.reload({ waitUntil: 'networkidle' });
      const first = page.locator('[data-horizontal-drift="tattoos"] [data-artwork-open]').first();
      const image = first.locator('img'); await image.evaluate(element => element.decode());
      const widthBefore = (await image.boundingBox()).width;
      const tapBox = await first.boundingBox();
      await page.touchscreen.tap(tapBox.x + tapBox.width / 2, tapBox.y + tapBox.height / 2); await page.waitForTimeout(500);
      const expanded = await image.boundingBox();
      assert.equal(await first.getAttribute('aria-pressed'), 'true');
      assert.ok(expanded.width / Math.min(widthBefore, 300) > 1.04 && expanded.x >= -.1 && expanded.x + expanded.width <= profile.width + .1, `Touch expansion grows beyond the exact 300px resting card while fitting the phone viewport: ${JSON.stringify({widthBefore,expanded})}`);

      await page.goto(new URL('/creative/more', base).href, { waitUntil: 'networkidle' });
      await page.locator('#digital-artworks').waitFor();
      const digital = page.locator('#digital-artworks .artwork-open').first();
      await digital.scrollIntoViewIfNeeded(); await frames(page);
      const digitalBox = await digital.boundingBox();
      assert.ok(digitalBox.width <= profile.width - 20 && digitalBox.width > profile.width * .4);
      assert.equal((await page.locator('.work-page .page-heading').textContent()), 'more');
      await page.screenshot({ path: new URL(`more-${profile.width}-${profile.reduced}.png`, output).pathname });

      await page.goto(new URL('/about', base).href, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.about-page .page-heading').textContent(), '02/ more about');
      await page.screenshot({ path: new URL(`about-${profile.width}-${profile.reduced}.png`, output).pathname });

      await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
      const cross = page.locator('.rubric-cross-links');
      await cross.scrollIntoViewIfNeeded(); await frames(page);
      const crossBox = await cross.evaluate(nav => { const r = nav.getBoundingClientRect(); return { width: r.width, height: r.height, scrollWidth: nav.scrollWidth, labels: [...nav.querySelectorAll('a')].map(a => a.textContent.replace(/\s+/g, ' ').trim()) }; });
      assert.ok(crossBox.scrollWidth <= crossBox.width + 1);
      assert.deepEqual(crossBox.labels, ['jewellery', 'tools', 'more']);
      await page.screenshot({ path: new URL(`rubrik-${profile.width}-${profile.reduced}.png`, output).pathname });
      assert.deepEqual(errors, []);
      reports.push({ ...profile, recognition, cursor, header, footer, style, positionBefore, positionAfter, widthBefore, expanded, digitalBox, crossBox, errors }); await save();
      console.log(`PASS V15 ${profile.width}px reduced=${profile.reduced}: centered tier line, touch cursor off, INDEX 00-03, footer tap, non-overlap, flat carousel swipe/expand, digital fit, lower-case rubrics, cross-links.`);
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors }); await save();
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
