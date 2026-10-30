import test from 'node:test';
import assert from 'node:assert/strict';
import { motionSettings, progressBetween, sampleCalmProgress, sampleCalmItem, sampleHeading, sampleHero,
  sampleHeroBar, sampleKineticItem, pinnedProgress, kineticItemProgress, sampleMotionTrail, sampleFlyIn } from '../src/data/motionSettings.js';

test('editorial content enters from a bounded right offset without rotation or overshoot', () => {
  for (const width of [320, 390, 1440]) {
    const initial = sampleCalmItem(0, width);
    assert.ok(initial.x > 0 && initial.x <= 36);
    assert.deepEqual(sampleCalmItem(1, width), { x: 0, rotation: 0, opacity: 1 });
    let previous = initial;
    for (let index = 0; index <= 1000; index++) {
      const pose = sampleCalmItem(index / 1000, width);
      assert.equal(pose.rotation, 0);
      assert.ok(pose.x >= 0 && pose.x <= previous.x);
      assert.ok(pose.opacity >= previous.opacity && pose.opacity <= 1);
      previous = pose;
    }
  }
});

test('compatibility exports preserve module APIs but no longer stagger or launch words', () => {
  assert.equal('fly' in motionSettings, false);
  assert.equal('trail' in motionSettings, false);
  for (const width of [320, 390, 1440]) for (const progress of [-1, 0, .2, .5, .8, 1, 2]) {
    for (let index = 0; index < 3; index++) {
      assert.deepEqual(sampleKineticItem(progress, index, width), sampleCalmItem(progress, width));
      assert.equal(kineticItemProgress(progress, index), progressBetween(progress, motionSettings.calm.start, motionSettings.calm.end));
    }
    for (const layer of [0, 1]) assert.deepEqual(sampleMotionTrail(progress, layer, width), { x: 0, opacity: 0 });
  }
  assert.deepEqual(sampleFlyIn(.5, { distance: 36, rotation: 6, overshoot: 12 }), sampleCalmProgress(.5, 36));
});

test('calm interpolation meets stationary endpoints without velocity or acceleration jumps', () => {
  const h = .00001;
  for (const component of ['x', 'opacity']) for (const boundary of [0, 1]) {
    const f = value => sampleCalmProgress(value, 1)[component];
    const v = f(boundary);
    const leftVelocity = (3 * v - 4 * f(boundary - h) + f(boundary - 2 * h)) / (2 * h);
    const rightVelocity = (-3 * v + 4 * f(boundary + h) - f(boundary + 2 * h)) / (2 * h);
    const leftAcceleration = (2 * v - 5 * f(boundary - h) + 4 * f(boundary - 2 * h) - f(boundary - 3 * h)) / h ** 2;
    const rightAcceleration = (2 * v - 5 * f(boundary + h) + 4 * f(boundary + 2 * h) - f(boundary + 3 * h)) / h ** 2;
    assert.ok(Math.abs(leftVelocity - rightVelocity) < .00001);
    assert.ok(Math.abs(leftAcceleration - rightAcceleration) < .002);
  }
});

test('reverse and stopped scrolling reproduce the exact same simultaneous poses', () => {
  const positions = Array.from({ length: 121 }, (_, index) => -.2 + index * .012);
  const down = positions.map(progress => sampleCalmItem(progress, 390));
  const up = positions.toReversed().map(progress => sampleCalmItem(progress, 390)).toReversed();
  assert.deepEqual(up, down);
  for (let repeat = 0; repeat < 10; repeat++) assert.deepEqual(sampleCalmItem(.47, 390), sampleCalmItem(.47, 390));
});

test('numeric heading rise and accepted hero recession keep exact rest states', () => {
  assert.deepEqual(sampleHeading(-1), { y: motionSettings.heading.rise, opacity: 0 });
  assert.deepEqual(sampleHeading(1), { y: 0, opacity: 1 });
  assert.deepEqual(sampleHero(0), { scale: 1, opacity: 1 });
  assert.deepEqual(sampleHero(1), { scale: motionSettings.hero.scale, opacity: 0 });
  assert.equal(progressBetween(-100, 0, 100), 0);
  assert.equal(progressBetween(200, 0, 100), 1);
});

test('the existing native sticky clock remains continuous with shorter phone reservation', () => {
  const height = 1000, top = 2000, run = height * motionSettings.pin.work;
  assert.equal(pinnedProgress(top - height * motionSettings.approach, top, height, run), 0);
  assert.equal(pinnedProgress(top + run, top, height, run), 1);
  assert.ok(motionSettings.pin.mobileWork < motionSettings.pin.work);
  assert.ok(sampleCalmItem(pinnedProgress(top, top, height, run), 1440).opacity > 0);
});

test('the whole hero bar fades reversibly and is hidden before the next section fills the screen', () => {
  assert.deepEqual(sampleHeroBar(0), { opacity: 1, hidden: false });
  assert.deepEqual(sampleHeroBar(.55), { opacity: 0, hidden: true });
  assert.deepEqual(sampleHeroBar(1), { opacity: 0, hidden: true });
  const progress = [0, .02, .1, .25, .4, .55, .8, 1];
  const down = progress.map(p => sampleHeroBar(p));
  assert.deepEqual(down, progress.toReversed().map(p => sampleHeroBar(p)).toReversed());
  assert.ok(down.slice(1).every((pose, index) => pose.opacity <= down[index].opacity));
  assert.ok(sampleHeroBar(.25).opacity > 0 && sampleHeroBar(.25).opacity < 1);
});

test('reduced motion switches the hero bar instantly and remains reversible', () => {
  for (const progress of [-1, 0, .2, .54]) assert.deepEqual(sampleHeroBar(progress, { reduced: true }), { opacity: 1, hidden: false });
  for (const progress of [.55, .8, 1, 2]) assert.deepEqual(sampleHeroBar(progress, { reduced: true }), { opacity: 0, hidden: true });
});
