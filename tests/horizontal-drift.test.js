import test from 'node:test';
import assert from 'node:assert/strict';
import { horizontalDriftCategories, renderHorizontalDrift } from '../src/horizontal-drift-content.js';

test('only the agreed three archives receive a horizontal carousel, including honest empty shells', () => {
  assert.deepEqual(horizontalDriftCategories, ['tattoos', 'flashes', 'jewellery', 'analog-photography']);
  for (const category of ['digital-artworks', 'paintings', 'more', 'all']) {
    assert.equal(renderHorizontalDrift([], { category }), '');
  }
  const empty = renderHorizontalDrift([], { category: 'tattoos' });
  assert.match(empty, /data-horizontal-drift="tattoos"/);
  assert.match(empty, /aria-roledescription="carousel"/);
  assert.match(empty, /data-carousel-total="0"/);
  assert.match(empty, /data-drift-count aria-hidden="true">00\/ 00/);
  assert.equal((empty.match(/ disabled>/g) || []).length, 2);
  assert.match(empty, /<p class="archive-empty">archive in progress\.<\/p>/);
  assert.doesNotMatch(empty, /<img|data-drift-item|data-artwork-open|placeholder|canvas/);
});

test('spatial archive preserves original dimensions, full sources, detail images and escaped copy', () => {
  const markup = renderHorizontalDrift([{
    id: 'original-work', category: 'tattoos', title: '<original>', description: 'skin & ink', year: 2026,
    images: [
      { src: '/images/original.webp', fullSrc: '/images/original-large.webp', alt: 'original <image>', width: 1800, height: 1200 },
      { src: '/images/healed.webp', alt: 'healed detail', width: 1000, height: 1500 },
    ],
  }], { category: 'tattoos', label: 'tattoos' });
  assert.match(markup, /data-horizontal-drift="tattoos"/);
  assert.match(markup, /--drift-ratio:1\.5/);
  assert.match(markup, /width="1800" height="1200"/);
  assert.match(markup, /data-full-src="\/images\/original-large.webp"/);
  assert.match(markup, /class="project-image inline-artwork-frame drift-detail-image"[^>]* hidden>/, 'Additional photographs remain hidden even with the frame geometry attributes.');
  assert.equal((markup.match(/data-artwork-open/g) || []).length, 2);
  assert.equal((markup.match(/data-inline-expand/g) || []).length, 2, 'Every rendered carousel image opts into the common in-page expansion lifecycle.');
  assert.equal((markup.match(/aria-pressed="false"/g) || []).length, 2);
  assert.match(markup, /aria-label="enlarge original &lt;image&gt; in place"/);
  assert.match(markup, /&lt;original&gt;/);
  assert.match(markup, /skin &amp; ink/);
  assert.match(markup, /href="\/creative\/original-work"/);
});

test('drafts, foreign categories and untrusted image URLs never enter the archive', () => {
  const image = { src: '/images/real.webp', alt: 'real' };
  const projects = [
    { id: 'draft', category: 'tattoos', images: [image], published: false },
    { id: 'other', category: 'jewellery', images: [image] },
    { id: 'unsafe', category: 'tattoos', images: [{ src: 'javascript:alert(1)' }] },
  ];
  const markup = renderHorizontalDrift(projects, { category: 'tattoos' });
  assert.match(markup, /data-carousel-total="0"/);
  assert.match(markup, /archive in progress\./);
  assert.doesNotMatch(markup, /data-drift-item|<img|javascript:/);
});

test('single real artwork keeps its working viewer and honest one-image navigation count', () => {
  const markup = renderHorizontalDrift([{ category: 'flashes', images: [{ src: '/images/actual.webp', alt: 'actual', width: 500, height: 700 }] }], { category: 'flashes' });
  assert.match(markup, /data-carousel-total="1"/);
  assert.match(markup, /data-drift-count aria-hidden="true">01\/ 01/);
  assert.equal((markup.match(/data-drift-item/g) || []).length, 1);
  assert.equal((markup.match(/data-artwork-open/g) || []).length, 1);
  assert.equal((markup.match(/ disabled>/g) || []).length, 2);
  assert.doesNotMatch(markup, /data-digital-ink|canvas|placeholder/);
});

test('carousel totals follow the actual published photo list when photographs are added or removed', () => {
  const image = { src: '/images/tattoos/tattoo-01.jpg', alt: 'supplied tattoo photograph', width: 1170, height: 1470 };
  for (const total of [0, 1, 3, 5, 8, 9]) {
    const projects = Array.from({ length: total }, (_, index) => ({ id: `count-fixture-${index}`, category: 'tattoos', images: [image] }));
    const markup = renderHorizontalDrift(projects, { category: 'tattoos' });
    assert.match(markup, new RegExp(`data-carousel-total="${total}"`));
    assert.match(markup, new RegExp(`data-drift-count aria-hidden="true">${String(total ? 1 : 0).padStart(2, '0')}\/ ${String(total).padStart(2, '0')}`));
    assert.equal((markup.match(/data-drift-item/g) || []).length, total);
    assert.equal((markup.match(/data-inline-expand/g) || []).length, total);
  }
});
