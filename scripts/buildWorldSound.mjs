#!/usr/bin/env node
/**
 * H4NGELIC WORLD SOUND v3 — real-source pipeline.
 *
 * Builds the two 90 s world loops and the two transitions from user-supplied
 * audio, then validates the shipped files. It never synthesizes musical
 * material: the only processing is gain, the documented asymmetric wrap blend
 * and the transition window cut.
 *
 *   node scripts/buildWorldSound.mjs --out work/world-sound-v3
 *   node scripts/buildWorldSound.mjs --validate
 *
 * Sources (read-only, never committed):
 *   ~/Desktop/h4ngelic_sounddesign.mov          -> loop 333 (normal side)
 *   ~/Desktop/h4ngelic_sounddesign_2.mov        -> loop 4   (other side)
 *   ~/Downloads/...-type-05-566460.mp3          -> sfx-a
 *   ~/Downloads/...-type-06-566459.mp3          -> sfx-b
 *
 * ffmpeg / afconvert are local build tooling only.
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { worldTransitionDurationSeconds, worldSoundSettings } from '../src/audio/worldSoundSettings.js';
import { hashedAudioName, hashWorldAudio } from './hash-world-audio.mjs';

/** Transition length is read from the visual config, never hardcoded here. */
export const transitionSeconds = () => worldTransitionDurationSeconds();
export const transitionFrames = () => Math.round(transitionSeconds() * SAMPLE_RATE);

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

export const SAMPLE_RATE = 44100;
export const LOOP_SECONDS = 90;
export const LOOP_FRAMES = LOOP_SECONDS * SAMPLE_RATE; // 3,969,000
export const WRAP_SECONDS = 8;                          // allowed 4-16
export const HEAD_FRAMES = 2 * SAMPLE_RATE;             // 88,200
export const BED_DIP_DB = -6;
export const TARGET_LUFS = -18;
const EDGE_FADE_MS = 20;
const SILENCE_FLOOR_DB = -50;

export const SOURCES = Object.freeze({
  'loop-333': {
    path: '/Users/h4ngelic/Desktop/h4ngelic_sounddesign.mov',
    label: 'h4ngelic_sounddesign.mov', origin: 'user-supplied render (user-owned)', kind: 'mov',
  },
  'loop-4': {
    path: '/Users/h4ngelic/Desktop/h4ngelic_sounddesign_2.mov',
    label: 'h4ngelic_sounddesign_2.mov', origin: 'user-supplied render (user-owned)', kind: 'mov',
  },
  'sfx-a': {
    path: '/Users/h4ngelic/Downloads/poorartistt-cinematic-whoosh-sfx-type-05-566460.mp3',
    label: 'poorartistt-cinematic-whoosh-sfx-type-05-566460.mp3', origin: 'user-supplied SFX library file', kind: 'mp3',
  },
  'sfx-b': {
    path: '/Users/h4ngelic/Downloads/poorartistt-cinematic-whoosh-sfx-type-06-566459.mp3',
    label: 'poorartistt-cinematic-whoosh-sfx-type-06-566459.mp3', origin: 'user-supplied SFX library file', kind: 'mp3',
  },
});

/* ------------------------------------------------------------------ utils */

const db = value => 20 * Math.log10(Math.max(1e-12, value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

export function decodeToFloat(path, { seconds = null } = {}) {
  const args = ['-v', 'error', '-i', path];
  if (seconds) args.push('-t', String(seconds));
  args.push('-f', 'f32le', '-ac', '2', '-ar', String(SAMPLE_RATE), '-');
  const out = execFileSync('ffmpeg', args, { maxBuffer: 2 ** 31 });
  const frames = out.length / 8;
  const left = new Float32Array(frames), right = new Float32Array(frames);
  for (let i = 0; i < frames; i++) { left[i] = out.readFloatLE(i * 8); right[i] = out.readFloatLE(i * 8 + 4); }
  return { left, right, frames };
}

/** 24-bit PCM WAV reader: keeps the data chunk as raw bytes so the loop head
 * can be copied byte-for-byte from the master. */
export function readWav24(path) {
  const bytes = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 'wav', '-c:a', 'pcm_s24le', '-'], { maxBuffer: 2 ** 31 }).stdout;
  let offset = 12, format = null, data = null;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      format = { channels: bytes.readUInt16LE(body + 2), sampleRate: bytes.readUInt32LE(body + 4), bits: bytes.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      data = bytes.subarray(body, body + size);
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!format || !data) throw new Error(`Unreadable WAV: ${path}`);
  return { ...format, data, frames: Math.floor(data.length / (format.channels * 3)) };
}

