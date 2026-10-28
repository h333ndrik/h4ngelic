import test from 'node:test';
import assert from 'node:assert/strict';
import { orderedArtworks, artworkImages } from '../src/artwork-content.js';

test('editor ordering is stable and a selected cover does not mutate authored images', () => {
  const first = { src: '/images/whole.webp' }, detail = { src: '/images/detail.webp' };
  const project = { id: 'cover', images: [first, detail], cover: detail.src };
  assert.deepEqual(artworkImages(project), [detail, first]);
  assert.deepEqual(project.images, [first, detail]);
  assert.deepEqual(artworkImages({ ...project, cover: '/missing.webp' }), [first, detail]);
  const projects = [{ id: 'unranked' }, { id: 'second', order: 2 }, { id: 'first', order: 1 }, { id: 'also-second', order: 2 }];
  assert.deepEqual(orderedArtworks(projects).map(project => project.id), ['first', 'second', 'also-second', 'unranked']);
  assert.equal(projects[0].id, 'unranked');
});
