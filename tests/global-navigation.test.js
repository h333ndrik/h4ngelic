import test from 'node:test';
import assert from 'node:assert/strict';
import { activeChapter, primaryIndexPage } from '../src/global-navigation-state.js';

test('chapter activation follows real section positions in either scroll direction', () => {
  const sections = [0, 844, 2600, 4300];
  assert.equal(activeChapter(sections, 0, 844), 0);
  assert.equal(activeChapter(sections, 500, 844), 1);
  assert.equal(activeChapter(sections, 4300, 844), 3);
  assert.equal(activeChapter(sections, 2400, 844), 2);
  assert.equal(activeChapter(sections, 0, 844), 0);
});

test('chapter count is not presumed for absent sections', () => {
  assert.equal(activeChapter([], 0, 844), -1);
  assert.equal(activeChapter([0, 1000], 10000, 844), 1);
  assert.equal(activeChapter([0], 10000, 844), 0);
});

test('jumping to a short mobile section does not skip its chapter', () => {
  assert.equal(activeChapter([0, 900, 1180, 1560], 900, 900), 1);
  assert.equal(activeChapter([0, 900, 1180, 1560], 1180, 900), 2);
});

test('artwork details retain WORK in the four-entry primary index', () => {
  assert.equal(primaryIndexPage('artwork'), 'work');
  for (const kind of ['home', 'work', 'about', 'contact']) assert.equal(primaryIndexPage(kind), kind);
  assert.equal(primaryIndexPage('not-found'), '');
});
