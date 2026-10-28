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
export function createModeAudio({ view = window, settings = modeAudioSettings, privateURL = view.__H4_PRIVATE_SMASH_URL__ || '' } = {}) {
  const AudioContext = view.AudioContext || view.webkitAudioContext;
  const buffers = new Map();
  const voices = new Set();
  let context = null;
  let master = null;
  let cueBus = null;
  let smashBus = null;
  let compressor = null;
  let active = null;
  let muted = !settings.enabled;
  const maximumVolume = Math.max(.01, Math.min(.5, settings.maximumVolume || .5));
  let volume = Math.max(0, Math.min(1, settings.volume / maximumVolume));
  try {
    const saved = JSON.parse(view.localStorage?.getItem(settings.preferenceKey) || 'null');
    if (typeof saved?.muted === 'boolean') muted = saved.muted;
    if (Number.isFinite(saved?.volume)) volume = Math.max(0, Math.min(1, saved.volume));
  } catch { /* Private browsing/storage denial leaves safe local defaults. */ }
  const subscribers = new Set();
  let media = null;
  let mediaSource = null;
  let smashActive = false;
  let smashRequest = 0;
  let disposed = false;
  let failed = false;
  let resume = null;
  let latestStop = 0;

  function notify() { for (const listener of subscribers) listener(); }
  function save() {
    try { view.localStorage?.setItem(settings.preferenceKey, JSON.stringify({ muted, volume })); } catch { /* Storage is optional. */ }
    notify();
  }
  function ramp(param, value, seconds = settings.volumeFadeSeconds || .04) {
    if (!context || !param) return;
    const now = context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + seconds);
  }
  function updateMaster() { ramp(master?.gain, muted ? 0 : volume * maximumVolume); }
  function releasePriority() {
    smashActive = false;
    ramp(cueBus?.gain, 1, settings.priorityFadeSeconds || .08);
    notify();
  }

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

  function prime(event, { allowMuted = false } = {}) {
    if (disposed || (muted && !allowMuted) || failed || !AudioContext || event?.isTrusted !== true) return Promise.resolve(false);
    try {
      if (!context) {
        context = new AudioContext({ latencyHint: 'interactive' });
        master = context.createGain();
        master.gain.value = muted ? 0 : volume * maximumVolume;
        cueBus = context.createGain();
        cueBus.connect(master);
        smashBus = context.createGain();
        smashBus.gain.value = .85;
        smashBus.connect(master);
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
    if (disposed || muted || smashActive || failed || !context || context.state !== 'running' || !['normal', 'xray'].includes(mode)) return false;
    try {
      const available = stop();
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = bufferFor(mode);
      source.connect(gain);
      gain.connect(cueBus);
      const started = Math.max(context.currentTime, available, latestStop);
      const voice = { source, gain, started };
      source.onended = () => cleanVoice(voice);
      voices.add(voice);
      active = voice;
      source.start(started);
      return true;
    } catch { return false; }
  }

  function stopSmash() {
    smashRequest++;
    if (media) {
      media.pause();
      try { media.currentTime = 0; } catch { /* Metadata may not yet be loaded. */ }
    }
    releasePriority();
  }

  function toggleSmash(event) {
    if (smashActive) { stopSmash(); return Promise.resolve(false); }
    if (disposed || !privateURL || !view.Audio || event?.isTrusted !== true) return Promise.resolve(false);
    // Both resume() and play() are called in the original gesture. No network,
    // media element or AudioContext is created merely by rendering the footer.
    const ready = prime(event, { allowMuted: true });
    if (!context || failed) return Promise.resolve(false);
    const request = ++smashRequest;
    try {
      if (!media) {
        media = new view.Audio();
        media.preload = 'none';
        media.src = privateURL;
        mediaSource = context.createMediaElementSource(media);
        mediaSource.connect(smashBus);
        media.onended = () => { if (smashActive) { smashRequest++; releasePriority(); } };
        media.onerror = () => { if (smashActive) stopSmash(); };
      }
      media.currentTime = 0;
      stop();
      smashActive = true;
      ramp(cueBus.gain, 0, settings.priorityFadeSeconds || .08);
      notify();
      const playing = Promise.resolve(media.play());
      return Promise.all([ready, playing]).then(([resumed]) => {
        if (disposed || request !== smashRequest) return false;
        if (!resumed) { stopSmash(); return false; }
        return true;
      }, () => { if (request === smashRequest) stopSmash(); return false; });
    } catch { if (request === smashRequest) stopSmash(); return Promise.resolve(false); }
  }

  return {
    prime,
    play,
    stop,
    toggleSmash,
    stopSmash,
    get supported() { return Boolean(AudioContext) && !failed; },
    get muted() { return muted; },
    get volume() { return volume; },
    get smashAvailable() { return Boolean(privateURL && view.Audio && AudioContext) && !failed; },
    get smashPlaying() { return smashActive; },
    setMuted(value) { muted = Boolean(value); if (muted) stop(); updateMaster(); save(); },
    setVolume(value) { if (!Number.isFinite(value)) return; volume = Math.max(0, Math.min(1, value)); updateMaster(); save(); },
    subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); },
    snapshot: () => ({ initialized: Boolean(context), state: context?.state || 'uninitialized', muted, volume, active: Boolean(active), allocatedVoices: voices.size, smashAvailable: Boolean(privateURL && view.Audio && AudioContext) && !failed, smashPlaying: smashActive }),
    dispose() {
      if (disposed) return;
      disposed = true;
      stopSmash();
      stop();
      for (const voice of voices) {
        try { voice.source.stop(); } catch { /* An already-ended source is harmless. */ }
        cleanVoice(voice);
      }
      buffers.clear();
      master?.disconnect();
      cueBus?.disconnect();
      smashBus?.disconnect();
      mediaSource?.disconnect();
      if (media) { media.onended = null; media.onerror = null; media.removeAttribute?.('src'); media.load?.(); }
      subscribers.clear();
      compressor?.disconnect();
      try { Promise.resolve(context?.close()).catch(() => {}); } catch { /* Closing audio must not interrupt page cleanup. */ }
    },
  };
}
