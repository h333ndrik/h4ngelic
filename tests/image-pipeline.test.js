import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { optimizeImages } from '../scripts/optimize-images.mjs';
import { getImageAsset } from '../src/image-assets.js';
import imageManifest from '../src/data/imageManifest.json' with { type: 'json' };

test('an explicit full-resolution source uses its optimized variant in the viewer', () => {
  const previewSource = '/images/__viewer-preview.jpg';
  const fullSource = '/images/__viewer-full-resolution.jpg';
  const previous = new Map([previewSource, fullSource].map((key) => [key, {
    present: Object.hasOwn(imageManifest, key), value: imageManifest[key],
  }]));
  try {
    imageManifest[previewSource] = { width: 640, height: 800, variants: [
      { src: '/images/optimized/__viewer-preview-320.webp', width: 320, height: 400 },
      { src: '/images/optimized/__viewer-preview-640.webp', width: 640, height: 800 },
    ] };
    imageManifest[fullSource] = { width: 3000, height: 3750, variants: [
      { src: '/images/optimized/__viewer-full-960.webp', width: 960, height: 1200 },
      { src: '/images/optimized/__viewer-full-1920.webp', width: 1920, height: 2400 },
    ] };
    const asset = getImageAsset({ src: previewSource, fullSrc: fullSource });
    assert.equal(asset.src, '/images/optimized/__viewer-preview-640.webp', 'The archive still uses its smaller responsive preview.');
    assert.equal(asset.fullSrc, '/images/optimized/__viewer-full-1920.webp', 'Opening artwork must not bypass optimization by downloading the original high-resolution JPEG.');
    assert.equal(getImageAsset({ src: previewSource }).fullSrc, '/images/optimized/__viewer-preview-640.webp');
    assert.equal(getImageAsset({ src: previewSource, fullSrc: 'https://example.test/remote.webp' }).fullSrc, 'https://example.test/remote.webp', 'An unprocessed external image retains its explicit destination.');
  } finally {
    for (const [key, saved] of previous) {
      if (saved.present) imageManifest[key] = saved.value;
      else delete imageManifest[key];
    }
  }
});

test('real supplied pixels generate responsive WebP sizes, dimensions and unchanged originals', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'h4-images-'));
  try {
    await mkdir(join(directory, 'public/images'), { recursive: true });
    await mkdir(join(directory, 'src/data'), { recursive: true });
    const original = await readFile(new URL('../public/assets/tattoo-texture.webp', import.meta.url));
    await writeFile(join(directory, 'public/images/original.webp'), original);
    const root = pathToFileURL(`${directory}/`);
    const manifest = await optimizeImages({ root, projects: [{ images: [{ src: '/images/original.webp' }] }], portrait: null });
    assert.equal(manifest['/images/original.webp'].width, 1024);
    assert.equal(manifest['/images/original.webp'].height, 1448);
    assert.deepEqual(manifest['/images/original.webp'].variants.map((variant) => variant.width), [320, 640, 960, 1024]);
    for (const variant of manifest['/images/original.webp'].variants) {
      const metadata = await sharp(new URL(`public${variant.src}`, root).pathname).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, variant.width);
      assert.equal(metadata.height, variant.height);
    }
    assert.deepEqual(await readFile(join(directory, 'public/images/original.webp')), original);
    assert.deepEqual(await optimizeImages({ root, projects: [{ images: [{ src: '/images/original.webp' }] }], portrait: null }), manifest, 'Image output paths must be repeatable.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
