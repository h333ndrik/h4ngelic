import './mode-snapshot.css';

const svgNS = 'http://www.w3.org/2000/svg';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;
const defaults = Object.freeze({
  minimumDurationMs: 1400, maximumDurationMs: 1400,
  framesPerSecond: 20, displacementPx: 180, smearPx: 220,
  channelOffsetPx: 9, colorStrength: .86, columns: 18, rows: 12,
});
// Mode and interaction controllers share the one native document capture. A
// superseded controller may release its own graph, never another owner's attrs.
const owners = new WeakMap();
const visualSelector = '.interaction-visual, .category-magnet, img';
const controlSelector = 'a, button, input, select, textarea, [role="button"]';
let serial = 0;

function parameters(settings) {
  const finite = (name, minimum, maximum) => clamp(Number.isFinite(settings[name]) ? settings[name] : defaults[name], minimum, maximum);
  const result = {
    minimumDurationMs: finite('minimumDurationMs', 750, 1600),
    maximumDurationMs: finite('maximumDurationMs', 750, 1600),
    framesPerSecond: finite('framesPerSecond', 1, 30),
    displacementPx: finite('displacementPx', 0, 320),
    smearPx: finite('smearPx', 0, 420),
    channelOffsetPx: finite('channelOffsetPx', 0, 24),
    colorStrength: finite('colorStrength', 0, 1),
    columns: Math.round(finite('columns', 2, 32)),
    rows: Math.round(finite('rows', 2, 24)),
  };
  result.maximumDurationMs = Math.max(result.minimumDurationMs, result.maximumDurationMs);
  return result;
}

function randomSequence(seed) {
  let value = seed >>> 0 || 1;
  return () => {
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

function scopedRect(rect, width, height) {
  if (!rect) return null;
  const x = Number(rect.left ?? rect.x);
  const y = Number(rect.top ?? rect.y);
  const w = Number(rect.width ?? Number(rect.right) - x);
  const h = Number(rect.height ?? Number(rect.bottom) - y);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  const left = clamp(x, 0, width);
  const top = clamp(y, 0, height);
  const right = clamp(x + w, 0, width);
  const bottom = clamp(y + h, 0, height);
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
}

/** Filter a visual descendant, never the actionable control that owns it.
 * Local effects use live SourceGraphic pixels and never suspend hit-testing.
 */
function findLocalVisual(target, element, doc) {
  if (!target || target.nodeType !== 1 || target.isConnected === false) return null;
  const visual = element?.isConnected !== false && element && target.contains?.(element)
    ? element : target.querySelector?.(visualSelector);
  if (!visual || visual === target || visual === doc.documentElement || visual === doc.body
    || visual.nodeType !== 1 || visual.isConnected === false || visual.matches?.(controlSelector)
    || visual.querySelector?.(controlSelector)) return null;
  return visual;
}

const svgURL = markup => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
function regionMask(width, height, rect) {
  const area = rect || { left: 0, top: 0, width, height };
  return svgURL(`<svg xmlns="${svgNS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="${area.left}" y="${area.top}" width="${area.width}" height="${area.height}" fill="white"/></svg>`);
}

/** An invisible UV field. Its rectangles sample captured page pixels; they are
 * never painted as decoration. Stable cells carry old image information across
 * phases while their sampling offsets advance, stretch and eventually recover.
 */
function displacementMap(width, height, seed, phase, settings, mobile, kind, rect, direction) {
  const random = randomSequence(seed);
  const local = kind === 'hover' || kind === 'click';
  const area = rect || { left: 0, top: 0, width, height };
  const columns = local ? Math.max(3, Math.min(8, Math.ceil(area.width / 42)))
    : Math.max(4, Math.round(settings.columns * (mobile ? .5 : .7)));
  const rows = local ? Math.max(2, Math.min(6, Math.ceil(area.height / 32)))
    : Math.max(4, Math.round(settings.rows * (mobile ? .5 : .7)));
  const cellWidth = area.width / columns;
  const cellHeight = area.height / rows;
  const scale = Math.max(1, settings.displacementPx * (mobile ? .65 : 1));
  const reversing = direction === 'leaving';
  const probability = reversing ? [.99, .98, .87, .7, .48, .18][phase] : [.48, .76, .96, 1, .9, .58][phase];
  const travel = reversing ? [.82, 1, .86, .63, .36, .12][phase] : [.22, .55, .88, 1, .84, .4][phase];
  const rectangles = [];
  const gradients = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const chance = random();
      const sign = (random() > .5 ? 1 : -1) * (reversing ? -1 : 1);
      const offset = sign * scale * (.12 + random() * .34) * travel;
      const vertical = .5 + (random() - .5) * .3 * travel;
      const smear = random() > .4;
      const span = local ? 1.4 + random() * 2.6 : 2.1 + random() * 3.8;
      const tall = random() > .76;
      // Stable cells recover at different phases. Their held source regions
      // survive together instead of becoming newly randomized every frame.
      const recovery = random();
      if (chance > probability || reversing && phase > 1 && recovery < (phase - 1) * .13) continue;
      const x = area.left + column * cellWidth;
      const y = area.top + row * cellHeight;
      const blockWidth = Math.min(area.left + area.width - x, smear ? Math.min(settings.smearPx * 1.35, cellWidth * span) : cellWidth + .5);
      const blockHeight = Math.min(area.top + area.height - y, cellHeight * (tall ? 2 : 1) + .5);
      const red = clamp(.5 + offset / scale, .04, .96);
      const green = Math.round(vertical * 255);
      let fill = `rgb(${Math.round(red * 255)},${green},128)`;
      if (smear) {
        const id = `s${row}-${column}`;
        const delta = Math.min(.88, blockWidth / scale);
        const start = Math.round(clamp(red + delta / 2, .02, .98) * 255);
        const end = Math.round(clamp(red - delta / 2, .02, .98) * 255);
        gradients.push(`<linearGradient id="${id}"><stop stop-color="rgb(${start},${green},128)"/><stop offset="1" stop-color="rgb(${end},${green},128)"/></linearGradient>`);
        fill = `url(#${id})`;
      }
      rectangles.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${blockWidth.toFixed(2)}" height="${blockHeight.toFixed(2)}" fill="${fill}"/>`);
    }
  }
  return svgURL(`<svg xmlns="${svgNS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs>${gradients.join('')}</defs><path d="M0 0H${width}V${height}H0Z" fill="rgb(128,128,128)"/>${rectangles.join('')}</svg>`);
}

