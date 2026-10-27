import test from 'node:test';
import assert from 'node:assert/strict';
import { activeChapter, primaryIndexPage, hasFinalChapterStop, clearChapterTop } from '../src/global-navigation-state.js';

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

test('Contact reaches its actual final h4 stop before wrapping, even when the ending is shorter than the viewport', () => {
  const ending = { current: 3, count: 4, finalTop: 4900, maximumScroll: 4600 };
  assert.equal(hasFinalChapterStop({ ...ending, scrollTop: 4100 }), true);
  assert.equal(hasFinalChapterStop({ ...ending, scrollTop: 4600 }), false);
  assert.equal(hasFinalChapterStop({ ...ending, scrollTop: 4599 }), false);
  assert.equal(hasFinalChapterStop({ ...ending, current: 2, scrollTop: 4100 }), false);
  assert.equal(hasFinalChapterStop({ ...ending, finalTop: Infinity, scrollTop: 4100 }), false);
});

test('the counter remains in its normal place until a real form hit area needs room', () => {
  const base = { preferredTop: 780, height: 48, viewportBottom: 844 };
  assert.equal(clearChapterTop(base), 780);
  const top = clearChapterTop({ ...base, obstacles: [{ top: 760, bottom: 815 }] });
  assert.ok(top + 48 + 6 <= 760, 'Input and navigation hit targets must not overlap.');
  assert.ok(780 - top < 100, 'A standard field needs only a small correction.');
});

test('a cleared counter position is stable through adjacent form controls and returns when space clears', () => {
  const base = { preferredTop: 780, previousTop: 700, height: 48, viewportBottom: 844 };
  assert.equal(clearChapterTop({ ...base, obstacles: [{ top: 760, bottom: 825 }] }), 700);
  assert.equal(clearChapterTop({ ...base, obstacles: [{ top: 100, bottom: 300 }] }), 780);
});

test('counter placement fits a reduced visual viewport and avoids more than one protected area', () => {
  const top = clearChapterTop({ preferredTop: 780, height: 48, viewportTop: 120, viewportBottom: 470,
    obstacles: [{ top: 390, bottom: 460 }, { top: 230, bottom: 320 }] });
  assert.ok(top >= 126 && top + 48 <= 464);
  assert.ok(top + 48 + 6 <= 390 && top - 6 >= 320);
});
