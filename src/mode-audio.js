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

/** Lazy Web Audio. The approved soundtrack is fetched/decoded only after a
 * trusted SMASH activation, then reused by this same route-persistent controller.
 * Independent cue/track buses let mute and volume act on the complete sound mix.
 */
export function createModeAudio({ view = window, settings = modeAudioSettings, smashURL = settings.smashURL || '', privateURL } = {}) {
  // Keep the old explicit override usable by existing integrations, without
  // exposing its former private-only URL in normal application configuration.
  const trackURL = privateURL === undefined ? smashURL : privateURL;
  const AudioContext = view.AudioContext || view.webkitAudioContext;
  const buffers = new Map();
  const voices = new Set();
  const subscribers = new Set();
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
  } catch { /* Storage denial leaves bounded in-memory preferences. */ }
  let smashBuffer = null;
  let smashLoading = null;
  let smashVoice = null;
  let smashActive = false;
  let smashPhase = 'idle';
  let smashRequest = 0;
  let smashFetches = 0;
  let disposed = false;
  let failed = false;
  let resume = null;
  let latestStop = 0;

  function notify() { for (const listener of subscribers) listener(); }
  function save() {
    try { view.localStorage?.setItem(settings.preferenceKey, JSON.stringify({ muted, volume })); } catch { /* Storage is optional. */ }
    notify();
  }
  function hold(param, now) {
    // cancelAndHold preserves the actual interpolated gain when a listener
    // stops a track during either its attack or its final tail.
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else { const value = param.value; param.cancelScheduledValues(now); param.setValueAtTime(value, now); }
  }
  function ramp(param, value, seconds = settings.volumeFadeSeconds || .04) {
    if (!context || !param) return;
    const now = context.currentTime;
    hold(param, now);
    param.linearRampToValueAtTime(value, now + seconds);
  }
  function updateMaster() { ramp(master?.gain, muted ? 0 : volume * maximumVolume); }
  function releasePriority() {
    smashActive = false;
    smashPhase = 'idle';
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
    hold(voice.gain.gain, now);
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
      // Resume synchronously inside the original trusted gesture. Fetching the
      // track later never requires a second autoplay-sensitive media element.
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

  function cleanSmash(voice) {
    if (!voice || smashVoice !== voice) return;
    voice.source.onended = null;
    voice.source.disconnect();
    voice.gain.disconnect();
    smashVoice = null;
    releasePriority();
  }

  function stopSmash({ immediate = false } = {}) {
    ++smashRequest;
    const voice = smashVoice;
    if (!voice || !context) { releasePriority(); return; }
    if (smashPhase === 'stopping' && !immediate) return;
    const now = context.currentTime;
    const end = immediate ? now : Math.min(voice.ends, now + (settings.smashStopFadeSeconds || 1));
    smashPhase = 'stopping';
    hold(voice.gain.gain, now);
    voice.gain.gain.linearRampToValueAtTime(0, end);
    if (immediate) {
      voice.source.onended = null;
      try { voice.source.stop(now); } catch { /* An ended source is harmless. */ }
      cleanSmash(voice);
    } else {
      try { voice.source.stop(end); } catch { cleanSmash(voice); }
      notify();
    }
  }

  function trackBuffer() {
    if (smashBuffer) return Promise.resolve(smashBuffer);
    if (smashLoading) return smashLoading;
    smashFetches++;
    // A single fetch/decode promise survives stops, route changes and mode
    // switches. Cached PCM is released only when the document controller dies.
    smashLoading = Promise.resolve(view.fetch(trackURL, { cache: 'force-cache' }))
      .then(response => { if (!response.ok) throw new Error('Soundtrack unavailable.'); return response.arrayBuffer(); })
      .then(bytes => context.decodeAudioData(bytes))
      .then(buffer => {
        if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error('Soundtrack has no playable duration.');
        if (!disposed) smashBuffer = buffer;
        return buffer;
      })
      .finally(() => { smashLoading = null; });
    return smashLoading;
  }

  function toggleSmash(event) {
    if (smashActive) { stopSmash(); return Promise.resolve(false); }
    if (disposed || !trackURL || typeof view.fetch !== 'function' || event?.isTrusted !== true) return Promise.resolve(false);
    const ready = prime(event, { allowMuted: true });
    if (!context || failed) return Promise.resolve(false);
    const request = ++smashRequest;
    stop();
    smashActive = true;
    smashPhase = 'loading';
    ramp(cueBus.gain, 0, settings.priorityFadeSeconds || .08);
    notify();
    let loading;
    try { loading = trackBuffer(); }
    catch { releasePriority(); return Promise.resolve(false); }
    return Promise.all([ready, loading]).then(([resumed, buffer]) => {
      if (disposed || request !== smashRequest) return false;
      if (!resumed) { releasePriority(); return false; }
      const source = context.createBufferSource();
      const gain = context.createGain();
      const started = context.currentTime;
      const duration = buffer.duration;
      const tail = Math.min(settings.smashFadeOutSeconds || 5, duration / 2);
      const attack = Math.min(settings.smashFadeInSeconds || 1.8, duration - tail);
      const tailStarts = started + duration - tail;
      const ends = started + duration;
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(smashBus);
      gain.gain.setValueAtTime(0, started);
      gain.gain.linearRampToValueAtTime(1, started + attack);
      gain.gain.setValueAtTime(1, tailStarts);
      gain.gain.linearRampToValueAtTime(0, ends);
      const voice = { source, gain, started, tailStarts, ends, duration, attack, tail };
      smashVoice = voice;
      smashPhase = 'playing';
      source.onended = () => cleanSmash(voice);
      source.start(started, 0);
      notify();
      return true;
    }).catch(() => {
      if (request === smashRequest) {
        if (smashVoice) stopSmash({ immediate: true });
        else releasePriority();
      }
      return false;
    });
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
    get smashAvailable() { return Boolean(trackURL && typeof view.fetch === 'function' && AudioContext) && !failed; },
    get smashPlaying() { return smashActive; },
    setMuted(value) { muted = Boolean(value); if (muted) stop(); updateMaster(); save(); },
    setVolume(value) { if (!Number.isFinite(value)) return; volume = Math.max(0, Math.min(1, value)); updateMaster(); save(); },
    subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); },
    snapshot: () => ({ initialized: Boolean(context), state: context?.state || 'uninitialized', muted, volume,
      active: Boolean(active), allocatedVoices: voices.size, smashAvailable: Boolean(trackURL && typeof view.fetch === 'function' && AudioContext) && !failed,
      smashPlaying: smashActive, smashPhase, smashCached: Boolean(smashBuffer), smashFetches,
      smash: smashVoice ? { started: smashVoice.started, tailStarts: smashVoice.tailStarts, ends: smashVoice.ends,
        duration: smashVoice.duration, attack: smashVoice.attack, tail: smashVoice.tail, stopping: smashPhase === 'stopping' } : null }),
    dispose() {
      if (disposed) return;
      disposed = true;
      stopSmash({ immediate: true });
      stop();
      for (const voice of voices) {
        try { voice.source.stop(); } catch { /* An already-ended source is harmless. */ }
        cleanVoice(voice);
      }
      buffers.clear();
      smashBuffer = null;
      master?.disconnect();
      cueBus?.disconnect();
      smashBus?.disconnect();
      subscribers.clear();
      compressor?.disconnect();
      try { Promise.resolve(context?.close()).catch(() => {}); } catch { /* Closing audio must not interrupt page cleanup. */ }
    },
  };
}
