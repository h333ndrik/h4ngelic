#!/usr/bin/env node
/**
 * H4NGELIC WORLD SOUND v2 — one deterministic renderer for all four deliverables.
 *
 *   loop-333.m4a   90 s  clean world   "edge of the universe, with life"
 *   loop-4.m4a     90 s  corrupted world "living decay"
 *   x-333-4.m4a    1.4 s transition, clean anchor -> corrupted anchor
 *   x-4-333.m4a    1.4 s transition, corrupted anchor -> clean anchor
 *
 * Loop construction
 * -----------------
 * Each loop is built as a signal that is periodic *by design* rather than by a
 * crossfade:
 *   - every sustained oscillator and LFO frequency is snapped to the 1/90 Hz
 *     grid, so it completes a whole number of cycles per 90 s loop (the worst
 *     case is 0.08 cent away from the nominal anchor frequency);
 *   - every envelope, filter drift and event position is a function of loop
 *     phase, never of absolute render time.
 * The renderer therefore writes 94 s: 4 s of pre-roll covering loop phase
 * 86-90 s, then loop phase 0-90 s. The pre-roll warms the echo and reverb
 * state, so the loop is trimmed at exactly 3,969,000 frames with no crossfade,
 * no level bump and no tail reset at the seam.
 *
 * ffmpeg is local build tooling only. Nothing in the site depends on it.
 *
 * Usage: node scripts/renderWorldLoops.mjs [--out DIR] [--flac] [--only=NAME]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const SAMPLE_RATE = 44100;
const BPM = 124;
const LOOP_SECONDS = 90;
const LOOP_FRAMES = LOOP_SECONDS * SAMPLE_RATE; // 3,969,000
const PRE_SECONDS = 4;
const PRE_FRAMES = PRE_SECONDS * SAMPLE_RATE;
const RENDER_FRAMES = LOOP_FRAMES + PRE_FRAMES;
const TRANSITION_FRAMES = Math.round(1.4 * SAMPLE_RATE); // 61,740
const TAU = Math.PI * 2;

/** Shared tonal anchors: F1 sub, F2, Ab2 and the bright metallic C6 ping.
 * Loops and transitions all use the same four frequencies. */
const NOMINAL_ANCHORS = Object.freeze([43.6535, 87.3071, 103.8262, 1046.5023]);
const grid = frequency => Math.round(frequency * LOOP_SECONDS) / LOOP_SECONDS;
const ANCHORS = Object.freeze(NOMINAL_ANCHORS.map(grid));
const [SUB_HZ, ROOT_HZ, MINOR_HZ, PING_HZ] = ANCHORS;
/** F minor pentatonic across the usable register. */
const SCALE = Object.freeze([174.614, 207.652, 233.082, 261.626, 311.127,
  349.228, 415.305, 466.164, 523.251, 622.254, 698.456]);
const NATURE_PENTATONIC = Object.freeze([523.251, 622.254, 698.456, 830.609, 932.328]);

const SEEDS = Object.freeze({
  'loop-333': 0x333a11ce,
  'loop-4': 0x4c0ffee1,
  'x-333-4': 0x33340001,
  'x-4-333': 0x43330001,
});
const TARGET_LUFS = -18;
const PEAK_CEILING = .62;

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const OUTPUT = resolve(outIndex >= 0 && args[outIndex + 1] ? args[outIndex + 1] : join(ROOT, 'work/world-sound-v2'));
const VERIFY_FLAC = args.includes('--flac');
const CHECK_DETERMINISM = args.includes('--determinism');
const onlyIndex = args.findIndex(value => value.startsWith('--only'));
const ONLY = onlyIndex >= 0 ? (args[onlyIndex].split('=')[1] || args[onlyIndex + 1] || null) : null;

/* ------------------------------------------------------------------ basics */

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = value + 0x6d2b79f5 | 0;
    let t = Math.imul(value ^ value >>> 15, 1 | value);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp = (value, minimum = -1, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const smoothstep = value => { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); };
const ramp = (time, start, end) => smoothstep((time - start) / Math.max(1e-9, end - start));
const windowEnv = (time, inStart, inEnd, outStart, outEnd) =>
  ramp(time, inStart, inEnd) * (1 - ramp(time, outStart, outEnd));
