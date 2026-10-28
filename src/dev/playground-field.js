import { createImageMemoryField, paintImageMemory } from '../image-memory.js';
import { playgroundSettings } from '../data/playgroundSettings.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

/** The released memory kernel with one isolated experimental policy:
 * reconstruction samples the preceding damaged output, never a clean source.
 * Only two fixed-size bitmaps are required, regardless of interaction count.
 */
export function createPlaygroundField({ width = playgroundSettings.width, height = playgroundSettings.height,
  seed = playgroundSettings.seed } = {}) {
  width = clamp(Math.round(finite(width, playgroundSettings.width)), 1, playgroundSettings.width);
  height = clamp(Math.round(finite(height, playgroundSettings.height)), 1, playgroundSettings.height);
  const memory = createImageMemoryField({ width, height, seed: seed >>> 0, persistent: true,
    cellSize: playgroundSettings.cellSize, maxCells: playgroundSettings.maximumCells });
  let frames = 0;
  let lastTime = null;
  let elapsed = 0;
  let lastPointer = null;
  let disposed = false;

  function impulse({ kind = 'cursor', x, y, dx = 0, dy = 0, strength = 1, radius = 65, time = 0, deltaMs = 80 } = {}) {
    if (disposed || ![x, y, dx, dy, strength, radius, time].every(Number.isFinite)) return false;
    return memory.impulse({ kind, x: clamp(x, 0, width), y: clamp(y, 0, height),
      dx: clamp(dx, -180, 180), dy: clamp(dy, -180, 180), strength: clamp(strength, 0, 3),
      radius: clamp(radius, 6, Math.max(width, height) * 2), time, deltaMs });
  }

  function pointer({ x, y, time } = {}) {
    if (disposed || ![x, y, time].every(Number.isFinite)) return false;
    const previous = lastPointer;
    lastPointer = { x, y, time };
    if (!previous || time <= previous.time || time - previous.time > 500) return false;
    const dx = x - previous.x, dy = y - previous.y;
    const speed = Math.hypot(dx, dy) / Math.max(8, time - previous.time);
    if (speed < .008) return false;
    return impulse({ kind: 'cursor', x, y, dx, dy, time, deltaMs: time - previous.time,
      strength: clamp(.45 + speed * 1.8, .45, 2.6), radius: 40 + Math.min(60, speed * 40) });
  }

  function step(time) {
    if (disposed || !Number.isFinite(time)) return [];
    const deltaMs = lastTime === null ? 1000 / playgroundSettings.framesPerSecond : clamp(time - lastTime, 0, 180);
    lastTime = time;
    elapsed += deltaMs / 1000;
    // Slow, regional, seeded flow transports existing damage. It is not a
    // full-frame pan and cannot repaint a pristine keyframe.
    const angle = (seed >>> 0) * .000013 + elapsed * .19;
    impulse({ kind: 'idle', x: width * (.5 + Math.sin(angle * .71) * .29),
      y: height * (.5 + Math.cos(angle * .83) * .3),
      dx: Math.sin(angle) * playgroundSettings.idleDisplacement,
      dy: Math.cos(angle * .91) * playgroundSettings.idleDisplacement,
      deltaMs, time, strength: .36, radius: Math.max(width, height) * .52 });
    frames++;
    return memory.step({ time, deltaMs, persistence: .985, recoverySpeed: .45,
      displacement: 1.25, colorBleeding: .55, negativeExposure: .08 });
  }

  function paint({ context, history, historyContext, time }) {
    const cells = step(time);
    if (!cells.length) return { advected: 0, recovered: 0 };
    // Both reads refer to the last complete frame. paintImageMemory writes
    // history only after every source read has finished.
    return paintImageMemory({ context, history, historyContext, source: history,
      width, height, cells });
  }

  return { impulse, pointer, step, paint,
    suspend() { lastTime = null; lastPointer = null; },
    snapshot: () => ({ seed: seed >>> 0, width, height, frames, elapsed, disposed,
      historyBuffers: playgroundSettings.historyBuffers, memory: memory.snapshot() }),
    dispose() { if (disposed) return; disposed = true; lastPointer = null; memory.clear(); },
  };
}
