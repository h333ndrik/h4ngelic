import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createWorldSound } from '../src/audio/worldSound.js';
import { worldSoundSettings, worldForMode, worldTransitionDurationSeconds } from '../src/audio/worldSoundSettings.js';

function fixture({ missing = [], lengthOverrides = {}, settings = worldSoundSettings, contextRate = worldSoundSettings.sampleRate } = {}) {
  const fetches = [], sources = [], gains = [], filters = [], compressors = [], timers = [], decodes = [];
  class Param {
    value = 1;
    events = [];
    setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
    linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); }
    cancelScheduledValues(time) { this.events.push(['cancel', time]); }
    cancelAndHoldAtTime(time) { this.events.push(['hold', time]); }
  }
  class Node {
    connections = [];
    connect(target) { this.connections.push(target); return target; }
    disconnect() { this.disconnected = true; }
  }
  class Gain extends Node { gain = new Param(); }
  class Source extends Node {
    loop = false; loopStart = 0; loopEnd = 0; started = null; offset = null; stops = [];
    start(time = 0, offset = 0) { this.started = time; this.offset = offset; }
    stop(time = 0) { this.stops.push(time); this.stopped = time; }
    end() { this.onended?.(); }
  }
  class Context {
    state = 'running'; currentTime = 4; sampleRate = contextRate; destination = {};
    createGain() { const node = new Gain(); gains.push(node); return node; }
    createBiquadFilter() { const node = Object.assign(new Node(), { type: 'lowpass', frequency: new Param(), Q: new Param() }); filters.push(node); return node; }
    createDynamicsCompressor() { const node = Object.assign(new Node(), Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(name => [name, new Param()]))); compressors.push(node); return node; }
    createBufferSource() { const source = new Source(); sources.push(source); return source; }
    decodeAudioData(bytes) {
      const label = new TextDecoder().decode(new Uint8Array(bytes));
      decodes.push(label);
      const name = ['loop-333', 'loop-4', 'x-333-4', 'x-4-333'].find(value => label.includes(value));
      const masterFrames = lengthOverrides[label.split('/').at(-1)] ?? lengthOverrides[name] ?? (name?.startsWith('x-') ? 39690 : 3969000);
      // decodeAudioData resamples to the context rate, exactly like a device.
      const length = Math.round(masterFrames * contextRate / worldSoundSettings.sampleRate);
      return Promise.resolve({ label, length, numberOfChannels: 2, sampleRate: contextRate, duration: length / contextRate });
    }
  }
  const context = new Context();
  const fetch = async (url, options) => {
    fetches.push({ url, options });
    if (missing.some(value => url.includes(value))) return { ok: false, status: 404 };
    return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer };
  };
  const schedule = (fn, ms) => { const timer = { fn, ms, cancelled: false }; timers.push(timer); return timer; };
  const cancelSchedule = timer => { timer.cancelled = true; };
  const destination = {};
  const world = createWorldSound({ context, destination, fetch, settings, schedule, cancelSchedule });
  const flush = () => { for (const timer of timers.splice(0)) if (!timer.cancelled) timer.fn(); };
  return { world, context, destination, fetches, sources, gains, filters, compressors, timers, flush, decodes };
}

const evidence = JSON.parse(await readFile(new URL('../docs/validation/world-sound/v3-build.json', import.meta.url), 'utf8'));
const loopById = Object.fromEntries(evidence.loops.map(loop => [loop.id, loop]));
const transitionById = Object.fromEntries(evidence.transitions.map(item => [item.id, item]));
const delivered = meta => ({ hash: meta.sha256, bytes: meta.bytes });

