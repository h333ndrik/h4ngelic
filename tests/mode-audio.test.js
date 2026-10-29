import test from 'node:test';
import assert from 'node:assert/strict';
import { createModeAudio, synthesizeModeSound } from '../src/mode-audio.js';
import { modeAudioSettings } from '../src/data/modeAudioSettings.js';

const rms = (values) => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);

test('the actual enter/leave PCM is short, bounded, stereo and decays without a clipped tail', () => {
  const enter = synthesizeModeSound('xray');
  const leave = synthesizeModeSound('normal');
  for (const sound of [enter, leave]) {
    assert.ok(sound.duration >= .4 && sound.duration <= .8);
    for (const channel of sound.channels) {
      assert.ok(channel.every(Number.isFinite));
      assert.equal(channel[0], 0);
      assert.equal(channel.at(-1), 0);
      assert.ok(Math.max(...channel.map(Math.abs)) <= modeAudioSettings.maximumPeak + 1e-6);
      const first = rms(channel.subarray(0, 4800));
      const last = rms(channel.subarray(channel.length - 4800));
      assert.ok(first > .1 && last < first * .04, 'Metallic strike must decay into a quiet resonance.');
    }
    assert.notDeepEqual(sound.channels[0], sound.channels[1], 'Short reflections preserve a small stereo width.');
  }
  assert.notDeepEqual(enter.channels[0], leave.channels[0], 'The related descending cue is a distinct waveform.');
  assert.throws(() => synthesizeModeSound('unknown'), TypeError);
  assert.throws(() => synthesizeModeSound('xray', { sampleRate: 0 }), RangeError);
});

function audioFixture({ rejectResume = false, throwConstruction = false, storage = new Map(), privateURL = '', rejectPlayback = false, deferredFetch = null } = {}) {
  const contexts = [];
  const media = [];
  const fetches = [];
  class Param {
    value = 1;
    events = [];
    setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
    linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); }
    cancelScheduledValues(time) { this.events.push(['cancel', time]); }
    cancelAndHoldAtTime(time) { this.events.push(['hold', time]); }
  }
  class Node {
    disconnected = false;
    connections = [];
    connect(target) { this.connections.push(target); return target; }
    disconnect() { this.disconnected = true; }
  }
  class Source extends Node {
    start(time, offset = 0) { this.started = time; this.offset = offset; }
    stop(time = 0) { this.stopped = time; }
    end() { this.onended?.(); }
  }
  class Context {
    state = 'suspended'; currentTime = 1; sampleRate = 24000; destination = {}; sources = []; gains = []; resumeCalls = 0;
    constructor() { if (throwConstruction) throw new Error('Audio unavailable.'); contexts.push(this); }
    createGain() { const node = Object.assign(new Node(), { gain: new Param() }); this.gains.push(node); return node; }
    createDynamicsCompressor() { return Object.assign(new Node(), Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(name => [name, new Param()]))); }
    createBuffer(channels, length) { return { channels: Array.from({ length: channels }, () => new Float32Array(length)), copyToChannel(data, index) { this.channels[index].set(data); } }; }
    createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
    createMediaElementSource(element) { const node = new Node(); node.media = element; return node; }
    decodeAudioData(bytes) { this.decodedBytes = bytes.byteLength; return Promise.resolve({ duration: 100.310204 }); }
    resume() { this.resumeCalls++; if (rejectResume) return Promise.reject(new Error('Gesture denied.')); this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  class Audio {
    currentTime = 0; playCalls = 0; pauseCalls = 0;
    constructor() { media.push(this); }
    play() { this.playCalls++; return rejectPlayback ? Promise.reject(new Error('Playback denied.')) : Promise.resolve(); }
    pause() { this.pauseCalls++; }
    load() {}
    removeAttribute(name) { delete this[name]; }
  }
  const audio = createModeAudio({ view: { AudioContext: Context, Audio,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    fetch(url, options) { fetches.push({ url, options }); return deferredFetch || Promise.resolve({ ok: !rejectPlayback, arrayBuffer: async () => new ArrayBuffer(8) }); },
  }, privateURL });
  return { audio, contexts, media, storage, fetches };
}

