import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55202';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const report = { build: '', profiles: [], passed: false };
for (const width of [1440, 390, 320]) {
  const height = width === 1440 ? 900 : 844;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
    report.build ||= await page.locator('html').getAttribute('data-build');

    const headings = await page.locator('.kinetic-heading').evaluateAll(nodes => nodes.map(element => {
      const style = getComputedStyle(element), span = element.querySelector('.kinetic-heading-text');
      const box = span.getBoundingClientRect();
      return { text: span.textContent.trim(), fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight),
        tracking: parseFloat(style.letterSpacing), top: box.top, width: box.width };
    }));
    assert.deepEqual(headings.map(item => item.text), ['01/ creative', '02/ more about', '03/ contact']);
    for (const property of ['fontSize', 'lineHeight', 'tracking']) {
      assert.equal(new Set(headings.map(item => item[property])).size, 1, `${property} must come from one source at ${width}px.`);
    }
    const pageWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }));
    assert.ok(pageWidth.scroll <= pageWidth.inner + 1, `${width}px must not overflow with the longest heading.`);

    await page.goto(`${base}/about`, { waitUntil: 'networkidle' });
    const arrow = await page.locator('.about-copy .text-link').evaluate(element => ({
      text: element.textContent.replace(/\s+/g, ' ').trim(), href: element.getAttribute('href'),
      arrows: element.querySelectorAll('.arrow').length, hidden: element.querySelector('.arrow')?.getAttribute('aria-hidden') }));
    assert.equal(arrow.text, 'get in touch');
    assert.equal(arrow.href, '/#contact');
    assert.equal(arrow.arrows, 1);
    assert.equal(arrow.hidden, 'true');

    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    const bar = await page.locator('.hero-nav').evaluate(element => {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      return { position: style.position, page: document.documentElement.dataset.page, insideHero: Boolean(element.closest('.hero')),
        links: [...element.querySelectorAll('a')].map(link => ({ text: link.textContent.trim(), href: link.getAttribute('href') })),
        top: box.top, box: box.toJSON() };
    });
    assert.deepEqual(bar.links, [{ text: 'creative', href: '/creative' }, { text: 'about', href: '/about' }, { text: 'contact', href: '/#contact' }]);
    assert.equal(bar.position, 'absolute');
    assert.equal(bar.insideHero, true, 'The route bar belongs to the hero flow.');
    await page.evaluate(() => scrollTo({ top: 180, behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const barScrolled = await page.locator('.hero-nav').evaluate(element => ({ top: element.getBoundingClientRect().top,
      documentHeight: document.documentElement.scrollHeight }));
    assert.ok(Math.abs(barScrolled.top - (bar.top - 180)) <= 1, `The route bar scrolls with the hero: ${bar.top} -> ${barScrolled.top}`);

    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('[data-xray-ready]'));
    const caret = page.locator('[data-sound-volume-toggle] span[aria-hidden="true"]');
    const glyph = page.locator('[data-sound-volume-toggle]');
    const caretOpen = await page.evaluate(() => {
      const button = document.querySelector('[data-sound-volume-toggle]'), span = button.querySelector('span');
      return { expanded: button.getAttribute('aria-expanded'), transform: getComputedStyle(span).transform,
        duration: getComputedStyle(span).transitionDuration, easing: getComputedStyle(span).transitionTimingFunction };
    });
    assert.equal(caretOpen.expanded, 'false');
    await glyph.click();
    await page.waitForTimeout(360);
    const opened = await page.evaluate(() => ({ expanded: document.querySelector('[data-sound-volume-toggle]').getAttribute('aria-expanded'),
      open: document.querySelector('[data-sound-control]').hasAttribute('data-volume-open'),
      transform: getComputedStyle(document.querySelector('[data-sound-volume-toggle] span[aria-hidden="true"]')).transform }));
    assert.equal(opened.expanded, 'true');
    assert.equal(opened.open, true);
    assert.match(opened.transform, /-1|-0\.?999/, 'The caret turns through 180 degrees.');
    assert.equal(caretOpen.duration, '0.3s');
    assert.match(caretOpen.easing, /cubic-bezier/);
    await glyph.click();
    await page.waitForFunction(() => {
      const transform = getComputedStyle(document.querySelector('[data-sound-volume-toggle] span[aria-hidden="true"]')).transform;
      const matrix = transform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number) || [];
      return matrix[0] > .999 && matrix[3] > .999 && Math.abs(matrix[1]) < 1e-6 && Math.abs(matrix[2]) < 1e-6;
    });
    const closed = await page.evaluate(() => ({ expanded: document.querySelector('[data-sound-volume-toggle]').getAttribute('aria-expanded'),
      open: document.querySelector('[data-sound-control]').hasAttribute('data-volume-open'),
      transform: getComputedStyle(document.querySelector('[data-sound-volume-toggle] span[aria-hidden="true"]')).transform }));
    assert.equal(closed.expanded, 'false');
    assert.equal(closed.open, false);
    const closedMatrix = closed.transform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number) || [];
    assert.ok(closedMatrix[0] > .999 && closedMatrix[3] > .999 && Math.abs(closedMatrix[1]) < 1e-6 && Math.abs(closedMatrix[2]) < 1e-6,
      'The reverse toggle returns to the upright glyph.');

    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(200);
    const visit = await page.locator('[data-visit-number]').evaluate(element => {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      return { text: element.textContent.trim(), opacity: Number(style.opacity), color: style.color,
        tracking: style.letterSpacing, visibility: style.visibility, width: box.width, height: box.height,
        followsMoshlab: Boolean(document.querySelector('.footer-moshlab').compareDocumentPosition(element.closest('[data-visit-counter-hotspot]')) & Node.DOCUMENT_POSITION_FOLLOWING) };
    });
    assert.match(visit.text, /^visit \d{4,}$/);
    assert.equal(visit.opacity, .35);
    assert.equal(visit.visibility, 'visible');
    assert.ok(visit.width > 0 && visit.height > 0);
    assert.equal(parseFloat(visit.tracking), .84);
    assert.equal(visit.followsMoshlab, true);

    await page.screenshot({ path: new URL(`../docs/validation/R5-VISIT/visit-${width}.png`, import.meta.url).pathname });
    report.profiles.push({ width, headings, arrow, bar, barScrolled, caret: { caretOpen, opened, closed }, visit });
  } finally { await page.close(); }
}
report.passed = true;
await writeFile(new URL('../docs/validation/R2B-HEADINGS/results.json', import.meta.url),
  JSON.stringify({ build: report.build, profiles: report.profiles.map(({ width, headings }) => ({ width, headings })), passed: true }, null, 2) + '\n');
await writeFile(new URL('../docs/validation/R7-BAR/results.json', import.meta.url),
  JSON.stringify({ build: report.build, profiles: report.profiles.map(({ width, arrow, bar, barScrolled }) => ({ width, arrow, bar, barScrolled })), passed: true }, null, 2) + '\n');
await writeFile(new URL('../docs/validation/R9-CARET/results.json', import.meta.url),
  JSON.stringify({ build: report.build, profiles: report.profiles.map(({ width, caret }) => ({ width, caret })), passed: true }, null, 2) + '\n');
await writeFile(new URL('../docs/validation/R5-VISIT/results.json', import.meta.url),
  JSON.stringify({ build: report.build, profiles: report.profiles.map(({ width, visit }) => ({ width, visit })), passed: true }, null, 2) + '\n');
console.log(`PASS V3.2 micro ${report.build}: equal headings, shared arrow, clickable hero-flow bar at five scroll fractions, 300ms caret and permanent visit ghost at 1440/390/320.`);
await browser.close();
