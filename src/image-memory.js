const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const random = (seed, salt) => {
  let value = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
  return ((value ^ value >>> 16) >>> 0) / 0x100000000;
};

/** Numeric, stable macroblock velocity field. Nothing in a cell refers to DOM.
 * Input vectors are real signed displacement over deltaMs, not random jitter.
 * History lives in the caller's bounded ping-pong canvases, not in these cells.
 */
export function createImageMemoryField({ width = 1, height = 1, cellSize = 28, seed = 0, maxCells = 1400, persistent = false } = {}) {
  let cells = [], columns = 0, rows = 0, size = 1, accepted = 0, sampledAt = 0;
  let inputKinds = {};
  function resize(nextWidth = width, nextHeight = height, nextSize = cellSize, preserve = false) {
    const previous = preserve && persistent ? { cells, columns, size, width, height } : null;
    width = Math.max(1, finite(nextWidth, 1)); height = Math.max(1, finite(nextHeight, 1));
    size = Math.max(6, finite(nextSize, 28), Math.sqrt(width * height / Math.max(1, maxCells - 100)));
    columns = Math.ceil(width / size); rows = Math.ceil(height / size);
    while (columns * rows > maxCells) { size += 1; columns = Math.ceil(width / size); rows = Math.ceil(height / size); }
    cells = Array.from({ length: columns * rows }, (_, index) => {
      const x = index % columns * size, y = Math.floor(index / columns) * size;
      return { x, y, width: Math.min(size, width - x), height: Math.min(size, height - y),
        vx: 0, vy: 0, energy: 0, holdUntil: 0, touched: false, scarX: 0, scarY: 0,
        rate: .24 + random(seed, index + 1) * 1.45,
        drag: .68 + random(seed, index + 7001) * .65,
        hold: .2 + random(seed, index + 9001) * .8,
        color: random(seed, index + 11001) };
    });
    if (previous?.cells.length) for (const cell of cells) {
      const column = Math.min(previous.columns - 1, Math.floor((cell.x + cell.width / 2) / width * previous.width / previous.size));
      const row = Math.min(Math.ceil(previous.height / previous.size) - 1, Math.floor((cell.y + cell.height / 2) / height * previous.height / previous.size));
      const old = previous.cells[row * previous.columns + column];
      if (!old) continue;
      const scaleX = width / previous.width, scaleY = height / previous.height;
      const limit = Math.min(58, size * 1.8);
      Object.assign(cell, { vx: old.vx * scaleX, vy: old.vy * scaleY, energy: old.energy,
        holdUntil: old.holdUntil, touched: old.touched,
        scarX: clamp(old.scarX * scaleX, -limit, limit), scarY: clamp(old.scarY * scaleY, -limit, limit) });
    }
  }
  function impulse(input = {}) {
    if (![input.x, input.y, input.dx, input.dy].every(Number.isFinite) || !(input.strength > 0)) return false;
    const radius = clamp(finite(input.radius, 70), 6, Math.max(width, height) * 2);
    const dt = clamp(finite(input.deltaMs, 80), 8, 250);
    const vx = clamp(input.dx / dt, -5, 5), vy = clamp(input.dy / dt, -5, 5);
    const strength = clamp(input.strength, 0, 3);
    const time = Math.max(sampledAt, finite(input.time));
    let changed = false;
    for (const cell of cells) {
      const distance = Math.hypot(cell.x + cell.width / 2 - input.x, cell.y + cell.height / 2 - input.y) / radius;
      if (distance >= 1) continue;
      const falloff = (1 - distance) ** .7;
      const weight = clamp(falloff * strength, 0, 1);
      // New signed motion takes precedence, including an immediate reversal.
      // Retaining the older maximum speed would pull pixels the wrong way.
      cell.vx = cell.vx * vx < 0 ? vx * strength * weight : cell.vx * (1 - weight) + vx * strength * weight;
      cell.vy = cell.vy * vy < 0 ? vy * strength * weight : cell.vy * (1 - weight) + vy * strength * weight;
      cell.energy = Math.max(cell.energy, clamp(weight * (.24 + Math.hypot(vx, vy) * .38), 0, 1));
      cell.holdUntil = Math.max(cell.holdUntil, time + 180 + cell.hold * 1050 * strength);
      // Only genuine displacement writes a scar. It is not another palette or
      // random overlay: eventual reconstruction samples the same material at
      // this retained, signed address instead of exposing its clean keyframe.
      // Idle flow moves history but cannot steadily push every scar to a cap.
      if (persistent && input.kind !== 'idle') {
        const limit = Math.min(58, size * 1.8);
        cell.scarX = clamp(cell.scarX + input.dx * weight * cell.drag * .18, -limit, limit);
        cell.scarY = clamp(cell.scarY + input.dy * weight * cell.drag * .18, -limit, limit);
      }
      cell.touched = changed = true;
    }
    if (changed) { accepted++; inputKinds[input.kind || 'motion'] = (inputKinds[input.kind || 'motion'] || 0) + 1; }
    return changed;
  }
  function step({ time = sampledAt, deltaMs = 40, persistence = .96, recoverySpeed = .8,
    displacement = 1.35, colorBleeding = .55, negativeExposure = .14 } = {}) {
    sampledAt = Math.max(sampledAt, finite(time, sampledAt));
    const dt = clamp(finite(deltaMs, 40), 0, 180);
    return cells.map(cell => {
      const held = sampledAt < cell.holdUntil;
      const motion = Math.hypot(cell.vx, cell.vy);
      // Quarter-pixel quantization is stable in place, never frame-hashed.
      const quantize = value => Math.round(clamp(value, -64, 64) * 4) / 4;
      const offsetX = motion < .0008 ? 0 : quantize(cell.vx * dt * displacement * cell.drag);
      const offsetY = motion < .0008 ? 0 : quantize(cell.vy * dt * displacement * cell.drag);
      const residual = (1 - clamp(persistence, 0, .9999)) * clamp(recoverySpeed, 0, 4) * cell.rate
        * (held ? .025 : .18 + (1 - cell.energy) * .82);
      const recovery = 1 - Math.pow(1 - clamp(residual, 0, .95), dt / (1000 / 60));
      const result = { x: cell.x, y: cell.y, width: cell.width, height: cell.height,
        offsetX, offsetY, energy: cell.energy, recovery,
        sourceOffsetX: cell.scarX, sourceOffsetY: cell.scarY,
        bleed: cell.color < .22 && motion > .02 ? cell.energy * colorBleeding * .2 : 0,
        negative: held && cell.color > .94 && motion > .04 ? cell.energy * negativeExposure * .24 : 0 };
      const drag = Math.exp(-dt / (held ? 480 + cell.drag * 480 : 220));
      cell.vx *= drag; cell.vy *= drag;
      cell.energy *= Math.exp(-dt * recoverySpeed / (held ? 4000 : 950 + cell.rate * 1200));
      if (cell.energy < .0005) { cell.energy = 0; cell.vx = cell.vy = 0; }
      return result;
    });
  }
  resize();
  return { impulse, step, resize,
    clear() { for (const cell of cells) { cell.vx = cell.vy = cell.energy = cell.holdUntil = cell.scarX = cell.scarY = 0; cell.touched = false; } },
    snapshot() { return { cells: cells.length, columns, rows, cellSize: size, accepted, byKind: { ...inputKinds },
      energy: cells.reduce((sum, cell) => sum + cell.energy, 0) / Math.max(1, cells.length),
      maxEnergy: Math.max(0, ...cells.map(cell => cell.energy)),
      movingCells: cells.filter(cell => Math.hypot(cell.vx, cell.vy) > .001).length,
      heldCells: cells.filter(cell => sampledAt < cell.holdUntil).length,
      persistent, scarredCells: cells.filter(cell => Math.hypot(cell.scarX, cell.scarY) > .25).length,
      maximumScar: Math.max(0, ...cells.map(cell => Math.hypot(cell.scarX, cell.scarY))) }; },
  };
}

