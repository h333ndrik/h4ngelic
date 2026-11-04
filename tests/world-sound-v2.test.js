import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worldSoundSettings } from '../src/audio/worldSoundSettings.js';

const evidence = JSON.parse(await readFile(new URL('../docs/validation/world-sound/v2/render-report.json', import.meta.url), 'utf8'));
const audioDirectory = new URL('../public/assets/audio/', import.meta.url);
const hasFfmpeg = () => spawnSync('ffmpeg', ['-version']).status === 0;

test('the 90 s loop and 1.4 s one-shot contracts match the shipped settings', () => {
  assert.equal(worldSoundSettings.seconds.loops, 90);
  assert.equal(worldSoundSettings.seconds.transitions, 1.4);
  assert.equal(worldSoundSettings.seconds.loops * worldSoundSettings.sampleRate, 3969000);
  assert.equal(Math.round(worldSoundSettings.seconds.transitions * worldSoundSettings.sampleRate), 61740);
  for (const frames of Object.values(worldSoundSettings.expectedFrames.loops)) assert.equal(frames, 3969000);
  for (const frames of Object.values(worldSoundSettings.expectedFrames.transitions)) assert.equal(frames, 61740);
  assert.deepEqual([...Object.keys(worldSoundSettings.expectedFrames.loops)].sort(), ['333', '4']);
  assert.deepEqual([...Object.keys(worldSoundSettings.expectedFrames.transitions)].sort(), ['333>4', '4>333']);
});

test('the committed render evidence describes exactly the committed M4A files', async () => {
  assert.deepEqual(evidence.files.map(file => file.name).sort(), ['loop-333', 'loop-4', 'x-333-4', 'x-4-333']);
  assert.equal(evidence.loopFrames, 3969000);
  assert.equal(evidence.transitionFrames, 61740);
  for (const file of evidence.files) {
    const bytes = await readFile(new URL(`${file.name}.m4a`, audioDirectory));
    assert.equal(bytes.byteLength, file.m4a.bytes, `${file.name} size drifted from the recorded render`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.m4a.sha256, `${file.name} hash drifted from the recorded render`);
    assert.equal(file.wav.frames ?? file.frames, file.frames);
  }
});

test('every deliverable lands on the -18 LUFS target with a bounded peak', () => {
  for (const file of evidence.files) {
    assert.ok(Math.abs(file.wav.lufs - -18) <= .5, `${file.name} integrated loudness is ${file.wav.lufs} LUFS`);
    assert.ok(Math.abs(file.m4a.lufs - file.wav.lufs) <= .3, `${file.name} loses loudness through the AAC encode`);
    assert.ok(file.wav.peakDbfs <= -3.5, `${file.name} keeps delivery headroom (peak ${file.wav.peakDbfs} dBFS)`);
  }
});

test('each loop closes on itself: matching head/tail level and a seam below ordinary sample movement', () => {
  for (const file of evidence.files.filter(item => item.name.startsWith('loop-'))) {
    assert.ok(Math.abs(file.analysis.headTail.differenceDb) <= 2,
      `${file.name} first and last two seconds differ by ${file.analysis.headTail.differenceDb} dB`);
    assert.ok(file.analysis.seam.ratio <= 6,
      `${file.name} seam step is ${file.analysis.seam.ratio}x the ordinary sample step`);
    assert.ok(file.analysis.correlation >= .5, `${file.name} stays mono-compatible (correlation ${file.analysis.correlation})`);
  }
});

test('both worlds carry the build arc and keep the shared anchors present at any position', () => {
  for (const file of evidence.files.filter(item => item.name.startsWith('loop-'))) {
    const peaks = file.analysis.perSegment.map(segment => segment.rmsDb);
    const intro = peaks[0];
    const fullest = Math.max(...peaks);
    const closing = peaks.at(-1);
    assert.ok(fullest - intro >= 3, `${file.name} has no audible build (${intro} -> ${fullest} dBFS)`);
    assert.ok(fullest - closing >= 2, `${file.name} does not settle back to the intro texture (${fullest} -> ${closing} dBFS)`);
    for (const probe of file.analysis.probes) {
      const anchors = probe.anchors.map(anchor => anchor.db);
      assert.deepEqual(anchors.length, 4);
      for (let index = 0; index < anchors.length; index++) {
        assert.ok(anchors[index] <= -6 && anchors[index] >= -45,
          `${file.name} anchor ${probe.anchors[index].frequency} Hz missing at ${probe.seconds}s (${anchors[index]} dB rel.)`);
      }
    }
    const low = file.analysis.bands.find(band => band.low === 20);
    assert.ok(low.db <= -2.5, `${file.name} low end is not restrained (20-60 Hz at ${low.db} dB rel.)`);
  }
});

test('the render is deterministic and reproduces the committed hashes', () => {
  assert.equal(evidence.determinism.identical, true);
  for (const repeat of evidence.determinism.repeats) assert.ok(repeat.wavIdentical && repeat.m4aIdentical, `${repeat.name} re-rendered differently`);
});

test('re-rendering a transition reproduces byte-identical WAV and M4A output', { skip: !hasFfmpeg() && 'ffmpeg is not installed (local build tooling only)' }, async () => {
  const first = await mkdtemp(join(tmpdir(), 'h4-render-a-'));
  const second = await mkdtemp(join(tmpdir(), 'h4-render-b-'));
  try {
    for (const directory of [first, second]) {
      const run = spawnSync(process.execPath, ['scripts/renderWorldLoops.mjs', '--only=x-4-333', '--out', directory], { encoding: 'utf8' });
      assert.equal(run.status, 0, run.stderr);
    }
    for (const name of ['x-4-333.wav', 'x-4-333.m4a']) {
      const [a, b] = await Promise.all([readFile(join(first, name)), readFile(join(second, name))]);
      assert.equal(createHash('sha256').update(a).digest('hex'), createHash('sha256').update(b).digest('hex'), `${name} is not reproducible`);
    }
  } finally {
    await Promise.all([rm(first, { recursive: true, force: true }), rm(second, { recursive: true, force: true })]);
  }
});
