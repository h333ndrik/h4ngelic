import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easterSettings, visitorMessages, visitorMessage, nextVisit, canRememberVisits } from '../src/data/easterSettings.js';
import { renderFooter } from '../src/footer.js';
import { featureFlags } from '../src/data/featureFlags.js';
import { createInkImprint } from '../src/ink-imprint.js';

test('visitor copy follows the six exact messages, then remains stable', () => {
  assert.deepEqual(visitorMessages, [
    'nice to meet you.', 'you came back.', "twice wasn't enough?", 'getting familiar.',
    "we're practically friends now.", 'you know your way around here.',
  ]);
  for (let count = 1; count <= 6; count++) assert.equal(visitorMessage(count), visitorMessages[count - 1]);
  assert.equal(visitorMessage(99), 'you know your way around here.');
  assert.equal(visitorMessage(-1), 'nice to meet you.');
});

test('ordinary page views and reloads are one visit until separated inactivity', () => {
  const interval = 30 * 60 * 1000;
  const first = nextVisit(null, 1000, interval);
  assert.deepEqual(first, { count: 1, lastSeen: 1000 });
  const reload = nextVisit(first, 1200, interval);
  assert.deepEqual(reload, { count: 1, lastSeen: 1200 });
  const navigation = nextVisit(reload, 1300, interval);
  assert.deepEqual(navigation, { count: 1, lastSeen: 1300 });
  assert.deepEqual(nextVisit(navigation, 1300 + interval, interval), { count: 2, lastSeen: 1300 + interval });
  assert.deepEqual(nextVisit({ count: '99', lastSeen: 0 }, 2000), { count: 1, lastSeen: 2000 });
  assert.deepEqual(nextVisit({ count: 4, lastSeen: 9000 }, 8000), { count: 4, lastSeen: 8000 }, 'Clock rollback must not create a new visit.');
});

test('persistent visitor memory requires both an explicit flag and valid consent', () => {
  assert.equal(easterSettings.visits.enabled, false);
  assert.equal(canRememberVisits(easterSettings.visits, true), false);
  assert.equal(canRememberVisits({ enabled: true }, false), false);
  assert.equal(canRememberVisits({ enabled: true }, 'yes'), false);
  assert.equal(canRememberVisits({ enabled: true }, true), true);
});

test('the postponed mode has no public teaser; homepage reserves a spacious quiet area', () => {
  assert.equal(featureFlags.otherSideEnabled, false);
  const html = renderFooter({ home: true });
  assert.match(html, /h4ngelic © 2026/);
  assert.match(html, /berlin, de/);
  assert.match(html, /data-footer-secret-space/);
  assert.doesNotMatch(html, /data-visit-message|data-visit-number/, 'Visitor copy belongs to the header, not the visible footer.');
  assert.doesNotMatch(html, /press 4|data-xray-toggle|data-other-side-hint|aria-keyshortcuts/);
  assert.doesNotMatch(html, /instagram|book a tat|mailto:/, 'The homepage contact links are not duplicated in the footer.');
  assert.doesNotMatch(renderFooter(), /data-footer-secret-space/, 'The large quiet area is homepage-specific.');
});

test('the future hint is opt-in, exact lowercase copy and a reveal-only accessible hotspot', () => {
  const html = renderFooter({ home: true, otherSideEnabled: true });
  assert.match(html, /data-other-side-hint data-secret-hotspot aria-label="reveal the other side shortcut"/);
  assert.match(html, />press 4 for the other side\.<\/span>/);
  assert.doesNotMatch(html, /data-xray-toggle|background|border|PRESS 4/);
});

test('each procedural ink impression changes its contour, fragmentation and pigment density', () => {
  let seed = 981;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  const samples = Array.from({ length: 120 }, () => createInkImprint(random));
  const mainContours = samples.map((markup) => markup.match(/d="([^"]+)"/)[1]);
  const fragments = samples.map((markup) => (markup.match(/<path /g) || []).length);
  const densities = samples.map((markup) => markup.match(/opacity="([^"]+)"/)[1]);
  assert.equal(new Set(mainContours).size, samples.length, 'Variation must exist in actual path geometry, not a rotated/scaled copy.');
  assert.ok(new Set(fragments).size >= 5, 'Satellite/fragment counts must vary.');
  assert.ok(new Set(densities).size >= 12, 'Ink density must vary independently of silhouette.');
  for (const markup of samples) {
    assert.doesNotMatch(markup, /NaN|Infinity|<circle|<ellipse/);
    assert.ok((markup.match(/<path /g) || []).length >= 4);
  }
  for (const extreme of [0, .999999]) assert.doesNotMatch(createInkImprint(() => extreme, { pressure: 1 }), /NaN|Infinity/);
});
