import './xray.css';
import { xraySettings, chooseXRayQuality, isXRayShortcut, solarizedChannels } from './data/xraySettings.js';

const controllers = new WeakMap();
const svgNamespace = 'http://www.w3.org/2000/svg';

// A single static exposure texture: coarse chemical blooms, broken scratches,
// dust and fine grain. It contains no source artwork and makes no requests.
const distressTexture = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="0 0 900 1100">
  <defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".71 .49" numOctaves="3" seed="19" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".62"/></feComponentTransfer></filter>
  <filter id="bloom"><feTurbulence type="fractalNoise" baseFrequency=".008 .013" numOctaves="2" seed="7" result="field"/><feDisplacementMap in="SourceGraphic" in2="field" scale="64" xChannelSelector="R" yChannelSelector="B"/><feGaussianBlur stdDeviation="12"/></filter></defs>
  <g filter="url(#bloom)"><path d="M-40 10 180-30 148 164 58 321 117 471-27 619Z" fill="#c9f144" opacity=".66"/><path d="m930 310-116 49-41 108 46 143-76 118 155 35Z" fill="#efa7c9" opacity=".58"/><path d="m388 837 102-63 92 46 87 201-32 119-140-9-70-173Z" fill="#8f51c4" opacity=".54"/></g>
  <rect width="900" height="1100" filter="url(#grain)" opacity=".54"/>
  <g fill="none" stroke="#f4e4dd" stroke-linecap="round" opacity=".48"><path d="m94 0-6 128 4 51-9 114m-1 12-4 88" stroke-width=".8"/><path d="m741 1094 3-96-6-80 2-47m2-18-1-88" stroke-width="1.1"/><path d="m548 82 3 98-5 99 4 26" stroke-width=".55"/><path d="m167 806 38-14 13-15m-34 49 54-30" stroke-width=".7"/></g>
  <g fill="#eaded8" opacity=".7"><path d="m256 149 4-2 1 7-3 3-3-2Z"/><path d="m641 617 5-2 2 4-6 2Z"/><path d="m454 996 3 1-2 8-3-2Z"/><path d="m72 760 5 2-2 4-5-1Z"/><path d="m809 76 3-2 4 4-3 3Z"/></g>
</svg>`;

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
  const previousAttributes = new Map(['data-mode', 'data-xray-quality', 'data-xray-ready', 'data-xray-transition'].map((name) => [name, html.getAttribute(name)]));
  const previousProperties = new Map();
  let mode = 'normal';
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
  overlay.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(distressTexture)}")`;
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
  property('--xray-grain', String(xraySettings.grainOpacity));
  property('--xray-lite-grain', String(xraySettings.liteGrainOpacity));

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
    const channels = solarizedChannels(progress);
    for (const node of channelNodes) node.setAttribute('tableValues', channels[node.dataset.xrayChannel].map((value) => value.toFixed(4)).join(' '));
    for (const node of saturationNodes) node.setAttribute('values', String(1 - (1 - xraySettings.saturation) * progress));
    for (const node of offsets) {
      const sign = node.dataset.xrayOffset === 'red' ? 1 : -0.7;
      node.setAttribute('dx', String(xraySettings.channelSeparation * progress * sign));
      node.setAttribute('dy', String(-xraySettings.channelSeparation * progress * sign * 0.4));
    }
  }

  function refresh() {
    if (destroyed) return;
    for (const button of doc.querySelectorAll('[data-xray-toggle]')) button.setAttribute('aria-pressed', String(mode === 'xray'));
  }

  function announce() {
    for (const status of doc.querySelectorAll('[data-mode-status]')) status.textContent = mode === 'xray' ? 'x-ray mode on. press 4 or activate the footer control to return.' : 'x-ray mode off.';
  }

  function finish(target) {
    treat(target);
    html.removeAttribute('data-xray-transition');
    frame = 0;
  }

  function setMode(next) {
    if (destroyed || !['normal', 'xray'].includes(next) || next === mode) return;
    view.cancelAnimationFrame(frame);
    frame = 0;
    mode = next;
    const target = mode === 'xray' ? 1 : 0;
    html.dataset.mode = mode;
    refresh();
    announce();
    doc.dispatchEvent(new view.CustomEvent('h4:modechange', { detail: { mode } }));
    const theme = doc.querySelector('meta[name="theme-color"]');
    if (theme) theme.content = mode === 'xray' ? xraySettings.palette.background : '#303033';
    if (reduced.matches || html.dataset.xrayQuality === 'lite') { finish(target); return; }
    html.dataset.xrayTransition = mode === 'xray' ? 'entering' : 'leaving';
    const from = amount;
    const started = view.performance.now();
    let previousUpdate = -Infinity;
    const duration = Math.max(1, xraySettings.transitionMs);
    const step = (now) => {
      if (destroyed) return;
      const progress = Math.min(1, Math.max(0, (now - started) / duration));
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

  const toggle = () => setMode(mode === 'xray' ? 'normal' : 'xray');
  listen(doc, 'keydown', (event) => {
    if (!isXRayShortcut(event, doc.activeElement)) return;
    event.preventDefault();
    toggle();
  });
  listen(doc, 'click', (event) => {
    const button = event.target.closest?.('[data-xray-toggle]');
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
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
  updateQuality();
  html.dataset.mode = 'normal';
  html.dataset.xrayReady = '';
  refresh();

  function dispose() {
    if (destroyed) return;
    destroyed = true;
    view.cancelAnimationFrame(frame);
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
    const theme = doc.querySelector('meta[name="theme-color"]');
    if (theme) theme.content = '#303033';
    controllers.delete(doc);
  }
  Object.assign(dispose, { setMode, toggle, refresh });
  controllers.set(doc, dispose);
  return dispose;
}
