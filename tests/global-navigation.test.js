import test from 'node:test';
import assert from 'node:assert/strict';
import { activeChapter, naaviUsesDisplayContrast } from '../src/global-navigation-state.js';
import { naaviStops, naaviState, initialNaaviIndex, renderNAAVI } from '../src/naavi-content.js';

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

test('Home includes the final h4 as 04 / 04 and cycles from it to the actual hero', () => {
  const stops = naaviStops('home');
  assert.deepEqual(stops.map(stop => stop.id), ['home-hero','selected-work','about-preview','contact','final-secret']);
  assert.equal(naaviState(stops, 0).total, 4);
  assert.equal(naaviState(stops, 3).destination.id, 'final-secret');
  assert.equal(naaviState(stops, 4).destination.id, 'home-hero');
});

test('Work numbers only the three main groups and HOME is a real route', () => {
  const stops = naaviStops('work');
  assert.deepEqual(stops.map(stop => stop.label), ['home','works / tattoos','jewellery','more']);
  assert.equal(naaviState(stops, 3).destination.href, '/');
  assert.equal(naaviState(stops, 1).total, 3);
  assert.equal(initialNaaviIndex({ kind:'artwork',category:'digital-artworks' }), 3);
});

test('About renders one reusable accessible no-JS link with active 01 / 01', () => {
  const html = renderNAAVI({ kind: 'about' });
  assert.match(html, /href="\/"/);
  assert.match(html, /data-chapter="1" data-chapter-total="1"/);
  assert.match(html, /NAAVI: 01 \/ 01, about. go to home/);
  assert.doesNotMatch(html, /details|summary|data-no-hover/);
});


test('NAAVI contrast covers the entire link only over display type and gives quiet form/UI regions priority', () => {
  const nav = { left: 100, right: 188, top: 730, bottom: 774 };
  const heading = { left: 35, right: 350, top: 700, bottom: 790 };
  const form = { left: 50, right: 300, top: 740, bottom: 860 };
  assert.equal(naaviUsesDisplayContrast(nav, [heading]), true);
  assert.equal(naaviUsesDisplayContrast(nav, [heading], [form]), false);
  assert.equal(naaviUsesDisplayContrast(nav, [], [form]), false);
  assert.equal(naaviUsesDisplayContrast(nav, [{ ...heading, bottom: 729 }]), false);
  assert.equal(naaviUsesDisplayContrast(nav, [{ ...heading, right: 100 }]), false, 'Touching edges do not claim overlap.');
  assert.equal(naaviUsesDisplayContrast(nav, [{ ...heading, left: NaN }]), false);
  assert.equal(naaviUsesDisplayContrast(null, [heading]), false);
});