test('the manifest contains exactly four verified M4A loops/transitions with ordered fallbacks', async () => {
  const expected = {
    'loop-333.m4a': delivered(loopById['loop-333'].m4a),
    'loop-4.m4a': delivered(loopById['loop-4'].m4a),
    'x-333-4.m4a': delivered(transitionById['sfx-a'].m4a),
    'x-4-333.m4a': delivered(transitionById['sfx-b'].m4a),
  };
  const directory = new URL('../public/assets/audio/', import.meta.url);
  assert.deepEqual((await readdir(directory)).sort(), Object.keys(expected).sort(), 'Only two loops and two transitions are committed.');
  for (const [name, metadata] of Object.entries(expected)) {
    const bytes = await readFile(new URL(name, directory));
    assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
    assert.equal(bytes.byteLength, metadata.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.hash, `${name} bytes or hash changed`);
  }

  const loops = Object.values(worldSoundSettings.paths.loops);
  const transitions = Object.values(worldSoundSettings.paths.transitions);
  assert.deepEqual(loops.map(paths => paths[0]).sort(),
    ['/assets/audio/loop-333.m4a', '/assets/audio/loop-4.m4a']);
  assert.deepEqual(transitions.map(paths => paths[0]).sort(),
    ['/assets/audio/x-333-4.m4a', '/assets/audio/x-4-333.m4a']);
  for (const paths of [...loops, ...transitions]) {
    assert.deepEqual(paths.map(path => path.split('.').at(-1)), ['m4a', 'flac', 'wav'], 'Fallback order is M4A → FLAC → WAV.');
  }
});

test('guided activation fades in over the supplied window and never restarts the loop', async () => {
  const f = fixture();
  assert.equal(await f.world.activate('333', { fadeSeconds: 1.8 }), true);
  const loops = () => f.sources.filter(source => source.loop);
  assert.equal(loops().length, 1);
  const fade = loops()[0].connections[0];
  assert.ok(fade.gain.events.some(([kind, value, time]) => kind === 'ramp' && value === 1 && Math.abs(time - 5.8) < 1e-9),
    'The loop reaches unity 1.8 s after activation.');
  assert.equal(await f.world.activate('333', { fadeSeconds: 1.2 }), true);
  assert.equal(loops().length, 1, 'A second guided activation reuses the running voice.');
  assert.ok(fade.gain.events.some(([kind, value, time]) => kind === 'ramp' && value === 1 && Math.abs(time - 5.2) < 1e-9));
});

test('transition one-shots reach the destination through their own SMASH duck', async () => {
  const f = fixture();
  assert.equal(await f.world.activate('333'), true);
  await f.world.switchTo('4', { durationMs: 900 });
  await new Promise(resolve => setTimeout(resolve, 0));
  const oneShot = f.sources.find(source => !source.loop && source.started !== null);
  assert.ok(oneShot, 'the one-shot source starts');
  const voiceGain = oneShot.connections[0];
  const duck = voiceGain.connections[0];
  assert.ok(duck.connections.includes(f.destination), 'the transition bus reaches the destination');
});