/** Shared clamped history sampling for the full field and image ROIs. */
export function historyCellSample(cell, width, height, maximum = 64, ratio = 1) {
  const sw = Math.min(cell.width, width), sh = Math.min(cell.height, height);
  const offsetX = clamp(finite(cell.offsetX) * ratio, -maximum, maximum);
  const offsetY = clamp(finite(cell.offsetY) * ratio, -maximum, maximum);
  return { sx: clamp(cell.x - offsetX, 0, width - sw), sy: clamp(cell.y - offsetY, 0, height - sh), sw, sh };
}

/** NEXT = displaced previous OUTPUT + selective current source residual.
 * History is updated only after every read; even a new source cannot replace
 * old colors wholesale. Identity cells retain exactly the existing pixels.
 */
export function paintImageMemory({ context, history, historyContext, source, width, height, cells, reconstruct = true,
  sourceRect = { x: 0, y: 0, width: source.width, height: source.height } }) {
  context.globalCompositeOperation = 'copy'; context.globalAlpha = 1;
  context.drawImage(history, 0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
  let advected = 0, recovered = 0;
  for (const cell of cells) {
    const { sx, sy, sw, sh } = historyCellSample(cell, width, height);
    if (cell.offsetX || cell.offsetY) {
      context.globalAlpha = 1;
      context.drawImage(history, sx, sy, sw, sh, cell.x, cell.y, sw, sh);
      advected++;
      if (cell.bleed > .001 || cell.negative > .001) {
        context.globalAlpha = clamp(cell.negative || cell.bleed, 0, .25);
        context.filter = cell.negative ? 'invert(1) saturate(1.4)' : 'hue-rotate(22deg) saturate(1.7)';
        context.drawImage(history, clamp(sx - cell.offsetX * .45, 0, width - sw), sy, sw, sh,
          cell.x, cell.y, sw, sh);
        context.filter = 'none';
      }
    }
    if (reconstruct && cell.recovery > 0) {
      context.globalAlpha = clamp(cell.recovery, 0, 1);
      const sourceWidth = sw / width * sourceRect.width, sourceHeight = sh / height * sourceRect.height;
      context.drawImage(source, clamp(sourceRect.x + (cell.x - finite(cell.sourceOffsetX)) / width * sourceRect.width,
        0, Math.max(0, source.width - sourceWidth)),
        clamp(sourceRect.y + (cell.y - finite(cell.sourceOffsetY)) / height * sourceRect.height,
          0, Math.max(0, source.height - sourceHeight)),
        sourceWidth, sourceHeight,
        cell.x, cell.y, sw, sh);
      recovered++;
    }
  }
  context.globalAlpha = 1; context.filter = 'none';
  historyContext.globalCompositeOperation = 'copy'; historyContext.globalAlpha = 1;
  historyContext.drawImage(context.canvas, 0, 0, width, height);
  historyContext.globalCompositeOperation = 'source-over';
  return { advected, recovered };
}
