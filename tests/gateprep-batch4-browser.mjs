import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const output = new URL('../docs/validation/GATEPREP/BATCH-4/gallery/', import.meta.url);
await mkdir(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), build: '', profiles: [], failures: [] };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600 });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      for (const tool of ['m4shlab', 'thr4ce']) {
        await page.goto(new URL(`/creative/tools/${tool}`, base).href, { waitUntil: 'networkidle' });
        await page.waitForTimeout(900);
        report.build ||= await page.locator('html').getAttribute('data-build');
        const state = await page.evaluate(() => {
          const filters = document.querySelector('.work-filters');
          const box = filters?.getBoundingClientRect();
          const brand = document.querySelector('[data-floating-brand]')?.getBoundingClientRect();
          const index = document.querySelector('[data-global-index] > summary')?.getBoundingClientRect();
          const dividers = [...document.querySelectorAll('.tool-detail-page *')].filter(element => {
            const style = getComputedStyle(element);
            return parseFloat(style.borderTopWidth) > 0 && /255, 255, 255/.test(style.borderTopColor);
          }).map(element => element.className || element.tagName);
          return {
            filters: filters ? {
              count: filters.querySelectorAll('a').length,
              labels: [...filters.querySelectorAll('a')].map(link => link.textContent.trim()),
              hrefs: [...filters.querySelectorAll('a')].map(link => link.getAttribute('href')),
              active: filters.querySelector('[aria-current="page"]')?.textContent.trim(),
              box: box && { x: Math.round(box.x), y: Math.round(box.y), height: Math.round(box.height) },
              position: getComputedStyle(filters).position,
            } : null,
            brandRight: brand && Math.round(brand.right), indexLeft: index && Math.round(index.left),
            breadcrumbs: document.querySelectorAll('.breadcrumbs').length,
            facts: document.querySelectorAll('.tool-facts').length,
            dividers,
            headings: [...document.querySelectorAll('h1, h2, h3')].map(node => node.textContent.trim().replace(/\s+/g, ' ')),
            headline: document.querySelector('.tool-headline')?.textContent.trim(),
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
        assert.ok(state.filters, `${tool}@${width}: tool pages need the shared sub-rubric bar.`);
        assert.equal(state.filters.count, 4, `${tool}@${width}: four rubric destinations.`);
        assert.deepEqual(state.filters.labels, ['tattoos', 'jewellery', 'tools', 'more']);
        assert.deepEqual(state.filters.hrefs, ['/creative/tattoos', '/creative/jewellery', '/creative/tools', '/creative/more']);
        assert.equal(state.filters.active, 'tools', `${tool}@${width}: the tools filter is current.`);
        assert.equal(state.filters.position, 'fixed', `${tool}@${width}: the row keeps the header-row geometry.`);
        assert.ok(state.filters.box.x >= state.brandRight - 1, `${tool}@${width}: filters start right of the branding.`);
        assert.ok(state.filters.box.y <= 24, `${tool}@${width}: filters sit on the header row (y ${state.filters.box.y}).`);
        assert.equal(state.breadcrumbs, 0, `${tool}@${width}: no breadcrumb on tool pages.`);
        assert.equal(state.facts, 0, `${tool}@${width}: the facts strip is gone.`);
        assert.deepEqual(state.dividers, [], `${tool}@${width}: no white divider inside the tool page (${state.dividers}).`);
        assert.ok(state.headings.every(text => text !== '3d model'), `${tool}@${width}: the tool page renders no 3d-model heading.`);
        assert.match(state.headline, new RegExp(`^${tool} —`), `${tool}@${width}: the tool headline stays the H1.`);
        assert.ok(state.overflow <= 1, `${tool}@${width}: no horizontal overflow (${state.overflow}).`);
        await page.screenshot({ path: new URL(`tool-top-${tool}-${width}.png`, output).pathname });
        if (tool === 'm4shlab') {
          await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
          await page.waitForTimeout(400);
          await page.screenshot({ path: new URL(`tool-bottom-${width}.png`, output).pathname });
        }
      }

      // B-F8: the footer counter is a quiet ghost statement, not a control.
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true');
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(400);
      const counter = page.locator('[data-visit-count]');
      assert.equal(await counter.count(), 1, 'One ghost counter exists per footer.');
      const before = await counter.evaluate(element => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const number = element.querySelector('[data-visit-number]');
        const numberStyle = getComputedStyle(number);
        return { tag: element.tagName, text: number.textContent.trim(), role: element.getAttribute('role'),
          href: element.closest('a[href]')?.getAttribute('href') || null,
          pointerEvents: style.pointerEvents, x: Math.round(box.x), height: Math.round(box.height),
          color: numberStyle.color, opacity: Number(numberStyle.opacity), tracking: numberStyle.letterSpacing,
          transform: numberStyle.textTransform,
          previousSibling: element.previousElementSibling?.className || null };
      });
      assert.equal(before.tag, 'SPAN', 'The counter is plain text, not a button or link.');
      assert.equal(before.href, null, 'No link wraps the counter.');
      assert.equal(before.pointerEvents, 'none', 'The counter owns no pointer target.');
      assert.match(before.text, /^visit \d{4,}$/);
      assert.equal(before.color, 'rgb(240, 239, 235)', 'Ghost colour matches the HOLD-4 hint.');
      assert.equal(before.opacity, .35, 'Ghost opacity matches the HOLD-4 hint.');
      assert.equal(before.tracking, '0.84px', 'Ghost tracking matches the HOLD-4 hint.');
      assert.equal(before.transform, 'lowercase');
      assert.equal(before.previousSibling, 'footer-moshlab', 'The counter keeps its slot after h4 moshlab.');
      assert.ok(before.height >= 44);
      if (width >= 600) {
        await page.mouse.move(before.x + 10, await counter.evaluate(element => element.getBoundingClientRect().top + 20));
        await page.waitForTimeout(500);
        const hovered = await counter.evaluate(element => ({ opacity: Number(getComputedStyle(element.querySelector('[data-visit-number]')).opacity),
          message: document.querySelectorAll('[data-visit-message]').length }));
        assert.equal(hovered.opacity, .35, 'Hovering never changes the ghost counter.');
        assert.equal(hovered.message, 0, 'No hidden phrase is attached to the counter.');
      }
      await counter.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForTimeout(200);
      await page.screenshot({ path: new URL(`footer-visit-${width}.png`, output).pathname });
      assert.deepEqual(errors, []);
      report.profiles.push({ width, tool: 'm4shlab+thr4ce', counter: before, errors, passed: true });
      console.log(`PASS batch 4 ${width}px: tool sub-rubric bar, no breadcrumb/facts/divider, static ghost counter.`);
    } catch (error) {
      report.failures.push({ width, error: error.stack, errors });
      throw error;
    } finally { await context.close(); }
  }
  report.passed = true;
} finally {
  await writeFile(new URL('batch4.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
