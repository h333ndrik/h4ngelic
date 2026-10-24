import './mode-snapshot.css';

const svgNS = 'http://www.w3.org/2000/svg';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;
const defaults = Object.freeze({
  minimumDurationMs: 720, maximumDurationMs: 920,
  framesPerSecond: 20, displacementPx: 180, smearPx: 220,
  channelOffsetPx: 9, colorStrength: .86, columns: 18, rows: 12,
});
let serial = 0;

function parameters(settings) {
  const finite = (name, minimum, maximum) => clamp(Number.isFinite(settings[name]) ? settings[name] : defaults[name], minimum, maximum);
  const result = {
    minimumDurationMs: finite('minimumDurationMs', 600, 1000),
    maximumDurationMs: finite('maximumDurationMs', 600, 1000),
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

/** An invisible UV field, not decorative rectangles. Constant cells displace
 * real screenshot pixels; selected gradient cells cancel source x movement,
 * stretching retained image columns into codec-like horizontal streaks.
 */
function displacementMap(width, height, seed, phase, settings, mobile) {
  const random = randomSequence(seed + phase * 739391);
  const columns = mobile ? Math.max(8, Math.round(settings.columns * .65)) : settings.columns;
  const rows = mobile ? Math.max(6, Math.round(settings.rows * .7)) : settings.rows;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  // A zero-strength preset still needs a finite invisible UV map. The actual
  // filter scale remains zero, so the source image receives no displacement.
  const scale = Math.max(1, settings.displacementPx * (mobile ? .65 : 1));
  const probability = [.3, .68, .92, .6][phase];
  const rectangles = [];
  const gradients = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const chance = random();
      const direction = random() > .5 ? 1 : -1;
      const offset = direction * scale * (.08 + random() * .34);
      const vertical = .5 + (random() - .5) * .26;
      const smear = random() > .59;
      if (chance > probability) continue;
      const x = column * cellWidth;
      const y = row * cellHeight;
      const blockWidth = Math.min(width - x, smear ? Math.min(settings.smearPx, cellWidth * (1.4 + random() * 1.7)) : cellWidth + .5);
      const blockHeight = Math.min(height - y, cellHeight * (random() > .82 ? 2 : 1) + .5);
      const red = clamp(.5 + offset / scale, .04, .96);
      const green = Math.round(vertical * 255);
      let fill = `rgb(${Math.round(red * 255)},${green},128)`;
      if (smear) {
        const id = `s${row}-${column}`;
        const delta = Math.min(.84, blockWidth / scale);
        const start = Math.round(clamp(red + delta / 2, .02, .98) * 255);
        const end = Math.round(clamp(red - delta / 2, .02, .98) * 255);
        gradients.push(`<linearGradient id="${id}"><stop stop-color="rgb(${start},${green},128)"/><stop offset="1" stop-color="rgb(${end},${green},128)"/></linearGradient>`);
        fill = `url(#${id})`;
      }
      rectangles.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${blockWidth.toFixed(2)}" height="${blockHeight.toFixed(2)}" fill="${fill}"/>`);
    }
  }
  const markup = `<svg xmlns="${svgNS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs>${gradients.join('')}</defs><path d="M0 0H${width}V${height}H0Z" fill="rgb(128,128,128)"/>${rectangles.join('')}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function filterMarkup(id) {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" data-snapshot-map result="uv"/>
    <feDisplacementMap in="SourceGraphic" in2="uv" scale="0" xChannelSelector="R" yChannelSelector="G" result="broken" data-snapshot-displacement/>
    <feComponentTransfer in="broken" result="chemical">
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
    <feBlend in="red-green" in2="blue" mode="screen"/>
  </filter>`;
}

/** Captures the actual rendered page through the native View Transition API.
 * The supplied update runs exactly once. It receives captured:false during a
 * synchronous accessibility/unsupported fallback, captured:true inside a native
 * snapshot update. Only captured pseudo-images pass through the pixel graph.
 */
