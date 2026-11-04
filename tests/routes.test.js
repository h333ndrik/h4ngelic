import test from 'node:test';
import assert from 'node:assert/strict';
import { artworks } from '../src/data/artworks.js';
import { resolveRoute, routeDefinitions, projectURL, matchesArchive, contactURL } from '../src/routes.js';
import { renderArtworkPage } from '../src/pages.js';

test('canonical creative categories preserve legacy query links and redirect every retired /work path', () => {
  const legacy = resolveRoute('/work?category=tattoos#project');
  assert.equal(legacy.kind, 'work');
  assert.equal(legacy.category, 'tattoos');
  assert.equal(legacy.canonicalPath, '/creative/onskin');
  assert.equal(legacy.redirectPath, '/creative/onskin#project');
  assert.equal(resolveRoute('/work/jewellery').category, 'jewellery');
  assert.equal(resolveRoute('/work?category=unknown').redirectPath, '/creative');
  assert.equal(resolveRoute('/work').redirectPath, '/creative');
  assert.equal(resolveRoute('/work/index.html').redirectPath, '/creative');
  assert.equal(routeDefinitions().some(route => route.path.startsWith('/work')), false);
  for (const path of ['/work/missing', '/work/tattoos/missing']) {
    const route = resolveRoute(path);
    assert.equal(route.kind, 'work');
    assert.equal(route.redirectPath, '/creative');
  }
  assert.equal(resolveRoute('/about/').redirectPath, '/about');
});

test('new leaf archives, More and tool groups resolve while paintings remain reachable', () => {
  for (const [category, path] of [['tattoos', '/creative/onskin'], ['flashes', '/creative/flashes'],
    ['jewellery', '/creative/jewellery'], ['analog-photography', '/creative/analog-photography'],
    ['digital-artworks', '/creative/digital-artworks'], ['paintings', '/creative/paintings'], ['more', '/creative/more']]) {
    const route = resolveRoute(path);
    assert.equal(route.kind, 'work');
    assert.equal(route.category, category);
    assert.ok(routeDefinitions().some((entry) => entry.canonicalPath === route.canonicalPath));
  }
  assert.equal(resolveRoute('/work?category=more').redirectPath, '/creative/more');
  assert.equal(projectURL({ id: 'wrong-parent', category: 'more' }), '');
  assert.equal(resolveRoute('/creative/tools/m4shlab').kind, 'tool');
  assert.equal(resolveRoute('/creative/tools/m4shlab').tool.id, 'm4shlab');
  assert.equal(resolveRoute('/creative/tools/missing').kind, 'not-found');
  assert.equal(matchesArchive({ category: 'analog-photography' }, 'more'), true);
  assert.equal(matchesArchive({ category: 'digital-artworks' }, 'more'), true);
  assert.equal(matchesArchive({ category: 'tattoos' }, 'more'), false);
  assert.equal(matchesArchive({ category: 'flashes' }, 'tattoos'), true);
  assert.equal(matchesArchive({ category: 'flashes' }, 'flashes'), true);
  const original = resolveRoute('/creative/green-black-original');
  assert.equal(original.kind, 'artwork', 'The supplied original has its canonical /creative detail route.');
  assert.equal(original.project, artworks.find(project => project.id === 'green-black-original'));
  assert.ok(routeDefinitions().some(route => route.canonicalPath === original.canonicalPath));
  assert.equal(resolveRoute('/work/digital-artworks/green-black-original').redirectPath, '/creative/green-black-original');
  assert.equal(resolveRoute('/creative/onskin/tattoo-01').redirectPath, '/creative/tattoo-01');
});

test('only genuine published artwork can have a detail URL and duplicate URLs fail the build', () => {
  const fixture = { id: 'route-fixture', category: 'paintings', title: 'test painting', description: 'provided test copy', images: [{ src: '/images/test.webp', alt: 'test image' }] };
  const initial = artworks.length;
  try {
    artworks.push(fixture, { ...fixture, id: 'draft', published: false }, { ...fixture, id: 'missing-image', images: [] });
    const url = projectURL(fixture);
    assert.equal(url, '/creative/route-fixture');
    assert.equal(resolveRoute(url).project, fixture);
    assert.equal(resolveRoute('/creative/draft').kind, 'not-found');
    assert.equal(resolveRoute('/creative/missing-image').kind, 'not-found');
    const paths = routeDefinitions().map((route) => route.canonicalPath);
    assert.ok(paths.includes(url));
    assert.ok(!paths.includes('/creative/draft'));
    const html = renderArtworkPage(fixture);
    assert.match(html, /<h1 class="page-heading">test painting<\/h1>/);
    assert.match(html, /loading="eager" fetchpriority="high"/);
    artworks.push({ ...fixture });
    assert.throws(routeDefinitions, /unique/);
  } finally { artworks.length = initial; }
});

test('Contact is a shared Home anchor and the old URL redirects preserving artwork context', () => {
  assert.equal(contactURL(), '/#contact');
  assert.equal(contactURL('a & b'), '/?artwork=a%20%26%20b#contact');
  for (const path of ['/contact', '/contact/']) {
    const route = resolveRoute(path);
    assert.equal(route.kind, 'home');
    assert.equal(route.canonicalPath, '/');
    assert.equal(route.redirectPath, '/#contact');
  }
  assert.equal(resolveRoute('/contact?artwork=green-black-original').redirectPath, '/?artwork=green-black-original#contact');
  assert.equal(routeDefinitions().some(route => route.path === '/contact'), false);
  assert.deepEqual([...new Set(routeDefinitions().filter(route => ['home','work','about'].includes(route.kind)).map(route => route.kind))], ['home','work','about']);
  assert.equal(routeDefinitions().some(route => route.path === '/work'), false, 'The old landing route is absent from the static route set.');
});
