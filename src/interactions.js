import './interactions.css';
import { uiEffectSettings, boundedHoverScale, uiEffectProperties } from './data/uiEffectSettings.js';
import { createVisualMotionPublisher } from './motion-mosh.js';
import { createFiniteHoverMotion } from './finite-hover-motion.js';
import { activateRubric, rubricSelector } from './rubric-activation.js';

const magneticSelector = `${rubricSelector}, .contact-link[href]`;
const interactiveSelector = 'a[href], button, [role="button"]';
const excludedSelector = '.secret-hotspot, [data-secret-hotspot], [data-mode-hold], .skip-link, [data-no-hover], [aria-disabled="true"], :disabled';

/**
 * Small, disposable enhancements for the current page contents. The link hit
 * areas never move: only their .category-magnet label/arrow wrapper translates.
 */
export function initInteractions(root = document, { revealSections = true, settings = uiEffectSettings } = {}) {
  const owner = root.ownerDocument || root;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const sections = [...root.querySelectorAll('.content-section')];
  const removers = [];
  const targets = new Map();
  const states = new Map();
  const wrappers = new Map();
  const originalProperties = new Map();
  const motionPublisher = createVisualMotionPublisher({ doc: owner });
  const hoverMotion = createFiniteHoverMotion({ doc: owner,
    publish: (samples, time) => motionPublisher.publish(samples, time) });
  let observer = null;
  let resizeObserver = null;
  let contentObserver = null;
  let active = null;
  let frame = 0;
  let disposed = false;
  let clearSelection = () => {};

  for (const [name, value] of Object.entries(uiEffectProperties(settings))) {
    originalProperties.set(name, owner.documentElement.style.getPropertyValue(name));
    owner.documentElement.style.setProperty(name, value);
  }

  function listen(target, name, callback, options) {
    target.addEventListener(name, callback, options);
    removers.push(() => target.removeEventListener(name, callback, options));
  }

  function reveal(section, immediately = false) {
    if (!section) return;
    if (immediately) section.classList.add('reveal-instant');
    section.classList.add('is-revealed');
    observer?.unobserve(section);
  }

  function trackHover(target, duration = settings.hover.durationMs) {
    const visual = targets.get(target)?.wrapper;
    if (visual) hoverMotion.track({ target, visual }, duration + 64);
  }

  function resetMagnet() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (active) {
      trackHover(active.link, settings.hover.releaseMs);
      active.wrapper.style.removeProperty('--magnet-x');
      active.wrapper.style.removeProperty('--magnet-y');
      active.link.removeAttribute('data-magnet-active');
    }
    active = null;
  }

  function measure(state) {
    const box = state.link.getBoundingClientRect();
    // Document coordinates stay valid through ordinary page scrolling without
    // installing a scroll handler or reading layout on every pointer movement.
    state.bounds = {
      x: box.left + scrollX, y: box.top + scrollY, width: box.width, height: box.height,
      scrollerLeft: state.scroller?.scrollLeft || 0,
    };
  }

  function applyMagnet() {
    frame = 0;
    if (disposed || !active || reduced.matches || !fine.matches) return;
    if (!active.bounds) measure(active);
    const { x, y, width, height, scrollerLeft } = active.bounds;
    if (!width || !height) return;
    const normalize = (value) => Math.max(-1, Math.min(1, value));
    const horizontalScroll = (active.scroller?.scrollLeft || 0) - scrollerLeft;
    const dx = normalize((active.pointerX + scrollX - x + horizontalScroll - width / 2) / (width / 2)) * settings.magnetDistance;
    const dy = normalize((active.pointerY + scrollY - y - height / 2) / (height / 2)) * settings.magnetDistance;
    const magnetX = `${dx.toFixed(2)}px`;
    const magnetY = `${dy.toFixed(2)}px`;
    if (active.wrapper.style.getPropertyValue('--magnet-x') === magnetX
      && active.wrapper.style.getPropertyValue('--magnet-y') === magnetY) return;
    trackHover(active.link);
    active.wrapper.style.setProperty('--magnet-x', magnetX);
    active.wrapper.style.setProperty('--magnet-y', magnetY);
  }

  function move(event, state) {
    if (event.pointerType !== 'mouse' || reduced.matches || !fine.matches) return;
    if (active !== state) {
      resetMagnet();
      active = state;
      measure(state);
      state.link.setAttribute('data-magnet-active', '');
    }
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    if (!frame) frame = requestAnimationFrame(applyMagnet);
  }

  if (revealSections && !reduced.matches && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) reveal(entry.target);
    }, { rootMargin: '0px 0px -24px 0px', threshold: 0 });
    for (const section of sections) {
      section.classList.add('reveal-pending');
      observer.observe(section);
    }
  }

  function fitVisual(target) {
    const wrapper = targets.get(target)?.wrapper;
    if (!wrapper) return;
    let scale = target.matches('.artwork-open') ? settings.hover.imageScale : settings.hover.scale;
    if (target.matches('.category-link, .contact-link')) {
      const style = getComputedStyle(target);
      const available = target.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      scale = boundedHoverScale(wrapper.scrollWidth, available, settings.hover.largeScale, settings.magnetDistance + 2);
    }
    target.style.setProperty('--ui-target-scale', String(scale));
  }

  function enhance(target) {
    if (!target.matches?.(interactiveSelector) || target.matches(excludedSelector) || target.closest('.secret-hotspot, [data-secret-hotspot]')) return;
    let wrapper = target.querySelector(':scope > .interaction-visual, :scope > .category-magnet, :scope > .kinetic-item > .category-magnet');
    if (!wrapper) {
      wrapper = owner.createElement('span');
      wrapper.className = 'interaction-visual';
      while (target.firstChild) wrapper.append(target.firstChild);
      target.append(wrapper);
      wrappers.set(wrapper, { created: true });
    } else if (!wrapper.classList.contains('interaction-visual')) {
      wrappers.set(wrapper, { created: false });
      wrapper.classList.add('interaction-visual');
    }
    // Existing templates use a literal space before the arrow. The shared gap
    // owns that spacing now, so remove only the redundant trailing whitespace.
    for (const node of wrapper.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.nextSibling?.matches?.('.arrow')) node.textContent = node.textContent.trimEnd();
    }
    if (target.matches(magneticSelector)) wrapper.classList.add('category-magnet');
    const previous = targets.get(target);
    if (previous) {
      if (previous.wrapper !== wrapper && !previous.wrapper.isConnected) wrappers.delete(previous.wrapper);
      previous.wrapper = wrapper;
      const state = states.get(target);
      if (state) { state.wrapper = wrapper; state.bounds = null; }
      return;
    }
    targets.set(target, { wrapper, attribute: target.getAttribute('data-ui-interactive'), scale: target.style.getPropertyValue('--ui-target-scale') });
    target.setAttribute('data-ui-interactive', '');
    listen(target, 'pointerenter', (event) => {
      if (event.pointerType !== 'mouse' || !fine.matches || reduced.matches) return;
      trackHover(target);
      fitVisual(target);
    }, { passive: true });
    listen(target, 'pointerleave', event => {
      if (event.pointerType === 'mouse') trackHover(target, settings.hover.releaseMs);
    }, { passive: true });
    resizeObserver?.observe(target);
    if (!target.matches(magneticSelector)) return;
    const state = { link: target, wrapper, scroller: target.closest('.category-strip, .contact-links'), bounds: null };
    states.set(target, state);
    listen(target, 'pointerenter', (event) => move(event, state), { passive: true });
    listen(target, 'pointermove', (event) => move(event, state), { passive: true });
    listen(target, 'pointerleave', resetMagnet, { passive: true });
    listen(target, 'pointerdown', (event) => { if (event.pointerType !== 'mouse') resetMagnet(); }, { passive: true });
  }

  function enhanceTree(element) {
    if (disposed || !(element instanceof owner.defaultView.Element)) return;
    enhance(element);
    for (const target of element.querySelectorAll(interactiveSelector)) enhance(target);
  }

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const state of states.values()) state.bounds = null;
      for (const { target } of entries) if (target.matches(':hover, :focus-visible')) fitVisual(target);
    });
  }
  for (const target of root.querySelectorAll(interactiveSelector)) enhance(target);
  // Hero controls replace textContent; gallery controls are created later.
  // Observe only child changes, not animation styles or pointer attributes.
  contentObserver = new MutationObserver((records) => {
    if (disposed) return;
    for (const record of records) {
      if (record.target instanceof owner.defaultView.Element && record.target.matches(interactiveSelector)) enhance(record.target);
      for (const added of record.addedNodes) enhanceTree(added);
    }
  });
  contentObserver.observe(root, { childList: true, subtree: true });

  listen(root, 'focusin', (event) => {
    // Keyboard navigation and anchor jumps must never land in faded content.
    reveal(event.target.closest?.('.content-section'), true);
    resetMagnet();
    const target = event.target.closest?.('[data-ui-interactive]');
    if (target) { trackHover(target); fitVisual(target); }
  });
  listen(root, 'focusout', event => {
    const target = event.target.closest?.('[data-ui-interactive]');
    if (target) trackHover(target, settings.hover.releaseMs);
  });
  listen(root, 'click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const target = event.target.closest?.(rubricSelector);
    if (!target || target.matches(excludedSelector) || target.closest('[inert]')) return;
    clearSelection();
    clearSelection = activateRubric(target, { reduced: reduced.matches });
  });
  listen(reduced, 'change', () => {
    resetMagnet();
    if (reduced.matches) {
      observer?.disconnect();
      for (const section of sections) reveal(section, true);
    }
  });
  listen(fine, 'change', resetMagnet);

  return function dispose() {
    disposed = true;
    clearSelection();
    resetMagnet();
    hoverMotion.dispose();
    motionPublisher.reset();
    observer?.disconnect();
    resizeObserver?.disconnect();
    contentObserver?.disconnect();
    for (const remove of removers) remove();
    for (const [target, previous] of targets) {
      if (previous.attribute === null) target.removeAttribute('data-ui-interactive');
      else target.setAttribute('data-ui-interactive', previous.attribute);
      if (previous.scale) target.style.setProperty('--ui-target-scale', previous.scale);
      else target.style.removeProperty('--ui-target-scale');
    }
    for (const [wrapper, { created }] of wrappers) {
      if (created && wrapper.parentNode) wrapper.replaceWith(...wrapper.childNodes);
      else wrapper.classList.remove('interaction-visual');
    }
    for (const [name, previous] of originalProperties) {
      if (previous) owner.documentElement.style.setProperty(name, previous);
      else owner.documentElement.style.removeProperty(name);
    }
    // Cleanup also makes the page usable if enhancements are later replaced.
    for (const section of sections) section.classList.remove('reveal-pending', 'is-revealed', 'reveal-instant');
  };
}
