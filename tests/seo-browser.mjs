import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.H4_PREVIEW_URL || 'http://127.0.0.1:4173';
const production = process.env.H4_EXPECT_DEPLOYMENT === 'production';
const origin = process.env.H4_CANONICAL_ORIGIN || 'https://h4ngelic.com';
const archiveIDs = ['tattoos', 'flashes', 'jewellery', 'tools', 'more', 'analog-photography', 'digital-artworks', 'paintings'];
const archivePaths = archiveIDs.map(id => `/creative/${id}`);
const toolPaths = ['/creative/tools/m4shlab', '/creative/tools/thr4ce'];
const originalPath = '/creative/green-black-original';
const tattooPaths = Array.from({ length: 8 }, (_, index) => `/creative/tattoo-${String(index + 1).padStart(2, '0')}`);
const artworkPaths = [originalPath, ...tattooPaths];
const isArtwork = path => artworkPaths.includes(path);
const paths = ['/', '/creative', ...archivePaths, ...toolPaths, '/about', '/impressum', ...artworkPaths];
const route = (path) => new URL(path, baseURL).href;

const landing = await fetch(route('/creative'), { redirect: 'manual' });
assert.equal(landing.status, 200, 'The Creative archive remains a real canonical landing route.');
for (const [category, slug] of [['onskin', 'tattoos'], ['tattoos', 'tattoos'], ['flashes', 'flashes'], ['jewellery', 'jewellery'], ['tools', 'tools'], ['more', 'more'], ['analog-photography', 'analog-photography'], ['digital-artworks', 'digital-artworks'], ['paintings', 'paintings']]) {
  const response = await fetch(route(`/creative?category=${category}`), { redirect: 'manual' });
  assert.equal(response.status, 301, 'Existing category-query bookmarks must redirect permanently to the canonical route.');
  assert.equal(new URL(response.headers.get('location'), baseURL).pathname, `/creative/${slug}`);
}
for (const [source, destination] of [['/work', '/creative'], ['/work/tattoos', '/creative/tattoos'], ['/work/onskin', '/creative/tattoos'], ['/creative/onskin', '/creative/tattoos'], ['/work/tools/m4shlab', '/creative/tools/m4shlab']]) {
  const response = await fetch(route(source), { redirect: 'manual' });
  assert.equal(response.status, 301, `${source} must permanently redirect.`);
  assert.equal(new URL(response.headers.get('location'), baseURL).pathname, destination);
}
// Contact survives only as a compatibility redirect to the one Home form.
for (const [path, destination] of [
  ['/contact', '/#contact'],
  ['/contact?artwork=green-black-original', '/?artwork=green-black-original#contact'],
]) {
  const response = await fetch(route(path), { redirect: 'manual' });
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), destination);
}
const manifestResponse = await fetch(route('/route-manifest.json'));
assert.equal(manifestResponse.status, 200);
const manifest = await manifestResponse.json();
assert.equal(manifest.routes.some(entry => entry.path === '/contact'), false);
assert.equal(manifest.routes.length, 23, 'The build contains 23 real routes including Creative, tools and Impressum.');
assert.deepEqual(manifest.routes.map(entry => entry.path).sort(), [...paths].sort());
assert.deepEqual(manifest.routes.filter(entry => ['/', '/about'].includes(entry.path)).map(entry => entry.path), ['/', '/about']);
assert.equal(manifest.routes.some(entry => entry.path === '/creative'), true);
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
assert.deepEqual(locations.sort(), production ? [`${origin}/`, `${origin}/creative/tools`, ...toolPaths.map(path => `${origin}${path}`), `${origin}/about`].sort() : [], 'Only canonical, indexable published pages belong in the sitemap; duplicate archive contexts, incomplete artwork and previews are excluded.');
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
const report = { checkedAt: new Date().toISOString(), baseURL, production, staticRoutes: [], liveRoutes: [], passed: false };
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
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      };
    });
    titles.push(metadata.title);
    // Supplied images have no artist-authored titles/descriptions yet. Their
    // unique catalogue labels stay noindex and reuse truthful category copy.
    if (!isArtwork(path)) descriptions.push(metadata.description);
    assert.ok(metadata.title.length > 10);
    assert.equal(metadata.horizontalOverflow, 0, `${path} must fit the no-JS desktop viewport.`);
    assert.ok(metadata.description.length > 25);
    assert.equal(metadata.canonical, `${origin}${path}`);
    assert.equal(metadata.ogTitle, metadata.title);
    assert.equal(metadata.ogDescription, metadata.description);
    assert.equal(metadata.ogURL, metadata.canonical);
    assert.equal(metadata.rendered, path, 'The response must contain its route-specific prerendered content.');
    const shouldIndex = production && ['/', '/creative/tools', ...toolPaths, '/about'].includes(path);
    assert.match(metadata.robots, shouldIndex ? /^index,\s*follow$/ : /^noindex,\s*follow$/);
    const person = metadata.data.find((node) => [node['@type']].flat().includes('Person'));
    assert.ok(person, 'The artist identity must be readable in structured data.');
    assert.equal(person.name, 'Hendrik');
    assert.ok([person.alternateName].flat().includes('h4ngelic'));
    assert.deepEqual(person.sameAs, ['https://www.instagram.com/h4ngelic/']);
    assert.equal(await page.locator('main').count(), 1);
    assert.equal(await page.locator('[data-floating-brand]').count(), 1);
    assert.equal(await page.locator('[data-global-index] summary').isVisible(), true);
    assert.equal(await page.locator('#reveal-control').count(), 0);
    assert.deepEqual(await page.locator('[data-global-index] .index-number').allTextContents(), ['00/', '01/', '02/', '03/']);
    assert.equal(await page.locator('[data-visit-message]').count(), 1);
    assert.match(await page.locator('[data-visit-number]').textContent(), /^visit \d{4,}$/);
    if (path !== '/') assert.equal(await page.locator('[data-inquiry-form]').count(), 0, 'Only Home contains the contact form.');
    assert.ok((await page.locator('h1').count()) >= 1);
    if (path === '/') {
      assert.equal(await page.locator('[data-global-index]').count(), 1);
      assert.equal(await page.locator('[data-naavi]').isVisible(), true, 'The single NAAVI remains usable without JavaScript.');
      assert.equal(await page.locator('[data-naavi]').getAttribute('href'), '/#selected-work');
      assert.equal(await page.locator('.hero').count(), 1);
      assert.equal(await page.locator('#selected-work .category-link[href="/creative/tattoos"]').count(), 1);
      assert.deepEqual(await page.locator('#selected-work .category-link').allTextContents(), ['tattoos', 'jewellery', 'tools', 'more']);
      assert.equal(await page.locator('#selected-work .category-sublinks').count(), 0);
      assert.equal(await page.locator('#contact [data-inquiry-form]').count(), 1);
      assert.match(metadata.text, /01\/ creative/);
      assert.equal(await page.locator('.fallback').isVisible(), true, 'The no-JS homepage retains the accessible static wordmark.');
    } else {
      assert.equal(await page.locator('[data-global-index]').count(), 1);
      assert.equal(await page.locator('[data-naavi]').isVisible(), true, 'Every prerendered route retains shared NAAVI.');
      assert.equal(await page.locator('[data-naavi]').count(), 1);
      assert.equal(await page.locator('.hero').count(), 0, 'Interior HTML must not expose a competing hero or download its font/scene.');
      if (path === originalPath) {
        assert.equal(await page.locator('.artwork-detail .project-image img').count(), 1);
        assert.equal(await page.locator('.work-filters').count(), 0);
        assert.equal(await page.locator('.artwork-detail img').getAttribute('width'), '1440');
        assert.equal(await page.locator('.artwork-detail img').getAttribute('height'), '1920');
        assert.match(await page.locator('.artwork-detail img').getAttribute('src'), /green-black-original/);
        assert.ok(metadata.data.some(node => node['@type'] === 'VisualArtwork'), 'The supplied image has genuine artwork structured data.');
      } else if (tattooPaths.includes(path)) {
        const number = path.slice(-2);
        assert.equal(await page.locator('.artwork-detail img').count(), 1);
        assert.equal(await page.locator('.work-filters').count(), 0);
        assert.equal(await page.locator('.artwork-detail').getAttribute('data-artwork-category'), 'tattoos');
        assert.equal(await page.locator('.artwork-detail h1').innerText(), `tattoo ${number}`, 'The existing catalogue ID labels the untitled photograph without inventing an artwork title.');
        assert.equal(metadata.title, `tattoo ${number} — h4ngelic`);
        assert.match(await page.locator('.artwork-detail img').getAttribute('src'), new RegExp(`tattoo-${number}`));
        const dimensions = await page.locator('.artwork-detail img').evaluate(image => [Number(image.width), Number(image.height)]);
        assert.ok(dimensions.every(size => size > 0));
        const artwork = metadata.data.find(node => node['@type'] === 'VisualArtwork');
        assert.ok(artwork);
        assert.equal(artwork.name, `tattoo ${number}`);
        assert.equal(artwork.dateCreated, undefined, 'No creation year is inferred from the supplied photograph.');
      } else if (path.startsWith('/creative/tools/')) {
        const tool = path.split('/').at(-1);
        assert.match(metadata.text, new RegExp(`${tool} —`));
        assert.equal(await page.locator('.tool-shot img').count(), 3);
        assert.equal(await page.locator('.tool-external-cta').getAttribute('href'), tool === 'm4shlab' ? 'https://github.com/h333ndrik/m4shlab' : 'https://h333ndrik.github.io/thr4ce');
        assert.match(await page.locator('.tool-mobile').innerText(), /share → add to home screen/i);
      } else if (path === '/impressum') {
        assert.match(metadata.text, /ddg disclosure/);
        assert.match(metadata.text, /\[VOLLNAME\]/);
        assert.equal(await page.locator('[data-naavi]').count(), 1);
      } else if (path.startsWith('/creative')) {
        const slug = path.split('/')[2] || 'all';
        const category = slug;
        const expected = {
          all: ['tattoos', 'flashes', 'jewellery', 'digital-artworks', 'analog-photography'],
          tattoos: ['tattoos', 'flashes'], flashes: ['flashes'], jewellery: ['jewellery'], tools: [],
          more: ['digital-artworks', 'analog-photography'], 'digital-artworks': ['digital-artworks'],
          'analog-photography': ['analog-photography'], paintings: ['paintings'],
        }[category];
        assert.deepEqual(await page.locator('[data-archive-category]').evaluateAll(nodes => nodes.map(node => node.dataset.archiveCategory)), expected);
        const photos = expected.includes('tattoos') ? 8 : 0, digital = expected.includes('digital-artworks') ? 1 : 0;
        assert.equal(await page.locator('.portfolio-archive .project-image').count(), photos + digital);
        assert.equal(await page.locator('[data-horizontal-drift="tattoos"] [data-drift-item]').count(), photos);
        if (digital) {
          const original = page.locator('[data-archive-category="digital-artworks"] .project-image img');
          assert.match(await original.getAttribute('src'), /green-black-original/);
          assert.equal(await original.getAttribute('width'), '1440'); assert.equal(await original.getAttribute('height'), '1920');
          assert.equal(await original.isVisible(), true, 'Real Digital artwork is visible without an ink reveal.');
        }
        assert.deepEqual(await page.locator('.work-filters a').evaluateAll(links => links.map(link => link.getAttribute('href'))),
          ['/creative/tattoos', '/creative/jewellery', '/creative/tools', '/creative/more']);
        const label = ['tattoos', 'jewellery', 'tools', 'more'].includes(category)
          ? (category === 'tattoos' ? 'tattoos' : category) : category === 'all' ? '01/ creative' : category.replaceAll('-', ' ').toUpperCase();
        assert.equal(await page.locator('.work-page .page-heading').innerText(), label);
        assert.equal(await page.locator('[data-connected-work]').getAttribute('data-work-context'), category);
        if (category === 'tools') {
          const cards = await page.locator('[data-tool-entry]').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.toolEntry,
            href: node.querySelector('.tool-card-link')?.getAttribute('href'), external: node.querySelector('.tool-card-external')?.getAttribute('href'),
            teaser: node.querySelector('p')?.textContent, target: node.querySelector('.tool-card-external')?.target })));
          assert.deepEqual(cards.map(card => card.id), ['m4shlab', 'thr4ce']);
          assert.deepEqual(cards.map(card => card.href), ['/creative/tools/m4shlab', '/creative/tools/thr4ce']);
          assert.deepEqual(cards.map(card => card.external), ['https://github.com/h333ndrik/m4shlab', 'https://h333ndrik.github.io/thr4ce']);
          assert.ok(cards.every(card => card.target === '_blank' && card.teaser.length > 80));
        }
      } else {
        assert.match(metadata.text, /hi, i'm hendrik\./);
        assert.match(metadata.text, /berlin/);
      }
    }
    report.staticRoutes.push({ path, status: response.status(), width: 1440, title: metadata.title,
      canonical: metadata.canonical, robots: metadata.robots, horizontalOverflow: metadata.horizontalOverflow });
  }
  assert.equal(new Set(titles).size, paths.length, 'Every direct page/context needs its own useful title.');
  assert.equal(new Set(descriptions).size, paths.length - artworkPaths.length, 'Every archive, Home and About keeps its own useful description; untitled photographs retain category copy.');
  await context.close();
  console.log(`PASS SEO HTTP/no-JS (${production ? 'production' : 'preview'}): ${paths.length} semantic direct routes, unique metadata, confirmed canonicals, structured artist identity, legacy redirects, strict 404s, sitemap and robots.`);

  const live = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const path of ['/creative', '/creative/tattoos', '/creative/tools', ...toolPaths, '/creative/more', '/creative/digital-artworks', ...artworkPaths, '/about', '/impressum', '/contact', '/contact?artwork=green-black-original', '/contact?artwork=tattoo-08', '/#contact']) {
    const livePage = await live.newPage();
    const errors = [];
    const requests = [];
    await livePage.addInitScript(() => {
      window.__seoWebGLContexts = 0;
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        if (/webgl/i.test(type)) window.__seoWebGLContexts++;
        return getContext.call(this, type, ...args);
      };
    });
    livePage.on('pageerror', (error) => errors.push(error.message));
    livePage.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    livePage.on('request', (request) => requests.push(request.url()));
    await livePage.goto(route(path), { waitUntil: 'networkidle' });
    assert.deepEqual(errors, []);
    assert.ok(!requests.some((url) => /\/main-[^/]+\.js|wordmark\.typeface|tattoo-texture|LiberationSans-Bold/.test(url)), 'Direct Work/About/Contact cannot download the 3D scene, font or reflection texture.');
    const expected = isArtwork(path) ? 'artwork' : path.startsWith('/creative/tools/') ? 'tool' : path.startsWith('/creative') ? 'work' : path.startsWith('/about') ? 'about' : path.startsWith('/impressum') ? 'impressum' : 'home';
    assert.equal(await livePage.locator('html').getAttribute('data-page'), expected);
    assert.equal(await livePage.evaluate(() => window.__seoWebGLContexts), 0, 'Cold interior/Home Contact never initializes WebGL.');
    if (expected === 'home') {
      assert.equal(await livePage.locator('[data-inquiry-form]').count(), 1);
      assert.equal(new URL(livePage.url()).hash, '#contact');
      assert.ok(await livePage.locator('#contact').evaluate(element => element.getBoundingClientRect().top < innerHeight));
      if (path.includes('artwork=')) assert.equal(await livePage.locator('[data-inquiry-artwork]').inputValue(), new URL(path, baseURL).searchParams.get('artwork'));
    }
    assert.ok(!requests.some(url => /\.mp3(?:$|[?#])|__h4_private_audio/.test(url)), 'The approved SMASH track is not requested before use.');
    await livePage.reload({ waitUntil: 'networkidle' });
    assert.equal(await livePage.evaluate(() => window.__seoWebGLContexts), 0);
    assert.ok(!requests.some((url) => /\/main-[^/]+\.js|wordmark\.typeface|tattoo-texture|LiberationSans-Bold/.test(url)));
    assert.ok(!requests.some(url => /\.mp3(?:$|[?#])|__h4_private_audio/.test(url)), 'Refresh still defers SMASH loading.');
    assert.deepEqual(errors, []);
    const horizontalOverflow = await livePage.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    assert.equal(horizontalOverflow, 0, `${path} must fit the live mobile viewport.`);
    report.liveRoutes.push({ path, width: 390, refreshed: true, webglContexts: await livePage.evaluate(() => window.__seoWebGLContexts),
      horizontalOverflow, errors, soundtrackRequests: requests.filter(url => /\.mp3(?:$|[?#])|__h4_private_audio/.test(url)) });
    await livePage.close();
  }
  await live.close();
  console.log('PASS SEO live interiors and Home Contact: direct/refresh routes work without Three.js scene, font or reflection requests.');
  report.passed = true;
} finally {
  await mkdir(new URL('../artifacts/v31-seo/', import.meta.url), { recursive: true });
  await writeFile(new URL('../artifacts/v31-seo/results.json', import.meta.url), JSON.stringify(report, null, 2));
  await browser.close();
}
