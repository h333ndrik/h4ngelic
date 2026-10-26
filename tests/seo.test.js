import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { getPageMetadata, getSEOConfig, normalizeProductionURL, renderHead, serializeJSONLD } from '../src/seo.js';
import { resolveRoute, routeDefinitions } from '../src/routes.js';
import { prerenderHTML, buildRobots, buildSitemap, prerender } from '../scripts/prerender.mjs';
import { createPreviewServer } from '../scripts/serve-preview.mjs';

const production = { deployment: 'production', productionURL: 'https://h4ngelic.com' };
const shell = `<!doctype html><html lang="en"><head><!--seo:start--><title>old</title><!--seo:end--></head><body><main><!--hero:start--><section class="hero" hidden><h1>h4ngelic</h1><canvas id="logo-canvas"></canvas></section><!--hero:end--><!--content:start--><div id="page-content"></div><!--content:end--></main><script type="module" src="/assets/app.js"></script></body></html>`;

test('preview remains non-indexable; production requires a real HTTPS origin', () => {
  assert.equal(getPageMetadata(resolveRoute('/')).robots, 'noindex, follow');
  assert.equal(getPageMetadata(resolveRoute('/'), { indexing: true }).indexable, false);
  assert.equal(getPageMetadata(resolveRoute('/'), production).indexable, true);
  assert.equal(getPageMetadata(resolveRoute('/'), { ...production, indexing: false }).indexable, false);
  assert.equal(normalizeProductionURL('https://h4ngelic.com/'), 'https://h4ngelic.com');
  for (const productionURL of ['', 'http://h4ngelic.com', 'https://user:pass@h4ngelic.com', 'https://h4ngelic.com/staging', 'https://h4ngelic.com?preview=1']) {
    assert.throws(() => getSEOConfig({ ...production, productionURL }));
  }
  assert.throws(() => getSEOConfig({ deployment: 'staging' }));
});

test('canonical archive metadata is unique and incomplete supplied detail remains non-indexable', () => {
  const routes = routeDefinitions();
  const pages = routes.map((route) => getPageMetadata(route, production));
  assert.equal(new Set(pages.map((page) => page.title)).size, pages.length);
  const describedPages = routes.filter(route => route.kind !== 'artwork').map(route => getPageMetadata(route, production));
  assert.equal(new Set(describedPages.map(page => page.description)).size, describedPages.length);
  const original = getPageMetadata(resolveRoute('/work/digital-artworks/green-black-original'), production);
  assert.equal(original.indexable, false, 'The artist has not supplied a title or description; publishing the actual image must not invent them.');
  assert.equal(original.canonicalURL, 'https://h4ngelic.com/work/digital-artworks/green-black-original');
  assert.equal(original.description, getPageMetadata(resolveRoute('/work/digital-artworks'), production).description,
    'An incomplete noindex detail uses the truthful existing category description.');
  assert.deepEqual(pages.filter((page) => page.indexable).map((page) => page.path), ['/', '/about']);
  assert.equal(getPageMetadata(resolveRoute('/work?category=tattoos'), production).canonicalURL, 'https://h4ngelic.com/work/tattoos');
  const missing = getPageMetadata(resolveRoute('/no-such-page'), production);
  assert.equal(missing.status, 404);
  assert.equal(missing.indexable, false);
  assert.equal(missing.canonicalURL, '');
  assert.equal(missing.structuredData, null);
});

test('only complete supplied projects make an archive and detail indexable', () => {
  const project = { id: 'line-study', category: 'tattoos', title: 'line study', description: 'A supplied description.', year: 2026, images: [{ src: '/images/line-study.webp', alt: 'Blackwork lines on an arm', width: 800, height: 1000 }] };
  const archive = resolveRoute('/work/tattoos');
  assert.equal(getPageMetadata(archive, { ...production, projects: [project] }).indexable, true);
  assert.equal(getPageMetadata(resolveRoute('/work/paintings'), { ...production, projects: [project] }).indexable, false);
  const detail = { kind: 'artwork', category: 'tattoos', project, path: '/work/tattoos/line-study', canonicalPath: '/work/tattoos/line-study' };
  const metadata = getPageMetadata(detail, production);
  assert.equal(metadata.indexable, true);
  const artwork = metadata.structuredData['@graph'].find((node) => node['@type'] === 'VisualArtwork');
  assert.equal(artwork.image[0].contentUrl, 'https://h4ngelic.com/images/line-study.webp');
  assert.equal(artwork.image[0].width, 800);
  assert.equal(artwork.dateCreated, '2026');
  for (const incomplete of [{ ...project, published: false }, { ...project, description: '' }, { ...project, images: [] }, { ...project, images: [{ src: '/images/line-study.webp', alt: '' }] }]) {
    assert.equal(getPageMetadata({ ...detail, project: incomplete }, production).indexable, false);
  }
});

test('More indexing follows its genuine leaf artwork while missing originals stay unpublished', () => {
  const project = { id: 'supplied-digital-work', category: 'digital-artworks', title: 'supplied title',
    description: 'Actual artist description.', images: [{ src: '/images/actual-original.webp', alt: 'Actual artwork.' }] };
  const options = { ...production, projects: [project] };
  assert.equal(getPageMetadata(resolveRoute('/work/more'), options).indexable, true);
  assert.equal(getPageMetadata(resolveRoute('/work/analog-photography'), options).indexable, false);
  assert.equal(getPageMetadata(resolveRoute('/work/digital-artworks'), options).indexable, true);
  assert.equal(getPageMetadata(resolveRoute('/work/more'), production).indexable, false);
});