export function createModeSnapshotTransition({ doc = document, settings = {} } = {}) {
  const view = doc.defaultView;
  const html = doc.documentElement;
  const config = parameters(settings);
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = view.matchMedia('(pointer: coarse)');
  const uid = `h4-mode-snapshot-${++serial}`;
  const properties = ['--mode-snapshot-duration', '--mode-snapshot-old-filter', '--mode-snapshot-new-filter'];
  const attributes = ['data-mode-snapshot', 'data-mode-snapshot-variant', 'data-mode-snapshot-frame'];
  const listeners = [];
  let definitions = null;
  let filters = [];
  let prepared = null;
  let active = null;
  let disposed = false;
  let nativeCount = 0;
  let last = null;
  const supported = () => !disposed && !doc.hidden && !reduced.matches && typeof doc.startViewTransition === 'function';
  const listen = (target, name, handler) => { target.addEventListener(name, handler); listeners.push(() => target.removeEventListener(name, handler)); };

  function prepare({ variant } = {}) {
    if (!supported()) return null;
    const width = Math.max(1, view.innerWidth);
    const height = Math.max(1, view.innerHeight);
    if (prepared?.width === width && prepared.height === height && (!Number.isFinite(variant) || prepared.seed === variant >>> 0)) return prepared;
    if (!definitions) {
      definitions = doc.createElementNS(svgNS, 'svg');
      definitions.setAttribute('aria-hidden', 'true');
      definitions.setAttribute('focusable', 'false');
      definitions.classList.add('mode-snapshot-definitions');
      definitions.innerHTML = `<defs>${filterMarkup(`${uid}-old`)}${filterMarkup(`${uid}-new`)}</defs>`;
      doc.body.append(definitions);
      filters = [...definitions.querySelectorAll('filter')].map(element => ({
        map: element.querySelector('[data-snapshot-map]'),
        displacement: element.querySelector('[data-snapshot-displacement]'),
        channels: [...element.querySelectorAll('[data-snapshot-channel]')],
        offsets: [...element.querySelectorAll('[data-snapshot-offset]')],
      }));
    }
    const seed = Number.isFinite(variant) ? variant >>> 0
      : view.crypto?.getRandomValues ? view.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967296);
    const mobile = coarse.matches || view.navigator.deviceMemory > 0 && view.navigator.deviceMemory <= 4
      || view.navigator.hardwareConcurrency > 0 && view.navigator.hardwareConcurrency <= 4 || view.navigator.connection?.saveData;
    const maps = Array.from({ length: 4 }, (_, phase) => displacementMap(width, height, seed, phase, config, mobile));
    for (const filter of filters) filter.map.setAttribute('href', maps[0]);
    // Predecode inside the discovery interval; no external network requests.
    for (const src of maps) {
      const image = new view.Image(); image.src = src;
      image.decode?.().catch(() => {});
    }
    prepared = { width, height, seed, maps, mobile };
    return prepared;
  }

  function end(record) {
    if (record.cleaned) return;
    record.cleaned = true;
    view.cancelAnimationFrame(record.frame);
    view.clearTimeout(record.timeout);
    if (active !== record) return;
    active = null;
    for (const [name, value] of record.previousAttributes) {
      if (value === null) html.removeAttribute(name); else html.setAttribute(name, value);
    }
    for (const [name, value] of record.previousProperties) {
      if (value) html.style.setProperty(name, value); else html.style.removeProperty(name);
    }
    // The native pseudo-images are gone. Release decoded UV dependencies and
    // invalidate retained filter intermediates instead of keeping the last
    // captured surface alive between otherwise idle mode switches.
    for (const filter of filters) {
      filter.map.removeAttribute('href');
      filter.displacement.setAttribute('scale', '0');
      for (const offset of filter.offsets) {
        offset.setAttribute('dx', '0');
        offset.setAttribute('dy', '0');
      }
    }
    last = { variant: record.variant, duration: record.duration, frames: record.frames, native: true, skipped: record.skipped };
  }

  function skip() {
    const record = active;
    if (!record) return;
    record.skipped = true;
    // A skipped capture still commits the requested state once, rather than
    // leaving an accepted keyboard shortcut pending until the page is visible.
    record.commit(false);
    try { record.transition?.skipTransition(); } catch { /* The native transition may already have finished. */ }
    end(record);
  }

  function run(update, { mode, duration, variant } = {}) {
    skip();
    let committed = false;
    let detail = {};
    const commit = captured => {
      if (committed) return;
      committed = true;
      return update({ captured, ...detail });
    };
    if (!supported()) { commit(false); return null; }
    const plan = prepare({ variant });
    prepared = null;
    const seed = Number.isFinite(variant) ? variant >>> 0 : plan.seed;
    const random = randomSequence(seed);
    const length = clamp(Number.isFinite(duration) ? duration : mix(config.minimumDurationMs, config.maximumDurationMs, random()), 600, 1000);
    detail = { duration: length, variant: seed };
    const entering = mode === 'xray';
    const record = {
      commit, variant: seed, duration: length, frames: 0, frame: 0, timeout: 0,
      transition: null, cleaned: false, skipped: false,
      previousAttributes: attributes.map(name => [name, html.getAttribute(name)]),
      previousProperties: properties.map(name => [name, html.style.getPropertyValue(name)]),
    };
    active = record;
    html.dataset.modeSnapshot = entering ? 'entering' : 'leaving';
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
    let previousPhase = -1;
    function render(progress) {
      const phase = progress < .17 ? 0 : progress < .4 ? 1 : progress < .7 ? 2 : 3;
      const envelope = progress < .17 ? progress / .17 : progress > .66 ? (1 - progress) / .34 : 1;
      const pulse = .86 + .14 * Math.sin(progress * Math.PI * (entering ? 5 : 3));
      const strength = clamp(envelope * pulse, 0, 1);
      const displacement = config.displacementPx * (plan.mobile ? .65 : 1);
      for (let index = 0; index < filters.length; index++) {
        const filter = filters[index];
        if (phase !== previousPhase) filter.map.setAttribute('href', plan.maps[(phase + (index && !entering ? 1 : 0)) % plan.maps.length]);
        const gain = index ? strength * (entering ? .82 : .72) : strength;
        filter.displacement.setAttribute('scale', String(displacement * gain * (index ? -.83 : 1)));
        for (const offset of filter.offsets) {
          const sign = Number(offset.dataset.snapshotOffset) * (entering ? 1 : -1);
          offset.setAttribute('dx', String(config.channelOffsetPx * gain * sign));
          offset.setAttribute('dy', String(config.channelOffsetPx * gain * sign * .17));
        }
        filter.channels.forEach((node, channel) => node.setAttribute('tableValues', tones[(channel + tintRotation) % 3]
          .map((value, sample) => mix(sample / 8, value, gain * config.colorStrength).toFixed(4)).join(' ')));
      }
      previousPhase = phase;
      html.dataset.modeSnapshotFrame = String(++record.frames);
    }
    render(0);
    try {
      record.transition = doc.startViewTransition(() => commit(true));
    } catch {
      end(record); commit(false); return null;
    }
    nativeCount++;
    record.transition.ready.then(() => {
      if (active !== record || record.cleaned) return;
      const started = view.performance.now();
      // Share the browser animation's clock, so suspended snapshots and delayed
      // native capture do not drift away from the displacement/color envelope.
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
    return { native: true, variant: seed, duration: length, finished, skip: () => { if (active === record) skip(); } };
  }

  listen(doc, 'h4:navigationstart', skip);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) skip(); });
  listen(view, 'blur', skip);
  listen(view, 'resize', () => { skip(); prepared = null; });
  listen(reduced, 'change', () => { if (reduced.matches) skip(); });
  return {
    prepare, run, skip,
    snapshot: () => ({ active: Boolean(active), prepared: Boolean(prepared), nativeCount,
      current: active ? { variant: active.variant, duration: active.duration, frames: active.frames } : null, last }),
    dispose() { skip(); disposed = true; for (const remove of listeners) remove(); definitions?.remove(); prepared = null; filters = []; },
  };
}
