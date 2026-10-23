import test from 'node:test';
import assert from 'node:assert/strict';
import { artworks } from '../src/data/artworks.js';
import { resolveRoute, routeDefinitions, projectURL } from '../src/routes.js';
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