const pan = amount => { const angle = (clamp(amount, -1, 1) + 1) * Math.PI / 4; return [Math.cos(angle), Math.sin(angle)]; };
const db = value => 20 * Math.log10(Math.max(1e-12, value));
const loopPhase = frame => ((frame - PRE_FRAMES) % LOOP_FRAMES + LOOP_FRAMES) % LOOP_FRAMES;
const phaseSeconds = frame => loopPhase(frame) / SAMPLE_RATE;
const atPhase = seconds => PRE_FRAMES + Math.round(((seconds % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS * SAMPLE_RATE);
function rms(channel, start = 0, length = channel.length) {
  let sum = 0;
  for (let index = start; index < start + length; index++) sum += channel[index] * channel[index];
  return Math.sqrt(sum / Math.max(1, length));
}
/** Gentle build arc: sparse intro -> layers -> fullest at 58-70 s -> back to
 * the intro texture at 90 s. Applied to every layer, so the loop level, not
 * just the arrangement, breathes. */
const ARC = Object.freeze([[0, .56], [12, .60], [26, .69], [45, .83], [58, .95], [70, 1], [79, .90], [90, .56]]);
function masterArc(cycle) {
  for (let index = 1; index < ARC.length; index++) {
    if (cycle <= ARC[index][0]) {
      const [t0, v0] = ARC[index - 1], [t1, v1] = ARC[index];
      return v0 + (v1 - v0) * smoothstep((cycle - t0) / (t1 - t0));
    }
  }
  return ARC.at(-1)[1];
}

function crush(sample, bits) {
  const steps = 2 ** bits;
  return Math.round(sample * steps) / steps;
}

/* --------------------------------------------------------- voice primitives */

/** One additive voice with per-partial inharmonic weights, smooth or
 * exponential edges and optional vibrato/pan drift. */
function addVoice(left, right, startFrame, seconds, frequency, amplitude, panning, options = {}) {
  const frames = Math.round(seconds * SAMPLE_RATE);
  if (frames < 2) return;
  const start = Math.max(0, Math.round(startFrame));
  const [gl, gr] = pan(panning);
  const attack = Math.max(.0005, options.attack ?? .01);
  const release = Math.max(.002, options.release ?? .3);
  const decay = options.decay || 0;
  const vibratoHz = options.vibratoHz || 0;
  const vibratoCents = options.vibratoCents || 0;
  const panLfo = options.panLfo || 0;
  const partials = options.partials || [[1, 1]];
  const random = rng(options.seed ?? 1);
  const phases = partials.map(() => random() * TAU);
  const total = seconds;
  for (let frame = 0; frame < frames; frame++) {
    const index = start + frame;
    if (index >= left.length) break;
    const time = frame / SAMPLE_RATE;
    let envelope = smoothstep(time / attack);
    if (decay) envelope *= Math.exp(-time / decay);
    const tail = Math.min(release, Math.max(.004, total - time));
    envelope *= smoothstep((total - time) / tail);
    const vibrato = vibratoCents ? Math.pow(2, vibratoCents * Math.sin(TAU * vibratoHz * time) / 1200) : 1;
    let value = 0;
    for (let partial = 0; partial < partials.length; partial++) {
      const [ratio, weight] = partials[partial];
      value += Math.sin(TAU * frequency * ratio * vibrato * time + phases[partial]) * weight;
    }
    const drift = panLfo ? Math.sin(TAU * panLfo * time) * .1 : 0;
    const sample = value * amplitude * envelope;
    left[index] += sample * gl * (1 - drift);
    right[index] += sample * gr * (1 + drift);
  }
}

/** Inharmonic bell/tick: the bright metallic identity shared by loops and
 * transitions. Ratios are deliberately non-integer for a struck-chrome timbre. */
function addPing(left, right, startFrame, amplitude, seed, base = PING_HZ, panning = 0, options = {}) {
  const random = rng(seed);
  const ratios = options.ratios || [1, 1.42, 1.93, 2.71, 3.37, 4.19];
  const spread = options.spread ?? .7;
  const length = options.length ?? 1.7;
  for (let partial = 0; partial < ratios.length; partial++) {
    addVoice(left, right, startFrame, length, base * ratios[partial],
      amplitude * (.36 / (partial + 1.35)), clamp(panning + (random() - .5) * spread), {
        attack: .0025, release: .015, decay: (options.decay ?? .46) * (1 - .1 * partial),
        vibratoHz: .5, vibratoCents: 1.2, seed: seed + partial + 1,
      });
  }
}

function addGlide(left, right, startFrame, seconds, fromHz, toHz, amplitude, panning, options = {}) {
  const frames = Math.round(seconds * SAMPLE_RATE);
  const start = Math.max(0, Math.round(startFrame));
  const [gl, gr] = pan(panning);
  const partials = options.partials || [[1, 1]];
  const random = rng(options.seed ?? 9);
  const phases = partials.map(() => random() * TAU);
  let phaseValue = 0;
  for (let frame = 0; frame < frames; frame++) {
    const index = start + frame;
    if (index >= left.length) break;
    const p = frame / frames;
    const frequency = fromHz * Math.pow(toHz / fromHz, p);
    phaseValue += TAU * frequency / SAMPLE_RATE;
    const attack = smoothstep(p / Math.max(1e-6, (options.attack ?? .06)));
    const release = smoothstep((1 - p) / Math.max(1e-6, (options.release ?? .18)));
    let value = 0;
    for (let partial = 0; partial < partials.length; partial++) {
      value += Math.sin(phaseValue * partials[partial][0] + phases[partial]) * partials[partial][1];
    }
    const sample = value * amplitude * attack * release;
    left[index] += sample * gl;
    right[index] += sample * gr;
  }
}

/* ------------------------------------------------------------- loop layers */

function renderBed(left, right, world, seed) {
  const dark = world === '4';
  // Two passes over the identical noise stream. Pass 1 primes every filter
  // state and is discarded; pass 2 starts from the state the loop ends on, so
  // the bed is periodic and the seam has no derivative jump. Three pink
  // streams keep the mono fold solid (shared) while staying wide (per channel).
  const state = [new Float64Array(7), new Float64Array(7), new Float64Array(7)];
  const lp = new Float64Array(3), hp = new Float64Array(3), held = new Float64Array(3);
  const outL = new Float32Array(LOOP_FRAMES), outR = new Float32Array(LOOP_FRAMES);
  for (let pass = 0; pass < 2; pass++) {
    const random = rng(seed);
    for (let frame = 0; frame < LOOP_FRAMES; frame++) {
      const cycle = frame / SAMPLE_RATE;
      const drift = .5 + .5 * Math.sin(TAU * cycle / LOOP_SECONDS)
        + .25 * Math.sin(TAU * 3 * cycle / LOOP_SECONDS + 1.3);
      const cutoff = dark ? 800 + drift * 2600 : 1900 + drift * 6000;
      const coefficient = 1 - Math.exp(-TAU * cutoff / SAMPLE_RATE);
      for (let channel = 0; channel < 3; channel++) {
        const white = random() * 2 - 1;
        const s = state[channel];
        s[0] = .99886 * s[0] + white * .0555179;
        s[1] = .99332 * s[1] + white * .0750759;
        s[2] = .96900 * s[2] + white * .1538520;
        s[3] = .86650 * s[3] + white * .3104856;
        s[4] = .55000 * s[4] + white * .5329522;
        s[5] = -.7616 * s[5] - white * .0168980;
        const pink = (s[0] + s[1] + s[2] + s[3] + s[4] + s[5] + s[6] + white * .5362) * .11;
        s[6] = white * .115926;
        const high = pink - hp[channel];
        hp[channel] = high * .995;
        lp[channel] += coefficient * (high - lp[channel]);
        if (dark) {
          if (frame % 4 === 0) held[channel] = lp[channel];
          lp[channel] = Math.round(held[channel] * 1024) / 1024;
        }
      }
      if (pass === 1) {
        const envelope = .82 + .18 * Math.sin(TAU * 2 * cycle / LOOP_SECONDS + (dark ? 2.1 : .4));
        const amplitude = (dark ? .070 : .062) * envelope * 1.7;
        outL[frame] = (lp[0] * .68 + lp[1] * .32) * amplitude;
        outR[frame] = (lp[0] * .68 + lp[2] * .32) * amplitude;
      }
    }
  }
  left.set(outL.subarray(LOOP_FRAMES - PRE_FRAMES), 0);
  right.set(outR.subarray(LOOP_FRAMES - PRE_FRAMES), 0);
  left.set(outL, PRE_FRAMES);
  right.set(outR, PRE_FRAMES);
}

/** Continuous anchor drones. These never fade and never change pitch, so every
 * position of either loop carries the same tonal anchors the transitions start
 * and end on. World 4 warps the upper layers, not the anchors themselves. */
function renderAnchorDrones(left, right, world, seed) {
  const dark = world === '4';
  for (let frame = 0; frame < RENDER_FRAMES; frame++) {
    const cycle = phaseSeconds(frame);
    const breath = 1 + .12 * Math.sin(TAU * 2 * cycle / LOOP_SECONDS);
    const wobble = 1 + (dark ? .1 : .03) * Math.sin(TAU * 5 * cycle / LOOP_SECONDS + .8);
    const sub = Math.sin(TAU * SUB_HZ * cycle + 1) * .82
      + Math.sin(TAU * SUB_HZ * 2 * cycle + 2) * .1
      + Math.sin(TAU * SUB_HZ * 3 * cycle + 3) * .033;
    const root = Math.sin(TAU * ROOT_HZ * cycle + 1.7) * .8
      + Math.sin(TAU * ROOT_HZ * 2 * cycle + 3.4) * .045;
    const minor = Math.sin(TAU * MINOR_HZ * cycle + .9) * .8
      + Math.sin(TAU * MINOR_HZ * 2 * cycle + 2.2) * .1;
    const shimmer = Math.sin(TAU * PING_HZ * cycle + .4) * .7
      + Math.sin(TAU * PING_HZ * 2 * cycle + 2.9) * .12;
    const shimmerArc = (.55 + .45 * (1 - ramp(cycle, 78, 87)) * ramp(cycle, 4, 30))
      * (1 + .3 * Math.sin(TAU * 11 * cycle / LOOP_SECONDS + 1.1));
    const l = sub * .021 * breath + root * .021 * wobble + minor * .011 + shimmer * .0034 * shimmerArc;
    const r = sub * .021 * breath + root * .021 * .96 * wobble + minor * .011 * 1.06 + shimmer * .0034 * shimmerArc * .92;
    left[frame] += l;
    right[frame] += r;
  }
}

/** High air: two cascaded high-passed noise streams for the chrome haze.
 * Shared plus per-channel streams keep it wide without losing the mono fold. */
function renderAir(left, right, world, seed) {
  const dark = world === '4';
  const random = rng(seed ^ 0x41a17e);
  const lp = [new Float64Array(2), new Float64Array(2), new Float64Array(2)];
  for (let frame = 0; frame < RENDER_FRAMES; frame++) {
    const cycle = phaseSeconds(frame);
    const drift = .5 + .5 * Math.sin(TAU * 7 * cycle / LOOP_SECONDS + 2.2)
      + .2 * Math.sin(TAU * 2 * cycle / LOOP_SECONDS + .3);
    const cutoff = dark ? 2500 + drift * 2400 : 3400 + drift * 4800;
    const coefficient = 1 - Math.exp(-TAU * cutoff / SAMPLE_RATE);
    const values = [0, 0, 0];
    for (let stream = 0; stream < 3; stream++) {
      let value = random() * 2 - 1;
      for (let pole = 0; pole < 2; pole++) {
        lp[stream][pole] += coefficient * (value - lp[stream][pole]);
        value = value - lp[stream][pole];
      }
      values[stream] = value;
    }
    const envelope = .7 + .3 * Math.sin(TAU * 3 * cycle / LOOP_SECONDS + 1);
    const amplitude = (dark ? .0092 : .0062) * envelope;
    left[frame] += (values[0] * .72 + values[1] * .28) * amplitude;
    right[frame] += (values[0] * .72 + values[2] * .28) * amplitude;
  }
}

/** Layered voices for the build arc: one enters at a time, all leave before
 * 90 s so the last seconds return to the intro texture. */
function renderBuildDrones(left, right, world, seed) {
  const dark = world === '4';
  const voices = [
    { frequency: 130.8128, amp: .021, inA: 16, inB: 30, outA: 76, outB: 84, pan: -.42, partials: [[1, .72], [2, .16], [3, .07]] },
    { frequency: 155.5635, amp: .017, inA: 28, inB: 43, outA: 74, outB: 82, pan: .38, partials: [[1, .7], [2, .18], [4.02, .05]] },
    { frequency: 174.6141, amp: .014, inA: 38, inB: 53, outA: 72, outB: 80, pan: -.18, partials: [[1, .74], [3, .1], [5, .04]] },
    { frequency: 698.4560, amp: .0065, inA: 46, inB: 62, outA: 70, outB: 78, pan: .55, partials: [[1, .66], [2.01, .2], [3.02, .06]] },
  ];
  voices.forEach((voice, index) => {
    const random = rng(seed + index * 977);
    const partials = voice.partials.map(([ratio, weight], part) =>
      [ratio * (dark ? 1 + (random() - .5) * .004 : 1), weight]);
    const phases = partials.map(() => random() * TAU);
    const panning = voice.pan;
    const [gl, gr] = pan(panning);
    for (let frame = 0; frame < RENDER_FRAMES; frame++) {
      const cycle = phaseSeconds(frame);
      const envelope = windowEnv(cycle, voice.inA, voice.inB, voice.outA, voice.outB);
      if (envelope <= 0) continue;
      const wowRate = (13 + index * 4) / LOOP_SECONDS;
      const wowDepth = dark ? 1.4 : .18;
      const modulation = wowDepth * Math.sin(TAU * wowRate * cycle + index);
      let value = 0;
      for (let part = 0; part < partials.length; part++) {
        value += Math.sin(TAU * voice.frequency * partials[part][0] * cycle + phases[part]
          + modulation * partials[part][0]) * partials[part][1];
      }
      let grain = 1;
      if (dark) {
        const grainRate = 1 / 90 * (58 + index * 9);
        grain = .74 + .26 * Math.sin(TAU * grainRate * cycle + index * 1.7)
          + .08 * Math.sin(TAU * grainRate * 2.37 * cycle);
      }
      const sample = value * voice.amp * envelope * grain;
      left[frame] += sample * gl;
      right[frame] += sample * gr;
    }
  });
}

/** Soft 124 BPM sub pulse. 124 BPM x 90 s = exactly 186 beats, so the pulse
 * grid closes on the loop boundary; accents every second beat stay periodic. */
function renderSubPulse(left, right, world, seed) {
  const dark = world === '4';
  const beat = 60 / BPM;
  for (let index = 0; index < 186; index++) {
    const phaseTime = index * beat;
    const accent = index % 2 === 0;
    const start = atPhase(phaseTime);
    const amp = (accent ? .026 : .019) * (dark ? 1.06 : 1);
    const length = dark ? .34 : .30;
    addVoice(left, right, start, length, SUB_HZ, amp, 0, {
      attack: .004, release: .035, decay: .11, partials: [[1, 1], [2, .18]], seed: seed + index,
    });
    if (dark && index % 6 === 4) {
      addVoice(left, right, start, length * 1.4, SUB_HZ * 1.5, amp * .50, .35, {
        attack: .006, release: .05, decay: .16, partials: [[1, 1], [3, .08]], seed: seed + index + 991,
      });
    }
  }
}

function addChirpPhrase(left, right, startFrame, random, world) {
  const chirps = 2 + Math.floor(random() * 3);
  const base = NATURE_PENTATONIC[Math.floor(random() * NATURE_PENTATONIC.length)];
  for (let chirp = 0; chirp < chirps; chirp++) {
    const at = startFrame + Math.round(chirp * (world === '4' ? .26 + random() * .3 : .14 + random() * .18) * SAMPLE_RATE);
    const duration = world === '4' ? .16 + random() * .16 : .06 + random() * .05;
    const from = base * (1.6 + random() * .7);
    const to = from * (world === '4' ? .33 + random() * .16 : .56 + random() * .14);
    const [gl, gr] = pan(random() * 1.85 - .925);
    const phaseOffset = random() * TAU;
    const frames = Math.round(duration * SAMPLE_RATE);
    for (let frame = 0; frame < frames; frame++) {
      const p = frame / frames;
      const envelope = Math.sin(Math.PI * p) ** 1.8;
      const frequency = from * Math.pow(to / from, p) * (1 + .012 * Math.sin(TAU * 19 * p));
      const angle = TAU * frequency * frame / SAMPLE_RATE + phaseOffset + Math.sin(TAU * 7 * p) * .7;
      const value = (Math.sin(angle) * .82 + Math.sin(angle * 2.01) * .18) * envelope * (world === '4' ? .0055 : .0062);
      const index = at + frame;
      if (index < left.length) { left[index] += value * gl; right[index] += value * gr; }
      if (world === '4' && frame > 0 && frame % 6 < 3) {
        const echo = Math.min(left.length - 1, index + 41);
        left[echo] += value * gl * .3;
        right[Math.min(left.length - 1, index + 57)] += value * gr * .24;
      }
    }
  }
}

function addWhaleCall(left, right, startFrame, duration, base, amplitude, panning, world) {
  const frames = Math.round(duration * SAMPLE_RATE);
  const [gl, gr] = pan(panning);
  let phaseValue = 0;
  for (let frame = 0; frame < frames; frame++) {
    const p = frame / frames;
    const frequency = base * (1 + .11 * Math.sin(Math.PI * p)) * (world === '4' ? 1 - .09 * p : 1);
    phaseValue += TAU * frequency / SAMPLE_RATE;
    const envelope = Math.sin(Math.PI * p) ** 1.15;
    const vibrato = Math.sin(TAU * (.38 + .08 * Math.sin(TAU * .06 * frame / SAMPLE_RATE)) * frame / SAMPLE_RATE) * .2;
    const value = (Math.sin(phaseValue + vibrato) + Math.sin(phaseValue * 2 + .7) * .1) * envelope * amplitude;
    const index = startFrame + frame;
    if (index < left.length) { left[index] += value * gl; right[index] += value * gr; }
  }
}

function addInsectClick(left, right, startFrame, random, world) {
  const frames = Math.max(3, Math.round((world === '4' ? .005 + random() * .005 : .0025 + random() * .003) * SAMPLE_RATE));
  const [gl, gr] = pan(random() * 1.8 - .9);
  const gain = world === '4' ? .0026 : .0018;
  let previous = 0;
  for (let frame = 0; frame < frames; frame++) {
    const white = random() * 2 - 1;
    const high = white - previous * .94;
    previous = white;
    const envelope = Math.sin(Math.PI * frame / frames) ** 2;
    let value = high * envelope * gain;
    if (world === '4') value = crush(value, 4);
    const index = startFrame + frame;
    if (index < left.length) { left[index] += value * gl; right[index] += value * gr; }
  }
}

function addReversedSwell(left, right, startFrame, seconds, amplitude, panning, seed) {
  const frames = Math.round(seconds * SAMPLE_RATE);
  const random = rng(seed);
  const buffer = new Float32Array(frames);
  let lp = 0;
  for (let frame = 0; frame < frames; frame++) {
    const tail = Math.exp(-(frames - frame) / (frames * .35));
    const white = random() * 2 - 1;
    lp += .18 * (white - lp);
    buffer[frame] = lp * tail;
  }
  const [gl, gr] = pan(panning);
  for (let frame = 0; frame < frames; frame++) {
    const value = buffer[frames - 1 - frame] * amplitude;
    const index = startFrame + frame;
    if (index < left.length) { left[index] += value * gl; right[index] += value * gr; }
  }
}

function renderEvents(world, seed) {
  const left = new Float32Array(RENDER_FRAMES);
  const right = new Float32Array(RENDER_FRAMES);
  const random = rng(seed ^ 0xe7e17);
  const dark = world === '4';
  const noteStart = dark ? 21 : 23;
  const noteStep = dark ? 4.9 : 6.3;
  for (let time = noteStart; time < 74; time += noteStep * (.8 + random() * .42)) {
    const frequency = SCALE[Math.floor(random() * SCALE.length)] * (random() < .2 ? .5 : 1);
    const duration = dark ? 5.6 + random() * 4.4 : 6.4 + random() * 4.6;
    const amplitude = (dark ? .019 : .018) * (.6 + random() * .7);
    const panning = random() * 1.5 - .75;
    const arc = windowEnv(time, 18, 30, 70, 78);
    if (arc <= 0) continue;
    addVoice(left, right, atPhase(time), Math.min(duration, 78 - time), frequency, amplitude * arc, panning, {
      attack: dark ? 1.1 + random() * 1.4 : 1.7 + random() * 1.6,
      release: duration * .55,
      partials: dark ? [[1, .64], [2.01, .17], [3.02, .1], [4.98, .05]] : [[1, .67], [2, .16], [3, .11], [5, .035]],
      vibratoHz: dark ? .11 + random() * .1 : .05 + random() * .04,
      vibratoCents: dark ? 9 + random() * 10 : 2.5 + random() * 3,
      panLfo: .012 + random() * .02,
      seed: seed + Math.floor(time * 13),
    });
    if (dark) {
      addVoice(left, right, atPhase(time + .06), Math.min(duration * .8, 78 - time), frequency * .9975, amplitude * arc * .55,
        -panning, { attack: 1.6 + random(), release: duration * .6, partials: [[1, .6], [2, .2], [4.02, .08]],
          vibratoHz: .09, vibratoCents: 16, seed: seed + Math.floor(time * 17) });
    }
  }
  // Clean chrome ticks: the same metallic family as the transition ping.
  for (let time = 28 + random() * 3; time < 70; time += 2.6 + random() * 4.2) {
    const arc = windowEnv(time, 26, 36, 68, 76);
    if (arc <= 0) continue;
    addPing(left, right, atPhase(time), (dark ? .010 : .013) * arc, seed + Math.floor(time * 7),
      PING_HZ * (random() < .35 ? 1.5 : 1), random() * 1.7 - .85, { length: 1.1, decay: dark ? .2 : .3, spread: .9 });
  }
  if (dark) {
    for (const time of [36.5, 50.5, 62.5]) {
      addReversedSwell(left, right, atPhase(time - 2.4), 2.4, .020, random() * 1.2 - .6, seed + Math.floor(time * 3));
    }
  }
  for (const time of [54.5, 59.2, 63.4, 67.3, 70.1]) addChirpPhrase(left, right, atPhase(time), random, world);
  addWhaleCall(left, right, atPhase(dark ? 56.4 : 58.2), dark ? 3.8 : 3.2, dark ? 62 : 74, dark ? .012 : .009, -.66, world);
  addWhaleCall(left, right, atPhase(dark ? 66.1 : 67.4), dark ? 3.4 : 2.8, dark ? 55 : 69, dark ? .008 : .0065, .62, world);
  for (let click = 0; click < (dark ? 14 : 9); click++) {
    addInsectClick(left, right, atPhase(54 + random() * 16), random, world);
  }
  return { left, right };
}

/* ---------------------------------------------------------------- effects */

function renderEcho(inputL, inputR, world, seed) {
  const left = new Float32Array(RENDER_FRAMES);
  const right = new Float32Array(RENDER_FRAMES);
  const size = SAMPLE_RATE * 3;
  const delayL = new Float32Array(size);
  const delayR = new Float32Array(size);
  const dark = world === '4';
  const baseL = dark ? .67 : .73;
  const baseR = dark ? .83 : .91;
  const feedback = dark ? .44 : .35;
  let write = 0, smoothedL = 0, smoothedR = 0;
  for (let frame = 0; frame < RENDER_FRAMES; frame++) {
    const cycle = phaseSeconds(frame);
    const wow = dark
      ? .0052 * Math.sin(TAU * 17 / LOOP_SECONDS * cycle) + .0011 * Math.sin(TAU * 567 / LOOP_SECONDS * cycle + 1.7)
      : .0014 * Math.sin(TAU * 5 / LOOP_SECONDS * cycle + .9);
    const readL = (write - Math.round((baseL + wow) * SAMPLE_RATE) + size) % size;
    const readR = (write - Math.round((baseR - wow * .7) * SAMPLE_RATE) + size) % size;
    const nextL = (readL + 1) % size, nextR = (readR + 1) % size;
    const dL = delayL[readL] * .82 + delayL[nextL] * .18;
    const dR = delayR[readR] * .82 + delayR[nextR] * .18;
    smoothedL += .17 * (dL - smoothedL);
    smoothedR += .17 * (dR - smoothedR);
    left[frame] = smoothedL;
    right[frame] = smoothedR;
    const fedL = dark ? crush(smoothedL, 9) : smoothedL;
    const fedR = dark ? crush(smoothedR, 9) : smoothedR;
    delayL[write] = inputL[frame] + feedback * (fedL * .84 + fedR * .16);
    delayR[write] = inputR[frame] + feedback * (fedR * .84 + fedL * .16);
    write = (write + 1) % size;
  }
  return { left, right };
}

function fft(real, imag, inverse = false) {
  const length = real.length;
  for (let i = 1, j = 0; i < length; i++) {
    let bit = length >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = real[i]; real[i] = real[j]; real[j] = tr;
      const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
    }
  }
  for (let size = 2; size <= length; size <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / size;
    const stepReal = Math.cos(angle), stepImag = Math.sin(angle);
    for (let start = 0; start < length; start += size) {
      let wReal = 1, wImag = 0;
      for (let offset = 0; offset < size / 2; offset++) {
        const even = start + offset, odd = even + size / 2;
        const vReal = real[odd] * wReal - imag[odd] * wImag;
        const vImag = real[odd] * wImag + imag[odd] * wReal;
        real[odd] = real[even] - vReal;
        imag[odd] = imag[even] - vImag;
        real[even] += vReal;
        imag[even] += vImag;
        const nextReal = wReal * stepReal - wImag * stepImag;
        wImag = wReal * stepImag + wImag * stepReal;
        wReal = nextReal;
      }
    }
  }
  if (inverse) for (let index = 0; index < length; index++) { real[index] /= length; imag[index] /= length; }
}

function makeImpulseResponse(seconds, seed, dark) {
  const length = Math.round(seconds * SAMPLE_RATE);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  let l = 0, r = 0;
  const random = rng(seed);
  for (let index = 0; index < length; index++) {
    const time = index / SAMPLE_RATE;
    const envelope = Math.exp(-time / (dark ? 1.05 : .86)) * (1 - Math.exp(-time * 160));
    const tilt = index % (dark ? 3 : 2) === 0 ? .3 : 1;
    l += .032 * ((random() * 2 - 1) * tilt - l);
    r += .032 * ((random() * 2 - 1) * tilt - r);
    left[index] = l * envelope;
    right[index] = r * envelope;
  }
  for (let reflection = 0; reflection < 22; reflection++) {
    const at = Math.round((.009 + random() * .22) * SAMPLE_RATE);
    const gain = (random() * 2 - 1) * .07;
    left[at] += gain;
    right[Math.min(length - 1, at + Math.round(random() * 90))] += gain * .8;
  }
  const normalize = signal => {
    let energy = 0;
    for (const sample of signal) energy += sample * sample;
    const scale = 1 / Math.sqrt(Math.max(1e-12, energy));
    for (let index = 0; index < signal.length; index++) signal[index] *= scale;
  };
  normalize(left); normalize(right);
  return { left, right };
}

function convolve(inputL, inputR, irL, irR) {
  const block = 8192;
  const size = block * 2;
  const partitions = Math.ceil(irL.length / block);
  const makeSpectra = signal => Array.from({ length: partitions }, (_, partition) => {
    const real = new Float64Array(size), imag = new Float64Array(size);
    for (let index = 0; index < block; index++) real[index] = signal[partition * block + index] || 0;
    fft(real, imag);
    return { real, imag };
  });
  const hL = makeSpectra(irL), hR = makeSpectra(irR);
  const outputL = new Float32Array(inputL.length), outputR = new Float32Array(inputR.length);
  const ringL = Array.from({ length: partitions }, () => ({ real: new Float64Array(size), imag: new Float64Array(size) }));
  const ringR = Array.from({ length: partitions }, () => ({ real: new Float64Array(size), imag: new Float64Array(size) }));
  const overlapL = new Float64Array(block), overlapR = new Float64Array(block);
  const realL = new Float64Array(size), imagL = new Float64Array(size);
  const realR = new Float64Array(size), imagR = new Float64Array(size);
  const sumLReal = new Float64Array(size), sumLImag = new Float64Array(size);
  const sumRReal = new Float64Array(size), sumRImag = new Float64Array(size);
  for (let blockIndex = 0, start = 0; start < inputL.length; start += block, blockIndex++) {
    realL.fill(0); imagL.fill(0); realR.fill(0); imagR.fill(0);
    for (let index = 0; index < block && start + index < inputL.length; index++) {
      realL[index] = inputL[start + index];
      realR[index] = inputR[start + index];
    }
    fft(realL, imagL); fft(realR, imagR);
    const slot = blockIndex % partitions;
    ringL[slot].real.set(realL); ringL[slot].imag.set(imagL);
    ringR[slot].real.set(realR); ringR[slot].imag.set(imagR);
    sumLReal.fill(0); sumLImag.fill(0); sumRReal.fill(0); sumRImag.fill(0);
    for (let partition = 0; partition < partitions; partition++) {
      const history = (blockIndex - partition + partitions * 2) % partitions;
      const xl = ringL[history], xr = ringR[history], hl = hL[partition], hr = hR[partition];
      for (let bin = 0; bin < size; bin++) {
        const xlre = xl.real[bin], xlim = xl.imag[bin];
        const xrre = xr.real[bin], xrim = xr.imag[bin];
        const hlre = hl.real[bin], hlim = hl.imag[bin];
        const hrre = hr.real[bin], hrim = hr.imag[bin];
        sumLReal[bin] += xlre * hlre - xlim * hlim;
        sumLImag[bin] += xlre * hlim + xlim * hlre;
        sumRReal[bin] += xrre * hrre - xrim * hrim;
        sumRImag[bin] += xrre * hrim + xrim * hrre;
      }
    }
    fft(sumLReal, sumLImag, true); fft(sumRReal, sumRImag, true);
    for (let index = 0; index < block; index++) {
      if (start + index < outputL.length) {
        outputL[start + index] = sumLReal[index] + overlapL[index];
        outputR[start + index] = sumRReal[index] + overlapR[index];
      }
      overlapL[index] = sumLReal[block + index];
      overlapR[index] = sumRReal[block + index];
    }
  }
  return { left: outputL, right: outputR };
}

/* ------------------------------------------------------------------ loops */

function renderLoop(world) {
  const dark = world === '4';
  const seed = SEEDS[`loop-${world}`];
  const left = new Float32Array(RENDER_FRAMES);
  const right = new Float32Array(RENDER_FRAMES);
  const debugLayers = (process.env.WORLD_LAYERS || '').split(',').filter(Boolean);
  const include = name => !debugLayers.length || debugLayers.includes(name);
  if (include('bed')) renderBed(left, right, world, seed);
  if (include('anchors')) renderAnchorDrones(left, right, world, seed);
  if (include('air')) renderAir(left, right, world, seed);
  if (include('build')) renderBuildDrones(left, right, world, seed);
  if (include('pulse')) renderSubPulse(left, right, world, seed);
  const events = include('events') ? renderEvents(world, seed) : { left: new Float32Array(RENDER_FRAMES), right: new Float32Array(RENDER_FRAMES) };

  const sendL = new Float32Array(RENDER_FRAMES), sendR = new Float32Array(RENDER_FRAMES);
  const echoInL = new Float32Array(RENDER_FRAMES), echoInR = new Float32Array(RENDER_FRAMES);
  for (let frame = 0; frame < RENDER_FRAMES; frame++) {
    sendL[frame] = events.left[frame] + left[frame] * .12;
    sendR[frame] = events.right[frame] + right[frame] * .12;
    echoInL[frame] = events.left[frame] * .7 + left[frame] * .05;
    echoInR[frame] = events.right[frame] * .7 + right[frame] * .05;
  }
  const dryOnly = Boolean(process.env.WORLD_DRY);
  const echo = dryOnly ? { left: new Float32Array(RENDER_FRAMES), right: new Float32Array(RENDER_FRAMES) } : renderEcho(echoInL, echoInR, world, seed);
  const ir = makeImpulseResponse(dark ? 3.0 : 2.5, seed ^ 0x1f1f1f1f, dark);
  const reverb = dryOnly ? { left: new Float32Array(RENDER_FRAMES), right: new Float32Array(RENDER_FRAMES) } : convolve(sendL, sendR, ir.left, ir.right);

  const mixL = new Float32Array(RENDER_FRAMES), mixR = new Float32Array(RENDER_FRAMES);
  for (let frame = 0; frame < RENDER_FRAMES; frame++) {
    // The build arc is a late-stage gain so the whole loop, effects included,
    // returns to the exact intro level at phase 90 s.
    const arc = masterArc(phaseSeconds(frame));
    mixL[frame] = (left[frame] + events.left[frame] + echo.left[frame] * .58 + reverb.left[frame] * .46) * arc;
    mixR[frame] = (right[frame] + events.right[frame] + echo.right[frame] * .58 + reverb.right[frame] * .46) * arc;
  }
  // The loop window: loop phase 0-90 s, reverb/echo state already warmed by the
  // 4 s pre-roll at phase 86-90 s. No crossfade, no blend at the seam.
  const loopL = mixL.subarray(PRE_FRAMES, PRE_FRAMES + LOOP_FRAMES);
  const loopR = mixR.subarray(PRE_FRAMES, PRE_FRAMES + LOOP_FRAMES);
  saturate(loopL, loopR, dark ? 1.35 : 1.15);
  return { left: loopL, right: loopR, seed, preRollFrames: PRE_FRAMES };
}

function saturate(left, right, drive) {
  const scale = Math.tanh(drive) / drive;
  for (let index = 0; index < left.length; index++) {
    left[index] = Math.tanh(left[index] * drive) / drive * scale;
    right[index] = Math.tanh(right[index] * drive) / drive * scale;
  }
}

/* ------------------------------------------------------------ transitions */

function renderTransition(direction) {
  const toDark = direction === '333>4';
  const seed = SEEDS[toDark ? 'x-333-4' : 'x-4-333'];
  const size = TRANSITION_FRAMES;
  const left = new Float32Array(size), right = new Float32Array(size);
  const end = size / SAMPLE_RATE;
  const random = rng(seed);
  const total = end;

  // Both directions begin and end on the same anchors: F-minor sub + bright
  // metallic C6 ping. That is what makes them safe from any loop position.
  addVoice(left, right, 0, total, SUB_HZ, toDark ? .052 : .046, 0,
    { attack: .012, release: .3, partials: [[1, .86], [2, .16], [3, .05]], vibratoHz: .5, vibratoCents: 1.4, seed: seed + 1 });
  addVoice(left, right, 0, total, ROOT_HZ, .020, -.12,
    { attack: .02, release: .32, partials: [[1, .8], [2, .14]], vibratoHz: .37, vibratoCents: 1.6, seed: seed + 2 });
  addVoice(left, right, 0, total, MINOR_HZ, .010, .16,
    { attack: .03, release: .3, partials: [[1, .8], [2, .12]], seed: seed + 3 });

  addPing(left, right, Math.round(.002 * SAMPLE_RATE), toDark ? .105 : .072, seed + 4, PING_HZ, toDark ? -.3 : .25,
    { length: toDark ? 1.2 : 1.0, decay: toDark ? .34 : .26, spread: .8 });
  addPing(left, right, Math.round((end - .13) * SAMPLE_RATE), toDark ? .075 : .095, seed + 5, PING_HZ, toDark ? .32 : -.2,
    { length: .13, decay: .045, spread: .5 });

  // Band-limited noise body. The sub stays clean underneath: the wash is
  // high-passed away from the anchor and only its top end moves.
  let lp = 0, hp = 0;
  for (let frame = 0; frame < size; frame++) {
    const t = frame / SAMPLE_RATE;
    const p = t / total;
    let envelope, cutoff;
    if (toDark) {
      envelope = smoothstep(p / .14) * (1 - smoothstep((p - .80) / .16));
      cutoff = 2400 + 7200 * p * p;
    } else {
      envelope = p < .56 ? smoothstep(p / .56) : 1 - smoothstep((p - .56) / .34);
      cutoff = 9000 - 6900 * Math.min(1, p / .95);
    }
    const coefficient = 1 - Math.exp(-TAU * Math.max(400, cutoff) / SAMPLE_RATE);
    const white = random() * 2 - 1;
    lp += coefficient * (white - lp);
    const highCoefficient = 1 - Math.exp(-TAU * (toDark ? 420 : 620) / SAMPLE_RATE);
    hp += highCoefficient * (lp - hp);
    let noise = (lp - hp) * envelope * (toDark ? .30 : .24);
    if (toDark) {
      const crushAmount = ramp(p, .34, .86);
      noise = noise * (1 - crushAmount) + crush(noise, 6) * crushAmount;
    }
    const [gl, gr] = pan((toDark ? -.75 + 1.5 * p : .75 - 1.5 * p));
    left[frame] += noise * gl;
    right[frame] += noise * gr;
  }

  if (toDark) {
    // Metallic pitch-stretch: the chrome ping drags downward and smears.
    addGlide(left, right, Math.round(.42 * SAMPLE_RATE), .78, PING_HZ, PING_HZ * .5, .052, -.25,
      { attack: .1, release: .35, partials: [[1, .7], [1.41, .3], [2.7, .12]], seed: seed + 11 });
    addGlide(left, right, Math.round(.6 * SAMPLE_RATE), .7, PING_HZ * .5, PING_HZ * .25, .034, .4,
      { attack: .12, release: .4, partials: [[1, .6], [1.93, .22]], seed: seed + 12 });
    for (let event = 0; event < 13; event++) {
      const at = .5 + random() * .62;
      addVoice(left, right, Math.round(at * SAMPLE_RATE), .16 + random() * .22,
        SCALE[Math.floor(random() * SCALE.length)], .008, random() * 1.5 - .75,
        { attack: .002, release: .12, decay: .09, partials: [[1, .6], [2.9, .2], [5.1, .07]], seed: seed + event + 20 });
    }
    addPing(left, right, Math.round((end - .42) * SAMPLE_RATE), .05, seed + 40, PING_HZ, -.25,
      { length: .42, decay: .1, ratios: [1, 1.37, 1.94, 2.6], spread: .9 });
  } else {
    // Cleansing shimmer: high partials settle onto the dry anchor.
    for (let sparkle = 0; sparkle < 16; sparkle++) {
      const at = .5 + random() * .5;
      const index = Math.round(at * SAMPLE_RATE);
      const frequency = NATURE_PENTATONIC[Math.floor(random() * NATURE_PENTATONIC.length)] * (2 + random() * 2);
      addVoice(left, right, index, .2 + random() * .35, frequency, .0075, random() * 1.8 - .9,
        { attack: .004, release: .18, decay: .13, partials: [[1, .7], [2.01, .18], [3.02, .06]], seed: seed + sparkle + 20 });
    }
    addGlide(left, right, Math.round(.44 * SAMPLE_RATE), .9, PING_HZ * .5, PING_HZ, .03, .3,
      { attack: .22, release: .5, partials: [[1, .7], [2.01, .18], [3.03, .06]], seed: seed + 11 });
    addPing(left, right, Math.round((end - .34) * SAMPLE_RATE), .045, seed + 40, PING_HZ, .2,
      { length: .34, decay: .09, ratios: [1, 1.5, 2.01, 3.02], spread: .5 });
  }

  // 6 ms de-click at the last sample only. The musical content is already
  // resolved by then; nothing is faded early and the full 1.4 s is preserved.
  const declick = Math.round(.006 * SAMPLE_RATE);
  for (let frame = size - declick; frame < size; frame++) {
    const gain = .5 + .5 * Math.cos(Math.PI * (frame - (size - declick)) / declick);
    left[frame] *= gain;
    right[frame] *= gain;
  }
  saturate(left, right, toDark ? 1.3 : 1.1);
  return { left, right, seed };
}

/* --------------------------------------------------------------- analysis */

function anchorProbe(left, right, seconds, frequency) {
  const length = 8192;
  const centre = Math.round(seconds * SAMPLE_RATE);
  const start = clamp(centre - length / 2, 0, left.length - length);
  let real = 0, imag = 0, energy = 0;
  for (let index = 0; index < length; index++) {
    const window = .5 - .5 * Math.cos(TAU * index / (length - 1));
    const sample = ((left[start + index] || 0) + (right[start + index] || 0)) * .5 * window;
    real += sample * Math.cos(TAU * frequency * index / SAMPLE_RATE);
    imag -= sample * Math.sin(TAU * frequency * index / SAMPLE_RATE);
    energy += sample * sample;
  }
  const magnitude = Math.hypot(real, imag) / length;
  return db(magnitude / Math.max(1e-12, Math.sqrt(energy / length)));
}

/** Octave-style band balance, averaged over eight windowed FFTs. */
function bandBalance(left, right) {
  const BANDS = [[20, 60], [60, 120], [120, 250], [250, 500], [500, 1000], [1000, 2000], [2000, 4000], [4000, 8000], [8000, 16000]];
  const size = 16384;
  const energy = BANDS.map(() => 0);
  let total = 0;
  for (let window = 0; window < 8; window++) {
    const start = Math.round((5 + window * 10) * SAMPLE_RATE);
    const real = new Float64Array(size), imag = new Float64Array(size);
    for (let index = 0; index < size; index++) {
      const windowValue = .5 - .5 * Math.cos(TAU * index / (size - 1));
      real[index] = ((left[start + index] || 0) + (right[start + index] || 0)) * .5 * windowValue;
    }
    fft(real, imag);
    for (let bin = 1; bin < size / 2; bin++) {
      const frequency = bin * SAMPLE_RATE / size;
      const power = real[bin] ** 2 + imag[bin] ** 2;
      total += power;
      for (let band = 0; band < BANDS.length; band++) {
        if (frequency >= BANDS[band][0] && frequency < BANDS[band][1]) { energy[band] += power; break; }
      }
    }
  }
  return BANDS.map(([low, high], index) => ({ low, high, db: db(Math.sqrt(energy[index] / Math.max(1e-18, total))) }));
}

function analyseLoop(left, right) {
  const perSegment = [];
  const segment = 5 * SAMPLE_RATE;
  for (let start = 0; start < left.length; start += segment) {
    perSegment.push({
      seconds: start / SAMPLE_RATE,
      rmsDb: db(Math.hypot(rms(left, start, segment), rms(right, start, segment)) / Math.SQRT2),
    });
  }
  const head = rms(left, 0, 2 * SAMPLE_RATE) + rms(right, 0, 2 * SAMPLE_RATE);
  const tailStart = LOOP_FRAMES - 2 * SAMPLE_RATE;
  const tail = rms(left, tailStart, 2 * SAMPLE_RATE) + rms(right, tailStart, 2 * SAMPLE_RATE);
  let step = 0, energyL = 0, energyR = 0, cross = 0;
  for (let index = 1; index < left.length; index++) {
    step += Math.abs(left[index] - left[index - 1]) + Math.abs(right[index] - right[index - 1]);
    energyL += left[index] * left[index];
    energyR += right[index] * right[index];
    cross += left[index] * right[index];
  }
  const seamStep = Math.abs(left[0] - left[left.length - 1]) + Math.abs(right[0] - right[right.length - 1]);
  const meanStep = step / ((left.length - 1) * 2);
  const correlation = cross / Math.max(1e-12, Math.sqrt(energyL * energyR));
  return {
    headTail: { head, tail, ratio: head / tail, differenceDb: db(head / tail) },
    seam: { seamStep, meanStep, ratio: seamStep / meanStep },
    correlation,
    perSegment,
    bands: bandBalance(left, right),
    probes: [2.5, 44, 78].map(seconds => ({
      seconds,
      anchors: ANCHORS.map((frequency, index) => ({ frequency, nominal: NOMINAL_ANCHORS[index], db: anchorProbe(left, right, seconds, frequency) })),
    })),
  };
}

/* ------------------------------------------------------------ file output */

function writeWav24(path, left, right) {
  const frames = left.length;
  const dataBytes = frames * 6;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 6, 28);
  buffer.writeUInt16LE(6, 32);
  buffer.writeUInt16LE(24, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  let offset = 44;
  for (let frame = 0; frame < frames; frame++) {
    for (const channel of [left, right]) {
      const sample = Math.max(-8388608, Math.min(8388607, Math.round(clamp(channel[frame]) * 8388607)));
      buffer.writeIntLE(sample, offset, 3);
      offset += 3;
    }
  }
  return writeFile(path, buffer);
}

async function sha(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

/** AAC 256 kbps. macOS AudioToolbox (afconvert) handles the first and last
 * transform frames far more accurately than ffmpeg's native encoder, which
 * matters because a loop boundary sits exactly there. ffmpeg stays the
 * fallback and is documented as such; both are local build tooling only. */
function encodeAac(wav, output) {
  if (process.platform === 'darwin') {
    const temporary = `${output}.native.m4a`;
    const native = spawnSync('afconvert', ['-f', 'm4af', '-d', 'aac ', '-b', '256000', wav, temporary], { encoding: 'utf8' });
    if (native.status === 0) {
      // afconvert stamps the container with the current time. Remuxing with
      // bitexact flags keeps the encoded audio verbatim and makes the file
      // byte-reproducible.
      const remux = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', temporary,
        '-map', '0:a:0', '-c', 'copy', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
        '-movflags', '+faststart', output], { encoding: 'utf8' });
      spawnSync('rm', ['-f', temporary]);
      if (remux.status === 0) return 'afconvert (Apple AudioToolbox) + ffmpeg bit-exact remux, 256 kbps AAC-LC';
    }
    spawnSync('rm', ['-f', temporary]);
  }
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
    '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
    '-map', '0:a:0', '-ac', '2', '-ar', String(SAMPLE_RATE),
    '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', output], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'ffmpeg failed');
  return 'ffmpeg (native AAC encoder), 256 kbps AAC-LC';
}

