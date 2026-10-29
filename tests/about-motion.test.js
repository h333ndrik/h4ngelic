import test from 'node:test';
import assert from 'node:assert/strict';
import { motionSettings, sampleAboutItem, sampleArchiveHeading } from '../src/data/motionSettings.js';

test('About copy and link use bounded entrances and settle into the same left-aligned rest pose', () => {
  for (const width of [320, 390, 1440]) {
    for (const role of ['copy', 'link']) {
      const start = sampleAboutItem(0, role, width);
      assert.ok(start.x > 0 && start.x <= (role === 'link' ? 28 : 36), 'About uses a controlled local entrance rather than a viewport-wide flight.');
      assert.equal(start.opacity, 0);
      assert.equal(start.rotation, 0, 'Large paragraph text stays readable as it arrives.');
      assert.deepEqual(sampleAboutItem(1, role, width), { x: 0, rotation: 0, opacity: 1 });
      for (let index = 0; index <= 100; index++) {
        const pose = sampleAboutItem(index / 100, role, width);
        assert.ok(pose.x >= 0 && pose.x <= start.x);
      }
    }
    const copy = sampleAboutItem(.5, 'copy', width);
    const link = sampleAboutItem(.5, 'link', width);
    assert.ok(copy.x < link.x, 'The text leads and MORE ABOUT follows with a brief stagger.');
  }
  assert.equal(motionSettings.about.copyStart, motionSettings.calm.start, 'The calm content family shares the established About copy range.');
});

test('About scroll reversal and stopped scrolling reproduce exactly the same entrance history', () => {
  const progress = [-1, 0, .16, .3, .42, .7, .9, 1, 2];
  const samples = progress.map(value => ['copy', 'link'].map(role => sampleAboutItem(value, role, 390)));
  const reversed = progress.toReversed().map(value => ['copy', 'link'].map(role => sampleAboutItem(value, role, 390))).toReversed();
  assert.deepEqual(reversed, samples);
  for (let repeat = 0; repeat < 10; repeat++) assert.deepEqual(sampleAboutItem(.42, 'copy', 390), samples[4][0]);
});

test('major Works headings use one continuous bounded About-like local approach', () => {
  for (const width of [320, 390, 768, 1440]) {
    const initial = sampleArchiveHeading(0, width);
    assert.ok(initial.x > 0 && initial.x <= motionSettings.about.maximumCopyDistance);
    assert.deepEqual(sampleArchiveHeading(1, width), { x: 0, rotation: 0, opacity: 1 });
    let previous = initial;
    for (let index = 1; index <= 1000; index++) {
      const pose = sampleArchiveHeading(index / 1000, width);
      assert.equal(pose.rotation, 0);
      assert.ok(pose.x >= 0 && pose.x <= previous.x);
      assert.ok(previous.x - pose.x < initial.x * .01, 'Tiny scroll changes cannot launch or snap a heading.');
      assert.ok(pose.opacity >= previous.opacity && pose.opacity <= 1);
      previous = pose;
    }
    const progression = [-1, 0, .2, .5, .7, 1, 2];
    assert.deepEqual(progression.map(progress => sampleArchiveHeading(progress, width)),
      progression.toReversed().map(progress => sampleArchiveHeading(progress, width)).toReversed());
  }
});
