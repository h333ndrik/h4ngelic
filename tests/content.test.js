import test from 'node:test';
import assert from 'node:assert/strict';
import { siteContent } from '../src/data/siteContent.js';
import { artworks } from '../src/data/artworks.js';
import { contentURL, emailURL, escapeHTML } from '../src/content-utils.js';
import { normalizeCategory, renderHomepageSections, renderWorkPage, renderProject, renderAboutPage } from '../src/pages.js';

test('homepage categories retain their exact horizontal-strip order and query links', () => {
  const markup = renderHomepageSections();
  const selected = markup.split('</section>')[0];
  assert.deepEqual([...selected.matchAll(/class="category-link" href="([^"]+)"/g)].map((match) => match[1]), [
    '/work?category=tattoos', '/work?category=jewellery', '/work?category=paintings',
  ]);
  assert.doesNotMatch(selected, /<img|<figure|placeholder/i);
  assert.match(markup, /id="contact"/);
  assert.match(markup, /href="\/about"/);
});

test('unconfigured contact destinations never become dead or invented links', () => {
  const markup = renderHomepageSections().split('id="contact"')[1];
  for (const label of ['get in touch', 'instagram', 'email', 'book a tattoo']) {
    assert.ok(markup.includes(`aria-label="${label} — link coming soon"`));
  }
  assert.equal((markup.match(/aria-disabled="true"/g) || []).length, 4);
  assert.doesNotMatch(markup, /href="(?:#|mailto:|https?:\/\/|)"/);
});

test('contact configuration creates appropriate safe real destinations', () => {
  const initial = { ...siteContent.contact };
  try {
    Object.assign(siteContent.contact, { instagramURL: 'https://instagram.com/configured-profile', email: 'artist@example.test', bookingURL: '/booking' });
    const markup = renderHomepageSections();
    assert.match(markup, /href="https:\/\/instagram.com\/configured-profile" target="_blank" rel="noopener noreferrer"/);
    assert.match(markup, /href="mailto:artist@example.test"/);
    assert.match(markup, /href="\/booking"/);
    assert.equal((markup.match(/href="mailto:artist@example.test"/g) || []).length, 2, 'get in touch defaults to the configured email');
  } finally {
    Object.assign(siteContent.contact, initial);
  }
});

test('category query selects one archive filter and unknown filters safely select all', () => {
  for (const category of siteContent.categories) {
    const markup = renderWorkPage(category.id);
    assert.ok(markup.includes(`href="/work?category=${category.id}" aria-current="page">${category.label}</a>`));
    assert.match(markup, /archive in progress\./);
  }
  assert.equal(normalizeCategory('unexpected'), 'all');
  assert.match(renderWorkPage('unexpected'), /href="\/work" aria-current="page">all<\/a>/);
});

test('real project entries support multiple images, optional metadata and category filtering', () => {
  const project = {
    id: 'renderer-fixture', category: 'tattoos', title: 'test title', year: 2026,
    description: 'test description', details: { materials: 'test material' },
    images: [
      { src: '/images/unit-test-one.webp', alt: 'first image', width: 600, height: 800 },
      { src: '/images/unit-test-two.webp', alt: 'detail image', caption: 'test detail' },
    ],
  };
  artworks.push(project, { ...project, id: 'draft-fixture', title: 'private draft title', published: false });
  try {
    const tattoos = renderWorkPage('tattoos');
    assert.equal((tattoos.match(/class="project-image"/g) || []).length, 2);
    assert.match(tattoos, /test description/);
    assert.match(tattoos, /<dt>materials<\/dt><dd>test material<\/dd>/);
    assert.match(tattoos, /width="600" height="800"/);
    assert.doesNotMatch(tattoos, /private draft title/);
    assert.match(renderWorkPage('jewellery'), /archive in progress\./);
  } finally {
    artworks.splice(-2);
  }
});

test('editable project copy is escaped and invalid image URLs cannot render', () => {
  const markup = renderProject({ category: 'paintings', title: '<script>bad()</script>', description: 'one & two', images: [
    { src: '/images/valid.webp', alt: '" onerror="bad()' },
    { src: 'javascript:bad()', alt: 'invalid' },
  ] });
  assert.doesNotMatch(markup, /<script>|src="javascript:/);
  assert.match(markup, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(markup, /alt="&quot; onerror=&quot;bad\(\)"/);
  assert.match(markup, /one &amp; two/);
});

test('artwork opening controls preserve image dimensions and lazy loading', () => {
  const markup = renderProject({ category: 'tattoos', images: [
    { src: '/images/viewer-fixture.webp', alt: 'a described artwork', width: 1000, height: 1200 },
  ] });
  assert.match(markup, /class="artwork-open" type="button" data-artwork-open/);
  assert.match(markup, /aria-label="open a described artwork"/);
  assert.match(markup, /--artwork-ratio: 1000 \/ 1200/);
  assert.match(markup, /width="1000" height="1200"/);
  assert.match(markup, /data-full-src="\/images\/viewer-fixture.webp"/);
  assert.match(markup, /loading="lazy" decoding="async"/);
  const unknownSize = renderProject({ category: 'paintings', images: [{ src: '/images/size-fixture.avif', alt: 'test image' }] });
  assert.match(unknownSize, /--artwork-ratio: [\d.]+ \/ [\d.]+/);
  assert.match(unknownSize, /width="[\d.]+" height="[\d.]+"/);
});

test('about optional content renders only when configured', () => {
  const about = renderAboutPage();
  assert.match(about, /tattooing, jewellery, painting and everything in between\./);
  assert.match(about, /independent artist based in berlin\./);
  assert.doesNotMatch(about, /class="about-portrait"|class="about-references"/);
  const originalPortrait = siteContent.about.portrait;
  const originalReferences = siteContent.about.references;
  try {
    siteContent.about.portrait = { src: '/images/portrait.webp', alt: 'configured portrait' };
    siteContent.about.references = [{ title: 'a reference', url: 'https://reference.example.test/' }];
    const configured = renderAboutPage();
    assert.match(configured, /class="about-portrait"/);
    assert.match(configured, /configured portrait/);
    assert.match(configured, /a reference/);
  } finally {
    siteContent.about.portrait = originalPortrait;
    siteContent.about.references = originalReferences;
  }
});

test('content utilities reject script, protocol-relative and credential-bearing links', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', '//example.test', 'https://user:password@example.test', 'https://example.test/\nattack']) {
    assert.equal(contentURL(url), '');
  }
  assert.equal(contentURL('/images/art.webp'), '/images/art.webp');
  assert.equal(contentURL('/relative', { relative: false }), '');
  assert.equal(contentURL('https://example.test/path'), 'https://example.test/path');
  assert.equal(emailURL(''), '');
  assert.equal(emailURL('not an email'), '');
  assert.equal(emailURL('artist@example.test'), 'mailto:artist@example.test');
  assert.equal(escapeHTML('<a title="x">&\''), '&lt;a title=&quot;x&quot;&gt;&amp;&#39;');
});
