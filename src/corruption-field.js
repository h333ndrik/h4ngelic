import { corruptionSettings } from './data/corruptionSettings.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const finite = (value, fallback, minimum, maximum) => Number.isFinite(value) ? clamp(value, minimum, maximum) : fallback;
const neutralBlock = () => ({ offsetX: 0, offsetY: 0, smearLength: 0, channelShift: 0, opacity: 0 });

// Integer hashing keeps a damaged cell's sample repeatable without consuming a
// global random stream on every frame. It describes offsets, never particles.
function hash(value) {
  let result = value >>> 0;
  result = Math.imul(result ^ result >>> 16, 0x45d9f3b);
  result = Math.imul(result ^ result >>> 16, 0x45d9f3b);
  return (result ^ result >>> 16) >>> 0;
}
const noise = (seed, salt) => hash(seed ^ salt) / 0x100000000;

function configuration(settings) {
  const defaults = corruptionSettings.field;
  const field = settings?.field || {};
  const value = (name, minimum, maximum) => finite(field[name], defaults[name], minimum, maximum);
  const minimumRadius = value('minimumRadius', 1, 512);
  const minimumBlockSize = value('minimumBlockSize', 1, 128);
  return {
    maximumImpulses: Math.floor(value('maximumImpulses', 1, 128)),
    maximumVelocity: value('maximumVelocity', .01, 20),
    velocityResetMs: value('velocityResetMs', 1, 2000),
    coalesceDistance: value('coalesceDistance', 0, 256),
    coalesceWindowMs: value('coalesceWindowMs', 0, 500),
    minimumRadius,
    maximumRadius: Math.max(minimumRadius, value('maximumRadius', 1, 512)),
    minimumBlockSize,
    maximumBlockSize: Math.max(minimumBlockSize, value('maximumBlockSize', 1, 128)),
    maximumDisplacement: value('maximumDisplacement', 0, 512),
    maximumSmear: value('maximumSmear', 0, 1024),
    instabilityIntervalMs: value('instabilityIntervalMs', 16, 1000),
    maximumCoordinate: value('maximumCoordinate', 1000, 100_000_000),
    intensity: finite(settings?.distressIntensity, corruptionSettings.distressIntensity, 0, 2)
      * finite(settings?.pixelCorruption, corruptionSettings.pixelCorruption, 0, 2),
    smearingIntensity: finite(settings?.smearingIntensity, corruptionSettings.smearingIntensity, 0, 2),
    colorCorruption: finite(settings?.colorCorruption, corruptionSettings.colorCorruption, 0, 2),
    recoveryMs: finite(settings?.recoveryMs, corruptionSettings.recoveryMs, 50, 10_000),
    recoverySpeed: finite(settings?.recoverySpeed, corruptionSettings.recoverySpeed, .1, 10),
  };
}

/**
 * Pure state kernel for an actual-pixel renderer. It owns no DOM, timers or RAF.
 * Coordinates are CSS pixels in one consistent surface space; time is ms from
 * the caller's monotonic clock. stroke() returns an impulse id, or null when
 * ignored. sample(now) returns fresh records, retaining each creation anchor.
 *
 * The renderer copies source/history pixels using these displacement values;
 * none of the records is a decorative square or a moving particle. Nearby
 * input is coalesced at its original anchor. resetPointer() breaks velocity
 * continuity on pointer leave while preserving the anchored recovery trails.
 */
