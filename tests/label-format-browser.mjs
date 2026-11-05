import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55200';
const output = new URL(`../${process.env.H4_LABEL_ARTIFACTS || 'artifacts/release/LABEL-FORMAT'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, profiles: [], passed: false };

try {
  for (const width of [1440, 390, 320]) {
    console.log(`CHECK label format ${width}px`);
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'no-preference' });
    const page = await context.newPage(); const errors = [];
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      await page.locator('#selected-work-title').waitFor();
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true'
        && /^\d/.test(getComputedStyle(document.documentElement).getPropertyValue('--slash-inset').trim()));
      const home = await page.evaluate(() => ({
        headings: [...document.querySelectorAll('.kinetic-heading-text')].map(node => node.textContent.trim()),
        index: [...document.querySelectorAll('[data-global-index] [data-index-page]')].map(node => node.textContent.replace(/\s+/g, ' ').trim()),
        naavi: document.querySelector('[data-naavi]').textContent.replace(/\s+/g, ' ').trim(),
        naaviLabel: document.querySelector('[data-naavi]').getAttribute('aria-label'),
        slashInset: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slash-inset')),
        categoryLefts: [...document.querySelectorAll('#selected-work .category-link .category-magnet > span')].map(node => node.getBoundingClientRect().left),
        slash: (() => { const heading = document.querySelector('#selected-work-title .kinetic-heading-text'); const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT); let node; while ((node = walker.nextNode())) { const index = node.textContent.indexOf('/'); if (index >= 0) { const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1); return range.getBoundingClientRect().left; } } return NaN; })(),
      }));
      assert.deepEqual(home.headings, ['01/ creative', '02/ about', '03/ contact']);
      assert.deepEqual(home.index, ['00/ home', '01/ creative', '02/ about', '03/ contact']);
      assert.equal(home.naavi, '00/ 04');
      assert.equal(home.naaviLabel, 'NAAVI: 00/ 04, home. go to creative');
      assert.ok(home.slashInset > 0);
      assert.ok(Math.abs(home.categoryLefts[0] - home.slash) <= 2, 'F28 slash measurement still aligns the rubric start.');
      if (width <= 600) assert.ok(Math.abs(home.categoryLefts[2] - home.slash) <= 2, 'The second mobile row shares the F28 slash column.');

      await page.locator('#selected-work').scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: new URL(`home-labels-${width}.png`, output).pathname });
      const work = {};
      for (const [path, current] of [['/creative/tattoos', '01/ 04'], ['/creative/jewellery', '02/ 04'], ['/creative/tools', '03/ 04'], ['/creative/more', '04/ 04']]) {
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
        work[path] = await page.evaluate(() => ({
          counter: document.querySelector('[data-naavi]').textContent.replace(/\s+/g, ' ').trim(),
          heading: document.querySelector('.work-page .page-heading').textContent.trim(),
          filter: document.querySelector('.work-filters [aria-current="page"]').textContent.trim(),
          build: document.documentElement.dataset.build || '',
        }));
        assert.equal(work[path].counter, current, `${path} keeps the dynamic NAAVI chapter value.`);
        assert.match(work[path].build, /^[a-f0-9]{7,40}$/i);
      }
      assert.equal(work['/creative/tattoos'].heading, 'tattoos');
      assert.equal(work['/creative/jewellery'].heading, 'jewellery');
      assert.equal(work['/creative/tools'].heading, 'tools');
      assert.equal(work['/creative/more'].heading, 'more');

      await page.goto(`${base}/about`, { waitUntil: 'networkidle' });
      const about = await page.evaluate(() => ({ heading: document.querySelector('.about-page .page-heading').textContent.trim(),
        counter: document.querySelector('[data-naavi]').textContent.replace(/\s+/g, ' ').trim() }));
      assert.equal(about.heading, '02/ about');
      assert.equal(about.counter, '01/ 01');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: new URL(`labels-${width}.png`, output).pathname });
      report.profiles.push({ width, home, work, about, errors });
    } finally { await context.close(); }
  }
  report.passed = true;
  console.log('PASS label format: NN/ labels, 00–04 INDEX, dynamic NAAVI counters and F28 alignment.');
} catch (error) {
  report.error = error.stack;
  throw error;
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
