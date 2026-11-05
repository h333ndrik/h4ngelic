import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { routeDefinitions } from '../src/routes.js';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../docs/validation/STRUCT/contracts/', import.meta.url);
await mkdir(output, { recursive: true });
const [styleCSS, pagesSource, footerSource] = await Promise.all([
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/footer.js', import.meta.url), 'utf8'),
]);
assert.equal((styleCSS.match(/^\.arrow\s*\{/gm) || []).length, 1, 'The shared arrow CSS block must have one source.');
assert.doesNotMatch(pagesSource, /↗/, 'pages.js must not duplicate the outbound glyph as text.');
assert.doesNotMatch(footerSource, /↗/, 'footer.js must not duplicate the outbound glyph as text.');

const paths = ['/', '/about', '/creative', '/creative/tools/m4shlab', '/creative/green-black-original'];
const knownPaths = new Set(routeDefinitions().map(route => route.canonicalPath));
const externalTargets = new Set([
  'https://www.instagram.com/h4ngelic/',
  'https://github.com/h333ndrik/m4shlab',
  'https://h333ndrik.github.io/thr4ce',
]);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, build: '', pages: [], arrowSource: null, failures: [] };
const save = () => writeFile(new URL('links.json', output), JSON.stringify(report, null, 2) + '\n');

const noArrowSurfaces = new Set(['skip', 'brand', 'naavi', 'index', 'filter', 'breadcrumb', 'archive-heading', 'project-action', 'footer-legal']);

function expectedArrow(link) {
  if (noArrowSurfaces.has(link.surface)) return 0;
  if (link.surface === 'group-heading') return link.text === 'tattoos' ? 1 : 0;
  if (link.href === '#page-content') return 0;
  return 1;
}

async function frame(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
}

/** Native strategy: the effective cursor belongs to the top painted element. */
async function cursorAt(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const stack = document.elementsFromPoint(x, y);
    const top = stack.find(element => getComputedStyle(element).pointerEvents !== 'none') || document.documentElement;
    return { cursor: getComputedStyle(top).cursor, tag: top.tagName,
      className: String(top.className?.baseVal ?? top.className ?? '') };
  }, { x, y });
}

function assertNativeCursor(sample, label) {
  assert.match(sample.cursor, /h4ngelic-cursor\.svg["']?\)\s+8\s+2/,
    `${label} must expose the native h4 cursor: ${JSON.stringify(sample)}`);
}

async function verifyLinkAt(page, index, label) {
  const locator = page.locator('a[href]').nth(index);
  await locator.scrollIntoViewIfNeeded();
  await frame(page);
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (!box || box.x + box.width <= 0 || box.y + box.height <= 0
    || box.x >= viewport.width || box.y >= viewport.height) return null;
  const x = Math.max(1, Math.min(viewport.width - 1, box.x + box.width / 2));
  const y = Math.max(1, Math.min(viewport.height - 1, box.y + box.height / 2));
  await page.mouse.move(x, y);
  await frame(page);
  const result = await locator.evaluate((element, { x, y }) => {
    const arrow = element.querySelector('.arrow');
    const style = getComputedStyle(element);
    return { cursor: style.cursor, pointerEvents: style.pointerEvents, arrowClass: arrow?.className || '',
      arrowHidden: arrow?.getAttribute('aria-hidden') || '', x, y };
  }, { x, y });
  assert.match(result.cursor, /h4ngelic-cursor\.svg["']?\)\s+8\s+2/, `${label} must keep the native h4 cursor.`);
  // B-F18: rubric links constrain the hit area to the visible label; the link is
  // still pointer-active through its .interaction-visual child.
  if (result.pointerEvents === 'none') {
    const labelActive = await page.evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y);
      return Boolean(hit?.closest('a[href]'));
    }, { x, y });
    assert.ok(labelActive, `${label} must be pointer-active through its visible label.`);
  }
  if (result.arrowClass) {
    assert.equal(result.arrowClass, 'arrow', `${label} must use the shared .arrow glyph source.`);
    assert.equal(result.arrowHidden, 'true', `${label} arrow must be decorative for assistive technology.`);
  }
  const overlay = await cursorAt(page, x, y);
  assertNativeCursor(overlay, label);
  return { ...result, overlay };
}

