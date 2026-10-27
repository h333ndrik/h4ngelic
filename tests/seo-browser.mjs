import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.H4_PREVIEW_URL || 'http://127.0.0.1:4173';
const production = process.env.H4_EXPECT_DEPLOYMENT === 'production';
const origin = process.env.H4_CANONICAL_ORIGIN || 'https://h4ngelic.com';
const archiveIDs = ['tattoos', 'flashes', 'jewellery', 'more', 'analog-photography', 'digital-artworks', 'paintings'];
const originalPath = '/work/digital-artworks/green-black-original';
const paths = ['/', '/work', ...archiveIDs.map(id => `/work/${id}`), '/about', '/contact', originalPath];
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
assert.deepEqual(locations.sort(), production ? [`${origin}/`, `${origin}/about`, `${origin}/contact`].sort() : [], 'Only canonical, indexable published pages belong in the sitemap; duplicate archive contexts, incomplete artwork and previews are excluded.');
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
    const archiveAlias = path.startsWith('/work/') && path !== originalPath;
    assert.equal(metadata.canonical, `${origin}${archiveAlias ? '/work' : path}`);
    assert.equal(metadata.ogTitle, metadata.title);
    assert.equal(metadata.ogDescription, metadata.description);
    assert.equal(metadata.ogURL, metadata.canonical);
    assert.equal(metadata.rendered, path, 'The response must contain its route-specific prerendered content.');
    const shouldIndex = production && ['/', '/about', '/contact'].includes(path);
    assert.match(metadata.robots, shouldIndex ? /^index,\s*follow$/ : /^noindex,\s*follow$/);
    const person = metadata.data.find((node) => [node['@type']].flat().includes('Person'));
    assert.ok(person, 'The artist identity must be readable in structured data.');
    assert.equal(person.name, 'Hendrik');
    assert.ok([person.alternateName].flat().includes('h4ngelic'));
    assert.deepEqual(person.sameAs, ['https://www.instagram.com/h4ngelic/']);
    assert.equal(await page.locator('main').count(), 1);
    assert.ok((await page.locator('h1').count()) >= 1);
    if (path === '/') {
      assert.equal(await page.locator('[data-global-index]').isVisible(), false,
        'The prerendered homepage has no INDEX even without JavaScript.');
      assert.equal(await page.locator('.hero').count(), 1);
      assert.equal(await page.locator('#selected-work .category-link[href="/work#tattoos"]').count(), 1);
      assert.deepEqual(await page.locator('#selected-work .category-link').allTextContents(), ['tattoos', 'jewellery', 'more']);
      assert.equal(await page.locator('#selected-work .category-sublinks').count(), 0);
      assert.equal(await page.locator('#contact [data-inquiry-form]').count(), 1);
      assert.match(metadata.text, /selected works?/i);
      assert.equal(await page.locator('.fallback').isVisible(), true, 'The no-JS homepage retains the accessible static wordmark.');
    } else {
      assert.equal(await page.locator('[data-global-index]').isVisible(), true,
        'Interior pages retain their native INDEX without JavaScript.');
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
        const expectedEmpty = category === 'paintings' ? 5 : 4;
        assert.deepEqual(await page.locator('.archive-empty').allTextContents(), Array(expectedEmpty).fill('archive in progress.'));
        assert.equal(await page.locator('.portfolio-archive img').count(), 1,
          'Connected Work retains the one genuine original in every category context.');
        assert.equal(await page.locator('.portfolio-archive .project-image').count(), 1, 'Only the supplied original has an image figure; empty categories do not invent artwork.');
        assert.deepEqual(await page.locator('[data-archive-category]').evaluateAll(nodes => nodes.map(node => node.dataset.archiveCategory)),
          ['tattoos', 'flashes', 'jewellery', 'analog-photography', 'digital-artworks', ...(category === 'paintings' ? ['paintings'] : [])]);
        assert.match(await page.locator('[data-archive-category="digital-artworks"] .project-image img').getAttribute('src'), /green-black-original/);
        assert.equal(await page.locator('[data-archive-category="digital-artworks"] .project-image img').getAttribute('width'), '1440');
        assert.equal(await page.locator('[data-archive-category="digital-artworks"] .project-image img').getAttribute('height'), '1920');
        assert.equal(await page.locator('[data-archive-category="digital-artworks"] .project-image img').isVisible(), true,
          'Without JavaScript, the actual original stays visible and needs no reveal interaction.');
        assert.deepEqual(await page.locator('.work-filters a').evaluateAll(links => links.map(link => link.getAttribute('href'))),
          ['/work', '/work#tattoos', '/work#jewellery', '/work#more']);
        assert.equal(await page.locator('.work-page .page-heading').innerText(), 'work');
        assert.equal(await page.locator('[data-connected-work]').getAttribute('data-work-context'), category);
      } else if (path === '/contact') {
        assert.equal(await page.locator('[data-inquiry-form]').count(), 1);
        assert.equal(await page.locator('input[name="name"][required]').count(), 1);
        assert.equal(await page.locator('input[name="email"][type="email"][required]').count(), 1);
        assert.equal(await page.locator('input[type="file"][multiple]').count(), 1);
        assert.match(metadata.text, /for tattoos, jewellery or other projects\./);
        assert.match(metadata.text, /h4ngelic@gmail\.com/);
        assert.ok(metadata.data.some(node => node['@type'] === 'ContactPage'));
      } else {
        assert.match(metadata.text, /hi, i'm hendrik\./);
        assert.match(metadata.text, /berlin/);
      }
    }
  }
  assert.equal(new Set(titles).size, paths.length, 'Every direct page/context needs its own useful title.');
  assert.equal(new Set(descriptions).size, paths.length - 1, 'Every archive, Home, About and Contact keeps its own useful description.');
  await context.close();
  console.log(`PASS SEO HTTP/no-JS (${production ? 'production' : 'preview'}): ${paths.length} semantic direct routes, unique metadata, confirmed canonicals, structured artist identity, legacy redirects, strict 404s, sitemap and robots.`);

  const live = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const path of ['/work/tattoos', '/work/more', '/work/digital-artworks', originalPath, '/about', '/contact']) {
    const livePage = await live.newPage();
    const errors = [];
    const requests = [];
    livePage.on('pageerror', (error) => errors.push(error.message));
    livePage.on('request', (request) => requests.push(request.url()));
    await livePage.goto(route(path), { waitUntil: 'networkidle' });
    assert.deepEqual(errors, []);
    assert.ok(!requests.some((url) => /\/main-[^/]+\.js|wordmark\.typeface|tattoo-texture|LiberationSans-Bold/.test(url)), 'Direct Work/About/Contact cannot download the 3D scene, font or reflection texture.');
    const expected = path === originalPath ? 'artwork' : path.startsWith('/work') ? 'work' : path.slice(1);
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