function encodeFlac(wav, output) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
    '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
    '-map', '0:a:0', '-ac', '2', '-ar', String(SAMPLE_RATE), '-c:a', 'flac', '-compression_level', '8', output], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'ffmpeg failed');
  return 'ffmpeg';
}

function measureLoudness(path) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path,
    '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const text = result.stderr || '';
  const integrated = [...text.matchAll(/I:\s*(-?[\d.]+)\s*LUFS/g)].pop();
  const peak = [...text.matchAll(/Peak:\s*(-?[\d.]+)\s*dBFS/g)].pop();
  if (!integrated) throw new Error(`Could not measure loudness for ${path}`);
  return { lufs: Number(integrated[1]), truePeakDbfs: peak ? Number(peak[1]) : null };
}

/** Static soft-knee peak shaper. Only the top ~8 dB of the waveform is
 * rounded, so transients stay intact while the loudness target is reachable
 * without a hard ceiling cut. */
function softLimit(value, ceiling = .58, knee = .18) {
  const magnitude = Math.abs(value);
  const start = ceiling - knee;
  if (magnitude <= start) return value;
  const shaped = start + knee * Math.tanh((magnitude - start) / knee);
  return Math.sign(value) * shaped;
}

async function finalise(name, rendered, outputDirectory) {
  const { left, right } = rendered;
  const baseL = Float32Array.from(left);
  const baseR = Float32Array.from(right);
  const loudnessPath = join(outputDirectory, `.loudness-${name}.wav`);
  // Loudness is set by iteration: scale, shape peaks, measure the real
  // integrated LUFS, correct. Two or three passes land within 0.1 dB.
  let gain = 1, lufs = -Infinity, peak = 0;
  for (let iteration = 0; iteration < 6; iteration++) {
    peak = 0;
    for (let index = 0; index < baseL.length; index++) {
      const l = softLimit(baseL[index] * gain);
      const r = softLimit(baseR[index] * gain);
      left[index] = l;
      right[index] = r;
      peak = Math.max(peak, Math.abs(l), Math.abs(r));
    }
    await writeWav24(loudnessPath, left, right);
    lufs = measureLoudness(loudnessPath).lufs;
    if (Math.abs(lufs - TARGET_LUFS) < .12) break;
    gain *= 10 ** ((TARGET_LUFS - lufs) / 20);
  }
  const wav = join(outputDirectory, `${name}.wav`);
  await writeWav24(wav, left, right);
  const m4a = join(outputDirectory, `${name}.m4a`);
  const encoder = encodeAac(wav, m4a);
  const flac = join(outputDirectory, `${name}.flac`);
  if (VERIFY_FLAC) encodeFlac(wav, flac);
  await rm(loudnessPath, { force: true });

  const entry = {
    name,
    seed: `0x${rendered.seed.toString(16)}`,
    frames: left.length,
    preRollFrames: rendered.preRollFrames ?? null,
    wav: { bytes: (await readFile(wav)).byteLength, sha256: await sha(wav), peakDbfs: db(peak), ...measureLoudness(wav) },
    m4a: { bytes: (await readFile(m4a)).byteLength, sha256: await sha(m4a), encoder, ...measureLoudness(m4a) },
  };
  if (VERIFY_FLAC) entry.flac = { bytes: (await readFile(flac)).byteLength, sha256: await sha(flac), ...measureLoudness(flac) };
  if (rendered.analysis) entry.analysis = analyseLoop(left, right);
  return entry;
}

