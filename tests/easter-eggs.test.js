import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easterSettings, visitorMessages, visitorMessage, nextVisit, canRememberVisits } from '../src/data/easterSettings.js';
import { renderFooter } from '../src/footer.js';

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

test('prerendered footer preserves identity and an accessible discreet mode control', () => {
  const html = renderFooter({ home: true });
  assert.match(html, /h4ngelic © 2026/);
  assert.match(html, /berlin, de/);
  assert.match(html, /data-visit-message>nice to meet you\./);
  assert.match(html, /data-visit-number>visit 001/);
  assert.match(html, /data-xray-toggle aria-label="toggle the other side \(4\)" aria-pressed="false"/);
  assert.match(html, /PRESS 4 TO SEE THE OTHER SIDE\./);
  assert.match(html, /data-mode-status role="status" aria-live="polite"/);
  assert.doesNotMatch(html, /instagram|book a tat|mailto:/, 'The homepage contact links are not duplicated in the footer.');
});