test('world sound is lazy, loop-aligned, and crossfades over the live mode-transition duration', async () => {
  const f = fixture();
  assert.equal(f.fetches.length, 0);
  assert.equal(f.gains.length, 5, 'bus, bed attenuation, SFX duck and both world gains are created only with the controller.');
  assert.equal(f.filters[0].frequency.value, worldSoundSettings.lowpassHz);
  assert.equal(f.compressors[0].threshold.value, worldSoundSettings.limiter.threshold);
  assert.equal(await f.world.activate('333'), true);
  assert.equal(f.fetches.length, 1);
  assert.equal(f.fetches[0].url, '/assets/audio/loop-333.m4a');
  assert.equal(f.sources[0].loop, true);
  assert.equal(f.sources[0].offset, 0);
  assert.equal(f.world.snapshot().loops['333'].status, 'ready');

  f.context.currentTime = 11.5;
  assert.equal(await f.world.switchTo('4', { durationMs: 900 }), true);
  await new Promise(resolve => setTimeout(resolve, 0));
  const loopSources = f.sources.filter(source => source.loop);
  const oneShots = f.sources.filter(source => !source.loop);
  assert.equal(loopSources.length, 2, 'One outgoing and one incoming loop voice coexist during the fade.');
  assert.equal(loopSources[1].offset, 7.5, 'The incoming loop starts at the shared transport phase, not at zero.');
  assert.equal(oneShots.length, 1);
  assert.equal(oneShots[0].offset, 0);
  assert.ok(Math.abs(oneShots[0].buffer.duration - .9) < 1e-9, 'The transition keeps its full supplied duration.');
  assert.equal(oneShots[0].started, 11.5, 'The one-shot starts with the crossfade at switch start.');
  const snapshot = f.world.snapshot();
  assert.equal(snapshot.currentWorld, '4');
  assert.equal(snapshot.transportStart, 4);
  assert.ok(Math.abs(snapshot.crossfade.durationSeconds - .9) < 1e-9);
  assert.equal(snapshot.crossfade.startedAt, 11.5);
  assert.equal(snapshot.crossfade.endsAt, 12.4);
  assert.equal(snapshot.transitionVoices, 1);
  assert.equal(f.fetches.map(item => item.url).includes('/assets/audio/x-333-4.m4a'), true);
  assert.equal(snapshot.assets['loops:4'].path, '/assets/audio/loop-4.m4a');
  assert.equal(snapshot.assets['transitions:333>4'].path, '/assets/audio/x-333-4.m4a');
  f.context.currentTime = 12.4;
  f.flush();
  assert.ok(loopSources[0].stops.length >= 1, 'The inactive loop source is stopped after its crossfade completes.');
  assert.equal(loopSources[1].stops.length, 0, 'The incoming source continues as the active transport.');
  assert.equal(oneShots[0].stops.length, 0, 'The full 1.4 s transition is never truncated at the crossfade boundary.');
  loopSources[0].end();
  const settled = f.world.snapshot();
  assert.equal(settled.loops['333'].active, false);
  assert.equal(settled.loops['4'].active, true);
  assert.equal(Object.values(settled.loops).filter(loop => loop.active).length, 1, 'Exactly one world loop remains active.');
});

test('a mid-crossfade reversal retargets both gains and starts the opposite one-shot without restarting transport', async () => {
  const f = fixture();
  await f.world.activate('333');
  f.context.currentTime = 10;
  await f.world.switchTo('4', { durationMs: 900 });
  await new Promise(resolve => setTimeout(resolve, 0));
  const loop333 = f.sources.find(source => source.loop && source.buffer.label.endsWith('loop-333.m4a'));
  const loop4 = f.sources.find(source => source.loop && source.buffer.label.endsWith('loop-4.m4a'));
  assert.ok(loop333.connections[0].gain.events.some(event => event[0] === 'ramp' && event[1] === 0 && event[2] === 10.9));
  assert.ok(loop4.connections[0].gain.events.some(event => event[0] === 'ramp' && event[1] === 1 && event[2] === 10.9));
  f.context.currentTime = 10.3;
  await f.world.switchTo('333', { durationMs: 900 });
  await new Promise(resolve => setTimeout(resolve, 0));
  const snapshot = f.world.snapshot();
  assert.ok(loop333.connections[0].gain.events.some(event => event[0] === 'ramp' && event[1] === 1 && Math.abs(event[2] - 11.2) < 1e-9),
    'The previously fading source is retargeted back up from its held value.');
  assert.ok(loop4.connections[0].gain.events.some(event => event[0] === 'ramp' && event[1] === 0 && Math.abs(event[2] - 11.2) < 1e-9),
    'The outgoing replacement is retargeted down without a gain jump.');
  assert.equal(snapshot.transportStart, 4);
  assert.equal(snapshot.currentWorld, '333');
  assert.equal(snapshot.crossfade.from, '4');
  assert.ok(Math.abs(snapshot.crossfade.durationSeconds - .9) < 1e-9);
  assert.equal(f.sources.filter(source => source.loop).length, 2, 'The reversal reuses the still-running outgoing source.');
  assert.equal(f.sources.filter(source => !source.loop).length, 2, 'The opposite transition is added under the same in-process controller.');
  assert.equal(loop333.offset, 0);
  assert.ok(f.fetches.some(item => item.url === '/assets/audio/x-4-333.m4a'));
});