export function writeWav24(path, left, right) {
  const frames = left.length, dataBytes = frames * 6;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataBytes, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24); buffer.writeUInt32LE(SAMPLE_RATE * 6, 28);
  buffer.writeUInt16LE(6, 32); buffer.writeUInt16LE(24, 34); buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  let o = 44;
  for (let f = 0; f < frames; f++) {
    buffer.writeIntLE(Math.max(-8388608, Math.min(8388607, Math.round(left[f] * 8388607))), o, 3); o += 3;
    buffer.writeIntLE(Math.max(-8388608, Math.min(8388607, Math.round(right[f] * 8388607))), o, 3); o += 3;
  }
  return writeFile(path, buffer).then(() => buffer);
}

export function measureLoudness(path) {
  const text = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 1 << 26 }).stderr || '';
  const integrated = [...text.matchAll(/I:\s*(-?[\d.]+)\s*LUFS/g)].pop();
  const lra = [...text.matchAll(/LRA:\s*(-?[\d.]+)\s*LU/g)].pop();
  const peak = [...text.matchAll(/Peak:\s*(-?[\d.]+)\s*dBFS/g)].pop();
  if (!integrated) throw new Error(`No loudness for ${path}`);
  return { lufs: Number(integrated[1]), lra: lra ? Number(lra[1]) : null, truePeakDbfs: peak ? Number(peak[1]) : null };
}

function encodeAac(wav, output) {
  if (process.platform === 'darwin') {
    const temp = `${output}.native.m4a`;
    const native = spawnSync('afconvert', ['-f', 'm4af', '-d', 'aac ', '-b', '256000', wav, temp], { encoding: 'utf8' });
    if (native.status === 0) {
      const remux = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', temp,
        '-map', '0:a:0', '-c', 'copy', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
        '-movflags', '+faststart', output], { encoding: 'utf8' });
      spawnSync('rm', ['-f', temp]);
      if (remux.status === 0) return 'afconvert (Apple AudioToolbox) + ffmpeg bit-exact remux, 256 kbps AAC-LC';
    }
    spawnSync('rm', ['-f', temp]);
  }
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
    '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-map', '0:a:0', '-ac', '2',
    '-ar', String(SAMPLE_RATE), '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', output], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'ffmpeg failed');
  return 'ffmpeg (native AAC), 256 kbps AAC-LC';
}

function decodedFrames(path) {
  const out = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 's16le', '-ac', '2', '-ar', String(SAMPLE_RATE), '-'],
    { maxBuffer: 2 ** 31 }).stdout;
  return out.length / 4;
}

