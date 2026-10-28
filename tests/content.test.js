import test from 'node:test';
import assert from 'node:assert/strict';
import { siteContent } from '../src/data/siteContent.js';
import { artworks } from '../src/data/artworks.js';
import { contentURL, emailURL, escapeHTML } from '../src/content-utils.js';
import { normalizeCategory, renderHomepageSections, renderWorkPage, renderProject, renderAboutPage, renderArtworkPage, renderContactPage } from '../src/pages.js';

test('homepage keeps only the three horizontal main links into the connected Work document', () => {
  const markup = renderHomepageSections();
  const selected = markup.split('</section>')[0];
  assert.deepEqual([...selected.matchAll(/class="category-link" href="([^"]+)"/g)].map((match) => match[1]), [
    '/work#tattoos', '/work#jewellery', '/work#more',
  ]);
  assert.doesNotMatch(selected, /<img|<figure|placeholder/i);
  assert.match(markup, /id="contact"/);
  assert.match(markup, /href="\/about"/);
  assert.doesNotMatch(selected, /category-sublinks|flashes|analog photography|digital artworks/);
});

test('Work retains all real groups and children for every category deep link without inventing artwork', () => {
  const homepage = renderHomepageSections().split('</section>')[0];
  assert.equal((homepage.match(/class="category-link"/g) || []).length, 3);
  assert.doesNotMatch(homepage, /href="\/work\/paintings"/);
  for (const context of ['all', 'tattoos', 'flashes', 'jewellery', 'more', 'analog-photography', 'digital-artworks']) {
    const markup = renderWorkPage(context);
    assert.ok(markup.includes(`data-work-context="${context}"`));
    assert.match(markup, /data-connected-work/);
    assert.deepEqual([...markup.matchAll(/data-archive-category="([^"]+)"/g)].map(match => match[1]),
      ['tattoos', 'flashes', 'jewellery', 'digital-artworks', 'analog-photography']);
    assert.equal((markup.match(/data-horizontal-drift=/g) || []).length, 3, 'The three intended archives retain their empty carousel structure.');
    assert.equal((markup.match(/<img /g) || []).length, 1, 'Every context retains the one genuine digital original.');
    assert.match(markup, /data-project-url="\/work\/digital-artworks\/green-black-original"/);
    assert.match(markup, /width="1440" height="1920"/);
    assert.equal((markup.match(/archive in progress\./g) || []).length, 4);
    assert.doesNotMatch(markup, /portfolio archive|01 \/ archive/);
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `Duplicate anchors in ${context} context`);
    for (const id of ['tattoos', 'finished-tattoos', 'flashes', 'jewellery', 'more', 'analog-photography', 'digital-artworks']) {
      assert.ok(ids.includes(id), `Missing ${id} anchor in ${context} context`);
    }
    for (const [, target] of markup.matchAll(/href="\/work#([^"]+)"/g)) {
      assert.ok(ids.includes(target), `Broken connected Work link: ${target}`);
    }
  }
});

test('home and dedicated Contact expose one accessible inquiry form and the confirmed contact details', () => {
  assert.equal(siteContent.contact.email, 'h4ngelic@gmail.com');
  assert.equal(siteContent.contact.instagramURL, 'https://www.instagram.com/h4ngelic/');
  assert.equal(siteContent.contact.bookingURL, '');
  for (const markup of [renderHomepageSections(), renderContactPage()]) {
    assert.equal((markup.match(/data-inquiry-form/g) || []).length, 1);
    assert.match(markup, /action="\/api\/inquiry" method="post" enctype="multipart\/form-data"/);
    assert.match(markup, /name="name" autocomplete="name" required/);
    assert.match(markup, /name="email" type="text" autocomplete="off" placeholder="email, instagram, phone number\.\.\." required/);
    assert.match(markup, /<textarea[^>]+name="message"/);
    assert.doesNotMatch(markup, /<textarea[^>]+required/);
    assert.match(markup, /type="file" name="attachments"[^>]+multiple/);
    assert.match(markup, /ATTACH REFERENCES \/ IMAGES/);
    assert.match(markup, /SEND INQUIRY/);
    assert.match(markup, /data-inquiry-status role="status" aria-live="polite"/);
    assert.match(markup, /href="mailto:h4ngelic@gmail\.com"/);
    assert.match(markup, /href="https:\/\/www\.instagram\.com\/h4ngelic\/" target="_blank" rel="noopener noreferrer"/);
    assert.doesNotMatch(markup, /class="contact-links"|link coming soon|href="(?:#|mailto:|https?:\/\/|)"/);
  }
});

