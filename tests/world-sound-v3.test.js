import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worldSoundSettings, transitionAssetFor, transitionFrames, worldTransitionDurationSeconds } from '../src/audio/worldSoundSettings.js';

const evidence = JSON.parse(await readFile(new URL('../docs/validation/world-sound/v3-build.json', import.meta.url), 'utf8'));
const audioDirectory = new URL('../public/assets/audio/', import.meta.url);
const loopById = Object.fromEntries(evidence.loops.map(loop => [loop.id, loop]));
const transitionById = Object.fromEntries(evidence.transitions.map(item => [item.id, item]));
const hasMasters = async () => {
  try { await access(new URL('../masters/loop-333-source.wav', import.meta.url)); return true; } catch { return false; }
};

test('one loop constant and one transition constant drive both worlds', () => {
  assert.equal(worldSoundSettings.seconds.loops, 90);
  assert.equal(worldSoundSettings.expectedFrames.loops['333'], 3969000);
  assert.equal(worldSoundSettings.expectedFrames.loops['4'], 3969000);
  assert.equal(evidence.loopFrames, 3969000);
  // The transition length is the visual transition length, not a literal.
  assert.equal(worldSoundSettings.seconds.transitions, worldTransitionDurationSeconds());
  assert.equal(transitionFrames(), Math.round(worldTransitionDurationSeconds() * 44100));
  for (const key of ['x-333-4', 'x-4-333']) assert.equal(worldSoundSettings.expectedFrames.transitions[key], transitionFrames());
  for (const transition of evidence.transitions) assert.equal(transition.m4a.frames, transitionFrames());
});

const servedName = path => path.split('/').pop();
const manifestPaths = [
  worldSoundSettings.paths.loops['333'][0], worldSoundSettings.paths.loops['4'][0],
  worldSoundSettings.paths.transitions['x-333-4'][0], worldSoundSettings.paths.transitions['x-4-333'][0],
];
const servedNames = manifestPaths.map(servedName);

test('the manifest is exactly two loops and two transitions with the recorded bytes', async () => {
  assert.equal(manifestPaths.length, 4, 'the runtime manifest lists exactly four files');
  assert.equal(new Set(servedNames).size, 4, 'no file is listed twice');
  assert.deepEqual((await readdir(audioDirectory)).sort(), [...servedNames].sort(), 'the served folder holds exactly the manifest files');
  for (const name of servedNames) {
    assert.match(name, /^[a-z0-9-]+\.[0-9a-f]{12}\.(m4a|flac|wav)$/, `${name} must carry a content hash`);
  }
  const expected = {
    [servedName(worldSoundSettings.paths.loops['333'][0])]: loopById['loop-333'].m4a,
    [servedName(worldSoundSettings.paths.loops['4'][0])]: loopById['loop-4'].m4a,
    [servedName(worldSoundSettings.paths.transitions['x-333-4'][0])]: transitionById['sfx-a'].m4a,
    [servedName(worldSoundSettings.paths.transitions['x-4-333'][0])]: transitionById['sfx-b'].m4a,
  };
  for (const [name, meta] of Object.entries(expected)) {
    const bytes = await readFile(new URL(name, audioDirectory));
    assert.equal(bytes.byteLength, meta.bytes, `${name} size drifted`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), meta.sha256, `${name} hash drifted`);
    assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
  }
});

test('every delivered file keeps -18 LUFS, headroom and the exact frame count', () => {
  for (const loop of evidence.loops) {
    assert.equal(loop.m4a.frames, 3969000);
    assert.ok(Math.abs(loop.level.m4a.lufs + 18) <= 1, `${loop.id} LUFS ${loop.level.m4a.lufs}`);
    assert.ok(loop.level.m4a.truePeakDbfs < -1, `${loop.id} true peak ${loop.level.m4a.truePeakDbfs}`);
  }
  for (const transition of evidence.transitions) {
    assert.equal(transition.m4a.frames, transitionFrames());
    assert.ok(Math.abs(transition.level.m4a.lufs + 18) <= 1, `${transition.id} LUFS ${transition.level.m4a.lufs}`);
    assert.ok(transition.level.m4a.truePeakDbfs < -1, `${transition.id} true peak ${transition.level.m4a.truePeakDbfs}`);
  }
});

test('both loops keep the head bit-identical and pass every seam gate', () => {
  for (const loop of evidence.loops) {
    assert.equal(loop.headPreserved, true, `${loop.id} head is not the source head`);
    assert.equal(loop.headSha256Source, loop.headSha256Loop);
    assert.equal(loop.headFrames, 88200);
    const gates = loop.gates;
    assert.ok(gates.seamWithinP95, `${loop.id} seam step ${gates.seamStep} vs p95 ${gates.p95Step}`);
    assert.ok(gates.levelWithin1dB, `${loop.id} seam level delta ${gates.levelDeltaDb} dB`);
    assert.ok(gates.noSeamTransient, `${loop.id} seam transient ${gates.tailPeakOverSurroundDb} dB`);
    assert.ok(gates.gradientWithin1p5dB, `${loop.id} gradient ${gates.gradientMaxDbPer100ms} dB/100ms`);
    assert.equal(gates.pass, true);
    assert.equal(loop.wrap.wrapSeconds, 8);
  }
});

test('the rejected head-injection wrap is recorded with its measured failure', () => {
  for (const loop of evidence.loops) {
    assert.equal(loop.specVariant.gates.pass, false, `${loop.id}: the literal head-injection shape must not silently pass`);
    assert.ok(!loop.specVariant.gates.levelWithin1dB, `${loop.id}: its level cliff is recorded`);
  }
  assert.ok(loopById['loop-4'].specVariant.gates.levelDeltaDb > 30, 'loop 4 head injection was a 36 dB cliff');
});

test('transitions are cut to the energy peak of the trimmed source and mapped by sweep shape', () => {
  for (const transition of evidence.transitions) {
    assert.ok(transition.trimmedFrames > transition.frames, 'the trimmed body is longer than the window');
    const centre = transition.windowStartInSource + transition.frames / 44100 / 2;
    assert.ok(Math.abs(centre - transition.peakSecondsInSource) < .05, `${transition.id} window is centred on the peak`);
  }
  assert.equal(transitionById['sfx-a'].sweepDirection, 'rising');
  assert.equal(transitionById['sfx-b'].sweepDirection, 'falling/impulsive');
  assert.equal(transitionAssetFor('333', '4'), 'x-333-4', 'rising sweep leaves the clean world');
  assert.equal(transitionAssetFor('4', '333'), 'x-4-333', 'falling sweep returns to it');
});

test('the bed dip is one -6 dB constant', () => {
  assert.equal(worldSoundSettings.bedDipDb, -6);
});

test('the same source bytes rebuild byte-identical deliveries', { skip: !(await hasMasters()) && 'source masters are local-only' }, async () => {
  const { build } = await import('../scripts/buildWorldSound.mjs');
  const out = await mkdtemp(join(tmpdir(), 'h4-world-v3-'));
  try {
    const report = await build({ out, mastersDir: join(out, 'masters'), publish: false });
    for (const loop of report.loops) assert.equal(loop.m4a.sha256, loopById[loop.id].m4a.sha256, `${loop.id} is not reproducible`);
    for (const transition of report.transitions) assert.equal(transition.m4a.sha256, transitionById[transition.id].m4a.sha256, `${transition.id} is not reproducible`);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