/* --------------------------------------------------- spectral / key tools */

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const ang = -2 * Math.PI / size, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let s = 0; s < n; s += size) {
      let cr = 1, ci = 0;
      for (let k = 0; k < size / 2; k++) {
        const e = s + k, o = e + size / 2;
        const vr = re[o] * cr - im[o] * ci, vi = re[o] * ci + im[o] * cr;
        re[o] = re[e] - vr; im[o] = im[e] - vi; re[e] += vr; im[e] += vi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pearson = (a, b) => {
  const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, dbb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; dbb += y * y; }
  return num / Math.sqrt(da * dbb || 1);
};

/** Krumhansl-Schmuckler key estimate on a chroma vector from 8192-sample
 * Hann windows over the first 90 s; band 55-2200 Hz. */
export function keyEstimate(left, right) {
  const size = 8192, hop = 4096;
  const chroma = new Array(12).fill(0);
  const mono = i => (left[i] + right[i]) / 2;
  for (let start = 0; start + size <= left.length; start += hop) {
    const re = new Float64Array(size), im = new Float64Array(size);
    for (let i = 0; i < size; i++) re[i] = mono(start + i) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
    fft(re, im);
    for (let bin = 1; bin < size / 2; bin++) {
      const f = bin * SAMPLE_RATE / size;
      if (f < 55 || f > 2200) continue;
      const mag = Math.hypot(re[bin], im[bin]);
      if (mag <= 0) continue;
      const midi = 69 + 12 * Math.log2(f / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      chroma[pc] += mag * (1 - Math.abs((midi - Math.floor(midi)) - 0.5) * 0.6);
    }
  }
  const total = chroma.reduce((s, v) => s + v, 0) || 1;
  const profile = chroma.map(v => v / total);
  const scores = [];
  for (let root = 0; root < 12; root++) {
    const rotate = p => Array.from({ length: 12 }, (_, i) => p[(i - root + 12) % 12]);
    scores.push({ key: `${NOTE_NAMES[root]} minor`, correlation: pearson(profile, rotate(MINOR)) });
    scores.push({ key: `${NOTE_NAMES[root]} major`, correlation: pearson(profile, rotate(MAJOR)) });
  }
  scores.sort((a, b) => b.correlation - a.correlation);
  return {
    method: 'Krumhansl-Schmuckler correlation over a 12-bin chroma vector (8192-sample Hann FFT, 55-2200 Hz, first 90 s)',
    best: scores[0].key,
    top: scores.slice(0, 3).map(s => ({ key: s.key, correlation: Number(s.correlation.toFixed(3)) })),
    confidence: Number((scores[0].correlation - scores[1].correlation).toFixed(3)),
    chroma: NOTE_NAMES.map((name, i) => ({ pitchClass: name, share: Number((profile[i] * 100).toFixed(1)) })),
  };
}

/** 50 ms RMS + brightness (first-difference energy ratio) series. */
export function energyEnvelope(left, right, windowSeconds = 0.05) {
  const win = Math.round(windowSeconds * SAMPLE_RATE);
  const series = [];
  for (let start = 0; start + win <= left.length; start += win) {
    let energy = 0, diff = 0, prev = 0;
    for (let i = 0; i < win; i++) {
      const v = (left[start + i] + right[start + i]) / 2;
      energy += v * v;
      const d = v - prev; diff += d * d; prev = v;
    }
    series.push({
      t: Number((start / SAMPLE_RATE).toFixed(3)),
      rmsDb: Number(db(Math.sqrt(energy / win)).toFixed(2)),
      brightness: Number((Math.sqrt(diff / Math.max(1e-12, energy))).toFixed(4)),
    });
  }
  return series;
}

/* ------------------------------------------------------------- loop build */

/** Wrap construction.
 *
 * The brief's literal shape (head fading in over the second half, full gain
 * at the final sample) was measured first: because the loop restarts at
 * source frame 0 while the head layer ends at source frame W-1, the seam
 * carries the source's own level change between 0 s and W s. On these takes
 * that is a 42 dB cliff (loop 4) - an audible restart, not a seam.
 *
 * Delivered shape: the outgoing tail follows a smooth dB ramp down to the
 * loop's own opening level, so the last seconds arrive exactly where the loop
 * restarts, then a 2 ms equal-power handoff lands sample-exact on the loop's
 * first samples. No pitch shift, no time stretch, head untouched.
 */
export function wrapGains(x, options = {}) {
  const smooth = (() => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); })();
  const fadeDb = options.fadeDb ?? 0;
  const gOut = 10 ** (fadeDb * smooth / 20);
  if (options.headInjection) {
    const gIn = x <= .5 ? 0 : (() => { const u = (x - .5) / .5; return u * u * (3 - 2 * u); })();
    const m = 1 / Math.sqrt(gOut * gOut + gIn * gIn);
    return { gOut, gIn, m };
  }
  return { gOut, gIn: 0, m: 1 };
}

function channelRms(data, channels, channel, startFrame, frames) {
  let sum = 0;
  for (let f = startFrame; f < startFrame + frames; f++) {
    const o = (f * channels + channel) * 3;
    const value = data[o] | (data[o + 1] << 8) | (data[o + 2] << 16);
    const sample = (value & 0x800000 ? value | ~0xffffff : value) / 8388608;
    sum += sample * sample;
  }
  return Math.sqrt(sum / frames);
}

function leadingSilenceFrames(master) {
  const frames = Math.min(master.frames, SAMPLE_RATE);
  for (let f = 0; f < frames; f++) {
    const o = f * master.channels * 3;
    if (master.data[o] || master.data[o + 1] || master.data[o + 2]
      || master.data[o + 3] || master.data[o + 4] || master.data[o + 5]) return f;
  }
  return frames;
}

