import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { artworks, suppliedTattooPhotographs } from '../src/data/artworks.js';
import { renderWorkPage } from '../src/pages.js';
import { publishedProjects } from '../src/routes.js';

const root = new URL('../', import.meta.url);
const evidence = JSON.parse(await readFile(new URL('docs/assets/tattoo-originals-v31.json', root), 'utf8'));
const approvedHashes = [
  '440d5b7f114eccaa6f04e499535bfa379169a4a18bcbea13f853c1f1b2730993',
  'c175805d6b02518e3a5c2948d2f005969c4f37fe4c843bfea077bd1fa9b2f848',
  '6af8684dd29a3e3d8f290cecdaec5b3c45425f20049f211802168344a89744bf',
  '01eed8dd82f145d538b206a3f668180aaafe714020d90a784d9428bc37d1b667',
  '839914e8e99e8e88392d6dc51e75718160eed4ba6dea77e7e4e66033f704e222',
  '898b43d493dee3460691999528414ce38f0453ccf974e317df34781adad539ef',
  '94200308cd8c1631702a0a60b33d61415fcac10dda9961d048e8e56c1ba848db',
  '637ed2c38c929dea469e48435bfd5996a6291403d1bf2795a66377a9131500f8',
];

test('all eight supplied Tattoo originals retain their approved JPEG bytes and exact display dimensions', async () => {
  assert.equal(evidence.archiveSHA256, '35046b97d44446a7d67bc60564780e5e84b5e91eebb77b7513be558c37c47782');
  assert.equal(evidence.images.length, 8);
  assert.equal(new Set(approvedHashes).size, 8, 'All eight distinct supplied originals are retained.');
  for (const [index, record] of evidence.images.entries()) {
    const expectedPath = `public/images/tattoos/tattoo-${String(index + 1).padStart(2, '0')}.jpg`;
    assert.equal(record.path, expectedPath);
    assert.ok(!record.archiveEntry.startsWith('__MACOSX/'));
    const bytes = await readFile(new URL(expectedPath, root));
    assert.equal(bytes.length, record.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), approvedHashes[index]);
    assert.equal(record.sha256, approvedHashes[index]);
    assert.equal(record.originalBytesPreserved, true);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'jpeg');
    const rotated = [5, 6, 7, 8].includes(metadata.orientation);
    assert.equal(record.width, rotated ? metadata.height : metadata.width);
    assert.equal(record.height, rotated ? metadata.width : metadata.height);
  }
});

test('central content publishes all eight photographs with real image paths, useful alt text and no invented project metadata', () => {
  assert.equal(suppliedTattooPhotographs.length, 8);
  for (const [index, project] of suppliedTattooPhotographs.entries()) {
    const record = evidence.images[index];
    assert.equal(project.id, `tattoo-${String(index + 1).padStart(2, '0')}`);
    assert.equal(project.category, 'tattoos');
    assert.equal(project.published, true);
    assert.ok(artworks.includes(project));
    assert.ok(publishedProjects().includes(project));
    assert.equal(project.title, '');
    assert.equal(project.description, '');
    assert.equal(project.year, undefined);
    assert.equal(project.images.length, 1);
    assert.equal(project.images[0].src, record.url);
    assert.deepEqual([project.images[0].width, project.images[0].height], [record.width, record.height]);
    assert.match(project.images[0].alt, /tattoo/);
  }
});

test('On Skin renders the actual eight-photo archive rather than an empty or fixture carousel', () => {
  const markup = renderWorkPage('tattoos');
  const onSkin = markup.split('data-horizontal-drift="tattoos"')[1].split('data-horizontal-drift="flashes"')[0];
  assert.match(onSkin, /data-carousel-total="8"/);
  assert.equal((onSkin.match(/data-drift-item/g) || []).length, 8);
  assert.doesNotMatch(onSkin, /carousel-fixture|archive in progress\./);
  assert.ok(onSkin.includes('1 / 8'));
  for (const project of suppliedTattooPhotographs) assert.ok(onSkin.includes(`/work/tattoos/${project.id}`));
});
