import './scroll-choreography.css';
import { motionSettings, progressBetween, pinnedProgress, kineticItemProgress, sampleMotionTrail, sampleFlyIn, sampleHeading, sampleHero, sampleKineticItem } from './data/motionSettings.js';

/** Native scrolling + native sticky positioning; no wheel/touch interception.
 * Each scroll/resize schedules at most one frame. Nothing runs while idle.
 * Keep this module independent from main.js: it never loads or drives WebGL.
 */
export function initScrollChoreography(root = document) {
  const sections = [...root.querySelectorAll('.content-section[data-motion]')].map((element) => ({
    element,
    kind: element.dataset.motion,
    pin: element.querySelector(':scope > .section-pin'),
    heading: element.querySelector('.kinetic-heading > .kinetic-heading-text'),
    items: [...element.querySelectorAll('.category-link > .kinetic-item, .contact-link > .kinetic-item, .kinetic-item[data-motion-item]')],
    top: 0, run: 0, lastState: '', lastProgress: '',
  })).filter((section) => section.pin && ['work', 'about', 'contact'].includes(section.kind));
  if (!sections.length) return () => {};

  const page = root.nodeType === Node.DOCUMENT_NODE ? root.documentElement : root;
  const owner = root.ownerDocument || root;
  const stage = owner.querySelector('.hero:not([hidden]) #stage');
  const hero = stage?.closest('.hero');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = [];
  const previousRootAttribute = page.getAttribute('data-scroll-choreography');
  const values = new WeakMap();
  const echoes = new Map();
  let frame = 0;
  let disposed = false;
  let enabled = false;
  let dirty = true;
  let width = 0;
  let height = 0;
  let heroTop = 0;
  let heroHeight = 1;
  let focusSection = null;

  function listen(target, name, callback, options) {
    target.addEventListener(name, callback, options);
    listeners.push(() => target.removeEventListener(name, callback, options));
  }

  function setValue(element, name, value) {
    if (!element) return;
    let cache = values.get(element);
    if (!cache) { cache = {}; values.set(element, cache); }
    if (cache[name] === value) return;
    cache[name] = value;
    element.style.setProperty(name, value);
  }

  function prepareEchoes() {
    for (const section of sections) {
      if (section.kind === 'about') continue;
      for (const item of section.items) {
        if (echoes.has(item)) continue;
        const label = item.querySelector('.category-magnet > span');
        if (!label) continue;
        const layers = Array.from({ length: motionSettings.trail.layers }, () => {
          const echo = owner.createElement('span');
          echo.className = 'motion-echo';
          echo.setAttribute('aria-hidden', 'true');
          // Generated content is decorative; no duplicate readable DOM text.
          echo.dataset.echoText = label.textContent.trim();
          item.append(echo);
          return echo;
        });
        echoes.set(item, layers);
      }
    }
  }

  function removeEchoes() {
    for (const layers of echoes.values()) for (const echo of layers) { values.delete(echo); echo.remove(); }
    echoes.clear();
  }

  function applyItem(element, sample, localProgress = 1) {
    setValue(element, '--kinetic-x', `${sample.x.toFixed(3)}px`);
    setValue(element, '--kinetic-rotate', `${sample.rotation.toFixed(3)}deg`);
    setValue(element, '--kinetic-opacity', sample.opacity.toFixed(4));
    echoes.get(element)?.forEach((echo, layer) => {
      const trail = sampleMotionTrail(localProgress, layer, width);
      setValue(echo, '--echo-x', `${trail.x.toFixed(3)}px`);
      setValue(echo, '--echo-opacity', trail.opacity.toFixed(4));
    });
  }

  function measure() {
    width = owner.documentElement.clientWidth || innerWidth;
    height = innerHeight;
    const mobile = width <= motionSettings.mobileBreakpoint;
    // Only layout changes write/read geometry. Ordinary scroll uses this cache.
    for (const section of sections) {
      if (section.kind === 'about') continue;
      const key = mobile ? `mobile${section.kind[0].toUpperCase()}${section.kind.slice(1)}` : section.kind;
      section.run = height * motionSettings.pin[key];
      section.element.setAttribute('data-motion-pin', '');
      setValue(section.element, '--motion-pin-height', `${height}px`);
      setValue(section.element, '--motion-run', `${section.run}px`);
    }
    const offset = scrollY;
    for (const section of sections) section.top = section.element.getBoundingClientRect().top + offset;
    if (hero) {
      const bounds = hero.getBoundingClientRect();
      heroTop = bounds.top + offset;
      heroHeight = bounds.height || 1;
    }
    dirty = false;
  }

  function update() {
    frame = 0;
    if (disposed || !enabled || owner.hidden) return;
    if (dirty) measure();
    const position = scrollY;
    if (stage) {
      const sample = sampleHero((position - heroTop) / heroHeight);
      setValue(stage, '--hero-scroll-opacity', sample.opacity.toFixed(4));
      setValue(stage, '--hero-scroll-scale', sample.scale.toFixed(4));
    }
    for (const section of sections) {
      const focused = section === focusSection;
      const progress = section.kind === 'about'
        ? progressBetween(position, section.top - height * motionSettings.about.approach, section.top - height * motionSettings.about.finish)
        : pinnedProgress(position, section.top, height, section.run);
      const lastEnd = motionSettings.fly.start + motionSettings.fly.duration + Math.max(0, section.items.length - 1) * motionSettings.fly.stagger;
      const state = focused ? 'focus' : progress < 0 ? 'before' : progress >= (section.kind === 'about' ? 1 : lastEnd) ? 'settled' : 'active';
      if (state !== section.lastState) { section.element.dataset.motionState = state; section.lastState = state; }
      const recordedProgress = progress.toFixed(4);
      if (recordedProgress !== section.lastProgress) { section.element.dataset.motionProgress = recordedProgress; section.lastProgress = recordedProgress; }
      const heading = focused ? { y: 0, opacity: 1 } : section.kind === 'about'
        ? sampleHeading(progress, 0, motionSettings.about.headingEnd)
        : sampleHeading(progress);
      setValue(section.heading, '--heading-y', `${heading.y.toFixed(3)}%`);
      setValue(section.heading, '--heading-opacity', heading.opacity.toFixed(4));
      section.items.forEach((item, index) => {
        if (focused) return applyItem(item, { x: 0, rotation: 0, opacity: 1 });
        if (section.kind !== 'about') return applyItem(item, sampleKineticItem(progress, index, width), kineticItemProgress(progress, index));
        const link = item.dataset.motionItem === 'link';
        const settings = motionSettings.about;
        const local = progressBetween(progress, link ? settings.linkStart : settings.copyStart, link ? settings.linkEnd : settings.copyEnd);
        applyItem(item, sampleFlyIn(local, { distance: width * (link ? settings.linkDistanceVw : settings.copyDistanceVw) }));
      });
    }
  }

  function schedule(remeasure = false) {
    if (disposed || !enabled) return;
    dirty ||= remeasure;
    if (!frame && !owner.hidden) frame = requestAnimationFrame(update);
  }

  function clearStyles() {
    removeEchoes();
    for (const section of sections) {
      section.element.removeAttribute('data-motion-pin');
      section.element.removeAttribute('data-motion-state');
      section.element.removeAttribute('data-motion-progress');
      section.element.style.removeProperty('--motion-pin-height');
      section.element.style.removeProperty('--motion-run');
      section.lastState = '';
      section.lastProgress = '';
      for (const item of section.items) {
        for (const name of ['--kinetic-x', '--kinetic-rotate', '--kinetic-opacity']) item.style.removeProperty(name);
        values.delete(item);
      }
      if (section.heading) {
        section.heading.style.removeProperty('--heading-y');
        section.heading.style.removeProperty('--heading-opacity');
        values.delete(section.heading);
      }
      values.delete(section.element);
    }
    if (stage) {
      stage.removeAttribute('data-scroll-hero');
      stage.style.removeProperty('--hero-scroll-opacity');
      stage.style.removeProperty('--hero-scroll-scale');
      values.delete(stage);
    }
    if (previousRootAttribute === null) page.removeAttribute('data-scroll-choreography');
    else page.setAttribute('data-scroll-choreography', previousRootAttribute);
  }

  function configure() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    enabled = !reduced.matches;
    if (!enabled) return clearStyles();
    prepareEchoes();
    page.setAttribute('data-scroll-choreography', '');
    stage?.setAttribute('data-scroll-hero', '');
    dirty = true;
    // Immediate initial values avoid an unenhanced frame flashing into a pose.
    update();
  }

  listen(window, 'scroll', () => schedule(), { passive: true });
  listen(window, 'resize', () => schedule(true), { passive: true });
  listen(owner, 'visibilitychange', () => {
    if (owner.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; }
    else schedule(true);
  });
  listen(root, 'focusin', (event) => {
    focusSection = sections.find((section) => section.element.contains(event.target)) || null;
    // Focus must be visible in this task, before the next browser paint. Keep
    // section geometry unchanged so native anchor/tab scrolling cannot jump.
    if (enabled) { if (frame) cancelAnimationFrame(frame); update(); }
  });
  listen(root, 'focusout', () => queueMicrotask(() => {
    if (disposed) return;
    focusSection = sections.find((section) => section.element.contains(owner.activeElement)) || null;
    schedule();
  }));
  listen(reduced, 'change', configure);

  const resize = 'ResizeObserver' in window ? new ResizeObserver(() => schedule(true)) : null;
  for (const section of sections) { resize?.observe(section.element); resize?.observe(section.pin); }
  if (hero) resize?.observe(hero);
  focusSection = sections.find((section) => section.element.contains(owner.activeElement)) || null;
  configure();

  return function dispose() {
    disposed = true;
    enabled = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    resize?.disconnect();
    for (const remove of listeners) remove();
    clearStyles();
  };
}