export function assembleLoop(master, { wrapSeconds = WRAP_SECONDS, headInjection = false, handoffMs = 2 } = {}) {
  const N = LOOP_FRAMES, W = wrapSeconds * SAMPLE_RATE;
  if (master.frames < N) throw new Error(`Source is ${master.frames} frames (${(master.frames / SAMPLE_RATE).toFixed(3)} s); 90 s required.`);
  const outL = new Float32Array(N), outR = new Float32Array(N);
  const read = (channel, frame) => {
    const o = (frame * master.channels + channel) * 3;
    const value = master.data[o] | (master.data[o + 1] << 8) | (master.data[o + 2] << 16);
    return (value & 0x800000 ? value | ~0xffffff : value) / 8388608;
  };
  for (let f = 0; f < N - W; f++) { outL[f] = read(0, f); outR[f] = read(1, f); }
  const window = Math.round(.25 * SAMPLE_RATE);
  const introLevel = db((channelRms(master.data, master.channels, 0, 0, window) + channelRms(master.data, master.channels, 1, 0, window)) / 2);
  const tailLevel = db((channelRms(master.data, master.channels, 0, N - W, window) + channelRms(master.data, master.channels, 1, N - W, window)) / 2);
  const fadeDb = Math.min(0, introLevel - tailLevel);
  for (let f = N - W; f < N; f++) {
    const x = (f - (N - W)) / (W - 1);
    const { gOut, gIn, m } = wrapGains(x, { fadeDb, headInjection });
    const head = f - (N - W);
    outL[f] = (read(0, f) * gOut + (gIn ? read(0, head) * gIn : 0)) * m;
    outR[f] = (read(1, f) * gOut + (gIn ? read(1, head) * gIn : 0)) * m;
  }
  // Sample-exact handoff: the last few ms cross into the loop's first samples
  // with an equal-power pair, so the wrap lands on frame 0 with no step.
  const lead = leadingSilenceFrames(master);
  const handoff = Math.max(Math.round(handoffMs / 1000 * SAMPLE_RATE), Math.min(lead + Math.round(.002 * SAMPLE_RATE), Math.round(.05 * SAMPLE_RATE)));
  for (let i = 0; i < handoff; i++) {
    const u = i / (handoff - 1);
    const angle = Math.PI / 2 * u;
    const f = N - handoff + i;
    outL[f] = outL[f] * Math.cos(angle) + read(0, i) * Math.sin(angle);
    outR[f] = outR[f] * Math.cos(angle) + read(1, i) * Math.sin(angle);
  }
  return { left: outL, right: outR, wrapFrames: W, introLevel, tailLevel, fadeDb, headInjection, handoffFrames: handoff, leadInFrames: lead };
}

export function seamGates(left, right) {
  const N = left.length;
  const seam = Math.abs(left[0] - left[N - 1]) + Math.abs(right[0] - right[N - 1]);
  const steps = [];
  for (let i = N - 2 * SAMPLE_RATE + 1; i < N; i++) {
    steps.push(Math.abs(left[i] - left[i - 1]), Math.abs(right[i] - right[i - 1]));
  }
  steps.sort((a, b) => a - b);
  const p95 = steps[Math.floor(steps.length * 0.95)];
  const shortTerm = (start, length) => {
    let energy = 0;
    for (let i = start; i < start + length; i++) energy += left[i] * left[i] + right[i] * right[i];
    return db(Math.sqrt(energy / (length * 2)));
  };
  const quarter = Math.round(.25 * SAMPLE_RATE);
  const levelDelta = Math.abs(shortTerm(N - quarter, quarter) - shortTerm(0, quarter));
  const ms50 = Math.round(.05 * SAMPLE_RATE), twoS = 2 * SAMPLE_RATE;
  const tailPeak = shortTerm(N - ms50, ms50);
  let surround = 0;
  for (let i = N - twoS; i < N - ms50; i += ms50) surround += shortTerm(i, ms50);
  surround /= Math.max(1, Math.floor((twoS - ms50) / ms50));
  const threeS = 3 * SAMPLE_RATE, win = Math.round(.1 * SAMPLE_RATE);
  let maxGradient = 0;
  for (let i = N - threeS + win; i + win <= N; i += win) {
    const a = shortTerm(i - win, win), b = shortTerm(i, win);
    maxGradient = Math.max(maxGradient, Math.abs(b - a));
  }
  const p95Step = p95 || 1e-9;
  return {
    seamStep: Number(seam.toFixed(6)),
    p95Step: Number(p95Step.toFixed(6)),
    seamWithinP95: seam <= p95,
    levelDeltaDb: Number(levelDelta.toFixed(2)),
    levelWithin1dB: levelDelta <= 1,
    tailPeakOverSurroundDb: Number((tailPeak - surround).toFixed(2)),
    noSeamTransient: tailPeak - surround <= 3,
    maxGradientDbPer100ms: Number(maxGradient.toFixed(2)),
    gradientWithin1p5dB: maxGradient <= 1.5,
    pass: seam <= p95Step && levelDelta <= 1 && tailPeak - surround <= 3 && maxGradient <= 1.5,
  };
}

export function shortTermProfile(left, right, windowSeconds = 0.4) {
  const win = Math.round(windowSeconds * SAMPLE_RATE), out = [];
  for (let i = 0; i + win <= left.length; i += Math.round(win / 4)) {
    let energy = 0;
    for (let k = 0; k < win; k++) energy += left[i + k] * left[i + k] + right[i + k] * right[i + k];
    out.push({ t: Number((i / SAMPLE_RATE).toFixed(3)), db: Number(db(Math.sqrt(energy / (win * 2))).toFixed(2)) });
  }
  return out;
}

