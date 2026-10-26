import './other-side-playground.css';
import { playgroundSettings } from '../data/playgroundSettings.js';
import { livingDecayMaterialAssets, getLivingDecaySettings } from '../data/livingDecaySettings.js';
import { createLivingComposition, renderLivingMaterial, livingRandom } from '../living-decay-material.js';
import { createPlaygroundField } from './playground-field.js';

/** Import only behind import.meta.env.DEV && ?playground=1. No public effects,
 * global settings or hero scene are modified by this bounded experiment. */
export function initOtherSidePlayground({ doc = document, getController = () => null } = {}) {
  const view = doc.defaultView;
  if (!doc.body || !view) return () => {};
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const panel = doc.createElement('aside');
  panel.className = 'other-side-playground';
  panel.setAttribute('aria-label', 'The Other Side isolated experiment');
  for (const name of ['data-no-ink', 'data-no-mosh', 'data-corruption-protected']) panel.setAttribute(name, '');
  panel.innerHTML = `<header><h2>the other side / isolated experiment</h2><button type="button" data-playground-close aria-label="close experiment">×</button></header>
    <p>experimental feedback only inside this canvas. move, click, hover, scroll or use arrow keys. site effects are unchanged.</p>
    <div class="other-side-playground__surface"><canvas width="480" height="300" tabindex="0" role="img" aria-label="Experimental corrupted material; arrow keys move image fragments"></canvas></div>
    <label class="other-side-playground__seed">seed <input type="text" inputmode="numeric" value="${playgroundSettings.seed}" pattern="[0-9]+" maxlength="10" aria-label="reproducible experiment seed"></label>
    <div class="other-side-playground__actions"><button type="button" data-playground-start>start experiment</button><button type="button" data-playground-pause disabled>pause</button><button type="button" data-playground-reset disabled>reset this canvas</button><button type="button" data-playground-navigation disabled>test navigation impulse</button></div>
    <p data-playground-status role="status" aria-live="polite">not started. no material or renderer allocated.</p><output data-playground-metrics aria-label="bounded experiment measurements"></output>`;
  doc.body.append(panel);
  const canvas = panel.querySelector('canvas');
  const start = panel.querySelector('[data-playground-start]');
  const pause = panel.querySelector('[data-playground-pause]');
  const reset = panel.querySelector('[data-playground-reset]');
  const navigate = panel.querySelector('[data-playground-navigation]');
  const seedInput = panel.querySelector('input');
  const status = panel.querySelector('[data-playground-status]');
  const metrics = panel.querySelector('[data-playground-metrics]');
  const listeners = [];
  const drawMs = [];
  let context = null, history = null, historyContext = null, source = null, field = null;
  let disposed = false, running = false, inView = true, loading = false, generation = 0;
  let timer = 0, frame = 0, pendingPointer = null, ruptures = 0;
  let nextSample = 0, sourceRequests = 0, failure = '';

  const listen = (target, name, callback, options) => {
    target.addEventListener(name, callback, options);
    listeners.push(() => target.removeEventListener(name, callback, options));
  };
  const canRun = () => !disposed && running && inView && !doc.hidden && !reduced.matches && field;
  const stop = () => {
    view.clearTimeout(timer); view.cancelAnimationFrame(frame); timer = frame = 0;
    field?.suspend(); pendingPointer = null;
  };
  const snapshot = () => ({ started: Boolean(field), running: Boolean(canRun()), paused: !running,
    reducedMotion: reduced.matches, visible: inView && !doc.hidden, loading, sourceRequests,
    canvases: field ? 2 : 0, pendingPointers: pendingPointer ? 1 : 0, queued: Number(Boolean(timer || frame)),
    ruptures, drawMs: [...drawMs], experiment: field?.snapshot() || null,
    productionSeed: getController()?.snapshot?.()?.ambient?.seed ?? null });
  function inspect() {
    const current = snapshot();
    const memory = current.experiment?.memory;
    metrics.value = memory ? `seed ${current.experiment.seed} · ${memory.cells} cells · 2 fixed ${canvas.width}×${canvas.height} buffers\n${memory.accepted} impulses · ${memory.scarredCells} scarred cells · ${current.experiment.frames} frames\nlast paint ${drawMs.at(-1)?.toFixed(2) || '0.00'} ms · ${drawMs.length}/${playgroundSettings.samples} timing samples` : '';
    status.textContent = failure || (!field ? loading ? 'loading the existing material asset…' : 'not started. no material or renderer allocated.'
      : reduced.matches ? 'reduced motion: static experimental frame; automatic animation and input distortion paused.'
        : running ? 'running locally. damage accumulates into the previous rendered frame.' : 'paused. accumulated local damage is retained.');
  }
  function schedule() {
    if (!canRun() || timer || frame) return;
    timer = view.setTimeout(() => {
      timer = 0;
      if (canRun()) frame = view.requestAnimationFrame(draw);
    }, 1000 / playgroundSettings.framesPerSecond);
  }
  function draw(time) {
    frame = 0;
    if (!canRun()) return;
    const started = view.performance.now();
    if (pendingPointer) { field.pointer(pendingPointer); pendingPointer = null; }
    field.paint({ context, history, historyContext, time });
    drawMs.push(view.performance.now() - started);
    if (drawMs.length > playgroundSettings.samples) drawMs.shift();
    if (time >= nextSample) { nextSample = time + 1000; inspect(); }
    schedule();
  }
  function sync() { stop(); inspect(); schedule(); }
  function readSeed() {
    const text = seedInput.value.trim();
    const value = Number(text);
    const valid = /^\d+$/.test(text) && Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff;
    seedInput.setCustomValidity(valid ? '' : 'enter an integer from 0 to 4294967295.');
    if (!valid) { seedInput.reportValidity(); return null; }
    return value;
  }
  function restoreLocal(seed) {
    field?.dispose();
    const sample = doc.createElement('canvas');
    sample.width = 320; sample.height = 200;
    const sampleContext = sample.getContext('2d', { willReadFrequently: true });
    if (!sampleContext) throw new Error('2D canvas unavailable.');
    sampleContext.drawImage(source, 0, 0, sample.width, sample.height);
    const sourcePixels = sampleContext.getImageData(0, 0, sample.width, sample.height);
    const output = context.createImageData(canvas.width, canvas.height);
    const settings = getLivingDecaySettings();
    renderLivingMaterial({ source: sourcePixels.data, sourceWidth: sample.width, sourceHeight: sample.height,
      width: canvas.width, height: canvas.height, composition: createLivingComposition(seed, settings), settings, output: output.data });
    context.putImageData(output, 0, 0);
    historyContext.globalCompositeOperation = 'copy';
    historyContext.drawImage(canvas, 0, 0);
    historyContext.globalCompositeOperation = 'source-over';
    sample.width = sample.height = 1;
    field = createPlaygroundField({ seed, width: canvas.width, height: canvas.height });
    ruptures = 0; drawMs.length = 0; nextSample = 0; pendingPointer = null;
    inspect();
  }
  async function begin() {
    const seed = readSeed();
    if (seed === null || loading || disposed) return;
    loading = true; failure = ''; const request = ++generation;
    start.disabled = true; inspect();
    try {
      if (!source) {
        const image = new view.Image();
        image.src = livingDecayMaterialAssets.mobile;
        sourceRequests++;
        await image.decode();
        if (disposed || request !== generation) return;
        source = image;
      }
      if (!context) {
        context = canvas.getContext('2d', { alpha: false, desynchronized: true });
        history = doc.createElement('canvas'); history.width = canvas.width; history.height = canvas.height;
        historyContext = history.getContext('2d', { alpha: false });
      }
      if (!context || !historyContext) throw new Error('2D canvas unavailable.');
      restoreLocal(seed);
      running = true; pause.disabled = reset.disabled = navigate.disabled = false;
      start.textContent = 'restart with seed';
    } catch {
      failure = 'experiment unavailable. the website remains usable.';
    } finally {
      loading = false;
      if (!disposed) { start.disabled = false; sync(); }
    }
  }
  function point(event) {
    const box = canvas.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width * canvas.width,
      y: (event.clientY - box.top) / box.height * canvas.height, time: view.performance.now() };
  }
  function rupture(kind, point, strength = 1) {
    if (!canRun()) return;
    const seed = field.snapshot().seed;
    const angle = livingRandom(seed, ++ruptures + 900) * Math.PI * 2;
    field.impulse({ ...point, kind, dx: Math.cos(angle) * (50 + strength * 45),
      dy: Math.sin(angle) * (35 + strength * 30), strength, radius: 50 + livingRandom(seed, ruptures + 1200) * 115 });
    inspect();
  }
  listen(start, 'click', () => { void begin(); });
  listen(pause, 'click', () => { running = !running; pause.textContent = running ? 'pause' : 'resume'; sync(); });
  listen(reset, 'click', () => { const seed = readSeed(); if (seed !== null && source) { stop(); restoreLocal(seed); schedule(); } });
  listen(navigate, 'click', () => rupture('navigation', { x: canvas.width / 2, y: canvas.height / 2, time: view.performance.now() }, 2.5));
  listen(panel.querySelector('[data-playground-close]'), 'click', dispose);
  listen(canvas, 'pointermove', event => { if (canRun() && event.isPrimary !== false) pendingPointer = point(event); }, { passive: true });
  listen(canvas, 'pointerleave', () => { pendingPointer = null; field?.suspend(); }, { passive: true });
  listen(canvas, 'pointerenter', event => rupture('hover', point(event), .7), { passive: true });
  listen(canvas, 'click', event => rupture('click', point(event), 2));
  listen(canvas, 'wheel', event => {
    if (!canRun()) return;
    field.impulse({ ...point(event), kind: 'scroll', dx: event.deltaX * .35,
      dy: event.deltaY * .35, strength: 1.4, radius: 130 });
  }, { passive: true });
  listen(canvas, 'keydown', event => {
    if (!canRun() || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    field.impulse({ kind: 'keyboard', x: canvas.width / 2, y: canvas.height / 2,
      dx: event.key === 'ArrowLeft' ? -60 : event.key === 'ArrowRight' ? 60 : 0,
      dy: event.key === 'ArrowUp' ? -60 : event.key === 'ArrowDown' ? 60 : 0,
      strength: 1.8, radius: 200, time: view.performance.now() });
  });
  listen(doc, 'visibilitychange', sync);
  listen(reduced, 'change', sync);
  const observer = 'IntersectionObserver' in view ? new view.IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }) : null;
  observer?.observe(canvas);
  function dispose() {
    if (disposed) return;
    disposed = true; generation++; running = false;
    stop(); observer?.disconnect(); field?.dispose();
    for (const remove of listeners) remove();
    panel.remove(); canvas.width = canvas.height = 1;
    if (history) history.width = history.height = 1;
    context = historyContext = source = null; history = null; field = null; drawMs.length = 0;
  }
  return Object.assign(dispose, { snapshot });
}
