import test from 'node:test';
import assert from 'node:assert/strict';
import { getImageAsset } from '../src/image-assets.js';
import { renderProject, renderArtworkPage } from '../src/pages.js';
import { featuredDigitalArtwork } from '../src/data/digitalArtworkSettings.js';

const image = featuredDigitalArtwork.images[0];
const imageTag = markup => markup.match(/<img\b[^>]*>/)?.[0] || '';
const srcset = tag => tag.match(/\bsrcset="([^"]+)"/)?.[1] || '';
const candidates = value => [...value.matchAll(/ (\d+)w(?:,|$)/g)].map(match => Number(match[1]));

test('a constrained digital preview offers only 320/640 while preserving the explicit high-resolution viewer source', () => {
  const asset = getImageAsset(image, { maximumPreviewWidth: 640, sizes: '550px' });
  assert.match(asset.src, /-640\.webp$/);
  assert.deepEqual(candidates(asset.srcset), [320, 640]);
  assert.match(asset.fullSrc, /-1440\.webp$/, 'An explicit viewer opening retains its available source quality.');
  assert.equal(asset.sizes, '550px');
  assert.deepEqual([asset.width, asset.height], [1440, 1920], 'Authored dimensions still reserve the exact aspect ratio.');
});

test('non-digital previews keep the existing responsive range', () => {
  const asset = getImageAsset(image);
  assert.deepEqual(candidates(asset.srcset), [320, 640, 960, 1440]);
  assert.match(asset.src, /-960\.webp$/);
});

test('digital archive and detail render lazy, dimensioned small previews without an eager large-image download', () => {
  for (const markup of [renderProject(featuredDigitalArtwork), renderArtworkPage(featuredDigitalArtwork)]) {
    const tag = imageTag(markup);
    assert.match(tag, /loading="lazy"/);
    assert.doesNotMatch(tag, /fetchpriority="high"/);
    assert.match(tag, /width="1440" height="1920"/);
    assert.deepEqual(candidates(srcset(tag)), [320, 640]);
    assert.match(tag, /data-full-src="[^"]+-1440\.webp"/);
  }
  assert.match(renderArtworkPage(featuredDigitalArtwork), /data-artwork-category="digital-artworks"/);
});

test('digital preview sizing does not change the priority or image range of other project detail routes', () => {
  const ordinary = { ...featuredDigitalArtwork, id: 'unit-preview-scope', category: 'tattoos' };
  const tag = imageTag(renderArtworkPage(ordinary));
  assert.match(tag, /loading="eager" fetchpriority="high"/);
  assert.deepEqual(candidates(srcset(tag)), [320, 640, 960, 1440]);
});