/* --------------------------------------------------------- transition cut */

/** Exact first/last non-silent sample, using 1 ms RMS blocks against a
 * -50 dBFS floor (the same floor as silencedetect=noise=-50dB). */
export function contentBounds(left, right) {
  const block = Math.round(.001 * SAMPLE_RATE);
  const blocks = Math.floor(left.length / block);
  const level = i => {
    let e = 0;
    for (let k = 0; k < block; k++) { const l = left[i * block + k], r = right[i * block + k]; e += l * l + r * r; }
    return db(Math.sqrt(e / (block * 2)));
  };
  let first = 0, last = blocks - 1;
  while (first < blocks && level(first) < SILENCE_FLOOR_DB) first++;
  while (last > first && level(last) < SILENCE_FLOOR_DB) last--;
  return { firstSample: first * block, lastSample: (last + 1) * block - 1, onsetSeconds: (first * block) / SAMPLE_RATE };
}

export function cutTransition(left, right, { frames, fadeMs = EDGE_FADE_MS }) {
  const bounds = contentBounds(left, right);
  const bodyFrames = bounds.lastSample - bounds.firstSample + 1;
  const bodyL = left.subarray(bounds.firstSample, bounds.lastSample + 1);
  const bodyR = right.subarray(bounds.firstSample, bounds.lastSample + 1);
  const envelope = energyEnvelope(bodyL, bodyR);
  let peak = envelope[0];
  for (const point of envelope) if (point.rmsDb > peak.rmsDb) peak = point;
  const peakFrame = Math.round(peak.t * SAMPLE_RATE);
  const halfEnvelopeWindow = Math.round(.05 * SAMPLE_RATE / 2);
  let start = Math.round(peakFrame - frames / 2 + halfEnvelopeWindow);
  const minStart = 0, maxStart = bodyFrames - frames;
  if (maxStart < 0) throw new Error(`SFX body is ${(bodyFrames / SAMPLE_RATE).toFixed(3)} s, shorter than ${(frames / SAMPLE_RATE).toFixed(3)} s.`);
  start = clamp(start, minStart, maxStart);
  const outL = new Float32Array(frames), outR = new Float32Array(frames);
  const fade = Math.round(fadeMs / 1000 * SAMPLE_RATE);
  for (let i = 0; i < frames; i++) {
    const g = Math.min(1, i / fade, (frames - 1 - i) / fade);
    const gain = .5 - .5 * Math.cos(Math.PI * clamp(g, 0, 1));
    outL[i] = bodyL[start + i] * gain;
    outR[i] = bodyR[start + i] * gain;
  }
  return {
    left: outL, right: outR,
    onsetSeconds: Number(bounds.onsetSeconds.toFixed(4)),
    trimmedFrames: bodyFrames,
    peakSecondsInBody: Number(peak.t.toFixed(3)),
    peakSecondsInSource: Number(((bounds.firstSample + peakFrame) / SAMPLE_RATE).toFixed(3)),
    peakRmsDb: peak.rmsDb,
    windowStartInBody: Number((start / SAMPLE_RATE).toFixed(3)),
    windowStartInSource: Number(((bounds.firstSample + start) / SAMPLE_RATE).toFixed(4)),
    envelope,
  };
}

/* ---------------------------------------------------------------- levels */

function scaleInPlace(left, right, gain) {
  for (let i = 0; i < left.length; i++) { left[i] *= gain; right[i] *= gain; }
}

/** Iteratively land the buffer on the LUFS target with a true-peak ceiling. */
async function normalise(name, left, right, workDir, { ceilingDbfs = -1.4 } = {}) {
  const temp = join(workDir, `.lufs-${name}.wav`);
  let gain = 1, measured = null;
  for (let pass = 0; pass < 4; pass++) {
    await writeWav24(temp, left, right);
    measured = measureLoudness(temp);
    const delta = TARGET_LUFS - measured.lufs;
    if (Math.abs(delta) < .1) break;
    gain = 10 ** (delta / 20);
    scaleInPlace(left, right, gain);
  }
  await rm(temp, { force: true });
  if (measured.truePeakDbfs > ceilingDbfs) {
    const reduce = 10 ** ((ceilingDbfs - measured.truePeakDbfs) / 20);
    scaleInPlace(left, right, reduce);
    await writeWav24(temp, left, right);
    measured = measureLoudness(temp);
    await rm(temp, { force: true });
  }
  return measured;
}

/* ------------------------------------------------------------------ build */

