/**
 * The other side. These are presentation parameters, not edits to artwork files.
 * Channel tables map equal input steps from black (first) to white (last).
 * Their non-monotonic curves create solarized violet, acid green and pale pink.
 */
export const xraySettings = {
  shortcutHoldMs: 1000,
  reversePresses: 3,
  reverseWindowMs: 2000,
  transitionMs: 650,
  transitionFramesPerSecond: 30,
  saturation: 0.58,
  channelSeparation: 2.1,
  grainOpacity: 0.24,
  liteGrainOpacity: 0.16,
  palette: {
    background: '#080516',
    foreground: '#fffefb',
    muted: '#e2dbe6',
    acid: '#bcff16',
    violet: '#7c08ff',
    pink: '#ff3dbb',
    cyan: '#4cf4e3',
  },
  channels: {
    red:   [0.08, 0.46, 0.70, 0.13, 0.68, 0.90, 0.28, 0.98, 1.00],
    green: [0.02, 0.04, 0.12, 0.84, 1.00, 0.35, 0.86, 0.96, 1.00],
    blue:  [0.25, 0.80, 1.00, 0.92, 0.12, 0.85, 0.36, 1.00, 1.00],
  },
};

export function solarizedChannels(amount, settings = xraySettings) {
  const progress = Math.max(0, Math.min(1, Number.isFinite(amount) ? amount : 0));
  return Object.fromEntries(Object.entries(settings.channels).map(([channel, samples]) => [channel,
    samples.map((sample, index) => index / (samples.length - 1) * (1 - progress) + sample * progress),
  ]));
}

export function chooseXRayQuality({ coarsePointer = false, memory, cores, saveData = false } = {}) {
  return coarsePointer || saveData || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4) ? 'lite' : 'full';
}

function editable(element) {
  return Boolean(element && (element.isContentEditable || element.closest?.('input, textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"], [role="slider"], [contenteditable]:not([contenteditable="false"])')));
}

export function isModeDigit(event, digit, activeElement = event.target) {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
  // Physical numpad keys work with Num Lock either on or off.
  const matches = event.key === digit || event.code === `Numpad${digit}` || (!event.key && event.code === `Digit${digit}`);
  if (!matches || editable(event.target) || editable(activeElement)) return false;
  return !(event.composedPath?.() || []).some(editable);
}

export function isXRayShortcut(event, activeElement = event.target) {
  return isModeDigit(event, '4', activeElement);
}