test('mode transitions enter from arbitrary loop phases while one-shots start at their shared anchor', async () => {
  for (const phase of [.125, 7.25, 29.9]) {
    const f = fixture();
    await f.world.activate('333');
    f.context.currentTime = 4 + phase;
    await f.world.switchTo('4', { durationMs: 900 });
    await new Promise(resolve => setTimeout(resolve, 0));
    const incoming = f.sources.find(source => source.loop && source.buffer.label.endsWith('loop-4.m4a'));
    const transition = f.sources.find(source => !source.loop && source.buffer.label.endsWith('x-333-4.m4a'));
    assert.ok(Math.abs(incoming.offset - phase) < 1e-9, `Incoming loop must join the shared phase at ${phase}s.`);
    assert.equal(transition.offset, 0, 'The supplied transition remains a complete one-shot from its own anchor.');
  }
});

test('format fallback decodes the next candidate when M4A is unavailable or has encoder padding', async () => {
  const unavailable = fixture({ missing: ['loop-333.m4a'] });
  assert.equal(await unavailable.world.activate('333'), true);
  assert.deepEqual(unavailable.fetches.map(item => item.url),
    ['/assets/audio/loop-333.m4a', '/assets/audio/loop-333.flac']);
  assert.equal(unavailable.world.snapshot().assets['loops:333'].path, '/assets/audio/loop-333.flac');

  const padded = fixture({ lengthOverrides: { 'loop-333.m4a': 3968999 } });
  assert.equal(await padded.world.activate('333'), true);
  const asset = padded.world.snapshot().assets['loops:333'];
  assert.equal(asset.path, '/assets/audio/loop-333.flac');
  assert.match(asset.attempts[0].error, /Unexpected decoded length/);
  assert.equal(asset.attempts[0].status, 'failed');
  assert.equal(asset.attempts[1].status, 'ready');
});

test('a 48 kHz device context keeps the same master duration and still rejects encoder padding', async () => {
  const native = fixture({ contextRate: 48000 });
  assert.equal(await native.world.activate('333'), true);
  const asset = native.world.snapshot().assets['loops:333'];
  assert.equal(asset.status, 'ready');
  assert.equal(asset.path, '/assets/audio/loop-333.m4a');
  assert.equal(native.world.snapshot().loops['333'].bufferDuration, 90, '90 s at 48 kHz keeps the exact master duration.');

  const padded = fixture({ contextRate: 48000, lengthOverrides: { 'loop-333.m4a': 3969001 } });
  assert.equal(await padded.world.activate('333'), true);
  assert.equal(padded.world.snapshot().assets['loops:333'].path, '/assets/audio/loop-333.flac');
});

test('concurrent preload and activation share one lazy fetch and one decode path', async () => {
  const f = fixture();
  const [activated] = await Promise.all([f.world.activate('333'), f.world.preload('333', null)]);
  assert.equal(activated, true);
  assert.equal(f.fetches.filter(item => item.url === '/assets/audio/loop-333.m4a').length, 1);
  assert.equal(f.sources.filter(source => source.loop).length, 1);
  assert.equal(f.world.snapshot().loops['333'].active, true);
});

