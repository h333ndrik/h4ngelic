import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55205';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { build: '', profiles: [], redirects: [], tools: [], passed: false };
for (const width of [1440, 390, 320]) {
  const height = width === 1440 ? 900 : 844;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'no-preference',
    hasTouch: width < 600, isMobile: width < 600 });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.setDefaultTimeout(60000);
  try {
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
    report.build ||= await page.locator('html').getAttribute('data-build');
    const index = await page.locator('[data-index-page]').evaluateAll(nodes => nodes.map(node => ({
      text: node.textContent.replace(/\s+/g, ' ').trim(), page: node.dataset.indexPage })));
    assert.deepEqual(index.map(item => item.page), ['home', 'creative', 'about', 'contact']);
    assert.deepEqual(index.map(item => item.text), ['00/ home', '01/ creative', '02/ more about', '03/ contact']);

    const gapToken = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#selected-work .category-strip')).columnGap));
    const categoryGaps = await page.locator('#selected-work .category-link').evaluateAll(nodes => {
      const rows = new Map();
      for (const node of nodes) {
        const box = node.getBoundingClientRect(), key = Math.round(box.top);
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push(box);
      }
      return [...rows.values()].flatMap(row => row.sort((a, b) => a.left - b.left).slice(1).map((box, index) => box.left - row[index].right));
    });
    assert.ok(categoryGaps.length >= 1);
    assert.ok(categoryGaps.every(gap => Math.abs(gap - gapToken) <= 2), `Frontpage uses --rubric-gap at ${width}px: ${categoryGaps} vs ${gapToken}`);

    await page.goto(`${base}/creative`, { waitUntil: 'networkidle' });
    const filterGap = await page.locator('.work-filters').evaluate(element => ({
      computed: parseFloat(getComputedStyle(element).columnGap),
      positions: [...element.querySelectorAll('a')].map(link => { const box = link.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top }; })
        .sort((a, b) => a.left - b.left).slice(1).map((box, index, all) => box.left - all[index].left) }));
    assert.ok(Math.abs(filterGap.computed - gapToken) <= .1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

    await page.goto(`${base}/creative/tattoos`, { waitUntil: 'networkidle' });
    const crossGap = await page.locator('.rubric-cross-links').evaluate(element => ({
      computed: parseFloat(getComputedStyle(element).columnGap),
      arrows: [...element.querySelectorAll('a')].map(link => parseFloat(getComputedStyle(link).columnGap)),
    }));
    assert.ok(Math.abs(crossGap.computed - gapToken) <= .1);
    assert.ok(crossGap.arrows.every(value => value > 0));

    for (const category of ['flashes', 'jewellery']) {
      await page.goto(`${base}/creative/${category}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('[data-horizontal-drift]')?.classList.contains('is-drift-enhanced'));
      const carousel = page.locator(`[data-horizontal-drift="${category}"]`);
      await carousel.scrollIntoViewIfNeeded();
      await page.waitForFunction(category => document.querySelector(`[data-horizontal-drift="${category}"]`)?.dataset.carouselWrap === 'true', category);
      const state = await carousel.evaluate(element => ({
        placeholders: [...element.querySelectorAll('[data-placeholder="true"]')].map(item => ({
          text: item.querySelector('[data-placeholder-expand]')?.textContent.trim(),
          width: item.querySelector('[data-placeholder-expand]')?.getBoundingClientRect().width,
          height: item.querySelector('[data-placeholder-expand]')?.getBoundingClientRect().height,
        })),
        empty: Boolean(element.querySelector('.archive-empty')),
        count: element.querySelector('[data-drift-count]')?.textContent.trim(),
        wrap: element.dataset.carouselWrap,
      }));
      assert.equal(state.placeholders.length, 8);
      assert.equal(state.empty, false);
      assert.equal(state.count, '01/ 08');
      assert.equal(state.wrap, 'true');
      if (width === 1440) assert.ok(state.placeholders.every(item => Math.abs(item.width - 300) < 1 && Math.abs(item.height - 420) < 1), JSON.stringify(state.placeholders[0]));
      const first = carousel.locator('[data-placeholder-expand]').first();
      await first.click({ force: true });
      assert.equal(await first.getAttribute('aria-pressed'), 'true');
      assert.equal(await carousel.locator('[data-placeholder="true"]').first().evaluate(node => node.classList.contains('is-placeholder-expanded')), true);
      await first.click({ force: true });
      assert.equal(await first.getAttribute('aria-pressed'), 'false');
      assert.equal(await carousel.getAttribute('data-placeholder-expanded'), null);
      await page.screenshot({ path: new URL(`../docs/validation/FLASH-JEWELLERY-PLACEHOLDER/${category}-${width}.png`, import.meta.url).pathname });
    }

    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    const normalFooter = await page.evaluate(() => ({
      smash: document.querySelectorAll('[data-smash]').length,
      imprint: [...document.querySelectorAll('.footer-details .footer-impressum')].map(link => link.textContent.trim()),
      hint: document.querySelector('[data-xray-hint-text]')?.textContent,
    }));
    assert.equal(normalFooter.smash, 0, 'Normal mode has no hidden SMASH DOM.');
    assert.deepEqual(normalFooter.imprint, ['impressum']);
    assert.equal(normalFooter.hint, 'hold 4 to see the other side.');
    await page.keyboard.down('4');
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray', null, { timeout: 60000 });
    await page.keyboard.up('4');
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-mode-snapshot') && !document.documentElement.hasAttribute('data-xray-transition'));
    const otherFooter = await page.evaluate(() => ({
      smash: [...document.querySelectorAll('[data-smash]')].map(button => ({ text: button.textContent.trim(), arrows: button.querySelectorAll('.arrow').length })),
      imprint: [...document.querySelectorAll('.footer-details .footer-impressum')].map(link => link.textContent.trim()),
      hint: document.querySelector('[data-xray-hint-text]')?.textContent,
    }));
    assert.deepEqual(otherFooter.smash, [{ text: 'smash', arrows: 0 }]);
    assert.deepEqual(otherFooter.imprint, ['impressum', 'impressum']);
    assert.equal(otherFooter.hint, 'press 3 three times to reverse.');
    await page.screenshot({ path: new URL(`../docs/validation/SMASH-OTHERSIDE/${width}.png`, import.meta.url).pathname });
    await page.locator('.footer-impressum').first().click();
    await page.waitForURL('**/impressum');
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'normal');
    const legal = await page.evaluate(() => ({
      page: document.documentElement.dataset.page,
      mode: document.documentElement.dataset.mode,
      text: document.querySelector('.legal-copy')?.textContent.replace(/\s+/g, ' ').trim(),
      smash: document.querySelectorAll('[data-smash]').length,
      back: document.querySelector('.legal-copy a')?.getAttribute('href'),
    }));
    assert.equal(legal.page, 'impressum');
    assert.equal(legal.mode, 'normal');
    assert.equal(legal.smash, 0);
    assert.equal(legal.back, '/');
    for (const marker of ['[VOLLNAME]', '[STRASSE+HAUSNUMMER]', '[PLZ+ORT]', '[E-MAIL]', '[UST-IDNR. ODER §19-HINWEIS]']) assert.ok(legal.text.includes(marker), marker);

    await page.goto(`${base}/creative/tattoo-01`, { waitUntil: 'networkidle' });
    await page.locator('[data-artwork-open]').first().click();
    await page.locator('dialog.artwork-dialog[open]').waitFor();
    await page.waitForFunction(() => /^\d{2}\/ \d{2}$/.test(document.querySelector('.artwork-viewer-count')?.textContent || ''));
    const viewer = await page.locator('.artwork-viewer-navigation').evaluate(element => {
      const buttons = [...element.querySelectorAll('button')]; buttons.forEach(button => { button.hidden = false; });
      const previous = element.querySelector('.artwork-previous').getBoundingClientRect();
      const count = element.querySelector('.artwork-viewer-count').getBoundingClientRect();
      const next = element.querySelector('.artwork-next').getBoundingClientRect();
      return { count: element.querySelector('.artwork-viewer-count').textContent.trim(), previous: previous.toJSON(), countBox: count.toJSON(), next: next.toJSON(),
        columns: getComputedStyle(element).gridTemplateColumns,
        disjoint: previous.right <= count.left && count.right <= next.left,
        targets: buttons.map(button => button.getBoundingClientRect()) };
    });
    assert.equal(viewer.count, '01/ 01');
    assert.equal(viewer.disjoint, true, JSON.stringify(viewer));
    assert.ok(viewer.targets.every(box => box.width >= 44 && box.height >= 44));

    report.profiles.push({ width, index, gapToken, categoryGaps, filterGap, crossGap, normalFooter, otherFooter, legal, viewer, errors });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

const request = await browser.newPage();
const redirectCases = [
  ['/work', '/creative'], ['/work?category=tools', '/creative/tools'], ['/work/tattoos', '/creative/tattoos'],
  ['/work/flashes', '/creative/flashes'], ['/work/jewellery', '/creative/jewellery'], ['/work/tools', '/creative/tools'],
  ['/work/tools/m4shlab', '/creative/tools/m4shlab'], ['/work/more', '/creative/more'],
  ['/work/analog-photography', '/creative/analog-photography'], ['/work/digital-artworks', '/creative/digital-artworks'],
  ['/work/tattoos/tattoo-01', '/creative/tattoo-01'], ['/work/paintings', '/creative/paintings'],
];
for (const [source, destination] of redirectCases) {
  const response = await request.request.get(`${base}${source}`, { maxRedirects: 0, failOnStatusCode: false });
  assert.equal(response.status(), 301, `${source} must be a permanent redirect.`);
  assert.equal(new URL(response.headers().location, base).pathname + new URL(response.headers().location, base).search, destination);
  report.redirects.push({ source, status: response.status(), destination: response.headers().location });
}
for (const path of ['/creative', '/creative/tattoos', '/creative/flashes', '/creative/jewellery', '/creative/tools', '/creative/tools/m4shlab', '/creative/tools/thr4ce', '/creative/more', '/creative/tattoo-01', '/creative/green-black-original', '/impressum']) {
  const response = await request.request.get(`${base}${path}`, { failOnStatusCode: false });
  assert.equal(response.status(), 200, `${path} must be a canonical 200.`);
}
for (const id of ['m4shlab', 'thr4ce']) {
  await request.goto(`${base}/creative/tools/${id}`, { waitUntil: 'networkidle' });
  const shots = request.locator('.tool-shot img'); await shots.last().scrollIntoViewIfNeeded();
  await request.waitForFunction(() => [...document.querySelectorAll('.tool-shot img')].every(image => image.complete && image.naturalWidth > 0));
  const tool = await request.evaluate(() => ({
    title: document.querySelector('.tool-headline')?.textContent.trim(),
    images: [...document.querySelectorAll('.tool-shot img')].map(image => ({ src: image.getAttribute('src'), naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, width: Number(image.getAttribute('width')), height: Number(image.getAttribute('height')) })),
    cta: document.querySelector('.tool-external-cta')?.getAttribute('href'),
    pwa: document.querySelector('.tool-mobile')?.textContent.replace(/\s+/g, ' ').trim(),
    filters: [...document.querySelectorAll('.work-filters a')].map(link => link.textContent.trim()),
    activeFilter: document.querySelector('.work-filters [aria-current="page"]')?.textContent.trim(),
    breadcrumbs: document.querySelectorAll('.breadcrumbs').length,
    facts: document.querySelectorAll('.tool-facts').length,
    video: document.querySelector('.tool-video-slot')?.textContent.trim(),
    pageWidth: document.documentElement.scrollWidth,
    innerWidth,
  }));
  assert.equal(tool.images.length, 3); assert.ok(tool.images.every(image => image.width === 1440 && image.height === 900 && image.naturalWidth > 0 && Math.abs(image.naturalWidth / image.naturalHeight - 1.6) < .01));
  assert.ok(tool.cta.startsWith('https://'));
  assert.match(tool.pwa, /share → add to home screen/i); assert.match(tool.pwa, /⋮ → install/);
  assert.deepEqual(tool.filters, ['tattoos', 'jewellery', 'tools', 'more'], 'Tool pages keep the shared sub-rubric row.');
  assert.equal(tool.activeFilter, 'tools');
  assert.equal(tool.breadcrumbs, 0, 'Tool pages carry no breadcrumb.');
  assert.equal(tool.facts, 0, 'The closing facts strip is retired.');
  assert.match(tool.video, /no video has been supplied/);
  assert.ok(tool.pageWidth <= tool.innerWidth + 1);
  report.tools.push({ id, ...tool });
}
const html = await readFile(new URL('../dist/creative/index.html', import.meta.url), 'utf8');
assert.doesNotMatch(html, /href="\/work(?:\/|[?"])/);
const sitemap = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../dist/route-manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.routes.length, 23);
await request.close();
await mkdir(new URL('../docs/validation/R3B-URLS/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/validation/R3B-URLS/results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
await writeFile(new URL('../docs/validation/R4-HINTS/results.json', import.meta.url), JSON.stringify({ build: report.build,
  profiles: report.profiles.map(({ width, normalFooter, otherFooter }) => ({ width, normalFooter, otherFooter })), passed: true }, null, 2) + '\n');
await writeFile(new URL('../docs/validation/IMPRESSUM-DUAL/results.json', import.meta.url), JSON.stringify({ build: report.build,
  profiles: report.profiles.map(({ width, normalFooter, otherFooter, legal }) => ({ width, normalFooter, otherFooter, legal })), passed: true }, null, 2) + '\n');
await writeFile(new URL('../docs/validation/R3B-URLS/ARTWORK-NAVI.json', import.meta.url), JSON.stringify({ build: report.build,
  profiles: report.profiles.map(({ width, viewer }) => ({ width, viewer })), passed: true }, null, 2) + '\n');
report.passed = true;
console.log(`PASS V3.2 structure ${report.build}: INDEX 00–03, 8+8 placeholders, mode-only SMASH, dual imprint, 12×301, 23 routes, /creative tool pages, gaps and NN/ NN viewer.`);
await browser.close();
