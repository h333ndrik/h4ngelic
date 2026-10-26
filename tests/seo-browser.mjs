import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.H4_PREVIEW_URL || 'http://127.0.0.1:4173';
const production = process.env.H4_EXPECT_DEPLOYMENT === 'production';
const origin = process.env.H4_CANONICAL_ORIGIN || 'https://h4ngelic.com';
const archiveIDs = ['tattoos', 'flashes', 'jewellery', 'more', 'analog-photography', 'digital-artworks', 'paintings'];
const originalPath = '/work/digital-artworks/green-black-original';
const paths = ['/', '/work', ...archiveIDs.map(id => `/work/${id}`), '/about', originalPath];
const route = (path) => new URL(path, baseURL).href;

for (const category of archiveIDs) {
  const response = await fetch(route(`/work?category=${category}`), { redirect: 'manual' });
  assert.equal(response.status, 301, 'Existing category-query bookmarks must redirect permanently to the canonical route.');
  assert.equal(new URL(response.headers.get('location'), baseURL).pathname, `/work/${category}`);
}
const missing = await fetch(route('/missing-page-for-seo-test'));
assert.equal(missing.status, 404, 'Unknown page paths must return an actual HTTP 404.');
const missingHTML = await missing.text();
assert.match(missingHTML, /page not found/i);
assert.match(missingHTML, /noindex/);
const asset = await fetch(route('/assets/missing-artwork-for-seo-test.webp'));
assert.equal(asset.status, 404);
const assetError = await asset.text();
assert.doesNotMatch(assetError, /data-prerendered="\/"/, 'A missing asset cannot be replaced with the homepage HTML shell.');
const sitemap = await fetch(route('/sitemap.xml'));
assert.equal(sitemap.status, 200);
assert.match(sitemap.headers.get('content-type'), /xml/);
const sitemapXML = await sitemap.text();
assert.match(sitemapXML, /<urlset\b/);
const locations = [...sitemapXML.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.deepEqual(locations.sort(), production ? [`${origin}/`, `${origin}/about`].sort() : [], 'Only canonical, indexable published pages belong in the sitemap; empty archives and previews are excluded.');
const robots = await fetch(route('/robots.txt'));
assert.equal(robots.status, 200);
const robotsText = await robots.text();
if (production) {
  assert.doesNotMatch(robotsText, /User-agent:\s*GPTBot/i, 'The new configuration must not add a training-crawler policy.');
  assert.match(robotsText, new RegExp(`Sitemap:\\s*${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap\\.xml`));
} else {
  assert.match(robotsText, /Disallow:\s*\/(?:\s|$)/);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const titles = [];
  const descriptions = [];
  for (const path of paths) {
    const response = await page.goto(route(path), { waitUntil: 'load' });
    assert.equal(response.status(), 200, `${path} must have a working direct HTML response.`);
    if (!production) assert.match(response.headers()['x-robots-tag'] || '', /noindex/);
    const metadata = await page.evaluate(() => {
      const meta = (name) => document.querySelector(`meta[name="${name}"],meta[property="${name}"]`)?.content || '';
      const data = JSON.parse(document.getElementById('structured-data')?.textContent || '{}');
      return {
        title: document.title,
        description: meta('description'),
        canonical: document.querySelector('link[rel="canonical"]')?.href,
        robots: meta('robots'),
        ogTitle: meta('og:title'), ogDescription: meta('og:description'), ogURL: meta('og:url'),
        data: Array.isArray(data) ? data : data['@graph'] || [data],
        rendered: document.getElementById('page-content')?.dataset.prerendered,
        text: document.getElementById('page-content')?.textContent,
      };
    });
    titles.push(metadata.title);
    // The original has no artist-supplied description yet. Its noindex detail
    // deliberately reuses truthful category copy instead of inventing text.
    if (path !== originalPath) descriptions.push(metadata.description);
    assert.ok(metadata.title.length > 10);
    assert.ok(metadata.description.length > 25);
    assert.equal(metadata.canonical, `${origin}${path}`);
    assert.equal(metadata.ogTitle, metadata.title);
    assert.equal(metadata.ogDescription, metadata.description);
    assert.equal(metadata.ogURL, metadata.canonical);
    assert.equal(metadata.rendered, path, 'The response must contain its route-specific prerendered content.');
    const shouldIndex = production && (path === '/' || path === '/about');
    assert.match(metadata.robots, shouldIndex ? /^index,\s*follow$/ : /^noindex,\s*follow$/);
    const person = metadata.data.find((node) => [node['@type']].flat().includes('Person'));
    assert.ok(person, 'The artist identity must be readable in structured data.');
    assert.equal(person.name, 'h333ndrik');
    assert.ok([person.alternateName].flat().includes('h4ngelic'));
    assert.equal(await page.locator('main').count(), 1);
    assert.ok((await page.locator('h1').count()) >= 1);
    if (path === '/') {
      assert.equal(await page.locator('.hero').count(), 1);
      assert.equal(await page.locator('#selected-work .category-link[href="/work/tattoos"]').count(), 1);
      assert.deepEqual(await page.locator('#selected-work .category-link').allTextContents(), ['tattoos', 'jewellery', 'more']);
      for (const child of ['tattoos', 'flashes', 'analog-photography', 'digital-artworks']) {
        assert.equal(await page.locator(`#selected-work .category-sublinks a[href="/work/${child}"]`).count(), 1);
      }
      assert.match(metadata.text, /selected works?/i);
      assert.equal(await page.locator('.fallback').isVisible(), true, 'The no-JS homepage retains the accessible static wordmark.');
    } else {
      assert.equal(await page.locator('.hero').count(), 0, 'Interior HTML must not expose a competing hero or download its font/scene.');
      if (path === originalPath) {
        assert.equal(await page.locator('.artwork-detail .project-image img').count(), 1);
        assert.equal(await page.locator('.work-filters').count(), 0);
        assert.equal(await page.locator('.artwork-detail img').getAttribute('width'), '1440');
        assert.equal(await page.locator('.artwork-detail img').getAttribute('height'), '1920');
        assert.match(await page.locator('.artwork-detail img').getAttribute('src'), /green-black-original/);
        assert.ok(metadata.data.some(node => node['@type'] === 'VisualArtwork'), 'The supplied image has genuine artwork structured data.');
      } else if (path.startsWith('/work')) {
        const category = path.split('/')[2] || 'all';
        const containsOriginal = ['all', 'more', 'digital-artworks'].includes(category);
        const expectedEmpty = category === 'all' ? 4 : category === 'digital-artworks' ? 0 : 1;
        assert.deepEqual(await page.locator('.archive-empty').allTextContents(), Array(expectedEmpty).fill('archive in progress.'));
        assert.equal(await page.locator('.portfolio-archive img').count(), containsOriginal ? 1 : 0,
          'Only the genuinely supplied original appears in prerendered archives.');
        assert.equal(await page.locator('.project-image').count(), 0, 'Empty categories must not invent gallery entries.');
        if (containsOriginal) {
          assert.match(await page.locator('.digital-ink-open img').getAttribute('src'), /green-black-original/);
          assert.equal(await page.locator('.digital-ink-open img').getAttribute('width'), '1440');
          assert.equal(await page.locator('.digital-ink-open img').getAttribute('height'), '1920');
          assert.equal(await page.locator('.digital-ink-open img').isVisible(), true,
            'Without JavaScript, the actual original stays visible and needs no reveal interaction.');
        }
        assert.equal((await page.locator('.filter-link[aria-current="page"]').textContent()).trim(), category.replaceAll('-', ' '));
      } else {
        assert.match(metadata.text, /h333ndrik/);
        assert.match(metadata.text, /berlin/);
      }
    }
  }
  assert.equal(new Set(titles).size, paths.length, 'Every canonical page needs its own title.');
  assert.equal(new Set(descriptions).size, paths.length - 1, 'Every archive, Home and About keeps its own useful description.');
  await context.close();
  console.log(`PASS SEO HTTP/no-JS (${production ? 'production' : 'preview'}): ${paths.length} semantic direct routes, unique metadata, confirmed canonicals, structured artist identity, legacy redirects, strict 404s, sitemap and robots.`);

  const live = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const path of ['/work/tattoos', '/work/more', '/work/digital-artworks', originalPath, '/about']) {
    const livePage = await live.newPage();
    const errors = [];
    const requests = [];
    livePage.on('pageerror', (error) => errors.push(error.message));
    livePage.on('request', (request) => requests.push(request.url()));
    await livePage.goto(route(path), { waitUntil: 'networkidle' });
    assert.deepEqual(errors, []);
    assert.ok(!requests.some((url) => /\/main-[^/]+\.js|wordmark\.typeface|tattoo-texture|LiberationSans-Bold/.test(url)), 'Direct Work/About cannot download the 3D scene, font or reflection texture.');
    const expected = path === originalPath ? 'artwork' : path.startsWith('/work') ? 'work' : 'about';
    assert.equal(await livePage.locator('html').getAttribute('data-page'), expected);
    await livePage.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(errors, []);
    await livePage.close();
  }
  await live.close();
  console.log('PASS SEO live interiors: direct/refresh routes work without Three.js scene, font or reflection requests.');
} finally {
  await browser.close();
}
