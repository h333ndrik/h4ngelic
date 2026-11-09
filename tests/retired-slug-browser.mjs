import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const output = new URL('../docs/validation/GATEPREP/BATCH-3/gallery/', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
await mkdir(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), base, build: '', redirects: [], pages: [], dist: {}, failures: [] };

async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) files.push(...await collect(child));
    else files.push(child);
  }
  return files;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [source, destination] of [
    ['/creative/onskin', '/creative/tattoos'],
    ['/creative/onskin/', '/creative/tattoos'],
    ['/creative/onskin/tattoo-01', '/creative/tattoo-01'],
    ['/creative?category=onskin', '/creative/tattoos'],
    ['/work/onskin', '/creative/tattoos'],
    ['/work?category=onskin', '/creative/tattoos'],
  ]) {
    const response = await fetch(new URL(source, base).href, { redirect: 'manual' });
    assert.equal(response.status, 301, `${source} must permanently redirect.`);
    const location = new URL(response.headers.get('location'), base);
    assert.equal(location.pathname, destination, `${source} must land on ${destination}.`);
    if (source === '/creative?category=onskin') assert.equal(location.search, '');
    report.redirects.push({ source, status: response.status, destination: `${location.pathname}${location.search}` });
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
  report.build = await page.locator('html').getAttribute('data-build');
  const work = await page.evaluate(() => ({
    url: location.pathname,
    heading: document.querySelector('.work-page .page-heading')?.textContent.trim(),
    filter: document.querySelector('.work-filters [aria-current="page"]')?.textContent.trim(),
    filterHrefs: [...document.querySelectorAll('.work-filters a')].map(link => link.getAttribute('href')),
    cross: [...document.querySelectorAll('.rubric-cross-links a')].map(link => link.textContent.trim()),
    childHeadings: [...document.querySelectorAll('.archive-category-heading')].map(node => node.textContent.trim()).slice(0, 4),
    naavi: document.querySelector('[data-naavi]').getAttribute('aria-label'),
    freshVisit: !document.referrer,
  }));
  assert.equal(work.heading, 'tattoos', 'The rubric page heading follows the label rename.');
  assert.equal(work.filter, 'tattoos', 'The active filter reads tattoos.');
  assert.deepEqual(work.filterHrefs, ['/creative/tattoos', '/creative/jewellery', '/creative/tools', '/creative/more']);
  assert.ok(work.childHeadings.every(text => text !== 'on skin'), `Archive headings must use the label: ${work.childHeadings}`);
  assert.match(work.naavi, /creative \/ tattoos/);
  await page.screenshot({ path: new URL('retired-slug-work-1440.png', output).pathname });

  await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  const home = await page.evaluate(() => ({
    links: [...document.querySelectorAll('#selected-work .category-link')].map(link => ({
      text: link.textContent.trim(), href: link.getAttribute('href') })),
    title: document.title,
  }));
  assert.deepEqual(home.links.map(link => link.text), ['tattoos', 'jewellery', 'tools', 'more']);
  assert.deepEqual(home.links.map(link => link.href),
    ['/creative/tattoos', '/creative/jewellery', '/creative/tools', '/creative/more']);
  report.pages.push({ work, home: home.links });

  // Deep link keeps the visible URL after the redirect (no double hop).
  const deep = await page.goto(new URL('/creative/onskin/tattoo-01', base).href, { waitUntil: 'networkidle' });
  assert.equal(deep.status(), 200);
  assert.equal(new URL(page.url()).pathname, '/creative/tattoo-01');
  report.deepLink = { status: deep.status(), final: new URL(page.url()).pathname };

  assert.deepEqual(errors, []);
  await context.close();

  // dist: the retired slug may survive only as the redirect map, never as a
  // rendered link, heading, filter or prerendered document.
  const files = await collect(dist);
  const html = files.filter(file => file.pathname.endsWith('.html'));
  const js = files.filter(file => file.pathname.endsWith('.js'));
  const htmlHits = [];
  for (const file of html) if ((await readFile(file, 'utf8')).includes('onskin')) htmlHits.push(file.pathname);
  const jsHits = [];
  for (const file of js) {
    const text = await readFile(file, 'utf8');
    const matches = text.match(/onskin/g) || [];
    if (matches.length) jsHits.push({ file: file.pathname, count: matches.length });
  }
  assert.deepEqual(htmlHits, [], `Prerendered HTML still mentions onskin: ${htmlHits}`);
  assert.equal(jsHits.length, 1, `Only the redirect map may mention onskin: ${JSON.stringify(jsHits)}`);
  const map = await readFile(jsHits[0].file, 'utf8');
  assert.match(map, /onskin\s*:\s*[`'"]tattoos[`'"]/, 'The surviving mention is the redirect map.');
  report.dist = { files: files.length, htmlHits, jsHits };
  report.passed = true;
  console.log(`PASS retired slug ${report.build}: 6 redirects, tattoos labels, 0 onskin in HTML, 1 redirect map in JS.`);
} catch (error) {
  report.failures.push({ error: error.stack });
  throw error;
} finally {
  await writeFile(new URL('retired-slug.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