test('Web Audio remains unallocated until a trusted user gesture, then primes before the hold timer', async () => {
  const { audio, contexts } = audioFixture();
  assert.equal(audio.snapshot().initialized, false);
  assert.equal(audio.play('xray'), false);
  assert.equal(await audio.prime({ isTrusted: false }), false);
  assert.equal(contexts.length, 0);
  const ready = audio.prime({ isTrusted: true });
  assert.equal(contexts[0].resumeCalls, 1, 'resume() must run synchronously inside the user gesture.');
  assert.equal(await ready, true);
  assert.equal(audio.play('xray'), true);
  assert.equal(contexts[0].sources[0].started, contexts[0].currentTime, 'An idle cue starts with the actual transition.');
  contexts[0].sources[0].end();
  assert.equal(audio.snapshot().allocatedVoices, 0);
  assert.equal(audio.snapshot().active, false);
  audio.dispose();
  assert.equal(contexts[0].state, 'closed');
});

test('rapid transitions do not overlap and ended sources disconnect', async () => {
  const { audio, contexts } = audioFixture();
  await audio.prime({ isTrusted: true });
  const context = contexts[0];
  audio.play('xray');
  context.currentTime += .1;
  audio.play('normal');
  const [first, second] = context.sources;
  assert.ok(first.stopped <= second.started, 'The old voice ends before the next one begins.');
  assert.ok(second.started - context.currentTime <= .01, 'Interruption protection does not add a perceptible delay.');
  first.end();
  assert.equal(first.disconnected, true);
  assert.equal(audio.snapshot().active, true, 'Finishing an old voice cannot clear the active replacement.');
  second.end();
  assert.equal(audio.snapshot().allocatedVoices, 0);
  audio.dispose();
});

test('mute stops current audio, persists in document memory and prevents new playback', async () => {
  const { audio, contexts } = audioFixture();
  audio.setMuted(true);
  assert.equal(await audio.prime({ isTrusted: true }), false);
  assert.equal(contexts.length, 0, 'Muting before discovery does not initialize audio.');
  audio.setMuted(false);
  await audio.prime({ isTrusted: true });
  audio.play('xray');
  audio.setMuted(true);
  assert.equal(audio.snapshot().active, false);
  assert.equal(audio.play('normal'), false);
  audio.setMuted(false);
  assert.equal(audio.play('normal'), true);
  audio.dispose();
  assert.equal(audio.snapshot().allocatedVoices, 0);
  assert.equal(audio.play('xray'), false);
});

test('unsupported or denied audio never throws into mode switching', async () => {
  const unsupported = createModeAudio({ view: {} });
  assert.equal(unsupported.supported, false);
  assert.equal(await unsupported.prime({ isTrusted: true }), false);
  assert.equal(unsupported.play('xray'), false);
  unsupported.dispose();
  const denied = audioFixture({ rejectResume: true });
  assert.equal(await denied.audio.prime({ isTrusted: true }), false);
  assert.equal(denied.audio.play('xray'), false);
  denied.audio.dispose();
  const unavailable = audioFixture({ throwConstruction: true });
  assert.equal(await unavailable.audio.prime({ isTrusted: true }), false);
  assert.equal(unavailable.audio.supported, false);
  unavailable.audio.dispose();
});

test('mute and bounded global volume survive reload without allocating audio or autoplaying', async () => {
  const storage = new Map();
  const first = audioFixture({ storage });
  let changes = 0;
  const unsubscribe = first.audio.subscribe(() => changes++);
  first.audio.setVolume(.27);
  first.audio.setMuted(true);
  assert.equal(changes, 2);
  assert.equal(first.contexts.length, 0);
  const second = audioFixture({ storage });
  assert.equal(second.audio.muted, true);
  assert.equal(second.audio.volume, .27);
  assert.equal(second.contexts.length, 0);
  second.audio.setMuted(false);
  await second.audio.prime({ isTrusted: true });
  assert.equal(second.contexts[0].gains[0].gain.value, .135);
  second.audio.setVolume(2);
  assert.equal(second.audio.volume, 1);
  assert.equal(second.contexts[0].gains[0].gain.value, .5, 'The shared bus caps maximum loudness.');
  second.audio.setVolume(-1);
  assert.equal(second.audio.volume, 0);
  second.audio.setVolume(Number.NaN);
  assert.equal(second.audio.volume, 0);
  unsubscribe(); first.audio.dispose(); second.audio.dispose();
});

