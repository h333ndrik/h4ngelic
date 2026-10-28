import test from 'node:test';
import assert from 'node:assert/strict';
import { motionSettings, progressBetween, sampleFlyIn, sampleHeading, sampleHero, sampleKineticItem, pinnedProgress, kineticItemProgress, sampleMotionTrail } from '../src/data/motionSettings.js';

test('kinetic links begin fully beyond the viewport and finish exactly at their editorial positions', () => {
  for (const width of [320, 390, 1440]) {
    for (let index = 0; index < 3; index++) {
      const initial = sampleKineticItem(-1, index, width);
      assert.ok(initial.x >= width * 1.3 && initial.x <= width * 1.7);
      assert.ok(initial.rotation >= 5 && initial.rotation <= 8);
      assert.equal(initial.opacity, 0);
      assert.deepEqual(sampleKineticItem(1, index, width), { x: 0, rotation: 0, opacity: 1 });
    }
  }
});

test('the three items enter sequentially and have all settled before native pin release', () => {
  const { start, stagger, duration } = motionSettings.fly;
  const sample = start + stagger / 2;
  assert.ok(sampleKineticItem(sample, 0, 1440).x < 1440 * motionSettings.fly.distanceVw);
  assert.equal(sampleKineticItem(sample, 1, 1440).opacity, 0);
  assert.equal(sampleKineticItem(sample, 2, 1440).opacity, 0);
  assert.ok(start + 2 * stagger + duration < 1);
  for (let index = 0; index < 3; index++) {
    assert.deepEqual(sampleKineticItem(start + index * stagger + duration, index, 1440), { x: 0, rotation: 0, opacity: 1 });
  }
});

test('fly-in decelerates into one bounded physical overshoot and returns continuously to zero', () => {
  const distance = 2160;
  const { overshoot, overshootAt } = motionSettings.fly;
  const options = { distance, overshoot, overshootAt, rotation: 6.5 };
  assert.equal(sampleFlyIn(overshootAt, options).x, -overshoot);
  const samples = Array.from({ length: 1001 }, (_, index) => sampleFlyIn(index / 1000, options));
  assert.ok(samples.every(({ x, opacity }) => x >= -overshoot && x <= distance && opacity >= 0 && opacity <= 1));
  assert.ok(samples.slice(1, 781).every((sample, index) => sample.x <= samples[index].x));
  assert.ok(samples.slice(781).every((sample, index) => sample.x >= samples[index + 780].x));
  const earlyTravel = sampleFlyIn(.1, options).x - sampleFlyIn(.2, options).x;
  const lateTravel = sampleFlyIn(.5, options).x - sampleFlyIn(.6, options).x;
  assert.ok(earlyTravel > lateTravel, 'the long entrance should slow as it approaches its final place');
  assert.ok(Math.abs(sampleFlyIn(overshootAt - .00001, options).x - sampleFlyIn(overshootAt + .00001, options).x) < .001);
});

test('fly-in starts and settles at rest without velocity or acceleration jumps', () => {
  // Normalize geometry to compare derivatives independently of viewport size.
  const options = { distance: 1, rotation: 1, overshoot: .01, overshootAt: .78 };
  const h = .00001;
  const sides = (f, p) => {
    const value = f(p);
    return {
      leftVelocity: (3 * value - 4 * f(p - h) + f(p - 2 * h)) / (2 * h),
      rightVelocity: (-3 * value + 4 * f(p + h) - f(p + 2 * h)) / (2 * h),
      leftAcceleration: (2 * value - 5 * f(p - h) + 4 * f(p - 2 * h) - f(p - 3 * h)) / h ** 2,
      rightAcceleration: (2 * value - 5 * f(p + h) + 4 * f(p + 2 * h) - f(p + 3 * h)) / h ** 2,
    };
  };
  for (const component of ['x', 'rotation']) {
    const boundaries = component === 'x'
      ? [0, options.overshootAt * motionSettings.fly.accelerationRamp, options.overshootAt, 1]
      : [0, motionSettings.fly.accelerationRamp, 1];
    for (const progress of boundaries) {
      const sample = sides((p) => sampleFlyIn(p, options)[component], progress);
      assert.ok(Math.abs(sample.leftVelocity - sample.rightVelocity) < .00001, `${component} velocity is continuous at ${progress}`);
      assert.ok(Math.abs(sample.leftAcceleration - sample.rightAcceleration) < .002, `${component} acceleration is continuous at ${progress}`);
      if (progress === 0 || progress === 1) {
        assert.ok(Math.abs(sample.leftVelocity) < .00001 && Math.abs(sample.rightVelocity) < .00001, 'Stationary endpoints meet the moving range at rest.');
        assert.ok(Math.abs(sample.leftAcceleration) < .002 && Math.abs(sample.rightAcceleration) < .002, 'Endpoint acceleration returns smoothly to zero.');
      }
    }
  }
});