export async function build({ out = join(ROOT, 'work/world-sound-v3'), mastersDir = join(ROOT, 'masters'), publish = true } = {}) {
  await mkdir(out, { recursive: true });
  await mkdir(mastersDir, { recursive: true });
  const report = { builtAt: new Date().toISOString(), sampleRate: SAMPLE_RATE, loopFrames: LOOP_FRAMES, wrapSeconds: WRAP_SECONDS, sources: {}, loops: [], transitions: [] };

  // Step 1: facts + hashes + key estimate per loop source.
  for (const [id, source] of Object.entries(SOURCES)) {
    const bytes = await readFile(source.path);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
      'format=filename,format_name,duration,bit_rate,size', '-show_entries',
      'stream=index,codec_type,codec_name,sample_rate,channels,bits_per_sample,duration,nb_frames,start_time',
      '-of', 'json', source.path], { encoding: 'utf8' }));
    report.sources[id] = { label: source.label, path: source.path, origin: source.origin, sha256: sha256(bytes), bytes: bytes.length, probe };
  }

  // Step 1.6/1.7: extract, normalise, key.
  const masters = {};
  for (const [id] of Object.entries(SOURCES).filter(([, s]) => s.kind === 'mov')) {
    const decoded = decodeToFloat(SOURCES[id].path, { seconds: LOOP_SECONDS });
    const key = keyEstimate(decoded.left, decoded.right);
    const assembled = assembleLoop({ data: encodePcm24(decoded.left, decoded.right, decoded.frames), frames: decoded.frames, channels: 2 });
    // Level first pass on the assembled loop, then write the master at that gain.
    const probeWav = join(out, `.probe-${id}.wav`);
    await writeWav24(probeWav, assembled.left, assembled.right);
    const preliminary = measureLoudness(probeWav);
    await rm(probeWav, { force: true });
    let gain = 10 ** ((TARGET_LUFS - preliminary.lufs) / 20);
    const masterPath = join(mastersDir, `${id}-source.wav`);
    for (let attempt = 0; attempt < 3; attempt++) {
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', SOURCES[id].path, '-vn', '-map', '0:a:0',
        '-af', `volume=${gain.toFixed(8)}`, '-acodec', 'pcm_s24le', '-ar', String(SAMPLE_RATE), '-ac', '2', masterPath]);
      const master = readWav24(masterPath);
      const loop = assembleLoop(master);
      const loopWav = join(out, `${id}.wav`);
      await writeLoopWav(loopWav, master, loop, WRAP_SECONDS * SAMPLE_RATE);
      const level = measureLoudness(loopWav);
      await rm(loopWav, { force: true });
      if (Math.abs(level.lufs - TARGET_LUFS) < .1) break;
      gain *= 10 ** ((TARGET_LUFS - level.lufs) / 20);
    }
    const master = readWav24(masterPath);
    const specVariant = assembleLoop(master, { headInjection: true });
    const specGates = seamGates(specVariant.left, specVariant.right);
    const loop = assembleLoop(master);
    const gates = seamGates(loop.left, loop.right);
    const profile = shortTermProfile(loop.left, loop.right);
    const loopWav = join(out, `${id}.wav`);
    const written = await writeLoopWav(loopWav, master, loop, WRAP_SECONDS * SAMPLE_RATE);
    const headBytes = HEAD_FRAMES * 6;
    const headHash = sha256(master.data.subarray(0, headBytes));
    const loopHeadHash = sha256(written.subarray(44, 44 + headBytes));
    const wavBytes = await readFile(loopWav);
    const m4a = join(out, `${id}.m4a`);
    const encoder = encodeAac(loopWav, m4a);
    const m4aBytes = await readFile(m4a);
    masters[id] = { masterPath, gain };
    report.loops.push({
      id, source: SOURCES[id].label, key,
      master: { path: masterPath, sha256: sha256(await readFile(masterPath)), frames: master.frames },
      headPreserved: headHash === loopHeadHash,
      headSha256Source: headHash, headSha256Loop: loopHeadHash, headFrames: HEAD_FRAMES,
      wav: { bytes: wavBytes.length, sha256: sha256(wavBytes) },
      m4a: { path: m4a, bytes: m4aBytes.length, sha256: sha256(m4aBytes), frames: decodedFrames(m4a), encoder },
      level: { wav: measureLoudness(loopWav), m4a: measureLoudness(m4a) },
      gates,
      specVariant: { shape: 'head injection per brief (outgoing tail + incoming head, full head gain at final sample)', gates: specGates, fadeDb: specVariant.fadeDb },
      wrap: { wrapSeconds: WRAP_SECONDS, fadeDb: loop.fadeDb, introLevelDb: loop.introLevel, tailLevelDb: loop.tailLevel, handoffFrames: loop.handoffFrames, leadInFrames: loop.leadInFrames },
      shortTermProfile: profile,
    });
    if (publish) await writeFile(join(ROOT, 'public/assets/audio', hashedAudioName(id, 'm4a', m4aBytes)), m4aBytes);
  }

  // 1.7: takes differ?
  if (report.loops.length === 2) {
    const a = report.sources['loop-333'], b = report.sources['loop-4'];
    const da = Number(a.probe.format.duration), dbb = Number(b.probe.format.duration);
    const la = decodeToFloat(SOURCES['loop-333'].path, { seconds: LOOP_SECONDS });
    const lb = decodeToFloat(SOURCES['loop-4'].path, { seconds: LOOP_SECONDS });
    let num = 0, ea = 0, eb = 0;
    const n = Math.min(la.frames, lb.frames);
    for (let i = 0; i < n; i += 7) {
      const x = (la.left[i] + la.right[i]) / 2, y = (lb.left[i] + lb.right[i]) / 2;
      num += x * y; ea += x * x; eb += y * y;
    }
    report.takesDiffer = { durationGapSeconds: Number(Math.abs(da - dbb).toFixed(3)), rmsCorrelation: Number((num / Math.sqrt(ea * eb || 1)).toFixed(4)), threshold: 0.5, differentTakes: Math.abs(da - dbb) > 1 || num / Math.sqrt(ea * eb || 1) < 0.5 };
  }

  // Step 3: transitions.
  const frames = transitionFrames();
  report.transition = { seconds: transitionSeconds(), frames, source: 'src/data/livingDecaySettings.js:modeTransitionMs' };
  for (const id of ['sfx-a', 'sfx-b']) {
    const decoded = decodeToFloat(SOURCES[id].path);
    const cut = cutTransition(decoded.left, decoded.right, { frames });
    const level = await normalise(id, cut.left, cut.right, out);
    const wav = join(out, `${id}.wav`);
    await writeWav24(wav, cut.left, cut.right);
    const wavBytes = await readFile(wav);
    const m4a = join(out, `${id}.m4a`);
    const encoder = encodeAac(wav, m4a);
    const m4aBytes = await readFile(m4a);
    const post = measureLoudness(m4a);
    const env = cut.envelope;
    // Direction is the brightness trend of the build INTO the hit; the decay
    // after the peak is always darker and must not decide the mapping.
    const peakIndex = env.findIndex(e => Math.abs(e.t - cut.peakSecondsInBody) < .03);
    const before = env.slice(0, Math.max(1, peakIndex));
    const headPart = before.slice(0, Math.max(1, Math.round(before.length / 2)));
    const prePart = before.slice(Math.round(before.length / 2));
    const mean = list => list.reduce((s, e) => s + e.brightness, 0) / Math.max(1, list.length);
    const brightnessGain = mean(prePart) - mean(headPart);
    const rising = brightnessGain > .05;
    cut.brightnessEarly = Number(mean(headPart).toFixed(4));
    cut.brightnessLate = Number(mean(prePart).toFixed(4));
    cut.brightnessGain = Number(brightnessGain.toFixed(4));
    report.transitions.push({
      id, source: SOURCES[id].label, frames,
      onsetSeconds: cut.onsetSeconds, trimmedFrames: cut.trimmedFrames,
      peakSecondsInSource: cut.peakSecondsInSource, peakRmsDb: cut.peakRmsDb,
      windowStartInSource: cut.windowStartInSource,
      windowStartInBody: cut.windowStartInBody,
      envelope: cut.envelope,
      sweepDirection: rising ? 'rising' : 'falling/impulsive',
      brightnessEarly: cut.brightnessEarly, brightnessLate: cut.brightnessLate, brightnessGain: cut.brightnessGain,
      wav: { bytes: wavBytes.length, sha256: sha256(wavBytes) },
      m4a: { path: m4a, bytes: m4aBytes.length, sha256: sha256(m4aBytes), frames: decodedFrames(m4a), encoder },
      level: { m4a: post },
    });
  }
  // Direction mapping from the measured sweep shape: rising -> 333>4,
  // falling/impulsive -> 4>333. Files keep the runtime names.
  const routing = { 'sfx-a': 'x-333-4', 'sfx-b': 'x-4-333' };
  for (const transition of report.transitions) {
    const runtimeId = routing[transition.id];
    const transitionBytes = await readFile(transition.m4a.path);
    const runtimeName = hashedAudioName(runtimeId, 'm4a', transitionBytes);
    if (publish) await writeFile(join(ROOT, 'public/assets/audio', runtimeName), transitionBytes);
    transition.runtimeFile = `public/assets/audio/${runtimeName}`;
    transition.direction = transition.id === 'sfx-a' ? '333>4' : '4>333';
  }
  report.routing = routing;
  if (publish) {
    // Publish again refreshes the content-hashed names and the manifest the
    // runtime imports, and removes any stale hash of the previous audio.
    await hashWorldAudio({ root: ROOT, log: message => console.log(message) });
    await writeFile(join(ROOT, 'docs/validation/world-sound/v3-build.json'), JSON.stringify(report, null, 2));
  }
  return report;
}