test('approved SMASH fetches once after a real gesture, fades precisely, ducks cues and caches playback', async () => {
  const { audio, contexts, media, fetches } = audioFixture({ privateURL: modeAudioSettings.smashURL });
  assert.equal(audio.smashAvailable, true);
  assert.equal(media.length, 0);
  assert.equal(fetches.length, 0, 'Rendering the footer cannot preload the track.');
  assert.equal(await audio.toggleSmash({ isTrusted: false }), false);
  assert.equal(fetches.length, 0);
  assert.equal(await audio.toggleSmash({ isTrusted: true }), true);
  assert.equal(fetches.length, 1);
  assert.deepEqual(fetches[0], { url: '/audio/h4ngelic_v8_full_sound_remaster_v11.mp3', options: { cache: 'force-cache' } });
  assert.equal(media.length, 0, 'One central Web Audio controller owns playback without an independent media player.');
  const context = contexts[0];
  const track = context.sources[0];
  const envelope = context.gains[3].gain.events;
  assert.equal(track.offset, 0, 'Every track activation begins at the first sample.');
  assert.deepEqual(envelope, [
    ['set', 0, 1], ['ramp', 1, 2.8],
    ['set', 1, 96.310204], ['ramp', 0, 101.310204],
  ], 'A 1.8-second attack and final 5-second tail reach silence exactly at the original buffer end.');
  assert.equal(audio.smashPlaying, true);
  assert.equal(audio.play('xray'), false);
  assert.equal(audio.play('normal'), false);
  assert.equal(track.stopped, undefined, 'Mode cues cannot interrupt the soundtrack.');
  audio.setVolume(.5);
  assert.equal(context.gains[0].gain.value, .25);
  audio.setMuted(true);
  assert.equal(context.gains[0].gain.value, 0);
  assert.equal(audio.smashPlaying, true, 'Mute affects the central bus while track time continues.');
  audio.setMuted(false);
  context.currentTime = 10;
  assert.equal(await audio.toggleSmash({ isTrusted: true }), false);
  assert.equal(track.stopped, 11, 'A second click schedules a one-second stop, not an immediate cut.');
  assert.deepEqual(context.gains[3].gain.events.slice(-2), [['hold', 10], ['ramp', 0, 11]], 'Manual stop holds the current interpolated gain instead of jumping to a future scheduled value.');
  assert.equal(audio.snapshot().smashPhase, 'stopping');
  assert.equal(audio.play('normal'), false, 'Priority remains with the track through its short stop fade.');
  context.currentTime = 11;
  track.end();
  assert.equal(audio.smashPlaying, false);
  assert.equal(track.disconnected, true);
  assert.equal(audio.play('normal'), true);
  assert.equal(await audio.toggleSmash({ isTrusted: true }), true);
  assert.equal(fetches.length, 1, 'A later activation reuses the cached decoded track without a second request.');
  const restarted = context.sources.at(-1);
  assert.equal(restarted.offset, 0);
  restarted.end();
  assert.equal(audio.smashPlaying, false);
  assert.equal(audio.play('xray'), true, 'Natural completion restores ordinary cue playback.');
  audio.dispose();
  assert.equal(audio.snapshot().allocatedVoices, 0);
  assert.equal(audio.snapshot().smashCached, false, 'Document disposal releases the cached PCM.');
});

test('missing or denied SMASH cannot substitute a track or leave cue priority stuck', async () => {
  const absent = audioFixture();
  assert.equal(absent.audio.smashAvailable, false);
  assert.equal(await absent.audio.toggleSmash({ isTrusted: true }), false);
  assert.equal(absent.contexts.length, 0);
  const denied = audioFixture({ privateURL: modeAudioSettings.smashURL, rejectPlayback: true });
  assert.equal(await denied.audio.toggleSmash({ isTrusted: true }), false);
  assert.equal(denied.audio.smashPlaying, false);
  assert.equal(denied.audio.play('normal'), true);
  absent.audio.dispose(); denied.audio.dispose();
});

test('canceling a pending track load does not create a stale source or duplicate its shared fetch', async () => {
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  const { audio, contexts, fetches } = audioFixture({ privateURL: modeAudioSettings.smashURL, deferredFetch: pending });
  const first = audio.toggleSmash({ isTrusted: true });
  assert.equal(audio.snapshot().smashPhase, 'loading');
  assert.equal(await audio.toggleSmash({ isTrusted: true }), false);
  assert.equal(audio.smashPlaying, false);
  const second = audio.toggleSmash({ isTrusted: true });
  assert.equal(fetches.length, 1);
  complete({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  assert.equal(await first, false);
  assert.equal(await second, true);
  assert.equal(contexts[0].sources.length, 1, 'Only the latest trusted activation becomes audible after loading.');
  audio.dispose();
  assert.equal(contexts[0].sources[0].disconnected, true);
});

test('stopping during the scheduled final tail cannot extend the track past its original end', async () => {
  const { audio, contexts } = audioFixture({ privateURL: modeAudioSettings.smashURL });
  await audio.toggleSmash({ isTrusted: true });
  const context = contexts[0], track = context.sources[0];
  context.currentTime = 101;
  audio.stopSmash();
  assert.equal(track.stopped, 101.310204);
  audio.dispose();
});
