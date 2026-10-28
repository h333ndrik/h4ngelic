import test from 'node:test';
import assert from 'node:assert/strict';
import { createDigitalInkField, paintDigitalInkAlpha, digitalInkProgress, digitalInkBoundary } from '../src/digital-ink-field.js';
import { renderDigitalInk } from '../src/digital-ink-content.js';
import { featuredDigitalArtwork } from '../src/data/digitalArtworkSettings.js';

const fixture = { id: 'test-only', category: 'digital-artworks', title: 'unit fixture', published: true,
  images: [{ src: '/images/test-only.webp', alt: 'a test image', width: 800, height: 1200 }] };

test('supplied original is published with its native proportions; drafts and missing images remain honest', () => {
  assert.equal(featuredDigitalArtwork.published, true);
  assert.equal(featuredDigitalArtwork.images[0].src, '/images/digital-artworks/green-black-original.jpg');
  assert.deepEqual([featuredDigitalArtwork.images[0].width, featuredDigitalArtwork.images[0].height], [1440, 1920]);
  assert.match(renderDigitalInk([featuredDigitalArtwork]), /data-digital-ink/);
  const markup = renderDigitalInk([{ ...featuredDigitalArtwork, published: false }]);
  assert.match(markup, /archive in progress\./);
  assert.match(markup, /data-digital-asset-slot="green-black-original"/);
  assert.doesNotMatch(markup, /<img|<canvas|data-artwork-open/);
});

test('real digital images keep native dimensions, meaningful alt text and full source', () => {
  const markup = renderDigitalInk([fixture]);
  assert.match(markup, /data-digital-ink/);
  assert.match(markup, /width="800" height="1200"/);
  assert.match(markup, /data-full-src="\/images\/test-only.webp"/);
  assert.match(markup, /alt="a test image"/);
  assert.match(markup, /loading="lazy"/);
  assert.doesNotMatch(renderDigitalInk([{ ...fixture, category: 'jewellery' }]), /<img/);
  assert.doesNotMatch(renderDigitalInk([{ ...fixture, images: [{ src: 'javascript:bad()' }] }]), /<img/);
  assert.doesNotMatch(renderDigitalInk([{ ...fixture, title: '<script>bad()</script>' }]), /<script>/);
});

test('organic field is deterministic, seeded and has multiple independent emergence islands', () => {
  const first = createDigitalInkField(80, 80, 19);
  assert.deepEqual(first.values, createDigitalInkField(80, 80, 19).values);
  assert.notDeepEqual(first.values, createDigitalInkField(80, 80, 20).values);
  const pixels = paintDigitalInkAlpha(first, .48, new Uint8ClampedArray(80 * 80 * 4));
  const seen = new Uint8Array(80 * 80);
  let islands = 0;
  for (let index = 0; index < seen.length; index++) {
    if (seen[index] || pixels[index * 4 + 3] < 180) continue;
    const queue = [index]; seen[index] = 1; let count = 0;
    while (queue.length) {
      const point = queue.pop(); count++;
      for (const neighbor of [point - 80, point + 80, point % 80 ? point - 1 : -1, point % 80 < 79 ? point + 1 : -1]) {
        if (neighbor < 0 || neighbor >= seen.length || seen[neighbor] || pixels[neighbor * 4 + 3] < 180) continue;
        seen[neighbor] = 1; queue.push(neighbor);
      }
    }
    if (count > 8) islands++;
  }
  assert.ok(islands > 1, `expected separate material regions, observed ${islands}`);
});

test('scroll mask grows monotonically, reverses exactly, and has clean endpoint fidelity', () => {
  const field = createDigitalInkField(64, 64, 18);
  const at = progress => paintDigitalInkAlpha(field, progress, new Uint8ClampedArray(field.values.length * 4));
  const empty = at(0), before = at(.3), after = at(.72), reversed = at(.3), full = at(1);
  assert.deepEqual(before, reversed);
  for (let index = 3; index < full.length; index += 4) {
    assert.equal(empty[index], 0);
    assert.equal(full[index], 255);
    assert.ok(after[index] >= before[index]);
  }
  assert.ok(before.some((value, index) => index % 4 === 3 && value > 0 && value < 255), 'soft material edge exists');
});

test('scroll progress has deterministic local boundaries and actual contour samples stay bounded', () => {
  assert.equal(digitalInkProgress({ top: 96, height: 1720, viewportHeight: 800 }), 0);
  assert.equal(digitalInkProgress({ top: -824, height: 1720, viewportHeight: 800 }), 1);
  assert.equal(digitalInkProgress({ top: -364, height: 1720, viewportHeight: 800 }), .5);
  assert.equal(digitalInkProgress({ top: NaN, height: 1720, viewportHeight: 800 }), 0);
  const field = createDigitalInkField(64, 64, 13);
  const first = digitalInkBoundary(field, .2), later = digitalInkBoundary(field, .7);
  assert.equal(first.length, 8);
  assert.notDeepEqual(first, later);
  for (const point of first.concat(later)) assert.ok(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
});