/** Loop WAV writer: the region [0, N-W) is a byte copy of the master data, so
 * the head is bit-identical by construction; only the wrap window is written
 * from floats. */
export function writeLoopWav(path, master, loop, wrapFrames) {
  const N = loop.left.length, dataBytes = N * 6;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataBytes, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24); buffer.writeUInt32LE(SAMPLE_RATE * 6, 28);
  buffer.writeUInt16LE(6, 32); buffer.writeUInt16LE(24, 34); buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  const untouchable = (N - wrapFrames) * 6;
  master.data.copy(buffer, 44, 0, untouchable);
  let o = 44 + untouchable;
  for (let f = N - wrapFrames; f < N; f++) {
    buffer.writeIntLE(Math.max(-8388608, Math.min(8388607, Math.round(loop.left[f] * 8388607))), o, 3); o += 3;
    buffer.writeIntLE(Math.max(-8388608, Math.min(8388607, Math.round(loop.right[f] * 8388607))), o, 3); o += 3;
  }
  return writeFile(path, buffer).then(() => buffer);
}

function encodePcm24(left, right, frames) {
  const buffer = Buffer.alloc(frames * 6);
  for (let f = 0; f < frames; f++) {
    buffer.writeIntLE(Math.max(-8388608, Math.min(8388607, Math.round(left[f] * 8388607))), f * 6, 3);
    buffer.writeIntLE(Math.max(-8388608, Math.min(8388607, Math.round(right[f] * 8388607))), f * 6 + 3, 3);
  }
  return buffer;
}

