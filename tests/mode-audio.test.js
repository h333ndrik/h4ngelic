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

function audioFixture({ rejectResume = false, throwConstruction = false } = {}) {
  const contexts = [];
  class Param {
    value = 1;
    events = [];
    setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
    linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); }
    cancelScheduledValues(time) { this.events.push(['cancel', time]); }
  }
  class Node {
    disconnected = false;
    connections = [];
    connect(target) { this.connections.push(target); return target; }
    disconnect() { this.disconnected = true; }
  }
  class Source extends Node {
    start(time) { this.started = time; }
    stop(time = 0) { this.stopped = time; }
    end() { this.onended?.(); }
  }
  class Context {
    state = 'suspended'; currentTime = 1; sampleRate = 24000; destination = {}; sources = []; resumeCalls = 0;
    constructor() { if (throwConstruction) throw new Error('Audio unavailable.'); contexts.push(this); }
    createGain() { return Object.assign(new Node(), { gain: new Param() }); }
    createDynamicsCompressor() { return Object.assign(new Node(), Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(name => [name, new Param()]))); }
    createBuffer(channels, length) { return { channels: Array.from({ length: channels }, () => new Float32Array(length)), copyToChannel(data, index) { this.channels[index].set(data); } }; }
    createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
    resume() { this.resumeCalls++; if (rejectResume) return Promise.reject(new Error('Gesture denied.')); this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  const audio = createModeAudio({ view: { AudioContext: Context } });
  return { audio, contexts };
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