test('configured Instagram links remain safe, optional and separate from inquiry submission', () => {
  const initial = { ...siteContent.contact };
  try {
    siteContent.contact.instagramURL = 'https://instagram.com/configured-profile';
    assert.match(renderHomepageSections(), /href="https:\/\/instagram.com\/configured-profile" target="_blank" rel="noopener noreferrer"/);
    for (const instagramURL of ['', 'javascript:alert(1)', '//evil.example', 'https://user:password@example.test']) {
      siteContent.contact.instagramURL = instagramURL;
      const markup = renderHomepageSections();
      assert.doesNotMatch(markup, /class="footer-instagram"|href="javascript:|href="\/\/evil|href="https:\/\/user:/);
      assert.match(markup, /data-inquiry-form/);
    }
  } finally {
    Object.assign(siteContent.contact, initial);
  }
});

test('legacy category contexts preserve connected Work and unknown categories safely select all', () => {
  for (const category of siteContent.categories) {
    const markup = renderWorkPage(category.id);
    assert.ok(markup.includes(`data-work-context="${category.id}"`));
    assert.match(markup, /href="\/work#tattoos"/);
    assert.match(markup, /href="\/work#jewellery"/);
    assert.match(markup, /href="\/work#more"/);
    assert.doesNotMatch(markup, /data-digital-ink|digital-ink-canvas/, 'Digital work is immediately visible without an ink reveal.');
    assert.equal((markup.match(/<img /g) || []).length, 1);
    if (category.legacy) assert.ok(markup.includes(`data-archive-category="${category.id}"`));
  }
  assert.equal(normalizeCategory('unexpected'), 'all');
  assert.match(renderWorkPage('unexpected'), /href="\/work" aria-current="location">all<\/a>/);
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
    const fixture = tattoos.split('data-project-url="/work/tattoos/renderer-fixture"')[1].split('</article>')[0];
    assert.equal((fixture.match(/class="project-image(?: |")/g) || []).length, 2);
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

test('published artwork images keep real detail URLs and progressively open in-place lightboxes', () => {
  const project = { id: 'real-url-fixture', category: 'tattoos', title: 'artwork', images: [
    { src: '/images/one.webp', alt: 'whole artwork', width: 600, height: 800 },
    { src: '/images/two.webp', alt: 'artwork detail', width: 600, height: 800 },
  ] };
  const archive = renderProject(project);
  assert.match(archive, /<a class="artwork-open" href="\/work\/tattoos\/real-url-fixture" data-artwork-link/);
  assert.match(archive, /href="\/work\/tattoos\/real-url-fixture#image-2" data-artwork-link/);
  assert.equal((archive.match(/data-artwork-open/g) || []).length, 2, 'JavaScript opens an image in place while no-JS retains real detail links.');
  const detail = renderArtworkPage(project);
  assert.equal((detail.match(/type="button" data-artwork-open/g) || []).length, 2);
  assert.match(detail, /id="image-2" tabindex="-1"/);
  assert.match(detail, /data-artwork-image="1"/);
  assert.match(detail, /loading="eager" fetchpriority="high"/);
  assert.match(detail, /href="\/contact\?artwork=real-url-fixture"/);
});

test('about optional content renders only when configured', () => {
  const about = renderAboutPage();
  assert.match(about, /hi, i&#39;m hendrik\./);
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

test('approved About copy remains exact and does not invent a portrait or biography', () => {
  assert.equal(siteContent.artistName, 'Hendrik');
  assert.equal(siteContent.home.tagline, 'mixed media');
  assert.equal(siteContent.about.intro, "hi, i'm hendrik.");
  assert.deepEqual(siteContent.about.paragraphs, [
    'i like making things, breaking things apart, and finding new ways to connect them.',
    'fragments, ornaments, tangled shapes, things that seem unfinished but somehow belong together.',
    "sometimes it's ink, sometimes it's metal, sometimes it's something else entirely.",
    'i see the body as an extension of my work, not just a surface for it. something that moves, changes, and becomes part of the composition.',
    "i'd rather see where they go.",
  ]);
  const markup = renderAboutPage();
  for (const paragraph of [siteContent.about.intro, ...siteContent.about.paragraphs]) assert.ok(markup.includes(escapeHTML(paragraph)));
  assert.doesNotMatch(markup, /<img|creative identity of h333ndrik|agency/);
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


test('Works has three unnumbered major rubrics, subordinate archive labels and an empty deferred model section', () => {
  const markup = renderWorkPage('all');
  assert.match(markup, /<h1 class="page-heading">01 \/ WORKS<\/h1>/);
  const major = [...markup.matchAll(/<h2 class="work-group-heading"[^>]*><a[^>]*>([^<]+)<\/a><\/h2>/g)].map(match => match[1]);
  assert.deepEqual(major, ['tattoos', 'jewellery', 'more']);
  const subordinate = [...markup.matchAll(/<h3 class="archive-category-heading"[^>]*>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/h3>/g)].map(match => match[1]);
  assert.deepEqual(subordinate, ['on skin', 'flashes', '3d model', 'digital artworks', 'analog photography']);
  assert.doesNotMatch(markup, /work-subfilters|class="arrow"|SELECTED WORKS|selected works/i);
  const model = markup.match(/<section[^>]+data-deferred-model>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(model);
  assert.match(model, /^<h3[^>]+>3d model<\/h3>$/);
  assert.doesNotMatch(model, /canvas|img|placeholder|loading|data-flash-mannequin/);
});

test('homepage About copy remains one flowing paragraph and every relevant route exposes the same visit indicator', () => {
  const home = renderHomepageSections();
  const paragraph = home.match(/<p class="about-preview-copy[^>]+>([\s\S]*?)<\/p>/)?.[1];
  assert.equal(paragraph, 'mixed media. ink, metal and everything in between.');
  assert.doesNotMatch(paragraph, /<br|<span/);
  for (const markup of [home, renderWorkPage(), renderAboutPage(), renderContactPage(), renderArtworkPage(artworks[0])]) {
    assert.equal((markup.match(/data-visit-number/g) || []).length, 1);
    assert.match(markup, /footer-brand[\s\S]*?data-visit-counter-hotspot/);
  }
});
