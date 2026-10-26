import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentURL } from '../src/content-utils.js';
import { getImageAsset } from '../src/image-assets.js';
import { previewImageURL } from '../src/preview-assets.js';
import manifest from '../src/data/imageManifest.json' with { type: 'json' };

test('offline portfolio keeps safe logical URLs while resolving only explicitly embedded image bytes', () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousImages = Object.getOwnPropertyDescriptor(globalThis, '__H4_PREVIEW_IMAGES__');
  const path = '/images/digital-artworks/green-black-original.jpg';
  const known = manifest[path];
  assert.ok(known?.variants.length > 1, 'The actual original has responsive variants.');
  const map = Object.fromEntries([path, ...known.variants.map(variant => variant.src)]
    .map((source, index) => [source, `data:image/webp;base64,${'A'.repeat(index + 4)}`]));
  try {
    globalThis.document = { documentElement: { dataset: { preview: 'standalone' } } };
    globalThis.__H4_PREVIEW_IMAGES__ = map;
    assert.equal(contentURL(path), path);
    assert.equal(contentURL(map[path]), path, 'An overlapping hero/image resource can recover its safe logical URL.');
    assert.equal(contentURL('data:image/webp;base64,unregistered'), '');
    assert.equal(contentURL('javascript:alert(1)'), '');
    const image = getImageAsset({ src: path });
    assert.ok(Object.values(map).includes(image.src));
    assert.ok(Object.values(map).includes(image.fullSrc));
    assert.equal(image.width, 1440);
    assert.equal(image.height, 1920);
    for (const variant of known.variants) assert.ok(image.srcset.includes(`${map[variant.src]} ${variant.width}w`));
    document.documentElement.dataset.preview = '';
    assert.equal(previewImageURL(path), path);
    assert.equal(contentURL(map[path]), '', 'The served website does not permit data URLs.');
    assert.ok(getImageAsset({ src: path }).src.startsWith('/images/optimized/'));
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else delete globalThis.document;
    if (previousImages) Object.defineProperty(globalThis, '__H4_PREVIEW_IMAGES__', previousImages); else delete globalThis.__H4_PREVIEW_IMAGES__;
  }
});
