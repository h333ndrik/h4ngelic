/**
 * The other side. These are presentation parameters, not edits to artwork files.
 * Channel tables map equal input steps from black (first) to white (last).
 * Their non-monotonic curves create solarized violet, acid green and pale pink.
 */
export const xraySettings = {
  shortcutHoldMs: 1000,
  transitionMs: 650,
  transitionFramesPerSecond: 30,
  saturation: 0.32,
  channelSeparation: 1.25,
  grainOpacity: 0.24,
  liteGrainOpacity: 0.16,
  palette: {
    background: '#25142f',
    foreground: '#f5e5ed',
    muted: '#c6b4cb',
    acid: '#c9f144',
    violet: '#b98be1',
    pink: '#ef9fc4',
    cyan: '#a4d8ce',
  },
  channels: {
    red:   [0.76, 0.40, 0.30, 0.68, 0.93, 0.79, 0.48, 0.98, 0.99],
    green: [0.94, 0.43, 0.07, 0.09, 0.49, 0.85, 0.96, 0.72, 0.99],
    blue:  [0.28, 0.71, 0.91, 0.98, 0.94, 0.89, 0.45, 0.83, 0.94],
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
  return Boolean(element && (element.isContentEditable || element.closest?.('input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])')));
}

export function isXRayShortcut(event, activeElement = event.target) {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
  // Numpad4 is an explicitly approved shortcut, including Num Lock-off events.
  const digit = event.key === '4' || event.code === 'Numpad4' || (!event.key && event.code === 'Digit4');
  if (!digit || editable(event.target) || editable(activeElement)) return false;
  return !(event.composedPath?.() || []).some(editable);
}