export function createCorruptionField({ settings = corruptionSettings, seed = 0x483443 } = {}) {
  const config = configuration(settings);
  const initialSeed = Number.isFinite(seed) ? seed >>> 0 : 0x483443;
  let impulses = [];
  let previous = null;
  let sequence = 0;
  let sampledAt = 0;

  const prune = (now) => { impulses = impulses.filter((impulse) => now < impulse.expiresAt); };

  function stroke(point) {
    if (!point || config.intensity === 0 || ![point.x, point.y, point.time].every(Number.isFinite)
      || point.time < 0 || Math.abs(point.x) > config.maximumCoordinate || Math.abs(point.y) > config.maximumCoordinate
      || previous && point.time < previous.time) return null;

    const now = Math.max(point.time, sampledAt);
    prune(now);
    let velocityX = 0;
    let velocityY = 0;
    if (previous) {
      const elapsed = point.time - previous.time;
      if (elapsed <= config.velocityResetMs) {
        const interval = Math.max(1, elapsed);
        velocityX = (point.x - previous.x) / interval;
        velocityY = (point.y - previous.y) / interval;
        const length = Math.hypot(velocityX, velocityY);
        if (length > config.maximumVelocity) {
          const ratio = config.maximumVelocity / length;
          velocityX *= ratio;
          velocityY *= ratio;
        }
      }
    }
    previous = { x: point.x, y: point.y, time: point.time };
    const speed = Math.min(1, Math.hypot(velocityX, velocityY) / config.maximumVelocity);
    const duration = clamp(config.recoveryMs * (.6 + speed * .8) / config.recoverySpeed, 50, 10_000);
    const latest = impulses.at(-1);
    if (latest && now - latest.updatedAt <= config.coalesceWindowMs
      && Math.hypot(point.x - latest.x, point.y - latest.y) <= config.coalesceDistance) {
      latest.updatedAt = now;
      latest.expiresAt = Math.max(latest.expiresAt, now + duration);
      // Retain the strongest stroke inside this small, fixed damage region.
      if (speed > latest.speed) Object.assign(latest, { speed, velocityX, velocityY });
      return latest.id;
    }

    const id = ++sequence;
    const impulse = {
      id, x: point.x, y: point.y, createdAt: now, updatedAt: now,
      expiresAt: now + duration, velocityX, velocityY, speed,
      seed: hash(initialSeed ^ Math.imul(id, 0x9e3779b1)),
    };
    if (impulses.length >= config.maximumImpulses) impulses.shift();
    impulses.push(impulse);
    return id;
  }

  function sample(now) {
    if (!Number.isFinite(now) || now < 0) return [];
    // A delayed/out-of-order frame cannot increase the opacity of old damage.
    sampledAt = Math.max(sampledAt, previous?.time || 0, now);
    prune(sampledAt);
    return impulses.map((impulse) => {
      const age = Math.max(0, sampledAt - impulse.updatedAt);
      const lifetime = Math.max(1, impulse.expiresAt - impulse.updatedAt);
      const progress = clamp(age / lifetime, 0, 1);
      const decay = (1 - progress) ** 2;
      const energy = Math.min(1, config.intensity * (.18 + impulse.speed * .82)) * decay;
      const radius = config.minimumRadius + (config.maximumRadius - config.minimumRadius) * impulse.speed;
      const direction = Math.abs(impulse.velocityX) > .001 ? Math.sign(impulse.velocityX) : noise(impulse.seed, 73) < .5 ? -1 : 1;
      const displacement = config.maximumDisplacement * Math.min(2, config.intensity) * (.08 + impulse.speed * .92) * decay;
      return {
        ...impulse,
        age, progress, energy,
        radiusX: radius,
        radiusY: radius * (.55 + noise(impulse.seed, 71) * .25),
        blockSize: Math.round(config.minimumBlockSize + (config.maximumBlockSize - config.minimumBlockSize) * impulse.speed),
        displacementX: displacement * direction,
        displacementY: displacement * impulse.velocityY / config.maximumVelocity * .15,
        smearLength: config.maximumSmear * config.smearingIntensity * (.05 + impulse.speed * .95) * decay,
        colorCorruption: config.colorCorruption,
        phase: Math.floor(age / config.instabilityIntervalMs),
      };
    });
  }

  return {
    stroke,
    sample,
    resetPointer() { previous = null; },
    clear() { impulses = []; previous = null; sequence = 0; sampledAt = 0; },
    get size() { return impulses.length; },
  };
}

/** Stable per-cell offsets for copying source pixels or prior damaged pixels. */
export function sampleCorruptionBlock(impulse, column, row) {
  if (!impulse || ![column, row, impulse.seed, impulse.energy, impulse.blockSize,
    impulse.displacementX, impulse.displacementY, impulse.smearLength, impulse.phase,
    impulse.colorCorruption].every(Number.isFinite) || impulse.energy <= 0) return neutralBlock();
  const cell = hash(impulse.seed ^ Math.imul(Math.trunc(column), 73856093)
    ^ Math.imul(Math.trunc(row), 19349663) ^ Math.imul(impulse.phase, 83492791));
  const horizontal = .35 + noise(cell, 11) * .65;
  return {
    offsetX: impulse.displacementX * horizontal,
    offsetY: impulse.displacementY + (noise(cell, 17) - .5) * impulse.blockSize * .24 * impulse.energy,
    smearLength: impulse.smearLength * (.5 + noise(cell, 23) * .5),
    channelShift: impulse.energy * clamp(impulse.colorCorruption, 0, 2) * (1 + noise(cell, 29) * 3),
    opacity: clamp(impulse.energy * (.65 + noise(cell, 31) * .35), 0, 1),
  };
}
