import { worldSoundSettings, worldTransitionDurationSeconds } from './worldSoundSettings.js';

const LOOP_KINDS = new Set(['loops']);
const TRANSITION_KINDS = new Set(['transitions']);
const timestamp = () => globalThis.performance?.now?.() ?? Date.now();

/** Web Audio world transport owned by the central sound controller.
 * One context, one aligned transport, one gain crossfade per mode change.
 * Missing/failed assets are recorded and left silent; format fallback uses
 * supplied derivatives only and never creates substitute audio.
 */
export function createWorldSound({
  context, destination, fetch: fetchAudio, settings = worldSoundSettings,
  schedule = globalThis.setTimeout?.bind(globalThis), cancelSchedule = globalThis.clearTimeout?.bind(globalThis),
} = {}) {
  if (!context || !destination || typeof fetchAudio !== 'function') throw new TypeError('World sound requires an audio context, destination and fetch.');
  const worldBus = context.createGain();
  const lowpass = context.createBiquadFilter();
  const limiter = context.createDynamicsCompressor();
  const duckGain = context.createGain();
  worldBus.gain.value = settings.worldBusGain;
  duckGain.gain.value = 1;
  lowpass.type = 'lowpass';
  lowpass.frequency.value = settings.lowpassHz;
  lowpass.Q.value = settings.lowpassQ;
  limiter.threshold.value = settings.limiter.threshold;
  limiter.knee.value = settings.limiter.knee;
  limiter.ratio.value = settings.limiter.ratio;
  limiter.attack.value = settings.limiter.attack;
  limiter.release.value = settings.limiter.release;
  worldBus.connect(lowpass);
  lowpass.connect(limiter);
  limiter.connect(duckGain);
  duckGain.connect(destination);

  const worlds = new Map(Object.keys(settings.paths.loops).map((id) => [id, {
    gain: context.createGain(), voice: null, buffer: null, status: 'idle', error: null,
  }]));
  for (const [id, record] of worlds) {
    record.gain.gain.value = settings.worldGains[id] ?? 1;
    record.gain.connect(worldBus);
  }
  const assets = new Map();
  const blocked = new Set();
  const transitionVoices = new Set();
  let currentWorld = null;
  let intendedWorld = null;
  let lastRequestedWorld = null;
  let transportStart = null;
  let transportDuration = null;
  let crossfade = null;
  let generation = 0;
  let transitionOrder = 0;
  let disposed = false;

  const now = () => context.currentTime;
  function hold(param, at) {
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(at);
    else { const value = param.value; param.cancelScheduledValues(at); param.setValueAtTime(value, at); }
  }
  function ramp(param, value, at) {
    hold(param, now());
    param.linearRampToValueAtTime(value, at);
  }
  function assetKey(kind, key) { return `${kind}:${key}`; }
  function pathsFor(kind, key) {
    const value = settings.paths[kind]?.[key];
    const candidates = Array.isArray(value) ? value : value ? [value] : [];
    return candidates.filter(path => typeof path === 'string' && path.length > 0);
  }
  function recordFor(kind, key) {
    const id = assetKey(kind, key);
    if (!assets.has(id)) {
      const paths = pathsFor(kind, key);
      assets.set(id, { kind, key, paths, path: '', status: paths.length ? 'idle' : 'missing',
        buffer: null, error: null, promise: null, attempts: [] });
    }
    return assets.get(id);
  }
  function block(record, error) {
    record.status = 'missing';
    record.error = String(error?.message || error || 'unavailable');
    if (record.kind === 'loops' && worlds.has(record.key)) worlds.get(record.key).status = 'missing';
    blocked.add(assetKey(record.kind, record.key));
  }
  function expectedFrames(kind, key) {
    return settings.expectedFrames?.[kind]?.[key];
  }
  function acceptBuffer(record, path, buffer) {
    if (!buffer || !(buffer.duration > 0)) throw new Error('Decoded asset has no duration.');
    const frames = expectedFrames(record.kind, record.key);
    // decodeAudioData always returns a buffer at the context's own rate, which
    // is the device rate (44.1 kHz or 48 kHz depending on the output). The
    // duration contract is what keeps the seam exact, so the expected frame
    // count is scaled to that rate rather than pinned to the master rate.
    const expectedFrameCount = frames ? Math.round(frames * buffer.sampleRate / settings.sampleRate) : null;
    if (buffer.sampleRate !== context.sampleRate) throw new Error(`Unexpected sample rate (${buffer.sampleRate}; context is ${context.sampleRate}).`);
    if (buffer.numberOfChannels !== settings.channels) throw new Error(`Unexpected channel count (${buffer.numberOfChannels}).`);
    if (expectedFrameCount && buffer.length !== expectedFrameCount) {
      throw new Error(`Unexpected decoded length (${buffer.length}; expected ${expectedFrameCount} at ${buffer.sampleRate} Hz).`);
    }
    record.path = path;
    record.buffer = buffer;
    record.status = 'ready';
    if (record.kind === 'loops' && worlds.has(record.key)) {
      worlds.get(record.key).buffer = buffer;
      worlds.get(record.key).status = 'ready';
    }
    return buffer;
  }
  async function resolveAsset(record) {
    let lastError = null;
    for (const path of record.paths) {
      try {
        const response = await fetchAudio(path, { cache: 'force-cache' });
        if (!response?.ok) throw new Error(`Asset unavailable (${response?.status || 'network'}).`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (disposed) return null;
        acceptBuffer(record, path, buffer);
        record.attempts.push({ path, status: 'ready' });
        return buffer;
      } catch (error) {
        if (disposed) return null;
        lastError = error;
        record.attempts.push({ path, status: 'failed', error: String(error?.message || error) });
      }
    }
    block(record, lastError);
    return null;
  }
  function load(kind, key) {
    if (!LOOP_KINDS.has(kind) && !TRANSITION_KINDS.has(kind)) throw new TypeError('Unknown world-sound asset kind.');
    const record = recordFor(kind, key);
    if (record.status === 'ready') return Promise.resolve(record.buffer);
    if (record.status === 'missing') return Promise.resolve(null);
    if (record.promise) return record.promise;
    record.status = 'loading';
    record.promise = resolveAsset(record).finally(() => { record.promise = null; });
    return record.promise;
  }

  function transportPosition() {
    if (transportStart === null) return 0;
    return Math.max(0, now() - transportStart);
  }
  function startTransport(buffer) {
    if (transportStart !== null) return;
    transportStart = now();
    transportDuration = Math.max(.001, buffer.duration);
  }
  function createLoopVoice(worldId, initialGain = 0, offsetOverride = null) {
    const record = worlds.get(worldId);
    if (!record?.buffer || disposed) return null;
    if (record.voice) return record.voice;
    const source = context.createBufferSource();
    const fade = context.createGain();
    source.buffer = record.buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = record.buffer.duration;
    fade.gain.value = initialGain;
    source.connect(fade);
    fade.connect(record.gain);
    const offset = Number.isFinite(offsetOverride) ? offsetOverride % record.buffer.duration
      : transportPosition() % record.buffer.duration;
    const voice = { source, fade, worldId, startedAt: now(), offset, stopTimer: null, ended: false };
    record.voice = voice;
    source.onended = () => {
      voice.ended = true;
      if (record.voice === voice) record.voice = null;
      try { source.disconnect(); fade.disconnect(); } catch { /* already disconnected */ }
    };
    source.start(now(), offset);
    return voice;
  }
  function cancelVoiceStop(voice) {
    if (!voice?.stopTimer) return;
    cancelSchedule?.(voice.stopTimer);
    voice.stopTimer = null;
  }
  function stopVoiceLater(voice, endTime) {
    if (!voice || voice.ended) return;
    cancelVoiceStop(voice);
    const delay = Math.max(0, (endTime - now()) * 1000) + settings.inactiveStopGraceMs;
    voice.stopTimer = schedule(() => {
      voice.stopTimer = null;
      if (voice.ended || disposed) return;
      const record = worlds.get(voice.worldId);
      if (record?.voice === voice && currentWorld !== voice.worldId) {
        try { voice.source.stop(); } catch { /* already ended */ }
      }
    }, delay);
  }
  function beginCrossfade(worldId, durationSeconds, fromWorld) {
    if (disposed) return false;
    const target = worlds.get(worldId);
    const at = now();
    const length = Math.max(settings.minimumCrossfadeSeconds, Number(durationSeconds) || 0);
    const end = at + length;
    for (const [id, record] of worlds) {
      if (!record.voice) continue;
      hold(record.voice.fade.gain, at);
    }
    if (target?.buffer) {
      startTransport(target.buffer);
      const voice = createLoopVoice(worldId, 0);
      if (voice) {
        cancelVoiceStop(voice);
        hold(voice.fade.gain, at);
        voice.fade.gain.linearRampToValueAtTime(1, end);
      }
    }
    for (const [id, record] of worlds) {
      if (id === worldId || !record.voice) continue;
      const voice = record.voice;
      hold(voice.fade.gain, at);
      voice.fade.gain.linearRampToValueAtTime(0, end);
      stopVoiceLater(voice, end);
    }
    currentWorld = worldId;
    lastRequestedWorld = worldId;
    crossfade = { from: fromWorld, to: worldId, startedAt: at, endsAt: end,
      durationSeconds: length, active: Boolean(target?.buffer), generation };
    return true;
  }

  async function activate(worldId, { fadeIn = true } = {}) {
    if (disposed || !worlds.has(worldId)) return false;
    intendedWorld = worldId;
    const buffer = await load('loops', worldId);
    if (disposed || intendedWorld !== worldId) return false;
    if (!buffer) {
      currentWorld = worldId;
      lastRequestedWorld = worldId;
      return false;
    }
    startTransport(buffer);
    const voice = createLoopVoice(worldId, fadeIn ? 0 : (settings.worldGains[worldId] ? 1 : 0), 0);
    if (!voice) return false;
    if (fadeIn) {
      const at = now();
      hold(voice.fade.gain, at);
      voice.fade.gain.linearRampToValueAtTime(1, at + Math.max(settings.minimumCrossfadeSeconds, settings.activationFadeSeconds));
    }
    currentWorld = worldId;
    lastRequestedWorld = worldId;
    crossfade = null;
    return true;
  }

  function transitionKey(from, to) {
    if (!from || !to || from === to) return null;
    return `${from}>${to}` in settings.paths.transitions ? `${from}>${to}` : null;
  }

  function stopOneShot(voice, endTime) {
    if (!voice || voice.ended) return;
    const at = now();
    hold(voice.gain.gain, at);
    voice.gain.gain.linearRampToValueAtTime(0, Math.max(at + .005, endTime));
    const delay = Math.max(0, (endTime - at) * 1000) + settings.inactiveStopGraceMs;
    voice.stopTimer = schedule(() => {
      try { voice.source.stop(); } catch { /* already ended */ }
      transitionVoices.delete(voice);
    }, delay);
  }

  function playTransition(from, to) {
    const key = transitionKey(from, to);
    if (!key) return Promise.resolve(false);
    return load('transitions', key).then((buffer) => {
      if (!buffer || disposed) return false;
      while (transitionVoices.size >= settings.maxTransitionVoices) {
        const oldest = [...transitionVoices].sort((a, b) => a.order - b.order)[0];
        transitionVoices.delete(oldest);
        stopOneShot(oldest, now() + settings.transitionCancelFadeSeconds);
      }
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = settings.transitionGain;
      source.connect(gain);
      gain.connect(worldBus);
      const voice = { source, gain, order: ++transitionOrder, startedAt: now(), ended: false, stopTimer: null };
      transitionVoices.add(voice);
      source.onended = () => {
        voice.ended = true;
        transitionVoices.delete(voice);
        try { source.disconnect(); gain.disconnect(); } catch { /* already disconnected */ }
      };
      source.start(now(), 0);
      return true;
    }).catch(() => false);
  }

  async function switchTo(worldId, { durationMs } = {}) {
    if (disposed || !worlds.has(worldId)) return false;
    intendedWorld = worldId;
    if (currentWorld === worldId && !crossfade) {
      lastRequestedWorld = worldId;
      return true;
    }
    const request = ++generation;
    const from = lastRequestedWorld || currentWorld || '333';
    lastRequestedWorld = worldId;
    void playTransition(from, worldId);
    const buffer = await load('loops', worldId);
    if (disposed || request !== generation || intendedWorld !== worldId) return false;
    const seconds = Number.isFinite(durationMs) && durationMs >= 0
      ? durationMs / 1000 : worldTransitionDurationSeconds();
    if (!buffer && currentWorld === worldId && !crossfade) return false;
    return beginCrossfade(worldId, seconds, from);
  }

  function preload(worldId, fromWorld = lastRequestedWorld || currentWorld) {
    if (!worlds.has(worldId)) return Promise.resolve(false);
    const transition = transitionKey(fromWorld, worldId);
    return Promise.all([load('loops', worldId), transition ? load('transitions', transition) : null])
      .then(([buffer, transitionBuffer]) => Boolean(buffer || transitionBuffer));
  }

  function setDuck(level, seconds = settings.smashDuckSeconds) {
    const target = Math.max(0, Math.min(1, Number(level)));
    if (!Number.isFinite(target)) return;
    const at = now() + Math.max(0, Number(seconds) || 0);
    hold(duckGain.gain, now());
    duckGain.gain.linearRampToValueAtTime(target, at);
  }

  function snapshot() {
    const loopStatus = Object.fromEntries([...worlds.entries()].map(([id, record]) => [id, {
      status: record.status, active: Boolean(record.voice && !record.voice.ended), bufferDuration: record.buffer?.duration || 0,
    }]));
    return {
      currentWorld, intendedWorld, transportStart, transportPhase: transportStart === null ? 0 : transportPosition() % (transportDuration || 1),
      crossfade: crossfade ? { ...crossfade, remaining: Math.max(0, crossfade.endsAt - now()) } : null,
      loops: loopStatus,
      assets: Object.fromEntries([...assets.entries()].map(([key, record]) => [key, {
        status: record.status, path: record.path, paths: [...record.paths], attempts: [...record.attempts],
      }])),
      blockedAssets: [...blocked],
      transitionVoices: transitionVoices.size,
      transitionVoiceLimit: settings.maxTransitionVoices,
      duck: duckGain.gain.value,
      busGain: worldBus.gain.value,
    };
  }

  return {
    activate,
    switchTo,
    preload,
    setDuck,
    snapshot,
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      for (const record of worlds.values()) {
        if (!record.voice) continue;
        const voice = record.voice;
        cancelVoiceStop(voice);
        try { voice.source.stop(); } catch { /* already ended */ }
        try { voice.source.disconnect(); voice.fade.disconnect(); } catch { /* already disconnected */ }
        record.voice = null;
      }
      for (const voice of transitionVoices) {
        try { voice.source.stop(); } catch { /* already ended */ }
        try { voice.source.disconnect(); voice.gain.disconnect(); } catch { /* already disconnected */ }
      }
      transitionVoices.clear();
      worldBus.disconnect(); lowpass.disconnect(); limiter.disconnect(); duckGain.disconnect();
      for (const record of worlds.values()) record.gain.disconnect();
      assets.clear();
    },
  };
}
