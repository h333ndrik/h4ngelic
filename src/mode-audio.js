import { modeAudioSettings } from './data/modeAudioSettings.js';

/** Inharmonic damped resonances, a short strike and two quiet early reflections.
 * Pure PCM generation also makes the actual browser sound exportable for review.
 */
export function synthesizeModeSound(mode, { sampleRate = 48000, settings = modeAudioSettings } = {}) {
  if (!['normal', 'xray'].includes(mode)) throw new TypeError('Unknown mode sound.');
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError('Unsupported sound sample rate.');
  const duration = Math.max(.4, Math.min(.8, settings.durationSeconds));
  const length = Math.ceil(sampleRate * duration);
  const channels = [new Float32Array(length), new Float32Array(length)];
  const strike = new Float32Array(length);
  const entering = mode === 'xray';
  const sweep = entering ? settings.enterSweep : settings.leaveSweep;
  const rate = sweep / duration;
  let seed = 0x4a73b95d;
  let previousNoise = 0;
  for (let index = 0; index < length; index++) {
    const time = index / sampleRate;
    const attack = Math.min(1, time / Math.max(1 / sampleRate, settings.attackSeconds));
    const tail = Math.min(1, (duration - time) / .055);
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const noise = (seed >>> 0) / 0x80000000 - 1;
    strike[index] = (noise - previousNoise) * .026 * Math.exp(-time / .009);
    previousNoise = noise;
    let value = strike[index];
    const integratedTime = Math.abs(rate) < 1e-9 ? time : Math.expm1(rate * time) / rate;
    const shimmerDepth = .55 * Math.exp(-time / .04);
    for (let partial = 0; partial < settings.partialRatios.length; partial++) {
      const frequency = settings.fundamentalHz * settings.partialRatios[partial] * (entering ? 1 : .97);
      if (frequency >= sampleRate * .46) continue;
      const phase = Math.PI * 2 * frequency * integratedTime;
      const shimmer = shimmerDepth * Math.sin(phase * 1.997);
      value += Math.sin(phase + shimmer) * settings.partialWeights[partial] * Math.exp(-time / settings.partialDecaySeconds[partial]);
    }
    channels[0][index] = channels[1][index] = value * attack * tail;
  }
  // Echoes read an immutable dry signal, so their energy cannot feed back.
  for (let channel = 0; channel < channels.length; channel++) {
    const dry = channels[channel].slice();
    for (const echo of settings.echoes) {
      const delay = Math.round((echo.delay + channel * .004) * sampleRate);
      for (let index = delay; index < length; index++) {
        const tail = Math.min(1, (length - index) / (sampleRate * .055));
        channels[channel][index] += dry[index - delay] * echo.gain * tail;
      }
    }
  }
  let peak = 0;
  for (const channel of channels) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  const gain = Math.min(1, Math.max(0, Math.min(.8, settings.maximumPeak)) / Math.max(peak, .00001));
  for (const channel of channels) {
    for (let index = 0; index < length; index++) channel[index] *= gain;
    channel[0] = 0;
    channel[length - 1] = 0;
  }
  return { sampleRate, duration: length / sampleRate, channels };
}

/** Lazy Web Audio: nothing is allocated until a trusted gesture primes it.
 * A denied/suspended audio context never prevents the visual mode change.
 */
export function createModeAudio({ view = window, settings = modeAudioSettings } = {}) {
  const AudioContext = view.AudioContext || view.webkitAudioContext;
  const buffers = new Map();
  const voices = new Set();
  let context = null;
  let master = null;
  let compressor = null;
  let active = null;
  let muted = !settings.enabled;
  let disposed = false;
  let failed = false;
  let resume = null;
  let latestStop = 0;

  function cleanVoice(voice) {
    if (!voices.has(voice)) return;
    voice.source.onended = null;
    voice.source.disconnect();
    voice.gain.disconnect();
    voices.delete(voice);
    if (active === voice) active = null;
  }

  function stop() {
    if (!active || !context) return context?.currentTime || 0;
    const voice = active;
    active = null;
    const now = context.currentTime;
    const end = Math.max(now + settings.interruptionFadeSeconds, voice.started);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, end);
    try { voice.source.stop(end); } catch { cleanVoice(voice); }
    latestStop = Math.max(latestStop, end);
    return end;
  }

  function bufferFor(mode) {
    if (buffers.has(mode)) return buffers.get(mode);
    const sound = synthesizeModeSound(mode, { sampleRate: context.sampleRate, settings });
    const buffer = context.createBuffer(sound.channels.length, sound.channels[0].length, sound.sampleRate);
    sound.channels.forEach((channel, index) => buffer.copyToChannel(channel, index));
    buffers.set(mode, buffer);
    return buffer;
  }

  function prime(event) {
    if (disposed || muted || failed || !AudioContext || event?.isTrusted !== true) return Promise.resolve(false);
    try {
      if (!context) {
        context = new AudioContext({ latencyHint: 'interactive' });
        master = context.createGain();
        master.gain.value = Math.max(0, Math.min(.5, settings.volume));
        compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.knee.value = 10;
        compressor.ratio.value = 5;
        compressor.attack.value = .002;
        compressor.release.value = .1;
        master.connect(compressor);
        compressor.connect(context.destination);
      }
      // Call resume synchronously within the gesture, before any timer/await.
      if (context.state !== 'running' && context.state !== 'closed' && !resume) {
        resume = Promise.resolve(context.resume()).then(() => context.state === 'running', () => false).finally(() => { resume = null; });
      }
      bufferFor('xray');
      bufferFor('normal');
      return resume || Promise.resolve(context.state === 'running');
    } catch { failed = true; return Promise.resolve(false); }
  }

  function play(mode) {
    if (disposed || muted || failed || !context || context.state !== 'running' || !['normal', 'xray'].includes(mode)) return false;
    try {
      const available = stop();
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = bufferFor(mode);
      source.connect(gain);
      gain.connect(master);
      const started = Math.max(context.currentTime, available, latestStop);
      const voice = { source, gain, started };
      source.onended = () => cleanVoice(voice);
      voices.add(voice);
      active = voice;
      source.start(started);
      return true;
    } catch { return false; }
  }

  return {
    prime,
    play,
    stop,
    get supported() { return Boolean(AudioContext) && !failed; },
    get muted() { return muted; },
    setMuted(value) { muted = Boolean(value); if (muted) stop(); },
    snapshot: () => ({ initialized: Boolean(context), state: context?.state || 'uninitialized', muted, active: Boolean(active), allocatedVoices: voices.size }),
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      for (const voice of voices) {
        try { voice.source.stop(); } catch { /* An already-ended source is harmless. */ }
        cleanVoice(voice);
      }
      buffers.clear();
      master?.disconnect();
      compressor?.disconnect();
      try { Promise.resolve(context?.close()).catch(() => {}); } catch { /* Closing audio must not interrupt page cleanup. */ }
    },
  };
}
