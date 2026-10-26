import test from 'node:test';
import assert from 'node:assert/strict';
import { artworks } from '../src/data/artworks.js';
import { resolveRoute, routeDefinitions, projectURL, matchesArchive } from '../src/routes.js';
import { renderArtworkPage } from '../src/pages.js';

test('canonical categories preserve legacy query links and distinguish actual missing routes', () => {
  const legacy = resolveRoute('/work?category=tattoos#project');
  assert.equal(legacy.kind, 'work');
  assert.equal(legacy.category, 'tattoos');
  assert.equal(legacy.canonicalPath, '/work/tattoos');
  assert.equal(legacy.redirectPath, '/work/tattoos#project');
  assert.equal(resolveRoute('/work/jewellery').category, 'jewellery');
  assert.equal(resolveRoute('/work?category=unknown').category, 'all');
  for (const path of ['/work/missing', '/work/tattoos/missing', '/about/missing']) assert.equal(resolveRoute(path).kind, 'not-found');
  assert.equal(resolveRoute('/about/').redirectPath, '/about');
});

test('new leaf archives and More group resolve while paintings and existing URLs remain valid', () => {
  for (const category of ['tattoos', 'flashes', 'jewellery', 'analog-photography', 'digital-artworks', 'paintings', 'more']) {
    const route = resolveRoute(`/work/${category}`);
    assert.equal(route.kind, 'work');
    assert.equal(route.category, category);
    assert.ok(routeDefinitions().some((entry) => entry.canonicalPath === route.canonicalPath));
  }
  assert.equal(resolveRoute('/work?category=more').redirectPath, '/work/more');
  assert.equal(projectURL({ id: 'wrong-parent', category: 'more' }), '');
  assert.equal(resolveRoute('/work/more/missing-artwork').kind, 'not-found');
  assert.equal(matchesArchive({ category: 'analog-photography' }, 'more'), true);
  assert.equal(matchesArchive({ category: 'digital-artworks' }, 'more'), true);
  assert.equal(matchesArchive({ category: 'tattoos' }, 'more'), false);
  assert.equal(matchesArchive({ category: 'flashes' }, 'tattoos'), false);
  // A parent heading does not conflate finished tattoos with available flashes.
  assert.equal(matchesArchive({ category: 'flashes' }, 'flashes'), true);
  const original = resolveRoute('/work/digital-artworks/green-black-original');
  assert.equal(original.kind, 'artwork', 'The supplied original now has its real canonical detail route.');
  assert.equal(original.project, artworks.find(project => project.id === 'green-black-original'));
  assert.ok(routeDefinitions().some(route => route.canonicalPath === original.canonicalPath));
});

test('only genuine published artwork can have a detail URL and duplicate URLs fail the build', () => {
  const fixture = { id: 'route-fixture', category: 'paintings', title: 'test painting', description: 'provided test copy', images: [{ src: '/images/test.webp', alt: 'test image' }] };
  const initial = artworks.length;
  try {
    artworks.push(fixture, { ...fixture, id: 'draft', published: false }, { ...fixture, id: 'missing-image', images: [] });
    const url = projectURL(fixture);
    assert.equal(url, '/work/paintings/route-fixture');
    assert.equal(resolveRoute(url).project, fixture);
    assert.equal(resolveRoute('/work/paintings/draft').kind, 'not-found');
    assert.equal(resolveRoute('/work/paintings/missing-image').kind, 'not-found');
    const paths = routeDefinitions().map((route) => route.canonicalPath);
    assert.ok(paths.includes(url));
    assert.ok(!paths.includes('/work/paintings/draft'));
    const html = renderArtworkPage(fixture);
    assert.match(html, /<h1 class="page-heading">test painting<\/h1>/);
    assert.match(html, /loading="eager" fetchpriority="high"/);
    artworks.push({ ...fixture });
    assert.throws(routeDefinitions, /unique category URLs/);
  } finally { artworks.length = initial; }
});
