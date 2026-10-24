import './xray.css';
import { xraySettings, chooseXRayQuality, solarizedChannels } from './data/xraySettings.js';
import { bindXRayShortcut, bindReverseShortcut } from './xray-shortcut.js';
import { bindModeHold } from './mode-hold.js';
import { createModeAudio } from './mode-audio.js';
import { corruptionSettings } from './data/corruptionSettings.js';
import { createModeSnapshotTransition } from './mode-snapshot.js';

const controllers = new WeakMap();
const svgNamespace = 'http://www.w3.org/2000/svg';

// Static grain is rasterized at build preparation; no SVG noise is recomputed
// while the canvas animates. It is requested only on first mode activation.


function filterMarkup(id, separated) {
  return `<filter id="${id}" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
    <feColorMatrix type="saturate" values="1" data-xray-saturation result="tonal"/>
    <feComponentTransfer in="tonal" result="solarized">
      <feFuncR type="table" tableValues="0 .125 .25 .375 .5 .625 .75 .875 1" data-xray-channel="red"/>
      <feFuncG type="table" tableValues="0 .125 .25 .375 .5 .625 .75 .875 1" data-xray-channel="green"/>
      <feFuncB type="table" tableValues="0 .125 .25 .375 .5 .625 .75 .875 1" data-xray-channel="blue"/>
    </feComponentTransfer>
    ${separated ? `<feColorMatrix in="solarized" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
    <feOffset in="red" dx="0" dy="0" data-xray-offset="red" result="red-shift"/>
    <feColorMatrix in="solarized" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>
    <feOffset in="green" dx="0" dy="0" data-xray-offset="green" result="green-shift"/>
    <feColorMatrix in="solarized" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>
    <feBlend in="red-shift" in2="green-shift" mode="screen" result="red-green"/>
    <feBlend in="red-green" in2="blue" mode="screen"/>` : ''}
  </filter>`;
}

/**
 * One document-level controller survives ordinary enhanced page navigation.
 * It stores no persistent state. The return value is a disposer with optional
 * .setMode(mode), .toggle() and .refresh() methods for integration and tests.
 */