test('missing loops and transitions remain silent without throwing or substituting audio', async () => {
  const f = fixture({ missing: ['loop-4.m4a', 'loop-4.flac', 'loop-4.wav', 'x-333-4.m4a', 'x-333-4.flac', 'x-333-4.wav'] });
  assert.equal(await f.world.activate('333'), true);
  f.context.currentTime = 8;
  assert.equal(await f.world.switchTo('4', { durationMs: 900 }), true);
  await new Promise(resolve => setTimeout(resolve, 0));
  const snapshot = f.world.snapshot();
  assert.equal(snapshot.currentWorld, '4');
  assert.equal(snapshot.loops['4'].active, false);
  assert.deepEqual(snapshot.blockedAssets.sort(), ['loops:4', 'transitions:333>4'].sort());
  assert.equal(f.sources.filter(source => !source.loop).length, 0, 'No placeholder one-shot is fabricated.');
  f.flush();
  assert.ok(f.sources[0].stops.length >= 1, 'The previous loop fades to honest silence.');
});

test('a missing starting loop does not prevent the other world from starting later', async () => {
  const f = fixture({ missing: ['loop-333.m4a', 'loop-333.flac', 'loop-333.wav'] });
  assert.equal(await f.world.activate('333'), false);
  assert.equal(f.world.snapshot().loops['333'].status, 'missing');
  f.context.currentTime = 6;
  assert.equal(await f.world.switchTo('4', { durationMs: 900 }), true);
  await new Promise(resolve => setTimeout(resolve, 0));
  const snapshot = f.world.snapshot();
  assert.equal(snapshot.currentWorld, '4');
  assert.equal(snapshot.transportStart, 6);
  assert.equal(snapshot.loops['4'].active, true);
  assert.equal(snapshot.loops['333'].active, false);
  assert.ok(snapshot.blockedAssets.includes('loops:333'));
});

