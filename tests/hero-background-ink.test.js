import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExposedHeroBackground, registerHeroInkHitTest, rememberHeroInkHit } from '../src/hero-background-ink.js';

function surface() {
  const hero = { hidden: false };
  return { hero, canvas: { id: 'logo-canvas', matches: value => value === 'canvas', closest: () => hero } };
}

test('exposed hero canvas accepts blank clicks before startup without loading a renderer', () => {
  const { hero, canvas } = surface();
  assert.equal(isExposedHeroBackground({ target: canvas }), true);
  hero.hidden = true;
  assert.equal(isExposedHeroBackground({ target: canvas }), false);
  assert.equal(isExposedHeroBackground({ target: { id: 'another-canvas' } }), false);
  assert.equal(isExposedHeroBackground({ target: { id: 'pause-control' } }), false);
});

test('real mesh hits exclude flat ink, empty canvas accepts it, and event results share the raycast', () => {
  const { canvas } = surface();
  let hits = true;
  let reads = 0;
  const stop = registerHeroInkHitTest(canvas, () => { reads++; return hits; });
  const overMesh = { target: canvas };
  assert.equal(isExposedHeroBackground(overMesh), false);
  assert.equal(isExposedHeroBackground(overMesh), false);
  assert.equal(reads, 1);
  hits = false;
  assert.equal(isExposedHeroBackground({ target: canvas }), true);
  const classifiedByScene = { target: canvas };
  const hit = { faceIndex: 12 };
  assert.equal(rememberHeroInkHit(classifiedByScene, hit), hit);
  assert.equal(isExposedHeroBackground(classifiedByScene), false);
  assert.equal(reads, 2, 'The document reuses the existing scene result.');
  stop();
  assert.equal(isExposedHeroBackground({ target: canvas }), true);
  assert.equal(reads, 2);
});

test('an obsolete cleanup cannot remove a replacement scene hit tester', () => {
  const { canvas } = surface();
  const old = registerHeroInkHitTest(canvas, () => false);
  const current = registerHeroInkHitTest(canvas, () => true);
  old();
  assert.equal(isExposedHeroBackground({ target: canvas }), false);
  current();
  assert.equal(isExposedHeroBackground({ target: canvas }), true);
});
