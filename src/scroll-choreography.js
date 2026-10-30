import './scroll-choreography.css';
import { motionSettings, progressBetween, pinnedProgress, sampleCalmItem, sampleHeading, sampleHero, sampleHeroBar, sampleAboutItem, sampleArchiveHeading } from './data/motionSettings.js';
import { createVisualMotionPublisher } from './motion-mosh.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

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
    items: [...element.querySelectorAll('.category-link > .kinetic-item, .contact-link > .kinetic-item, .kinetic-item[data-motion-item], .inquiry-enter')],
    top: 0, run: 0, lastState: '', lastProgress: '',
  })).filter((section) => section.pin && ['work', 'about', 'contact'].includes(section.kind));
  const archiveGroups = [...root.querySelectorAll('.work-group')].map(element => ({
    element, top: 0, headings: [],
  }));
  const archiveHeadings = archiveGroups.flatMap(group => {
    group.headings = [...group.element.querySelectorAll('.work-group-heading, .archive-category-heading')].map(element => {
      let visual = element.querySelector(':scope > a');
      const generatedLabel = !visual;
      if (generatedLabel) {
        visual = element.ownerDocument.createElement('span');
        visual.className = 'archive-scroll-label';
        visual.append(...element.childNodes);
        element.append(visual);
      }
      return { element, visual, generatedLabel, group, top: 0, left: 0, width: 0, height: 0,
        pose: { x: 0, rotation: 0, opacity: 1 } };
    });
    return group.headings;
  });
  if (!sections.length && !archiveHeadings.length) return () => {};

  const page = root.nodeType === Node.DOCUMENT_NODE ? root.documentElement : root;
  const owner = root.ownerDocument || root;
  const stage = owner.querySelector('.hero:not([hidden]) #stage');
  const hero = stage?.closest('.hero');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = [];
  const previousRootAttribute = page.getAttribute('data-scroll-choreography');
  const values = new WeakMap();
  const poses = new WeakMap();
  const motionPublisher = createVisualMotionPublisher({ doc: owner });
  let frame = 0;
  let disposed = false;
  let enabled = false;
  let animated = !reduced.matches;
  const heroBars = hero ? [...hero.querySelectorAll('.controls, .hero-nav')].map(element => ({ element, inert: element.inert })) : [];
  let barHidden = null;
  let dirty = true;
  let width = 0;
  let height = 0;
  let heroTop = 0;
  let heroHeight = 1;
  let focusSection = null;

  // Anchor navigation focuses the section container itself. That focus must
  // not pin an otherwise scroll-scrubbed entrance at rest on reverse scroll.
  // Descendant fields and links still reveal their section for keyboard use.
  const focusedSection = target => sections.find(section => target !== section.element
    && section.element.contains(target)) || null;

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

  function applyItem(element, sample) {
    poses.set(element, sample);
    setValue(element, '--kinetic-x', `${sample.x.toFixed(3)}px`);
    setValue(element, '--kinetic-rotate', '0deg');
    setValue(element, '--kinetic-opacity', sample.opacity.toFixed(4));
  }

  function updateHeroBar(position) {
    if (!hero) return;
    const sample = sampleHeroBar((position - heroTop) / heroHeight, { reduced: !animated });
    setValue(hero, '--hero-bar-opacity', sample.opacity.toFixed(4));
    if (sample.hidden !== barHidden) {
      barHidden = sample.hidden;
      hero.dataset.heroBarState = sample.hidden ? 'hidden' : 'visible';
      for (const bar of heroBars) bar.element.inert = sample.hidden || bar.inert;
    }
  }

  function measure() {
    width = owner.documentElement.clientWidth || innerWidth;
    height = innerHeight;
    const mobile = width <= motionSettings.mobileBreakpoint;
    if (!animated) {
      if (hero) { const bounds = hero.getBoundingClientRect(); heroTop = bounds.top + scrollY; heroHeight = bounds.height || 1; }
      dirty = false;
      return;
    }
    // Only layout changes write/read geometry. Ordinary scroll uses this cache.
    for (const section of sections) {
      if (section.kind === 'about' || section.kind === 'contact') continue;
      const key = mobile ? `mobile${section.kind[0].toUpperCase()}${section.kind.slice(1)}` : section.kind;
      section.run = height * motionSettings.pin[key];
      section.element.setAttribute('data-motion-pin', '');
      setValue(section.element, '--motion-pin-height', `${height}px`);
      setValue(section.element, '--motion-run', `${section.run}px`);
    }
    const offset = scrollY;
    for (const section of sections) {
      section.top = section.element.getBoundingClientRect().top + offset;
      section.motionLayout = null;
      if (owner.documentElement.dataset.mode !== 'xray') continue;
      // Extra source footprints are cached only in the Other Side's existing
      // layout pass. Undo our known translation around the unchanged center;
      // ordinary scroll frames never read element geometry or computed style.
      const pin = section.pin.getBoundingClientRect();
      section.pinTravel = ['about', 'contact'].includes(section.kind) ? 0 : Math.max(0, section.element.offsetHeight - section.pin.offsetHeight);
      section.pinOffset = pin.top - (section.top - offset + clamp(offset - section.top, 0, section.pinTravel));
      section.pinLeft = pin.left + scrollX;
      section.motionLayout = [section.heading, ...section.items].filter(element => element && !element.matches('.inquiry-enter')).map(element => {
        const heading = element === section.heading;
        const rect = element.getBoundingClientRect();
        const pose = poses.get(element);
        const itemWidth = element.offsetWidth || rect.width;
        const itemHeight = element.offsetHeight || rect.height;
        const scroller = element.closest('.category-strip, .contact-links');
        return { element, heading, width: itemWidth, height: itemHeight,
          x: rect.left + rect.width / 2 - pin.left - (pose?.x || 0),
          y: rect.top + rect.height / 2 - pin.top - (heading ? (pose?.y || 0) * itemHeight / 100 : 0),
          scroller, scrollLeft: scroller?.scrollLeft || 0 };
      });
    }
    for (const heading of archiveHeadings) {
      const bounds = heading.visual.getBoundingClientRect();
      heading.top = bounds.top + offset;
      heading.left = bounds.left + scrollX - heading.pose.x;
      heading.width = bounds.width;
      heading.height = bounds.height;
    }
    for (const group of archiveGroups) group.top = group.headings[0]?.top || 0;
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
    updateHeroBar(position);
    if (!animated) return;
    const motionSamples = owner.documentElement.dataset.mode === 'xray' ? [] : null;
    if (stage) {
      const sample = sampleHero((position - heroTop) / heroHeight);
      setValue(stage, '--hero-scroll-opacity', sample.opacity.toFixed(4));
      setValue(stage, '--hero-scroll-scale', sample.scale.toFixed(4));
    }
    for (const section of sections) {
      const focused = section === focusSection;
      const progress = section.kind === 'contact'
        ? progressBetween(position, section.top - height * .68, section.top - height * .10)
        : section.kind === 'about'
        ? progressBetween(position, section.top - height * motionSettings.about.approach, section.top - height * motionSettings.about.finish)
        : pinnedProgress(position, section.top, height, section.run);
      const state = focused ? 'focus' : progress <= 0 ? 'before' : progress >= 1 ? 'settled' : 'active';
      if (state !== section.lastState) { section.element.dataset.motionState = state; section.lastState = state; }
      const recordedProgress = progress.toFixed(4);
      if (recordedProgress !== section.lastProgress) { section.element.dataset.motionProgress = recordedProgress; section.lastProgress = recordedProgress; }
      const calm = focused ? { x: 0, rotation: 0, opacity: 1 } : sampleCalmItem(progress, width);
      const heading = section.kind === 'contact'
        ? { ...calm, y: 0 }
        : focused ? { x: 0, y: 0, opacity: 1 }
          : { x: 0, ...sampleHeading(progress, 0, section.kind === 'about' ? motionSettings.about.headingEnd : motionSettings.heading.end) };
      setValue(section.heading, '--heading-x', `${heading.x.toFixed(3)}px`);
      setValue(section.heading, '--heading-y', `${heading.y.toFixed(3)}%`);
      setValue(section.heading, '--heading-opacity', heading.opacity.toFixed(4));
      if (section.heading) poses.set(section.heading, heading);
      section.items.forEach(item => {
        if (focused) return applyItem(item, { x: 0, rotation: 0, opacity: 1 });
        applyItem(item, section.kind === 'about' ? sampleAboutItem(progress, item.dataset.motionItem, width) : calm);
      });
      if (motionSamples && section.motionLayout) {
        const pinY = section.top - position + clamp(position - section.top, 0, section.pinTravel) + section.pinOffset;
        for (const source of section.motionLayout) {
          const pose = poses.get(source.element);
          const angle = (pose.rotation || 0) * Math.PI / 180;
          const cosine = Math.abs(Math.cos(angle));
          const sine = Math.abs(Math.sin(angle));
          const x = section.pinLeft - scrollX + source.x + (pose.x || 0)
            - ((source.scroller?.scrollLeft || 0) - source.scrollLeft);
          const y = pinY + source.y + (source.heading ? pose.y * source.height / 100 : 0);
          const points = [['tl', -1, -1], ['tr', 1, -1], ['br', 1, 1], ['bl', -1, 1]].map(([id, sideX, sideY]) => {
            const localX = sideX * source.width / 2;
            const localY = sideY * source.height / 2;
            return { id, x: x + Math.cos(angle) * localX - Math.sin(angle) * localY,
              y: y + Math.sin(angle) * localX + Math.cos(angle) * localY };
          });
          motionSamples.push({ target: source.element, kind: source.heading ? 'section' : 'typography', x, y, points,
            width: source.width * cosine + source.height * sine,
            height: source.height * cosine + source.width * sine, opacity: pose.opacity, angle });
        }
      }
    }
    for (const heading of archiveHeadings) {
      const focused = owner.activeElement !== heading.group.element
        && heading.group.element.contains(owner.activeElement);
      const progress = progressBetween(position, heading.group.top - height * motionSettings.about.approach,
        heading.group.top - height * motionSettings.about.finish);
      const pose = focused ? { x: 0, rotation: 0, opacity: 1 } : sampleArchiveHeading(progress, width);
      heading.pose = pose;
      setValue(heading.element, '--archive-heading-x', `${pose.x.toFixed(3)}px`);
      setValue(heading.element, '--archive-heading-opacity', pose.opacity.toFixed(4));
      if (motionSamples && heading.top - position < height && heading.top + heading.height - position > 0) {
        motionSamples.push({ target: heading.element, kind: 'typography',
          x: heading.left - scrollX + heading.width / 2 + pose.x,
          y: heading.top - position + heading.height / 2,
          width: heading.width, height: heading.height, opacity: pose.opacity });
      }
    }
    if (motionSamples?.length) motionPublisher.publish(motionSamples);
  }

  function schedule(remeasure = false) {
    if (disposed || !enabled) return;
    dirty ||= remeasure;
    if (!frame && !owner.hidden) frame = requestAnimationFrame(update);
  }

  function clearStyles() {
    for (const section of sections) {
      section.element.removeAttribute('data-motion-pin');
      section.element.removeAttribute('data-motion-state');
      section.element.removeAttribute('data-motion-progress');
      section.element.style.removeProperty('--motion-pin-height');
      section.element.style.removeProperty('--motion-run');
      section.lastState = '';
      section.lastProgress = '';
      for (const item of section.items) {
        item.removeAttribute('data-scroll-item');
        for (const name of ['--kinetic-x', '--kinetic-rotate', '--kinetic-opacity']) item.style.removeProperty(name);
        values.delete(item);
        poses.delete(item);
      }
      if (section.heading) {
        section.heading.style.removeProperty('--heading-x');
        section.heading.style.removeProperty('--heading-y');
        section.heading.style.removeProperty('--heading-opacity');
        values.delete(section.heading);
        poses.delete(section.heading);
      }
      values.delete(section.element);
    }
    if (stage) {
      stage.removeAttribute('data-scroll-hero');
      stage.style.removeProperty('--hero-scroll-opacity');
      stage.style.removeProperty('--hero-scroll-scale');
      values.delete(stage);
    }
    if (hero) {
      hero.style.removeProperty('--hero-bar-opacity');
      hero.removeAttribute('data-hero-bar-state');
      values.delete(hero);
      barHidden = null;
      for (const bar of heroBars) bar.element.inert = bar.inert;
    }
    for (const heading of archiveHeadings) {
      heading.element.removeAttribute('data-scroll-heading');
      heading.element.style.removeProperty('--archive-heading-x');
      heading.element.style.removeProperty('--archive-heading-opacity');
      values.delete(heading.element);
      heading.pose = { x: 0, rotation: 0, opacity: 1 };
    }
    if (previousRootAttribute === null) page.removeAttribute('data-scroll-choreography');
    else page.setAttribute('data-scroll-choreography', previousRootAttribute);
  }

  function configure() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    enabled = true;
    animated = !reduced.matches;
    if (!animated) { motionPublisher.reset(); clearStyles(); dirty = true; update(); return; }
    page.setAttribute('data-scroll-choreography', '');
    for (const section of sections) for (const item of section.items) item.setAttribute('data-scroll-item', '');
    for (const heading of archiveHeadings) heading.element.setAttribute('data-scroll-heading', '');
    stage?.setAttribute('data-scroll-hero', '');
    dirty = true;
    // Immediate initial values avoid an unenhanced frame flashing into a pose.
    update();
  }

  listen(window, 'scroll', () => schedule(), { passive: true });
  listen(root, 'scroll', () => schedule(), { passive: true, capture: true });
  listen(window, 'resize', () => schedule(true), { passive: true });
  listen(owner, 'h4:modechange', () => { motionPublisher.reset(); schedule(true); });
  listen(owner, 'visibilitychange', () => {
    if (owner.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; motionPublisher.reset(); }
    else schedule(true);
  });
  listen(root, 'focusin', (event) => {
    focusSection = focusedSection(event.target);
    // Focus must be visible in this task, before the next browser paint. Keep
    // section geometry unchanged so native anchor/tab scrolling cannot jump.
    if (enabled) { if (frame) cancelAnimationFrame(frame); update(); }
  });
  listen(root, 'focusout', () => queueMicrotask(() => {
    if (disposed) return;
    focusSection = focusedSection(owner.activeElement);
    schedule();
  }));
  listen(reduced, 'change', configure);

  const resize = 'ResizeObserver' in window ? new ResizeObserver(() => schedule(true)) : null;
  for (const section of sections) { resize?.observe(section.element); resize?.observe(section.pin); }
  for (const heading of archiveHeadings) { resize?.observe(heading.element); resize?.observe(heading.group.element); }
  if (hero) resize?.observe(hero);
  focusSection = focusedSection(owner.activeElement);
  configure();

  return function dispose() {
    disposed = true;
    enabled = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    motionPublisher.reset();
    resize?.disconnect();
    for (const remove of listeners) remove();
    clearStyles();
    for (const heading of archiveHeadings) if (heading.generatedLabel) heading.visual.replaceWith(...heading.visual.childNodes);
  };
}
