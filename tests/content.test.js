import test from 'node:test';
import assert from 'node:assert/strict';
import { siteContent } from '../src/data/siteContent.js';
import { artworks } from '../src/data/artworks.js';
import { contentURL, emailURL, escapeHTML } from '../src/content-utils.js';
import { normalizeCategory, renderHomepageSections, renderWorkPage, renderProject, renderAboutPage, renderArtworkPage } from '../src/pages.js';

test('homepage keeps four horizontal real category routes and a static creative heading', () => {
  const markup = renderHomepageSections();
  const selected = markup.split('</section>')[0];
  assert.deepEqual([...selected.matchAll(/class="category-link" href="([^"]+)"/g)].map((match) => match[1]), [
    '/creative/tattoos', '/creative/jewellery', '/creative/tools', '/creative/more',
  ]);
  assert.match(selected, /<span class="kinetic-heading-text">01\/ creative<\/span>/);
  assert.doesNotMatch(selected, /section-route-link/);
  assert.doesNotMatch(selected, /<img|<figure|placeholder/i);
  assert.match(markup, /id="contact"/);
  assert.match(markup, /href="\/about"/);
  assert.doesNotMatch(selected, /category-sublinks|flashes|analog photography|digital artworks/);
});

test('real category pages select their own content while /creative retains the complete archive', () => {
  const cases = [
    ['all', ['tattoos', 'flashes', 'jewellery', 'digital-artworks', 'analog-photography'], ['tattoos', 'jewellery', 'tools', 'more'], 9, '01/ creative'],
    ['tattoos', ['tattoos', 'flashes'], ['tattoos'], 8, 'tattoos'],
    ['flashes', ['flashes'], [], 0, 'FLASHES'],
    ['jewellery', ['jewellery'], ['jewellery'], 0, 'jewellery'],
    ['more', ['digital-artworks', 'analog-photography'], ['more'], 1, 'more'],
    ['analog-photography', ['analog-photography'], [], 0, 'ANALOG PHOTOGRAPHY'],
    ['digital-artworks', ['digital-artworks'], [], 1, 'DIGITAL ARTWORKS'],
    ['paintings', ['paintings'], [], 0, 'PAINTINGS'],
  ];
  for (const [context, categories, groups, imageCount, heading] of cases) {
    const markup = renderWorkPage(context);
    assert.ok(markup.includes(`data-work-context="${context}"`));
    assert.deepEqual([...markup.matchAll(/data-archive-category="([^"]+)"/g)].map(match => match[1]), categories);
    assert.deepEqual([...markup.matchAll(/data-work-group="([^"]+)"/g)].map(match => match[1]), groups);
    assert.equal((markup.match(/<img /g) || []).length, imageCount, 'Only real supplied images from the selected route render.');
    const headingClass = context === 'more' ? 'page-heading sr-only' : context === 'all' ? 'page-heading numbered-heading' : 'page-heading';
    assert.ok(markup.includes(`<h1 class="${headingClass}" id="work-page-title">${heading}</h1>`));
    for (const href of ['/creative/tattoos', '/creative/jewellery', '/creative/tools', '/creative/more']) assert.ok(markup.includes(`href="${href}"`));
    assert.doesNotMatch(markup, /href="\/work(?:\/|#)/);
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `Duplicate anchors in ${context} context`);
  }
});

test('rubric pages render plain child category headings and keep cross-links', () => {
  const expected = {
    tattoos: [['archive-flashes-title', 'flashes'], ['archive-model-title', '3d model']],
    jewellery: [],
    tools: [],
    more: [['archive-digital-artworks-title', 'digital artworks'], ['archive-analog-photography-title', 'analog photography']],
  };
  for (const [context, headings] of Object.entries(expected)) {
    const markup = renderWorkPage(context);
    assert.match(markup, new RegExp(`<div class="page-shell work-page is-rubric-page"[^>]*>`));
    assert.doesNotMatch(markup, /work-group-heading/);
    const rendered = [...markup.matchAll(/<h3 class="archive-category-heading rubric-category-heading" id="([^"]+)" data-motion-static>([^<]+)<\/h3>/g)]
      .map(match => [match[1], match[2]]);
    assert.deepEqual(rendered, headings);
    const headingMarkup = [...markup.matchAll(/<h3 class="archive-category-heading rubric-category-heading"[^>]*>[\s\S]*?<\/h3>/g)].map(match => match[0]);
    assert.ok(headingMarkup.every(heading => !heading.includes('<a') && !heading.includes('class="arrow"')), 'Child categories are plain text, not links.');
    for (const [id] of headings) assert.ok(markup.includes(`aria-labelledby="${id}"`), 'Section anchors keep their heading IDs.');
    const crossLinks = [...markup.matchAll(/<nav class="rubric-cross-links"[^>]*>([\s\S]*?)<\/nav>/g)][0]?.[1] || '';
    assert.equal((crossLinks.match(/<a href="\/creative\//g) || []).length, 3, 'The other three rubric routes remain available as navigation.');
    assert.equal((crossLinks.match(/class="rubric-cross-gap"/g) || []).length, 1);
  }
});

test('only Home exposes the accessible inquiry form; interior Contact links target its section', () => {
  assert.equal(siteContent.contact.email, 'h4ngelic@gmail.com');
  assert.equal(siteContent.contact.instagramURL, 'https://www.instagram.com/h4ngelic/');
  assert.equal(siteContent.contact.bookingURL, '');
  for (const markup of [renderHomepageSections()]) {
    assert.equal((markup.match(/data-inquiry-form/g) || []).length, 1);
    assert.match(markup, /action="\/api\/inquiry" method="post" enctype="multipart\/form-data"/);
    assert.match(markup, /name="name" autocomplete="name" placeholder="max musterperson" required/);
    assert.match(markup, /name="email" type="text" autocomplete="off" placeholder="email, instagram, phone number\.\.\." required/);
    assert.match(markup, /<textarea[^>]+name="message"/);
    assert.doesNotMatch(markup, /<textarea[^>]+required/);
    assert.match(markup, /type="file" name="attachments"[^>]+multiple/);
    assert.match(markup, /up to 5 files, 4 MB total/);
    assert.doesNotMatch(markup, /5 MB each|12 MB/);
    assert.match(markup, /attach references \/ images/);
    assert.match(markup, /send message/);
    assert.match(markup, /data-inquiry-status role="status" aria-live="polite"/);
    assert.match(markup, /href="mailto:h4ngelic@gmail\.com"/);
    assert.match(markup, /href="https:\/\/www\.instagram\.com\/h4ngelic\/" target="_blank" rel="noopener noreferrer"/);
    const withoutApprovedPlaceholder = markup.replace(/<a\b[^>]*data-moshlab-placeholder[^>]*>[\s\S]*?<\/a>/g, '');
    assert.match(markup, /class="footer-moshlab" href="#" data-moshlab-placeholder aria-label="h4 moshlab, destination not configured"/);
    assert.doesNotMatch(withoutApprovedPlaceholder, /class="contact-links"|link coming soon|href="(?:#|mailto:|https?:\/\/|)"/);
  }
});

test('interior routes have no form and one contact destination', () => {
  for (const markup of [renderWorkPage(), renderAboutPage()]) {
    assert.doesNotMatch(markup, /data-inquiry-form|href="\/contact/);
  }
  assert.match(renderAboutPage(), /href="\/#contact">get in touch/);
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

test('tattoos labels the Tattoo archive without changing its identity or Home copy', () => {
  const group = siteContent.workGroups.find(entry => entry.id === 'tattoos');
  assert.equal(group.label, 'tattoos');
  assert.equal(group.archiveLabel, 'tattoos');
  const archive = renderWorkPage('tattoos');
  assert.match(archive, /<h1 class="page-heading" id="work-page-title">tattoos<\/h1>/);
  assert.match(archive, /data-work-context="tattoos"/);
  assert.match(archive, /<a class="filter-link is-active" href="\/creative\/tattoos" aria-current="page">tattoos<\/a>/);
  assert.match(archive, /<a href="\/creative\/jewellery">jewellery /);
  assert.match(archive, /<a href="\/creative\/more">more /);
  const all = renderWorkPage('all');
  assert.match(all, /id="group-tattoos-title"[^>]*><a[^>]*>tattoos\s+<i class="arrow"/);
  assert.match(all, /href="\/creative\/tattoos"[^>]*>tattoos<\/a>/);
  const home = renderHomepageSections();
  assert.match(home, /<a class="category-link" href="\/creative\/tattoos"><span[^>]*>[^<]*<span[^>]*><span>tattoos<\/span>/);
});

test('category routes retain safe navigation, visible art and legacy unknown-category fallback', () => {
  for (const category of siteContent.categories) {
    const markup = renderWorkPage(category.id);
    assert.ok(markup.includes(`data-work-context="${category.id}"`));
    assert.doesNotMatch(markup, /data-digital-ink|digital-ink-canvas|href="\/work#/);
    assert.ok(markup.includes(`data-archive-category="${category.id}"`));
  }
  assert.equal(normalizeCategory('unexpected'), 'all');
  assert.match(renderWorkPage('unexpected'), /data-work-context="all"/);
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
    const fixture = tattoos.split('data-project-url="/creative/renderer-fixture"')[1].split('</article>')[0];
    assert.equal((fixture.match(/class="project-image(?: |")/g) || []).length, 2);
    assert.match(tattoos, /test description/);
    assert.match(tattoos, /<dt>materials<\/dt><dd>test material<\/dd>/);
    assert.match(tattoos, /width="600" height="800"/);
    assert.doesNotMatch(tattoos, /private draft title/);
    assert.equal((renderWorkPage('jewellery').match(/data-placeholder="true"/g) || []).length, 8);
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
  assert.match(archive, /<a class="artwork-open" href="\/creative\/real-url-fixture" data-artwork-link/);
  assert.match(archive, /href="\/creative\/real-url-fixture#image-2" data-artwork-link/);
  assert.equal((archive.match(/data-artwork-open/g) || []).length, 2, 'JavaScript opens an image in place while no-JS retains real detail links.');
  const detail = renderArtworkPage(project);
  assert.equal((detail.match(/type="button" data-artwork-open/g) || []).length, 2);
  assert.match(detail, /id="image-2" tabindex="-1"/);
  assert.match(detail, /data-artwork-image="1"/);
  assert.match(detail, /loading="eager" fetchpriority="high"/);
  assert.match(detail, /href="\/\?artwork=real-url-fixture#contact"/);
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

test('About keeps its lower-case numbered route heading', () => {
  assert.match(renderAboutPage(), /<h1 class="page-heading numbered-heading">02\/ more about<\/h1>/);
});

test('approved About copy remains exact and does not invent a portrait or biography', () => {
  assert.equal(siteContent.artistName, 'Hendrik');
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


test('Works has four unnumbered major rubrics, subordinate archive labels and an empty deferred model section', () => {
  const markup = renderWorkPage('all');
  assert.match(markup, /<h1 class="page-heading numbered-heading" id="work-page-title">01\/ creative<\/h1>/);
  const major = [...markup.matchAll(/<h2 class="work-group-heading"[^>]*>([\s\S]*?)<\/h2>/g)].map(match => match[1].replace(/<[^>]*>/g, '').trim());
  assert.deepEqual(major, ['tattoos', 'jewellery', 'tools', 'more']);
  assert.match(markup, /id="group-tools-title"[^>]*><span class="archive-scroll-label">tools<\/span><\/h2>/);
  assert.doesNotMatch(markup, /id="group-tools-title"[^>]*><a/);
  const subordinate = [...markup.matchAll(/<h3 class="archive-category-heading(?: rubric-category-heading)?"[^>]*>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/h3>/g)].map(match => match[1]);
  assert.deepEqual(subordinate, ['tattoos', 'flashes', '3d model', 'digital artworks', 'analog photography']);
  assert.deepEqual([...markup.matchAll(/data-tool-entry="([^"]+)"/g)].map(match => match[1]), ['m4shlab', 'thr4ce']);
  assert.doesNotMatch(markup, /work-subfilters|SELECTED WORKS|selected works/i);
  const numberedAndCategoryHeadings = [...markup.matchAll(/<h[123]\b[^>]*>[\s\S]*?<\/h[123]>/g)].map(match => match[0]).join('');
  assert.equal((numberedAndCategoryHeadings.match(/class="arrow"/g) || []).length, 3,
    'The TATTOOS rubric keeps its arrow and the two external tool CTAs keep the shared directional arrow.');
  assert.match(markup, /id="group-tattoos-title"[^>]*><a[^>]*>tattoos\s+<i class="arrow" aria-hidden="true"><\/i><\/a><\/h2>/);
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
  for (const markup of [home, renderWorkPage(), renderAboutPage(), renderArtworkPage(artworks[0])]) {
    assert.equal((markup.match(/data-visit-number/g) || []).length, 1);
    assert.match(markup, /footer-brand[\s\S]*?data-visit-count/);
  }
});