async function pageLinks(page) {
  return page.locator('a[href]').evaluateAll(elements => elements.map((element, index) => {
    const surface = element.matches('.skip-link') ? 'skip'
      : element.matches('.floating-brand') ? 'brand'
        : element.matches('[data-naavi]') ? 'naavi'
          : element.closest('[data-global-index]') ? 'index'
            : element.closest('.work-filters') ? 'filter'
              : element.closest('.breadcrumbs') ? 'breadcrumb'
                : element.closest('.work-group-heading') ? 'group-heading'
                  : element.closest('.archive-category-heading') ? 'archive-heading'
                  : element.closest('.artwork-page .project-meta') ? 'project-action'
                    : element.matches('.footer-moshlab, .footer-instagram, .footer-smash') ? 'footer-link'
                        : element.matches('.category-link') ? 'category'
                          : element.matches('.tool-card-link') ? 'tool-card'
                            : element.matches('.tool-card-external, .tool-external-cta') ? 'tool-cta' : 'internal';
    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
    const arrow = element.querySelector('.arrow');
    const arrowStyle = arrow ? getComputedStyle(arrow, '::before') : null;
    return { index, text: element.textContent.trim().replace(/\s+/g, ' '), href: element.getAttribute('href'),
      resolvedHref: element.href, target: element.target, rel: element.rel, className: String(element.className || ''),
      arrows: element.querySelectorAll(':scope > .arrow, :scope * > .arrow').length,
      surface, visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
      arrowSource: arrow ? { border: arrowStyle.borderTopWidth, content: arrowStyle.content,
        transform: arrowStyle.transform } : null };
  }));
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({ count: 5, lastSeen: Date.now() }));
    localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .2 }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const arrowStyles = [];
  try {
    for (const path of paths) {
      console.log(`CHECK link glyph contract ${path}`);
      await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      report.build ||= await page.locator('html').getAttribute('data-build');
      const links = await pageLinks(page);
      for (const link of links.filter(entry => entry.visible && entry.text)) {
        assert.equal(link.arrows, expectedArrow(link),
          `${path} ${link.surface} link ${JSON.stringify(link.text)} has the wrong arrow count.`);
        const url = new URL(link.resolvedHref, base);
        if (url.origin !== new URL(base).origin) {
          assert.equal(link.target, '_blank', `${path} external link ${url.href} must open in a new tab.`);
          assert.match(link.rel, /\bnoopener\b/, `${path} external link ${url.href} needs rel=noopener.`);
          assert.match(link.rel, /\bnoreferrer\b/, `${path} external link ${url.href} needs rel=noreferrer.`);
          assert.ok(externalTargets.has(link.resolvedHref), `${path} has an unapproved external destination: ${link.resolvedHref}`);
        } else if (link.href === '#') {
          assert.ok(link.className.includes('footer-moshlab'), `${path} only the explicit moshlab placeholder may use #.`);
        } else if (link.href.startsWith('#')) {
          assert.equal(link.href, '#page-content', `${path} only the skip link may use a same-document hash.`);
        } else {
          assert.ok(knownPaths.has(url.pathname), `${path} internal link is not a published route: ${url.pathname}`);
        }
        if (link.arrowSource) arrowStyles.push(link.arrowSource);
      }

      const checked = [];
      for (const link of links.filter(entry => entry.visible && entry.text)) {
        const sample = await verifyLinkAt(page, link.index, `${path} ${link.surface} ${JSON.stringify(link.text)}`);
        if (sample) checked.push({ text: link.text, href: link.href, surface: link.surface, cursor: sample.cursor, overlay: sample.overlay });
      }
      assert.ok(checked.length > 0, `${path} must expose visible text links.`);

      if (path === '/creative') {
        const filters = links.filter(link => link.surface === 'filter');
        assert.deepEqual(filters.map(link => link.text), ['tattoos', 'jewellery', 'tools', 'more']);
        assert.deepEqual(filters.map(link => link.href), ['/creative/tattoos', '/creative/jewellery', '/creative/tools', '/creative/more']);
        assert.ok(filters.every(link => link.arrows === 0), 'Filter links never use the outbound arrow.');
      }
      if (path === '/about') {
        const contact = links.find(link => /^get in touch/.test(link.text));
        assert.ok(contact, 'About must expose get in touch.');
        assert.equal(contact.href, '/#contact');
        assert.equal(contact.arrows, 1);
      }
      if (path === '/creative/tools/m4shlab') {
        const cta = links.find(link => link.surface === 'tool-cta');
        assert.deepEqual({ text: cta.text, href: cta.href, target: cta.target, rel: cta.rel, arrows: cta.arrows },
          { text: 'open m4shlab', href: 'https://github.com/h333ndrik/m4shlab', target: '_blank', rel: 'noopener noreferrer', arrows: 1 });
      }

      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      const indexDetails = page.locator('[data-global-index]');
      if (!await indexDetails.evaluate(element => element.open)) await indexDetails.locator('summary').click();
      await page.waitForFunction(() => document.querySelector('[data-global-index]')?.open === true);
      const indexLinks = page.locator('[data-global-index] a[href]');
      assert.ok(await indexLinks.count() >= 3, 'The INDEX exposes its internal links.');
      const indexAudit = [];
      for (let index = 0; index < await indexLinks.count(); index += 1) {
        const link = indexLinks.nth(index);
        assert.equal(await link.locator('.arrow').count(), 0, 'INDEX links never use the outbound arrow.');
        const box = await link.boundingBox();
        assert.ok(box, 'Every open INDEX link must have a painted box.');
        const sample = await verifyLinkAt(page, await link.evaluate(element => [...document.querySelectorAll('a[href]')].indexOf(element)),
          `${path} INDEX ${await link.textContent()}`);
        indexAudit.push({ text: (await link.textContent()).trim().replace(/\s+/g, ' '), href: await link.getAttribute('href'), sample });
      }
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []);
      report.pages.push({ path, build: report.build, links: links.filter(link => link.visible && link.text), checked, indexAudit, errors });
      await save();
      console.log(`PASS links ${path}: ${checked.length} visible text links use the approved glyph matrix and the native h4 cursor.`);
    }
    assert.ok(arrowStyles.length > 0, 'The shared arrow source must be exercised.');
    const signatures = new Set(arrowStyles.map(style => JSON.stringify(style)));
    assert.equal(signatures.size, 1, `All arrow glyphs must share one rendered source: ${JSON.stringify([...signatures])}`);
    report.arrowSource = arrowStyles[0];
    console.log(`PASS link glyph contract: ${report.pages.reduce((total, entry) => total + entry.checked.length, 0)} link hover checks, one .arrow source, no foreign destinations.`);
  } finally { await context.close(); }
} catch (error) {
  report.failures.push({ error: error.stack });
  throw error;
} finally {
  await save();
  await browser.close();
}