async function main() {
  await mkdir(OUTPUT, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    sampleRate: SAMPLE_RATE, bpm: BPM, loopSeconds: LOOP_SECONDS, loopFrames: LOOP_FRAMES,
    preRollSeconds: PRE_SECONDS, transitionFrames: TRANSITION_FRAMES, targetLufs: TARGET_LUFS,
    anchors: { nominal: NOMINAL_ANCHORS, periodicTuning: ANCHORS, worstDetuneCents: NOMINAL_ANCHORS.map((value, index) => 1200 * Math.log2(ANCHORS[index] / value)) },
    files: [],
  };
  for (const world of ['333', '4']) {
    const name = `loop-${world}`;
    if (ONLY && ONLY !== name) continue;
    console.error(`Rendering ${name}…`);
    const rendered = renderLoop(world);
    rendered.analysis = true;
    report.files.push(await finalise(name, rendered, OUTPUT));
  }
  for (const direction of ['333>4', '4>333']) {
    const name = `x-${direction.replace('>', '-')}`;
    if (ONLY && ONLY !== name) continue;
    console.error(`Rendering ${name}…`);
    report.files.push(await finalise(name, renderTransition(direction), OUTPUT));
  }
  if (CHECK_DETERMINISM) {
    // Re-render every asset from scratch and compare byte hashes. This is the
    // determinism evidence recorded in docs/WORLD-SOUND.md.
    const repeat = join(OUTPUT, '.repeat');
    await rm(repeat, { recursive: true, force: true });
    await mkdir(repeat, { recursive: true });
    const repeats = [];
    for (const entry of report.files) {
      const isLoop = entry.name.startsWith('loop-');
      const rendered = isLoop
        ? renderLoop(entry.name === 'loop-333' ? '333' : '4')
        : renderTransition(entry.name === 'x-333-4' ? '333>4' : '4>333');
      const again = await finalise(entry.name, rendered, repeat);
      repeats.push({
        name: entry.name,
        wavIdentical: again.wav.sha256 === entry.wav.sha256,
        m4aIdentical: again.m4a.sha256 === entry.m4a.sha256,
        m4aSha256: again.m4a.sha256,
      });
    }
    await rm(repeat, { recursive: true, force: true });
    report.determinism = { checkedAt: new Date().toISOString(), repeats, identical: repeats.every(item => item.wavIdentical && item.m4aIdentical) };
  }
  await writeFile(join(OUTPUT, 'render-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
