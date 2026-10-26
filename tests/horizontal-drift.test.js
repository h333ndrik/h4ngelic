import test from 'node:test';
import assert from 'node:assert/strict';
import { driftPlacement, horizontalDriftCategories, renderHorizontalDrift } from '../src/horizontal-drift-content.js';

test('only the agreed three archives receive Horizontal Drift', () => {
  assert.deepEqual(horizontalDriftCategories, ['tattoos', 'flashes', 'analog-photography']);
  for (const category of ['jewellery', 'digital-artworks', 'paintings', 'more', 'all']) {
    assert.equal(renderHorizontalDrift([], { category }), '');
  }
  assert.equal(renderHorizontalDrift([], { category: 'tattoos' }), '<p class="archive-empty">archive in progress.</p>');
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
  assert.equal(renderHorizontalDrift(projects, { category: 'tattoos' }), '<p class="archive-empty">archive in progress.</p>');
});

test('each spatial pose is deterministic, restrained and identical between worlds', () => {
  const poses = Array.from({ length: 30 }, (_, index) => driftPlacement(index));
  assert.ok(new Set(poses.map(value => JSON.stringify(value))).size > 3);
  poses.forEach((pose, index) => {
    assert.deepEqual(pose, driftPlacement(index));
    assert.ok(Math.abs(pose.y) < 32 && pose.z >= -80 && pose.z <= 0 && Math.abs(pose.angle) <= 5);
  });
});