test('the brief acceleration ramp preserves established later approach positions and bounded direction', () => {
  const options = { distance: 1944, rotation: 6.5, overshoot: 12, overshootAt: .78 };
  for (const progress of [.15, .3, .5, .7]) {
    assert.deepEqual(sampleFlyIn(progress, options), sampleFlyIn(progress, { ...options, accelerationRamp: 0 }), 'The established middle/late approach remains exact.');
  }
  for (const accelerationRamp of [.04, .12, .3]) {
    let previous = options.distance;
    for (let index = 0; index <= 780; index++) {
      const sample = sampleFlyIn(index / 1000, { ...options, accelerationRamp });
      assert.ok(sample.x <= previous + 1e-10, 'Acceleration never reverses the incoming word.');
      assert.ok(sample.x >= -options.overshoot && sample.x <= options.distance, 'Ramping never adds an extra overshoot.');
      previous = sample.x;
    }
  }
});

test('scroll reversal and stopped scroll reproduce the same poses with no time or history dependency', () => {
  const positions = Array.from({ length: 121 }, (_, index) => -.2 + index * .012);
  const down = positions.map((progress) => Array.from({ length: 3 }, (_, index) => sampleKineticItem(progress, index, 390)));
  const up = positions.toReversed().map((progress) => Array.from({ length: 3 }, (_, index) => sampleKineticItem(progress, index, 390))).toReversed();
  assert.deepEqual(up, down);
  const paused = sampleKineticItem(.47, 1, 390);
  for (let repeat = 0; repeat < 20; repeat++) assert.deepEqual(sampleKineticItem(.47, 1, 390), paused);
  // On reverse, paintings leave the final position before jewellery/tattoos.
  assert.deepEqual(sampleKineticItem(.86, 0, 390), { x: 0, rotation: 0, opacity: 1 });
  assert.deepEqual(sampleKineticItem(.86, 1, 390), { x: 0, rotation: 0, opacity: 1 });
  assert.notEqual(sampleKineticItem(.86, 2, 390).x, 0);
});

test('masked headings and the receding hero return to exact original states', () => {
  assert.deepEqual(sampleHeading(-1), { y: motionSettings.heading.rise, opacity: 0 });
  assert.deepEqual(sampleHeading(1), { y: 0, opacity: 1 });
  assert.deepEqual(sampleHero(0), { scale: 1, opacity: 1 });
  assert.deepEqual(sampleHero(1), { scale: motionSettings.hero.scale, opacity: 0 });
  const middle = sampleHero(.4);
  assert.ok(middle.scale > motionSettings.hero.scale && middle.scale < 1);
  assert.ok(middle.opacity > 0 && middle.opacity < 1);
  assert.equal(progressBetween(-100, 0, 100), 0);
  assert.equal(progressBetween(200, 0, 100), 1);
});

test('About moves a shorter distance, and phone pin distances are shorter than desktop', () => {
  assert.ok(motionSettings.about.copyDistanceVw < motionSettings.fly.distanceVw);
  assert.ok(motionSettings.about.linkDistanceVw < motionSettings.about.copyDistanceVw);
  assert.ok(motionSettings.pin.mobileWork < motionSettings.pin.work);
  assert.ok(motionSettings.pin.mobileContact < motionSettings.pin.contact);
});


test('pinned approaches start at the lower viewport before native pinning without empty settled intervals', () => {
  const height = 1000;
  const top = 2000;
  const run = height * motionSettings.pin.work;
  const origin = top - height * motionSettings.approach;
  assert.equal(pinnedProgress(origin, top, height, run), 0);
  assert.equal(sampleKineticItem(pinnedProgress(origin, top, height, run), 0, 1440).opacity, 0);
  const early = pinnedProgress(origin + height * .1, top, height, run);
  assert.ok(sampleKineticItem(early, 0, 1440).opacity > 0, 'The first word must already move while the section top is at 75% viewport height.');
  const atPin = pinnedProgress(top, top, height, run);
  assert.ok(kineticItemProgress(atPin, 0) > .5, 'The first word must arrive during the approach rather than wait for the sticky stage.');
  const final = motionSettings.fly.start + motionSettings.fly.duration + 2 * motionSettings.fly.stagger;
  assert.ok(final > .9 && final < 1, 'The final word settles close to natural sticky release.');
  assert.equal(pinnedProgress(top + run, top, height, run), 1);
});

test('two monochrome echoes stretch behind flying words and converge to a perfectly crisp endpoint', () => {
  for (const width of [320, 390, 1440]) {
    for (const layer of [0, 1]) {
      assert.equal(sampleMotionTrail(0, layer, width).opacity, 0);
      assert.deepEqual(sampleMotionTrail(1, layer, width), { x: 0, opacity: 0 });
      const early = sampleMotionTrail(.1, layer, width);
      const late = sampleMotionTrail(.7, layer, width);
      assert.ok(early.x > late.x && late.x > 0);
      assert.ok(early.opacity > 0 && early.opacity <= .25);
      assert.ok(late.opacity < early.opacity);
      assert.equal(sampleMotionTrail(.9, layer, width).opacity, 0);
    }
    assert.ok(sampleMotionTrail(.1, 1, width).x > sampleMotionTrail(.1, 0, width).x);
    const progress = [.05, .12, .35, .7, .9, 1];
    assert.deepEqual(progress.map((p) => sampleMotionTrail(p, 0, width)), progress.toReversed().map((p) => sampleMotionTrail(p, 0, width)).toReversed());
  }
});
