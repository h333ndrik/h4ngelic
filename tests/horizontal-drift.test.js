import test from 'node:test';
import assert from 'node:assert/strict';
import { driftPlacement, horizontalDriftCategories, renderHorizontalDrift } from '../src/horizontal-drift-content.js';

test('only the agreed three archives receive a horizontal carousel, including honest empty shells', () => {
  assert.deepEqual(horizontalDriftCategories, ['tattoos', 'flashes', 'analog-photography']);
  for (const category of ['jewellery', 'digital-artworks', 'paintings', 'more', 'all']) {
    assert.equal(renderHorizontalDrift([], { category }), '');
  }
  const empty = renderHorizontalDrift([], { category: 'tattoos' });
  assert.match(empty, /data-horizontal-drift="tattoos"/);
  assert.match(empty, /aria-roledescription="carousel"/);
  assert.match(empty, /data-carousel-total="0"/);
  assert.match(empty, /data-drift-count aria-hidden="true">0 \/ 0/);
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
  assert.match(markup, /drift-detail-image" hidden/);
  assert.equal((markup.match(/data-artwork-open/g) || []).length, 2);
  assert.match(markup, /&lt;original&gt;/);
  assert.match(markup, /skin &amp; ink/);
  assert.match(markup, /href="\/work\/tattoos\/original-work"/);
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
  assert.match(markup, /data-drift-count aria-hidden="true">1 \/ 1/);
  assert.equal((markup.match(/data-drift-item/g) || []).length, 1);
  assert.equal((markup.match(/data-artwork-open/g) || []).length, 1);
  assert.equal((markup.match(/ disabled>/g) || []).length, 2);
  assert.doesNotMatch(markup, /data-digital-ink|canvas|placeholder/);
});

test('each spatial pose is deterministic, restrained and identical between worlds', () => {
  const poses = Array.from({ length: 30 }, (_, index) => driftPlacement(index));
  assert.ok(new Set(poses.map(value => JSON.stringify(value))).size > 3);
  poses.forEach((pose, index) => {
    assert.deepEqual(pose, driftPlacement(index));
    assert.ok(Math.abs(pose.y) < 32 && pose.z >= -80 && pose.z <= 0 && Math.abs(pose.angle) <= 5);
  });
});