function filterMarkup(id) {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" data-snapshot-map result="uv-current"/>
    <feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" data-snapshot-next-map result="uv-next"/>
    <feComposite in="uv-current" in2="uv-next" operator="arithmetic" k1="0" k2="1" k3="0" k4="0" data-snapshot-map-blend result="uv"/>
    <feDisplacementMap in="SourceGraphic" in2="uv" scale="0" xChannelSelector="R" yChannelSelector="G" result="broken" data-snapshot-displacement/>
    <feOffset in="broken" dx="0" dy="0" data-snapshot-advection result="history"/>
    <feOffset in="history" dx="0" dy="0" data-snapshot-echo result="held-frame"/>
    <feComposite in="history" in2="held-frame" operator="arithmetic" k1="0" k2="1" k3="0" k4="0" data-snapshot-feedback result="carried-frame"/>
    <feComponentTransfer in="carried-frame" result="chemical">
      <feFuncR type="table" tableValues="0 .125 .25 .375 .5 .625 .75 .875 1" data-snapshot-channel="0"/>
      <feFuncG type="table" tableValues="0 .125 .25 .375 .5 .625 .75 .875 1" data-snapshot-channel="1"/>
      <feFuncB type="table" tableValues="0 .125 .25 .375 .5 .625 .75 .875 1" data-snapshot-channel="2"/>
    </feComponentTransfer>
    <feColorMatrix in="chemical" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
    <feOffset in="red" dx="0" dy="0" result="red-shift" data-snapshot-offset="1"/>
    <feColorMatrix in="chemical" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>
    <feOffset in="green" dx="0" dy="0" result="green-shift" data-snapshot-offset="-0.7"/>
    <feColorMatrix in="chemical" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>
    <feBlend in="red-shift" in2="green-shift" mode="screen" result="red-green"/>
    <feBlend in="red-green" in2="blue" mode="screen" result="damaged"/>
    <feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" data-snapshot-mask result="scope"/>
    <feComposite in="damaged" in2="scope" operator="in" result="inside"/>
    <feComposite in="SourceGraphic" in2="scope" operator="out" result="outside"/>
    <feMerge><feMergeNode in="outside"/><feMergeNode in="inside"/></feMerge>
  </filter>`;
}

/** Mode/navigation sample native page images, including dialogs. Local gestures
 * sample only their live inner visual through the same SVG graph, preserving
 * real input during every frame. JavaScript receives no bitmap pixels. Updates
 * run exactly once and their asynchronous result remains independently awaited.
 */
export function createModeSnapshotTransition({ doc = document, settings = {} } = {}) {
  const view = doc.defaultView;
  const html = doc.documentElement;
  const config = parameters(settings);
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = view.matchMedia('(pointer: coarse)');
  const uid = `h4-mode-snapshot-${++serial}`;
  const properties = ['--mode-snapshot-duration', '--mode-snapshot-old-filter', '--mode-snapshot-new-filter'];
  const attributes = ['data-mode-snapshot', 'data-mode-snapshot-variant', 'data-mode-snapshot-frame', 'data-mosh-kind'];
  const listeners = [];
  let definitions = null;
  let filters = [];
  let prepared = null;
  let active = null;
  let disposed = false;
  let nativeCount = 0;
  let last = null;
  const supported = (kind = 'mode') => !disposed && !doc.hidden && !reduced.matches
    && (localKind(kind) || typeof doc.startViewTransition === 'function');
  const listen = (target, name, handler, options) => { target.addEventListener(name, handler, options); listeners.push(() => target.removeEventListener(name, handler, options)); };
  const localKind = kind => kind === 'hover' || kind === 'click';
  const nativeBusy = () => Boolean(owners.get(doc) || doc.activeViewTransition || doc.getAnimations?.().some(animation => animation.effect?.pseudoElement?.startsWith('::view-transition-')));

  function prepare({ variant, kind = 'mode', mode, rect, region, target, element, replacingHover = false } = {}) {
    if (!supported(kind) || localKind(kind) && !replacingHover && nativeBusy()) return null;
    const local = localKind(kind);
    const parent = target || element?.parentElement;
    const visual = local ? findLocalVisual(parent, element, doc) : null;
    if (local && !visual) return null;
    // The inner visual supplies its own live SourceGraphic. Its UV/mask origin
    // is local, rather than the viewport coordinates of the actionable parent.
    const bounds = visual?.getBoundingClientRect();
    if (local && (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)
      || bounds.width <= 0 || bounds.height <= 0)) return null;
    const width = local ? bounds.width : Math.max(1, view.innerWidth);
    const height = local ? bounds.height : Math.max(1, view.innerHeight);
    const scope = local ? scopedRect({ left: 0, top: 0, width, height }, width, height) : null;
    const direction = kind === 'mode' && mode === 'normal' ? 'leaving' : kind === 'mode' ? 'entering' : 'forward';
    const scopeKey = JSON.stringify([scope, direction]);
    if (prepared?.width === width && prepared.height === height && prepared.kind === kind && prepared.scopeKey === scopeKey && prepared.visual === visual
      && (!Number.isFinite(variant) || prepared.seed === variant >>> 0)) return prepared;
    if (!definitions) {
      definitions = doc.createElementNS(svgNS, 'svg');
      definitions.setAttribute('aria-hidden', 'true');
      definitions.setAttribute('focusable', 'false');
      definitions.classList.add('mode-snapshot-definitions');
      definitions.innerHTML = `<defs>${filterMarkup(`${uid}-old`)}${filterMarkup(`${uid}-new`)}</defs>`;
      doc.body.append(definitions);
      filters = [...definitions.querySelectorAll('filter')].map(element => ({
        map: element.querySelector('[data-snapshot-map]'),
        nextMap: element.querySelector('[data-snapshot-next-map]'),
        mapBlend: element.querySelector('[data-snapshot-map-blend]'),
        mask: element.querySelector('[data-snapshot-mask]'),
        advection: element.querySelector('[data-snapshot-advection]'),
        echo: element.querySelector('[data-snapshot-echo]'),
        feedback: element.querySelector('[data-snapshot-feedback]'),
        displacement: element.querySelector('[data-snapshot-displacement]'),
        channels: [...element.querySelectorAll('[data-snapshot-channel]')],
        offsets: [...element.querySelectorAll('[data-snapshot-offset]')],
      }));
    }
    const seed = Number.isFinite(variant) ? variant >>> 0
      : view.crypto?.getRandomValues ? view.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967296);
    const mobile = coarse.matches || view.navigator.deviceMemory > 0 && view.navigator.deviceMemory <= 4
      || view.navigator.hardwareConcurrency > 0 && view.navigator.hardwareConcurrency <= 4 || view.navigator.connection?.saveData;
    const maps = Array.from({ length: 6 }, (_, phase) => displacementMap(width, height, seed, phase, config, mobile, kind, scope, direction));
    const mask = regionMask(width, height, scope);
    // Discovery may predecode the next capture while this graph still belongs
    // to an active one. Leave that capture's sampling and mask intact.
    if (!active) for (const filter of filters) {
      filter.map.setAttribute('href', maps[0]); filter.nextMap.setAttribute('href', maps[0]); filter.mask.setAttribute('href', mask);
    }
    const decodes = [];
    for (const src of [...maps, mask]) {
      const image = new view.Image(); image.src = src;
      if (image.decode) decodes.push(image.decode().catch(() => {}));
    }
    prepared = { width, height, seed, maps, mask, ready: Promise.all(decodes), mobile, kind, direction, scopeKey, rect: scope, visual, target: parent };
    return prepared;
  }

  function end(record) {
    if (record.cleaned) return;
    record.cleaned = true;
    view.cancelAnimationFrame(record.frame);
    view.clearTimeout(record.timeout);
    if (active !== record) return;
    active = null;
    if (owners.get(doc)?.record === record) {
      owners.delete(doc);
      for (const [name, value] of record.previousAttributes) {
        if (value === null) html.removeAttribute(name); else html.setAttribute(name, value);
      }
      for (const [name, value, priority] of record.previousProperties) {
        if (value) html.style.setProperty(name, value, priority); else html.style.removeProperty(name);
      }
    }
    if (record.previousFilter) {
      const [value, priority] = record.previousFilter;
      if (value) record.visual.style.setProperty('filter', value, priority);
      else record.visual.style.removeProperty('filter');
    }
    // Release every decoded UV/mask dependency and all retained filter state.
    for (const filter of filters) {
      filter.map.removeAttribute('href'); filter.nextMap.removeAttribute('href'); filter.mask.removeAttribute('href');
      filter.mapBlend.setAttribute('k2', '1'); filter.mapBlend.setAttribute('k3', '0');
      filter.displacement.setAttribute('scale', '0');
      for (const offset of [...filter.offsets, filter.advection, filter.echo]) {
        offset.setAttribute('dx', '0'); offset.setAttribute('dy', '0');
      }
      filter.feedback.setAttribute('k2', '1'); filter.feedback.setAttribute('k3', '0');
      for (const channel of filter.channels) channel.setAttribute('tableValues', '0 .125 .25 .375 .5 .625 .75 .875 1');
    }
    last = { kind: record.kind, strength: record.strength, variant: record.variant, duration: record.duration, frames: record.frames, native: record.native, skipped: record.skipped };
    record.resolveFinished?.();
  }

  function skip() {
    const record = active;
    if (!record) return;
    record.skipped = true;
    // Commit immediately even when a native callback has not run yet. Returning
    // the same pending promise when it does run keeps asynchronous renders inside
    // updateCallbackDone, rather than capturing an unfinished route.
    try { Promise.resolve(record.commit(false)).catch(() => {}); } catch { /* Native callback reports the same failure. */ }
    try { record.transition?.skipTransition(); } catch { /* Already finished. */ }
    end(record);
  }

  function run(update, { mode, duration, variant, kind = 'mode', strength = 1, rect, region, target, element, dx, dy } = {}) {
    kind = ['mode', 'hover', 'click', 'navigation'].includes(kind) ? kind : 'mode';
    let committed = false;
    let result;
    let failed = false;
    let failure;
    let detail = {};
    const commit = captured => {
      if (committed) { if (failed) throw failure; return result; }
      committed = true;
      try { result = update({ captured, ...detail }); return result; }
      catch (error) { failed = true; failure = error; throw error; }
    };
    const supersedesHover = kind === 'click' && owners.get(doc)?.record.kind === 'hover';
    if (supersedesHover) owners.get(doc).skip();
    if (localKind(kind) && !supersedesHover && nativeBusy()) { commit(false); return null; }
    if (!localKind(kind)) owners.get(doc)?.skip();
    else skip();
    if (!supported(kind)) { commit(false); return null; }
    const plan = prepare({ variant, kind, mode, rect, region, target, element, replacingHover: supersedesHover });
    if (!plan) { commit(false); return null; }
    // Superseding a capture releases its hrefs. Cached plans must rebind both
    // dependencies too, including a rapid mode reversal or hover-to-click.
    for (const filter of filters) {
      filter.map.setAttribute('href', plan.maps[0]); filter.nextMap.setAttribute('href', plan.maps[0]); filter.mask.setAttribute('href', plan.mask);
    }
    prepared = null;
    const seed = Number.isFinite(variant) ? variant >>> 0 : plan.seed;
    const random = randomSequence(seed);
    const local = localKind(kind);
    const length = local ? clamp(Number.isFinite(duration) ? duration : kind === 'hover' ? 300 : 400, 240, 480)
      : kind === 'navigation' ? clamp(Number.isFinite(duration) ? duration : 340, 250, 450)
        : clamp(Number.isFinite(duration) ? duration : mix(config.minimumDurationMs, config.maximumDurationMs, random()), 750, 1600);
    const amount = clamp(Number.isFinite(strength) ? strength : 1, 0, 1);
    detail = { duration: length, variant: seed, kind, strength: amount };
    const entering = kind !== 'mode' || mode === 'xray';
    const record = {
      commit, kind, strength: amount, variant: seed, duration: length, frames: 0, frame: 0, timeout: 0,
      transition: null, cleaned: false, skipped: false, native: !local,
      visual: plan.visual, target: plan.target, previousFilter: local ? [
        plan.visual.style.getPropertyValue('filter'), plan.visual.style.getPropertyPriority?.('filter') || '',
      ] : null,
      previousAttributes: attributes.map(name => [name, html.getAttribute(name)]),
      previousProperties: properties.map(name => [name, html.style.getPropertyValue(name), html.style.getPropertyPriority?.(name) || '']),
    };
    active = record;
    owners.set(doc, { record, skip });
    html.dataset.modeSnapshot = entering ? 'entering' : 'leaving';
    html.dataset.moshKind = kind;
    html.dataset.modeSnapshotVariant = String(seed);
    html.dataset.modeSnapshotFrame = '0';
    html.style.setProperty('--mode-snapshot-duration', `${length}ms`);
    html.style.setProperty('--mode-snapshot-old-filter', `url("#${uid}-old")`);
    html.style.setProperty('--mode-snapshot-new-filter', `url("#${uid}-new")`);
    const tones = [
      [.03, .67, .96, .15, .91, .2, .69, 1, 1],
      [.02, .04, .17, .91, .99, .23, .88, .98, 1],
      [.2, .98, .78, .95, .13, .89, .32, 1, 1],
    ];
    const tintRotation = random() > .57 ? 1 : 0;
    const travelX = clamp(Number.isFinite(dx) ? dx : kind === 'mode' ? (entering ? 110 : -90) : kind === 'navigation' ? 76 : 24, -180, 180);
    const travelY = clamp(Number.isFinite(dy) ? dy : kind === 'mode' ? (entering ? 14 : -11) : 5, -60, 60);
    let previousPhase = -1;
    function render(progress) {
      // Mode maps retain the same seeded cells while their UVs flow between
      // phases. Local gestures retain their short established block rhythm.
      const position = progress * (kind === 'mode' ? plan.maps.length - 1 : plan.maps.length);
      const phase = Math.min(plan.maps.length - 1, Math.floor(position));
      const fraction = kind === 'mode' ? position - phase : 0;
      const mapMix = fraction * fraction * (3 - 2 * fraction);
      const envelope = entering ? progress < .13 ? progress / .13 : progress > .72 ? (1 - progress) / .28 : 1
        : progress < .08 ? .65 + progress / .08 * .35 : Math.pow(1 - progress, .58);
      // Broad, non-strobing bursts ride the continuous displacement. Reverse
      // reconstruction has its own rhythm rather than replaying entry backward.
      const burst = Math.exp(-Math.pow((progress - (entering ? .43 : .23)) / .11, 2));
      const pulse = kind === 'mode' ? 1 + .08 * burst : .94 + .06 * Math.sin(progress * Math.PI * (entering ? 2 : 1));
      const gain = clamp(envelope * pulse, 0, 1) * amount;
      const displacement = config.displacementPx * (plan.mobile ? .65 : 1) * (kind === 'mode' ? 1.85 : local ? .65 : .9);
      const drift = Math.sin(progress * Math.PI) * (.35 + .65 * progress) * amount;
      for (let index = 0; index < filters.length; index++) {
        const filter = filters[index];
        if (phase !== previousPhase) {
          const mapIndex = Math.min(plan.maps.length - 1, phase + (index && !entering ? 1 : 0));
          filter.map.setAttribute('href', plan.maps[mapIndex]);
          filter.nextMap.setAttribute('href', plan.maps[Math.min(plan.maps.length - 1, mapIndex + 1)]);
        }
        filter.mapBlend.setAttribute('k2', String(1 - mapMix));
        filter.mapBlend.setAttribute('k3', String(mapMix));
        const imageGain = index ? gain * (entering ? .58 : .68) : gain;
        filter.displacement.setAttribute('scale', String(displacement * imageGain * (index ? -.83 : 1)));
        filter.advection.setAttribute('dx', String(travelX * drift * (index ? -.28 : 1)));
        filter.advection.setAttribute('dy', String(travelY * drift * (index ? -.28 : 1)));
        // The retained outgoing page and incoming page carry differently
        // displaced copies of their own real pixels. Weighted arithmetic keeps
        // brightness unchanged; this adds frame drag, never a white/glow layer.
        const echo = kind === 'mode' ? imageGain * (index ? .22 : .34) : 0;
        filter.echo.setAttribute('dx', String(travelX * drift * (index ? -.62 : .54)));
        filter.echo.setAttribute('dy', String(travelY * drift * (entering ? .38 : -.64)));
        filter.feedback.setAttribute('k2', String(1 - echo));
        filter.feedback.setAttribute('k3', String(echo));
        for (const offset of filter.offsets) {
          const sign = Number(offset.dataset.snapshotOffset) * (entering ? 1 : -1);
          offset.setAttribute('dx', String(config.channelOffsetPx * imageGain * sign * (kind === 'mode' ? 1.6 : 1)));
          offset.setAttribute('dy', String(config.channelOffsetPx * imageGain * sign * .23));
        }
        filter.channels.forEach((node, channel) => node.setAttribute('tableValues', tones[(channel + tintRotation) % 3]
          .map((value, sample) => mix(sample / 8, value, imageGain * config.colorStrength).toFixed(4)).join(' ')));
      }
      previousPhase = phase;
      html.dataset.modeSnapshotFrame = String(++record.frames);
    }
    render(0);
    const skipRecord = () => { if (active === record) skip(); };
    if (local) {
      // A native transition freezes document hit-testing before its ready
      // promise, even when only a child is named. Keep local input entirely in
      // the live DOM; the bounded SVG graph still samples actual visual pixels.
      const finished = new Promise(resolve => { record.resolveFinished = resolve; });
      let updateCallbackDone;
      try { updateCallbackDone = Promise.resolve(commit(false)); }
      catch (error) { end(record); throw error; }
      updateCallbackDone.catch(() => end(record));
      const ready = Promise.all([plan.ready, updateCallbackDone]).then(() => {
        if (active !== record || record.cleaned) return;
        if (record.visual.isConnected === false) { end(record); return; }
        const computed = view.getComputedStyle?.(record.visual);
        const original = computed?.filter && computed.filter !== 'none' ? computed.filter : '';
        const activeGlow = record.target?.matches?.(':hover, :focus-visible')
          && computed?.getPropertyValue?.('--ui-hover-glow').trim();
        // Keep the existing strong hover glow. Filtering only the inner visual
        // preserves stable hit targets; original inline priority is restored.
        const finish = activeGlow ? 'var(--ui-hover-glow)' : original;
        record.visual.style.setProperty('filter', `url("#${uid}-old")${finish ? ` ${finish}` : ''}`, 'important');
        const started = view.performance.now();
        let painted = -Infinity;
        const frame = now => {
          record.frame = 0;
          if (active !== record || record.cleaned) return;
          if (record.visual.isConnected === false || doc.hidden || reduced.matches) { end(record); return; }
          const progress = clamp((now - started) / length, 0, 1);
          if (now - painted >= 1000 / config.framesPerSecond || progress === 1) { render(progress); painted = now; }
          if (progress < 1) record.frame = view.requestAnimationFrame(frame);
          else end(record);
        };
        record.frame = view.requestAnimationFrame(frame);
      }, () => end(record));
      record.timeout = view.setTimeout(skipRecord, length + 120);
      return { native: false, variant: seed, duration: length, finished, ready, updateCallbackDone,
        skip: skipRecord, skipTransition: skipRecord };
    }
    try { record.transition = doc.startViewTransition(() => commit(true)); }
    catch { end(record); commit(false); return null; }
    nativeCount++;
    const EventConstructor = view.CustomEvent || globalThis.CustomEvent;
    if (typeof EventConstructor === 'function') doc.dispatchEvent(new EventConstructor('h4:transitionintent', { detail: {
      kind, mode, duration: length, direction: plan.direction, strength: amount, variant: seed,
      x: plan.width / 2, y: plan.height / 2,
    } }));
    record.transition.ready.then(() => {
      if (active !== record || record.cleaned) return;
      const started = view.performance.now();
      const nativeAnimation = doc.getAnimations?.().find(animation => animation.effect?.pseudoElement === '::view-transition-new(root)');
      let painted = -Infinity;
      let lastProgress = -1;
      const frame = now => {
        record.frame = 0;
        if (active !== record || record.cleaned) return;
        const clock = Number.isFinite(nativeAnimation?.currentTime) ? nativeAnimation.currentTime : now - started;
        const progress = clamp(clock / length, 0, 1);
        if ((now - painted >= 1000 / config.framesPerSecond || progress === 1) && progress !== lastProgress) {
          render(progress); painted = now; lastProgress = progress;
        }
        if (progress < 1) record.frame = view.requestAnimationFrame(frame);
      };
      record.frame = view.requestAnimationFrame(frame);
    }, () => end(record));
    const finished = record.transition.finished.then(() => end(record), () => end(record));
    record.transition.updateCallbackDone.catch(() => end(record));
    record.timeout = view.setTimeout(() => { if (active === record) skip(); }, length + 1600);
    return { native: true, variant: seed, duration: length, finished, ready: record.transition.ready,
      updateCallbackDone: record.transition.updateCallbackDone, skip: skipRecord, skipTransition: skipRecord };
  }

  const skipInteraction = () => { if (active && localKind(active.kind)) skip(); };
  listen(doc, 'h4:navigationstart', skip);
  listen(doc, 'h4:modechange', skipInteraction);
  listen(view, 'scroll', skipInteraction, { passive: true });
  listen(doc, 'visibilitychange', () => { if (doc.hidden) skip(); });
  listen(view, 'blur', skip);
  listen(view, 'resize', () => { skip(); prepared = null; });
  listen(reduced, 'change', () => { if (reduced.matches) skip(); });
  return {
    prepare, run, skip,
    snapshot: () => ({ active: Boolean(active), prepared: Boolean(prepared), nativeCount,
      current: active ? { kind: active.kind, strength: active.strength, variant: active.variant, duration: active.duration, frames: active.frames, native: active.native } : null, last }),
    dispose() { skip(); disposed = true; for (const remove of listeners) remove(); definitions?.remove(); prepared = null; filters = []; },
  };
}
