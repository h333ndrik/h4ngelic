import { getLivingDecaySettings } from '../data/livingDecaySettings.js';

const loops = {
  '333': Object.freeze([
    '/assets/audio/loop-333.m4a',
    '/assets/audio/loop-333.flac',
    '/assets/audio/loop-333.wav',
  ]),
  '4': Object.freeze([
    '/assets/audio/loop-4.m4a',
    '/assets/audio/loop-4.flac',
    '/assets/audio/loop-4.wav',
  ]),
};
const transitions = {
  'x-333-4': Object.freeze([
    '/assets/audio/x-333-4.m4a',
    '/assets/audio/x-333-4.flac',
    '/assets/audio/x-333-4.wav',
  ]),
  'x-4-333': Object.freeze([
    '/assets/audio/x-4-333.m4a',
    '/assets/audio/x-4-333.flac',
    '/assets/audio/x-4-333.wav',
  ]),
};

/** One source for every world-sound tuning value. Candidate paths are ordered
 * by verified delivery preference; component code owns no media locations. */
export const worldSoundSettings = Object.freeze({
  enabled: true,
  paths: Object.freeze({ loops: Object.freeze(loops), transitions: Object.freeze(transitions) }),
  sampleRate: 44100,
  channels: 2,
  /** Which transition file each direction plays. Swap the two values to
   * reverse the mapping - no code change, the files keep their names. */
  transitionRouting: Object.freeze({ '333>4': 'x-333-4', '4>333': 'x-4-333' }),
  /** Loop and one-shot lengths. A decoded asset is accepted only when its
   * frame count matches exactly, so encoder padding can never shift the seam.
   * The one-shot length always equals the visual transition length. */
  seconds: Object.freeze({ loops: 90, transitions: 0.9 }),
  expectedFrames: Object.freeze({
    loops: Object.freeze({ '333': 3969000, '4': 3969000 }),
    transitions: Object.freeze({ 'x-333-4': 39690, 'x-4-333': 39690 }),
  }),
  /** Bed attenuation during a mode switch, in dB. The SFX is not boosted;
   * the dip makes the room. */
  bedDipDb: -6,
  modeWorlds: Object.freeze({ normal: '333', xray: '4' }),
  worldGains: Object.freeze({ '333': .82, '4': .82 }),
  worldBusGain: 1.95,
  transitionGain: .9,
  activationFadeSeconds: .12,
  minimumCrossfadeSeconds: .04,
  inactiveStopGraceMs: 40,
  maxTransitionVoices: 2,
  transitionCancelFadeSeconds: .025,
  lowpassHz: 17000,
  lowpassQ: .55,
  limiter: Object.freeze({ threshold: -3, knee: 6, ratio: 8, attack: .003, release: .22 }),
  smashDuckGain: .2,
  smashDuckSeconds: .08,
});

/** Direction -> transition file, resolved through the reversible routing. */
export function transitionAssetFor(from, to) {
  if (!from || !to || from === to) return null;
  const key = `${from}>${to}`;
  return worldSoundSettings.transitionRouting[key] || null;
}

export function transitionFrames() {
  return Math.round(worldTransitionDurationSeconds() * worldSoundSettings.sampleRate);
}

export function worldForMode(mode) {
  return worldSoundSettings.modeWorlds[mode] || null;
}

/** The visual mode transition remains the only duration source. F24 currently
 * sets it to 900 ms; changing that setting retargets the audio crossfade too. */
export function worldTransitionDurationSeconds() {
  return Math.max(0, Number(getLivingDecaySettings().modeTransitionMs) || 0) / 1000;
}
