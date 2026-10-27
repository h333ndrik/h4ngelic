import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../artifacts/master-foundation/layout/', import.meta.url);
await mkdir(output, { recursive: true });
const launchBrowser = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let browser;
const results = [];
const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
try {
  for (const width of (process.env.H4_LAYOUT_WIDTHS || '1440,1000,801,800,390,320').split(',').map(Number)) {
    browser = await launchBrowser();
    console.log(`CHECK master layout ${width}px`);
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: 'reduce',
      deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.locator('.hero:not([hidden])').waitFor();
      const home = await page.evaluate(() => {
        const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        const controls = document.querySelector('.hero .controls');
        return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
          brand: document.querySelector('.hero-brand').textContent,
          edition: !!document.querySelector('.masthead .edition'), identity: !!document.querySelector('.hero .identity'),
          controls: rect(controls), buttons: [...controls.querySelectorAll('button')].map(button => ({ ...rect(button), fontSize: parseFloat(getComputedStyle(button).fontSize) })),
          navigation: rect(document.querySelector('.hero-nav')), navigationLinks: [...document.querySelectorAll('.hero-nav a')].map(rect), naavi: document.querySelector('[data-naavi]') ? rect(document.querySelector('[data-naavi]')) : null };
      });
      assert.equal(home.brand, 'h4ngelic');
      assert.equal(home.edition, false); assert.equal(home.identity, false);
      assert.equal(home.buttons.length, 4);
      assert.ok(home.controls.top > home.height / 2, 'Controls belong to the lower hero area.');
      assert.ok(home.controls.left >= 21 && home.controls.right <= width - 21);
      assert.ok(home.navigation.right <= width - 21);
      for (const link of home.navigationLinks) assert.ok(link.height >= 44, 'Frontpage links retain accessible touch hit areas.');
      assert.ok(!overlap(home.controls, home.navigation), 'The small controls and frontpage navigation have separate responsive areas.');
      if (home.naavi) { assert.ok(!overlap(home.controls, home.naavi)); assert.ok(!overlap(home.navigation, home.naavi)); }
      for (const button of home.buttons) { assert.ok(button.height >= 44 && button.fontSize <= 11); assert.ok(button.left >= 0 && button.right <= width); }
      assert.ok(home.documentWidth <= width + 1);
      await page.screenshot({ path: new URL(`home-${width}.png`, output).pathname });

      console.log(`CHECK ${width}px Works`);
      await page.goto(new URL('/work', base).href, { waitUntil: 'networkidle' });
      const work = await page.evaluate(() => {
        const numeric = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
        return { heading: document.querySelector('.work-page h1').textContent,
          groups: [...document.querySelectorAll('.work-group-heading')].map(h => h.textContent.trim()),
          subheads: [...document.querySelectorAll('h3.archive-category-heading')].map(h => h.textContent.trim()),
          majorSize: numeric('.work-group-heading'), subordinateSize: numeric('.archive-category-heading'), digitalSize: numeric('#digital-artworks .archive-category-heading'),
          noArrows: !document.querySelector('.work-page .arrow'), noMiniNav: !document.querySelector('.work-subfilters'),
          modelChildren: [...document.querySelector('[data-deferred-model]').children].map(el => el.tagName),
          lines: [...document.querySelectorAll('.work-page .work-filters,.work-page .work-group,.work-page .archive-category,.work-page .project-meta')].map(el => {
            const s = getComputedStyle(el); return [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth]; }),
          documentWidth: document.documentElement.scrollWidth, images: document.querySelectorAll('.work-page .project-image img').length };
      });
      assert.equal(work.heading, '01 / WORKS');
      assert.deepEqual(work.groups, ['tattoos', 'jewellery', 'more']);
      assert.deepEqual(work.subheads, ['on skin', 'flashes', '3d model', 'digital artworks', 'analog photography']);
      assert.ok(work.subordinateSize < work.majorSize * .67 && work.digitalSize < work.subordinateSize);
      assert.ok(work.noArrows && work.noMiniNav);
      assert.deepEqual(work.modelChildren, ['H3']);
      for (const sides of work.lines) assert.deepEqual(sides, ['0px','0px','0px','0px']);
      assert.equal(work.images, 1, 'Only the genuine supplied digital artwork is published.');
      assert.ok(work.documentWidth <= width + 1);

      const counts = [];
      for (const path of ['/work', '/about', '/contact', '/work/digital-artworks/green-black-original']) {
        console.log(`CHECK ${width}px footer ${path}`);
        if (path !== '/work') await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });
        await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
        const footer = await page.locator('[data-artist-footer]').evaluate(element => {
          const box = el => { const r = el.getBoundingClientRect(); return { left:r.left,right:r.right,top:r.top,bottom:r.bottom }; };
          const counter = element.querySelector('[data-visit-number]'), button = counter.closest('button');
          return { count:counter.textContent, visible:getComputedStyle(counter).opacity, signature:box(element.querySelector('.footer-brand')), visit:box(button),
            border:getComputedStyle(element).borderTopWidth, width:document.documentElement.scrollWidth,
            naavi:document.querySelector('[data-naavi]') ? box(document.querySelector('[data-naavi]')) : null };
        });
        assert.equal(footer.visible, '1'); assert.equal(footer.border, '0px');
        assert.ok(footer.visit.left >= footer.signature.right && footer.visit.left - footer.signature.right <= 18);
        assert.ok(Math.abs(footer.visit.top - footer.signature.top) < 18);
        assert.ok(footer.visit.right <= width && footer.width <= width + 1);
        if (footer.naavi) { assert.ok(!overlap(footer.signature,footer.naavi)); assert.ok(!overlap(footer.visit,footer.naavi)); }
        counts.push(footer.count);
      }
      assert.ok(counts.every(value => value === counts[0]), 'Interior pages share one visit, not one count per route.');
      assert.deepEqual(errors, []);
      results.push({ width, home, work, counts, errors });
      console.log(`PASS master layout ${width}px: small lower controls, exact Works hierarchy, empty model, no category/footer lines, shared visible VISIT.`);
      await writeFile(new URL(`results-${width}.json`, output), JSON.stringify({ checkedAt: new Date().toISOString(), ...results.at(-1) }, null, 2));
    } finally { await context.close(); await browser.close(); browser = null; }
  }
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
} finally { await browser?.close(); }