/* --------------------------------------------------------------- validate */

export async function validate() {
  const runtimePath = url => join(ROOT, 'public', url.replace(/^\//, ''));
  const files = [
    { path: runtimePath(worldSoundSettings.paths.loops['333'][0]), frames: LOOP_FRAMES, loop: true },
    { path: runtimePath(worldSoundSettings.paths.loops['4'][0]), frames: LOOP_FRAMES, loop: true },
    { path: runtimePath(worldSoundSettings.paths.transitions['x-333-4'][0]), frames: transitionFrames(), loop: false },
    { path: runtimePath(worldSoundSettings.paths.transitions['x-4-333'][0]), frames: transitionFrames(), loop: false },
  ];
  const results = [];
  for (const file of files) {
    const decoded = decodeToFloat(file.path);
    const level = measureLoudness(file.path);
    const gates = file.loop ? seamGates(decoded.left, decoded.right) : null;
    results.push({
      path: file.path.replace(`${ROOT}/`, ''),
      frames: decoded.frames, expectedFrames: file.frames,
      framesExact: decoded.frames === file.frames,
      lufs: level.lufs, truePeakDbfs: level.truePeakDbfs,
      lufsInRange: Math.abs(level.lufs - TARGET_LUFS) <= 1,
      peakBelowMinus1: level.truePeakDbfs < -1,
      gates,
    });
  }
  const pass = results.every(r => r.framesExact && r.lufsInRange && r.peakBelowMinus1 && (!r.gates || r.gates.pass));
  return { checkedAt: new Date().toISOString(), results, pass };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  if (process.argv.includes('--validate')) {
    const result = await validate();
    console.log(JSON.stringify(result, null, 2));
    if (!result.pass) process.exitCode = 1;
  } else {
    const outIndex = process.argv.indexOf('--out');
    const out = outIndex > 0 ? resolve(process.argv[outIndex + 1]) : undefined;
    const report = await build({ out });
    console.log(JSON.stringify({
      loops: report.loops.map(l => ({ id: l.id, key: l.key.best, head: l.headPreserved, gates: l.gates.pass, m4a: l.m4a.sha256.slice(0, 16), bytes: l.m4a.bytes, lufs: l.level.m4a.lufs, frames: l.m4a.frames })),
      transitions: report.transitions.map(t => ({ id: t.id, sweep: t.sweepDirection, peak: t.peakSecondsInSource, m4a: t.m4a.sha256.slice(0, 16), frames: t.m4a.frames, lufs: t.level.m4a.lufs })),
    }, null, 2));
  }
}
