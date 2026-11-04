import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55200';
const output = new URL(`../${process.env.H4_TOOLS_ARTIFACTS || 'artifacts/release/TOOLS-RUBRIC'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const expected = [
  { id: 'm4shlab', href: 'https://github.com/h333ndrik/m4shlab',
    teaser: 'real h.264 bitstream moshing in the browser. up to 12 clips, five boundary methods, your footage never leaves the device.' },
  { id: 'thr4ce', href: 'https://h333ndrik.github.io/thr4ce',
    teaser: 'image & stencil editor. black ink or no ink — deterministic morphology brush, print-exact export.' },
];
const report = { checkedAt: new Date().toISOString(), base, profiles: [], passed: false };

try {
  const redirect = await fetch(`${base}/creative?category=tools`, { redirect: 'manual' });
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('location'), '/creative/tools');

  for (const width of [1440, 390, 320]) {
    console.log(`CHECK tools rubric ${width}px`);
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'no-preference' });
    const page = await context.newPage(); const errors = [];
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      await page.locator('#selected-work').waitFor();
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true'
        && /^\d/.test(getComputedStyle(document.documentElement).getPropertyValue('--slash-inset').trim()));
      const home = await page.evaluate(() => {
        const links = [...document.querySelectorAll('#selected-work .category-link')];
        const heading = document.querySelector('#selected-work-title .kinetic-heading-text');
        const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT); let node, slash;
        while ((node = walker.nextNode())) { const index = node.textContent.indexOf('/'); if (index >= 0) { const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1); slash = range.getBoundingClientRect().left; break; } }
        return { labels: links.map(link => link.textContent.trim()), sizes: links.map(link => getComputedStyle(link).fontSize),
          boxes: links.map(link => { const box = link.getBoundingClientRect(); const text = link.querySelector('.category-magnet > span').getBoundingClientRect(); return { left: box.left, top: box.top, right: box.right, width: box.width, textLeft: text.left }; }),
          slash, pageWidth: document.documentElement.scrollWidth, innerWidth,
          columns: getComputedStyle(document.querySelector('.category-strip')).gridTemplateColumns,
          slashInset: getComputedStyle(document.documentElement).getPropertyValue('--slash-inset').trim() };
      });
      assert.deepEqual(home.labels, ['tattoos', 'jewellery', 'tools', 'more']);
      assert.equal(new Set(home.sizes).size, 1, 'All four frontpage labels share one font size.');
      assert.equal(home.pageWidth, home.innerWidth, 'The frontpage row never widens the document.');
      assert.ok(Math.abs(home.boxes[0].textLeft - home.slash) <= 2, `The first label starts on the slash column: ${JSON.stringify(home)}`);
      if (width > 600) {
        assert.ok(home.boxes.every(box => Math.abs(box.top - home.boxes[0].top) < 2), 'Desktop keeps one horizontal row.');
        assert.equal(home.columns.trim().split(/\s+/).length, 4);
      } else {
        assert.ok(Math.abs(home.boxes[0].top - home.boxes[1].top) < 2 && Math.abs(home.boxes[2].top - home.boxes[3].top) < 2 && home.boxes[2].top > home.boxes[0].top);
        assert.ok(Math.abs(home.boxes[0].left - home.boxes[2].left) < 2 && Math.abs(home.boxes[1].left - home.boxes[3].left) < 2, 'Mobile forms an aligned 2x2 grid.');
        assert.ok(Math.abs(home.boxes[2].textLeft - home.slash) <= 2, 'The second mobile row starts on the same slash column.');
        assert.equal(home.columns.trim().split(/\s+/).length, 2);
      }
      await page.locator('#selected-work').scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: new URL(`frontpage-${width}.png`, output).pathname });

      await page.goto(`${base}/creative/tools`, { waitUntil: 'networkidle' });
      await page.locator('[data-connected-work][data-work-context="tools"]').waitFor();
      const tools = await page.evaluate(() => ({
        heading: document.querySelector('.work-page .page-heading').textContent.trim(),
        filters: [...document.querySelectorAll('.work-filters a')].map(link => ({ text: link.textContent.trim(), href: link.getAttribute('href'), current: link.getAttribute('aria-current') })),
        cards: [...document.querySelectorAll('[data-tool-entry]')].map(card => {
          const link = card.querySelector('.tool-card-link'), external = card.querySelector('.tool-card-external'), box = link.getBoundingClientRect(), style = getComputedStyle(card);
          return { id: card.dataset.toolEntry, title: card.querySelector('h3').textContent.replace(/\s+/g, ' ').trim(),
            href: link.getAttribute('href'), target: external.target, rel: external.rel, externalHref: external.href,
            teaser: card.querySelector('p').textContent.trim(), arrows: card.querySelectorAll('.arrow').length, radius: style.borderRadius,
            left: box.left, right: box.right, width: box.width, height: box.height };
        }),
        pageWidth: document.documentElement.scrollWidth, innerWidth,
        build: document.documentElement.dataset.build || '',
      }));
      assert.equal(tools.heading, 'tools');
      assert.deepEqual(tools.filters.map(item => item.text), ['tattoos', 'jewellery', 'tools', 'more']);
      assert.deepEqual(tools.filters.map(item => item.href), ['/creative/tattoos', '/creative/jewellery', '/creative/tools', '/creative/more']);
      assert.equal(tools.filters.find(item => item.current === 'page').href, '/creative/tools');
      assert.deepEqual(tools.cards.map(card => ({ id: card.id, href: card.href, externalHref: card.externalHref, target: card.target, teaser: card.teaser })), expected.map(card => ({
        id: card.id, href: `/creative/tools/${card.id}`, externalHref: card.href, target: '_blank', teaser: card.teaser })));
      assert.ok(tools.cards.every(card => card.arrows === 2 && card.radius === '4px' && card.width > 0 && card.height > 0 && card.rel === 'noopener noreferrer'));
      assert.equal(tools.pageWidth, tools.innerWidth);
      assert.match(tools.build, /^[a-f0-9]{7,40}$/i);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: new URL(`tools-${width}.png`, output).pathname });
      report.profiles.push({ width, home, tools, errors });
    } finally { await context.close(); }
  }
  report.passed = true;
  console.log('PASS tools rubric: redirect, internal detail cards with external CTAs, four filters, 4px cards and desktop/mobile slash-aligned row.');
} catch (error) {
  report.error = error.stack;
  throw error;
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