export function initXRay({ root = document } = {}) {
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  if (controllers.has(doc)) return controllers.get(doc);
  const html = doc.documentElement;
  const view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = view.matchMedia('(pointer: coarse)');
  const removers = [];
  const previousAttributes = new Map(['data-mode', 'data-xray-quality', 'data-xray-ready', 'data-xray-transition', 'data-mode-holding'].map((name) => [name, html.getAttribute(name)]));
  const previousProperties = new Map();
  const audio = createModeAudio({ view });
  const snapshot = createModeSnapshotTransition({ doc, settings: corruptionSettings.transition });
  let mode = 'normal';
  let pendingMode = null;
  let generation = 0;
  let amount = 0;
  let frame = 0;
  let destroyed = false;

  const defs = doc.createElementNS(svgNamespace, 'svg');
  defs.setAttribute('data-xray-filters', '');
  defs.setAttribute('aria-hidden', 'true');
  defs.setAttribute('focusable', 'false');
  defs.setAttribute('width', '0');
  defs.setAttribute('height', '0');
  defs.classList.add('xray-filter-definitions');
  defs.innerHTML = `<defs>${filterMarkup('h4-xray-treatment', true)}${filterMarkup('h4-xray-lite', false)}</defs>`;
  const overlay = doc.createElement('div');
  overlay.className = 'xray-distress';
  overlay.setAttribute('aria-hidden', 'true');
  doc.body.append(defs, overlay);

  const listen = (target, name, callback, options) => {
    target.addEventListener(name, callback, options);
    removers.push(() => target.removeEventListener(name, callback, options));
  };
  const property = (name, value) => {
    previousProperties.set(name, html.style.getPropertyValue(name));
    html.style.setProperty(name, value);
  };
  for (const [name, value] of Object.entries(xraySettings.palette)) property(`--xray-${name}`, value);
  property('--xray-duration', `${xraySettings.transitionMs}ms`);
  property('--xray-grain', String(xraySettings.grainOpacity * corruptionSettings.grainIntensity));
  property('--xray-lite-grain', String(xraySettings.liteGrainOpacity * corruptionSettings.grainIntensity));

  function updateQuality() {
    html.dataset.xrayQuality = chooseXRayQuality({
      coarsePointer: coarse.matches,
      memory: view.navigator.deviceMemory,
      cores: view.navigator.hardwareConcurrency,
      saveData: view.navigator.connection?.saveData,
    });
  }

  const channelNodes = [...defs.querySelectorAll('[data-xray-channel]')];
  const saturationNodes = [...defs.querySelectorAll('[data-xray-saturation]')];
  const offsets = [...defs.querySelectorAll('[data-xray-offset]')];
  function treat(progress) {
    amount = progress;
    const channels = solarizedChannels(progress * corruptionSettings.colorCorruption);
    for (const node of channelNodes) node.setAttribute('tableValues', channels[node.dataset.xrayChannel].map((value) => value.toFixed(4)).join(' '));
    for (const node of saturationNodes) node.setAttribute('values', String(1 - (1 - xraySettings.saturation) * progress));
    for (const node of offsets) {
      const sign = node.dataset.xrayOffset === 'red' ? 1 : -0.7;
      node.setAttribute('dx', String(xraySettings.channelSeparation * progress * sign));
      node.setAttribute('dy', String(-xraySettings.channelSeparation * progress * sign * 0.4));
    }
    doc.dispatchEvent(new view.CustomEvent('h4:modeprogress', { detail: { amount: progress } }));
  }

  function refresh() {
    if (destroyed) return;
    for (const button of doc.querySelectorAll('[data-xray-toggle]')) button.setAttribute('aria-pressed', String(mode === 'xray'));
    for (const button of doc.querySelectorAll('[data-mode-hold]')) {
      button.setAttribute('aria-pressed', String(mode === 'xray'));
      button.setAttribute('aria-label', mode === 'xray' ? 'hold for one second to return to normal mode' : 'hold for one second to enter the other side');
      button.setAttribute('aria-keyshortcuts', mode === 'xray' ? '3' : '4');
    }
    for (const label of doc.querySelectorAll('[data-xray-hint-text]')) label.textContent = mode === 'xray' ? 'PRESS 3 THREE TIMES TO REVERSE.' : 'HOLD 4 TO SEE THE OTHER SIDE.';
    for (const button of doc.querySelectorAll('[data-mode-mute]')) {
      button.textContent = audio.muted ? 'sound off' : 'sound on';
      button.setAttribute('aria-pressed', String(audio.muted));
      button.disabled = !audio.supported;
      button.setAttribute('aria-label', audio.supported ? 'mute transition sounds' : 'transition sounds unavailable');
    }
  }

  function announce() {
    for (const status of doc.querySelectorAll('[data-mode-status]')) status.textContent = mode === 'xray' ? 'the other side is on. press 3 three times within two seconds to return. on touch, hold the instruction for one second.' : 'the other side is off.';
  }

  function finish(target) {
    view.cancelAnimationFrame(frame);
    treat(target);
    html.removeAttribute('data-xray-transition');
    frame = 0;
  }

  function applyMode(next, { captured = false, duration, variant } = {}) {
    if (destroyed) return;
    view.cancelAnimationFrame(frame);
    frame = 0;
    mode = next;
    pendingMode = null;
    if (mode === 'xray' && !overlay.style.backgroundImage) overlay.style.backgroundImage = 'url("/assets/xray-distress.webp")';
    const target = mode === 'xray' ? 1 : 0;
    html.dataset.mode = mode;
    refresh();
    announce();
    if (!doc.hidden) audio.play(mode);
    doc.dispatchEvent(new view.CustomEvent('h4:modechange', { detail: { mode, captured, duration, variant } }));
    const theme = doc.querySelector('meta[name="theme-color"]');
    if (theme) theme.content = mode === 'xray' ? xraySettings.palette.background : '#303033';
    if (captured) {
      // The browser captures a complete destination frame. Intermediate media
      // curves would bake an unfinished treatment into that destination bitmap.
      treat(target);
      html.dataset.xrayTransition = mode === 'xray' ? 'entering' : 'leaving';
      return;
    }
    if (reduced.matches || doc.hidden || html.dataset.xrayQuality === 'lite') { finish(target); return; }
    html.dataset.xrayTransition = mode === 'xray' ? 'entering' : 'leaving';
    const from = amount;
    const started = view.performance.now();
    let previousUpdate = -Infinity;
    const fallbackDuration = Math.max(1, xraySettings.transitionMs);
    const step = (now) => {
      if (destroyed) return;
      const progress = Math.min(1, Math.max(0, (now - started) / fallbackDuration));
      if (progress >= 1) { finish(target); return; }
      // This bounded transition is the only RAF work: no idle distortion loop.
      if (now - previousUpdate >= 1000 / xraySettings.transitionFramesPerSecond) {
        const smooth = progress * progress * (3 - 2 * progress);
        treat(from + (target - from) * smooth);
        previousUpdate = now;
      }
      frame = view.requestAnimationFrame(step);
    };
    frame = view.requestAnimationFrame(step);
  }

  function setMode(next) {
    if (destroyed || !['normal', 'xray'].includes(next) || next === (pendingMode || mode)) return;
    snapshot.skip();
    const request = ++generation;
    pendingMode = next;
    const transition = snapshot.run(detail => applyMode(next, detail), { mode: next });
    if (transition) void transition.finished.then(() => {
      if (!destroyed && request === generation) finish(mode === 'xray' ? 1 : 0);
    });
  }

  const toggle = () => setMode((pendingMode || mode) === 'xray' ? 'normal' : 'xray');
  const endHold = () => html.removeAttribute('data-mode-holding');
  const prepare = (event, hold = true) => {
    // Priming and preloading happen inside the original gesture, not its timer.
    void audio.prime(event).then(refresh);
    snapshot.prepare();
    if (hold) html.setAttribute('data-mode-holding', '');
    const source = event.type === 'keydown' ? 'keyboard' : event.type === 'click' ? 'accessible' : 'pointer';
    doc.dispatchEvent(new view.CustomEvent('h4:modeprepare', { detail: { source } }));
  };
  let stopPointer;
  const stopKeyboard = bindXRayShortcut(doc, () => setMode('xray'), {
    isEnabled: () => mode === 'normal',
    onStart(event) { stopPointer?.cancel(); prepare(event); }, onEnd: endHold,
  });
  const stopReverse = bindReverseShortcut(doc, () => setMode('normal'), {
    isEnabled: () => mode === 'xray',
    onStart(event) { stopPointer?.cancel(); prepare(event, false); },
  });
  stopPointer = bindModeHold(doc, toggle, {
    onStart(event) { stopKeyboard.cancel(); stopReverse.cancel(); prepare(event); }, onEnd: endHold,
  });
  removers.push(stopKeyboard, stopReverse, stopPointer);
  listen(doc, 'click', (event) => {
    const mute = event.target.closest?.('[data-mode-mute]');
    if (mute && !mute.disabled) {
      audio.setMuted(!audio.muted);
      if (!audio.muted) void audio.prime(event).then(refresh);
      refresh();
      return;
    }
    const button = event.target.closest?.('[data-xray-toggle]');
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    stopKeyboard.cancel();
    stopPointer.cancel();
    prepare(event);
    endHold();
    toggle();
  });
  listen(doc, 'h4:pagechange', refresh);
  listen(view, 'pageshow', refresh);
  listen(coarse, 'change', updateQuality);
  listen(reduced, 'change', () => {
    if (!reduced.matches) return;
    view.cancelAnimationFrame(frame);
    finish(mode === 'xray' ? 1 : 0);
  });
  listen(doc, 'visibilitychange', () => { if (doc.hidden) audio.stop(); });
  updateQuality();
  html.dataset.mode = 'normal';
  html.dataset.xrayReady = '';
  refresh();

  function dispose() {
    if (destroyed) return;
    destroyed = true;
    view.cancelAnimationFrame(frame);
    snapshot.dispose();
    audio.dispose();
    for (const remove of removers) remove();
    defs.remove();
    overlay.remove();
    for (const [name, value] of previousAttributes) {
      if (value === null) html.removeAttribute(name);
      else html.setAttribute(name, value);
    }
    for (const [name, value] of previousProperties) {
      if (value) html.style.setProperty(name, value);
      else html.style.removeProperty(name);
    }
    for (const button of doc.querySelectorAll('[data-xray-toggle]')) button.setAttribute('aria-pressed', 'false');
    for (const button of doc.querySelectorAll('[data-mode-hold]')) button.setAttribute('aria-pressed', 'false');
    for (const label of doc.querySelectorAll('[data-xray-hint-text]')) label.textContent = 'HOLD 4 TO SEE THE OTHER SIDE.';
    for (const status of doc.querySelectorAll('[data-mode-status]')) status.textContent = '';
    const theme = doc.querySelector('meta[name="theme-color"]');
    if (theme) theme.content = '#303033';
    controllers.delete(doc);
  }
  Object.assign(dispose, { setMode, toggle, refresh });
  controllers.set(doc, dispose);
  return dispose;
}