test('transition one-shot concurrency is capped and only paths from settings are fetched', async () => {
  const settings = { ...worldSoundSettings, maxTransitionVoices: 2 };
  const f = fixture({ settings });
  await f.world.activate('333');
  const order = ['4', '333', '4'];
  for (let index = 0; index < order.length; index++) {
    f.context.currentTime = 6 + index * .2;
    await f.world.switchTo(order[index], { durationMs: 400 });
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.ok(f.world.snapshot().transitionVoices <= 2);
  const requested = new Set(f.fetches.map(item => item.url));
  for (const url of requested) {
    assert.ok([...Object.values(settings.paths.loops), ...Object.values(settings.paths.transitions)].flat().includes(url), `Unexpected fetched URL ${url}`);
  }
  assert.deepEqual(f.fetches.filter(item => item.url.includes('x-')).map(item => item.url).sort(),
    ['/assets/audio/x-333-4.m4a', '/assets/audio/x-4-333.m4a']);
  assert.equal(worldForMode('normal'), '333');
  assert.equal(worldForMode('xray'), '4');
  assert.equal(worldTransitionDurationSeconds(), .9, 'The crossfade follows the actual current visual transition config.');
});

test('a mode switch dips the bed by exactly the configured amount for the transition window', async () => {
  const f = fixture();
  await f.world.activate('333');
  f.context.currentTime = 20;
  await f.world.switchTo('4', { durationMs: 900 });
  await new Promise(resolve => setTimeout(resolve, 0));
  const snapshot = f.world.snapshot();
  const expected = 10 ** (worldSoundSettings.bedDipDb / 20);
  assert.ok(snapshot.dip, 'The switch schedules a bed dip.');
  assert.ok(Math.abs(snapshot.dip.level - expected) < 1e-9, `Dip is ${worldSoundSettings.bedDipDb} dB.`);
  assert.ok(Math.abs(snapshot.dip.seconds - .9) < 1e-9, 'The dip lasts exactly as long as the transition.');
  const bed = f.gains[1];
  const values = bed.gain.events.filter(event => event[0] === 'ramp').map(event => event[1]);
  assert.ok(values.some(value => Math.abs(value - expected) < 1e-6), 'The bed reaches the dip floor.');
  assert.ok(Math.abs(values.at(-1) - 1) < 1e-9, 'The bed is back at unity when the transition ends.');
});

test('SMASH and the switch dip stack by the deeper attenuation, never the sum', async () => {
  const f = fixture();
  await f.world.activate('333');
  f.world.setDuck(worldSoundSettings.smashDuckGain, 0);
  f.context.currentTime = 30;
  await f.world.switchTo('4', { durationMs: 900 });
  await new Promise(resolve => setTimeout(resolve, 0));
  const bed = f.gains[1];
  const values = bed.gain.events.filter(event => event[0] === 'ramp').map(event => event[1]);
  assert.ok(values.every(value => value >= worldSoundSettings.smashDuckGain - 1e-9),
    'The bed never goes below the deeper single attenuation.');
  assert.ok(values.some(value => Math.abs(value - worldSoundSettings.smashDuckGain) < 1e-9),
    'The SMASH duck (deeper than the dip) is what applies.');
  assert.ok(!values.some(value => Math.abs(value - worldSoundSettings.smashDuckGain * 10 ** (worldSoundSettings.bedDipDb / 20)) < 1e-6),
    'The two attenuations are never multiplied.');
  assert.ok(Math.abs(f.world.snapshot().sfxDuck - worldSoundSettings.smashDuckGain) < 1e-9);
});

test('release drops every SFX and every scheduled dip, leaving the bed at unity', async () => {
  const f = fixture();
  await f.world.activate('333');
  f.context.currentTime = 40;
  await f.world.switchTo('4', { durationMs: 900 });
  await new Promise(resolve => setTimeout(resolve, 0));
  f.world.release();
  f.flush();
  const snapshot = f.world.snapshot();
  assert.equal(snapshot.dip, null, 'No dip survives a release.');
  assert.ok(f.sources.filter(source => !source.loop).every(source => source.stops.length >= 1), 'Every one-shot is stopped.');
  const bed = f.gains[1];
  assert.ok(Math.abs(bed.gain.events.at(-1)[1] - 1) < 1e-9, 'The bed returns to unity.');
});

test('five mode switches keep one context and release the outgoing loop buffer', async () => {
  const f = fixture();
  await f.world.activate('333');
  const order = ['4', '333', '4', '333', '4'];
  for (let index = 0; index < order.length; index++) {
    f.context.currentTime = 50 + index;
    await f.world.switchTo(order[index], { durationMs: 900 });
    await new Promise(resolve => setTimeout(resolve, 0));
    f.flush();
  }
  const count = url => f.fetches.filter(item => item.url === url).length;
  assert.equal(count('/assets/audio/loop-333.m4a'), 3, 'The incoming loop is reloaded only after its buffer was released.');
  assert.equal(count('/assets/audio/loop-4.m4a'), 3);
  assert.equal(count('/assets/audio/x-333-4.m4a'), 1, 'Tiny transition buffers stay cached.');
  assert.equal(count('/assets/audio/x-4-333.m4a'), 1);
  const decoded = label => f.decodes.filter(value => value.includes(label)).length;
  assert.equal(decoded('loop-333'), 3);
  assert.equal(decoded('loop-4'), 3);
  const snapshot = f.world.snapshot();
  assert.equal(snapshot.loops['4'].active, true);
  assert.equal(snapshot.loops['333'].active, false);
  assert.equal(snapshot.loops['333'].status, 'idle', 'The outgoing loop PCM is released.');
  assert.equal(snapshot.loops['333'].bufferDuration, 0);
  assert.equal(snapshot.assets['loops:333'].status, 'idle');
});

test('the transition direction mapping is reversible from settings alone', async () => {
  const settings = { ...worldSoundSettings, transitionRouting: { '333>4': 'x-4-333', '4>333': 'x-333-4' } };
  const f = fixture({ settings });
  await f.world.activate('333');
  await f.world.switchTo('4', { durationMs: 900 });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(f.fetches.some(item => item.url === '/assets/audio/x-4-333.m4a'), 'Flipped routing plays the other file.');
  assert.ok(!f.fetches.some(item => item.url === '/assets/audio/x-333-4.m4a'));
  assert.equal(f.world.snapshot().assets['transitions:333>4'].path, '/assets/audio/x-4-333.m4a');
});
