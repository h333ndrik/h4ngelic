import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easterSettings, visitorMessages, visitorMessage, nextVisit, canRememberVisits } from '../src/data/easterSettings.js';
import { renderFooter } from '../src/footer.js';
import { createInkImprint } from '../src/ink-imprint.js';

test('visitor copy follows the seven exact personal stages, including returning intervals', () => {
  assert.deepEqual(visitorMessages, [
    'nice to meet you.', 'you came back.', 'we’re practically friends now.',
    "getting familiar, aren't we?", 'you know your way around here.',
    'some things are worth returning to.', "you're part of this place now.",
  ]);
  for (let count = 1; count <= 5; count++) assert.equal(visitorMessage(count), visitorMessages[count - 1]);
  for (let count = 6; count <= 9; count++) assert.equal(visitorMessage(count), visitorMessages[5]);
  for (const count of [10, 11, 99, Number.MAX_SAFE_INTEGER]) assert.equal(visitorMessage(count), visitorMessages[6]);
  for (const invalid of [-1, 0, NaN, Infinity, '3']) assert.equal(visitorMessage(invalid), visitorMessages[0]);
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

test('the requested local counter works by default and supports opt-out or a host consent gate', () => {
  assert.equal(easterSettings.visits.enabled, true);
  assert.equal(canRememberVisits(easterSettings.visits), true);
  assert.equal(canRememberVisits({ enabled: false }, true), false);
  assert.equal(canRememberVisits({ enabled: true, requireConsent: true }, false), false);
  assert.equal(canRememberVisits({ enabled: true, requireConsent: true }, 'yes'), false);
  assert.equal(canRememberVisits({ enabled: true, requireConsent: true }, true), true);
});

test('the homepage keeps its hidden instruction separate from the identity-row count', () => {
  const html = renderFooter({ home: true, otherSideEnabled: true });
  assert.match(html, /h4ngelic © 2026/);
  assert.match(html, /berlin, de/);
  assert.match(html, /data-footer-secret-space/);
  assert.match(html, /data-visit-message/, 'The personal phrase accompanies the visible count.');
  assert.match(html, /data-other-side-hint data-secret-hotspot data-mode-hold/);
  assert.match(html, />HOLD 4 TO SEE THE OTHER SIDE\.<\/span>/);
  assert.match(html, /data-visit-counter-hotspot/);
  assert.match(html, /aria-describedby="footer-visit-count footer-visit-memory"/);
  assert.match(html, /data-visit-number id="footer-visit-count"/);
  assert.match(html, />visit 1<\/span>/);
  assert.ok(html.indexOf('data-smash') < html.indexOf('class="footer-instagram"'));
  assert.match(html, /data-smash[^>]*disabled/, 'Missing private soundtrack cannot fake playback.');
  assert.ok(html.indexOf('data-footer-secret-space') < html.indexOf('data-artist-footer'));
  assert.ok(html.indexOf('data-visit-counter-hotspot') > html.indexOf('footer-identity'));
  assert.doesNotMatch(html, /data-mode-mute/, 'The sound control belongs to the hero controls, without a footer duplicate.');
  assert.match(html, /data-mode-status role="status" aria-live="polite"/);
  assert.doesNotMatch(html, /data-xray-toggle/, 'A simple touch tap must not bypass the hold control.');
  assert.match(html, /class="footer-instagram" href="https:\/\/www\.instagram\.com\/h4ngelic\/"/,
    'The confirmed Instagram profile shares the metadata row.');
  assert.doesNotMatch(html, /book a tat|mailto:/, 'The inquiry form is not duplicated with extra contact links.');
  assert.doesNotMatch(renderFooter(), /data-footer-secret-space/, 'The large quiet area is homepage-specific.');
});

test('the shared release gate can still omit all alternate-mode controls independently of visits', () => {
  const html = renderFooter({ home: true, otherSideEnabled: false });
  assert.doesNotMatch(html, /data-other-side-hint|data-mode-hold|data-mode-mute|data-mode-status/);
  assert.match(html, /data-visit-number/);
  assert.match(renderFooter(), /data-visit-counter-hotspot/, 'The shared local visit count is present on interior routes too.');
});

test('ink remains temporary for six to twelve seconds with a bounded active count', () => {
  assert.equal(easterSettings.ink.minimumLifetimeMs, 6000);
  assert.equal(easterSettings.ink.maximumLifetimeMs, 12000);
  assert.equal(easterSettings.ink.maximumMarks, 12);
  assert.ok(new Set(easterSettings.ink.palette).size >= 5, 'Colorful chemical ink is configured for both modes.');
  assert.match(easterSettings.ink.texture, /corrupted-film.*\.webp$/);
});

test('ink clips actual film pixels and bounded displaced bands to independent organic masks', () => {
  const samples = Array.from({ length: 3 }, () => createInkImprint(() => .5, { texture: easterSettings.ink.texture }));
  const ids = samples.flatMap(markup => [...markup.matchAll(/<clipPath id="([^"]+)"/g)].map(match => match[1]));
  assert.equal(new Set(ids).size, ids.length, 'Concurrent marks must never share SVG clip IDs.');
  for (const markup of samples) {
    assert.match(markup, /data-ink-film href="\/assets\/corrupted-film-mobile\.webp"/);
    assert.match(markup, /class="ink-tear"/);
    assert.match(markup, /clip-rule="evenodd"/);
    assert.ok((markup.match(/data-ink-pigment=/g) || []).length >= 8);
    assert.ok((markup.match(/<image /g) || []).length <= 7);
    assert.ok((markup.match(/<path /g) || []).length <= 40);
    for (const [, reference] of markup.matchAll(/clip-path="url\(#([^\)]+)\)"/g)) assert.ok(markup.includes(`id="${reference}"`));
  }
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