test('structured data attributes the artist without invented business details or profiles', () => {
  const metadata = getPageMetadata(resolveRoute('/about'), production);
  const graph = metadata.structuredData['@graph'];
  const person = graph.find((node) => node['@type'] === 'Person');
  assert.equal(person.name, 'h333ndrik');
  assert.equal(person.alternateName, 'h4ngelic');
  assert.equal(person.workLocation.name, 'Berlin');
  assert.equal(person.sameAs, undefined);
  assert.equal(person.address, undefined);
  assert.equal(graph.some((node) => node['@type'] === 'LocalBusiness'), false);
  assert.equal(metadata.openGraph.image, undefined);
  assert.doesNotMatch(renderHead(metadata), /property="og:image"/);
});

test('head rendering safely escapes editable HTML and inline JSON', () => {
  const metadata = getPageMetadata(resolveRoute('/'), production);
  metadata.title = '<img src=x onerror=alert(1)>';
  metadata.description = '" content="injected';
  metadata.structuredData = { value: '</script><script>alert(1)</script>&\u2028' };
  const head = renderHead(metadata);
  assert.match(head, /&lt;img/);
  assert.match(head, /&quot; content=&quot;injected/);
  assert.doesNotMatch(head, /<img|<script>alert/);
  assert.equal((head.match(/<script /g) || []).length, 1);
  assert.deepEqual(JSON.parse(serializeJSONLD(metadata.structuredData)), metadata.structuredData);
});

test('prerender emits readable semantic pages while interior hero stays inert', () => {
  const home = prerenderHTML(shell, resolveRoute('/'));
  assert.match(home, /<section class="hero"><h1>h4ngelic/);
  assert.match(home, /id="selected-work"/);
  assert.match(home, /data-prerendered="\/"/);
  const about = prerenderHTML(shell, resolveRoute('/about'));
  assert.match(about, /<template id="hero-template"><section class="hero" hidden>/);
  const active = about.replace(/<template\b[\s\S]*?<\/template>/g, '');
  assert.doesNotMatch(active, /logo-canvas/);
  assert.equal((active.match(/<h1\b/g) || []).length, 1);
  assert.match(active, /creative identity of h333ndrik/);
  assert.match(active, /data-prerendered="\/about"/);
  assert.throws(() => prerenderHTML('<html></html>', resolveRoute('/')));
});

test('sitemap only includes indexable canonical pages and robots preserves existing policy', () => {
  const pages = routeDefinitions().map((route) => getPageMetadata(route, production));
  const xml = buildSitemap(pages);
  assert.match(xml, /https:\/\/h4ngelic.com\/about/);
  assert.doesNotMatch(xml, /\/work/);
  assert.doesNotMatch(buildSitemap(routeDefinitions().map((route) => getPageMetadata(route))), /<url>/);
  assert.equal(buildRobots(getSEOConfig()), 'User-agent: *\nDisallow: /\n');
  const existing = 'User-agent: GPTBot\nDisallow: /\n';
  assert.equal(buildRobots(getSEOConfig(production), existing), existing);
  const generated = buildRobots(getSEOConfig(production));
  assert.match(generated, /Sitemap: https:\/\/h4ngelic.com\/sitemap.xml/);
  assert.doesNotMatch(generated, /User-agent:|Allow:/);
});

test('production output and preview HTTP preserve canonical redirects, strict 404 and build policy', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'h4-seo-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'index.html'), shell);
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'assets/app.js'), '/* compression test */'.repeat(200));
  await symlink('/etc/passwd', join(directory, 'assets/not-public.txt'));
  const manifest = await prerender({ outDir: directory, config: getSEOConfig(production) });
  assert.equal(manifest.routes.length, routeDefinitions().length);
  assert.match(await readFile(join(directory, 'about/index.html'), 'utf8'), /independent artist based in berlin/);
  const server = await createPreviewServer({ root: directory });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-robots-tag'), 'index, follow');
  assert.equal(home.headers.get('content-encoding'), 'gzip');
  assert.match(await home.text(), /data-prerendered="\/"/);
  for (const [path, destination] of [['/work?category=tattoos', '/work/tattoos'], ['/about/', '/about'], ['/work/index.html', '/work'], ['/index.html', '/']]) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual' });
    assert.equal(response.status, 301, path);
    assert.equal(response.headers.get('location'), destination);
  }
  const work = await fetch(`${base}/work/tattoos`);
  assert.equal(work.status, 200);
  assert.equal(work.headers.get('x-robots-tag'), 'noindex, follow');
  for (const path of ['/does-not-exist', '/work/tattoos/fake-project', '/404.html']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
    assert.match(await response.text(), /page not found/);
  }
  const missingAsset = await fetch(`${base}/assets/not-public.txt`);
  assert.equal(missingAsset.status, 404);
  assert.match(missingAsset.headers.get('content-type'), /text\/plain/);
  assert.equal(await missingAsset.text(), 'File not found');
  const head = await fetch(`${base}/about`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const post = await fetch(base, { method: 'POST' });
  assert.equal(post.status, 405);
});
