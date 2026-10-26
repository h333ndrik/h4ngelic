import './global-navigation.css';
import { activeChapter, primaryIndexPage } from './global-navigation-state.js';

/** Persistent navigation around the existing page renderer. Native details and
 * anchors remain usable in prerendered HTML without this enhancement. */
export function initGlobalNavigation(doc = document) {
  const view = doc.defaultView;
  const index = doc.querySelector('[data-global-index]');
  if (!view || !index) return Object.assign(() => {}, { refresh: () => {} });
  const summary = index.querySelector('summary');
  const links = [...index.querySelectorAll('[data-index-page]')];
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const removers = [];
  let disposed = false;
  let frame = 0;
  let dirty = true;
  let chapters = [];
  let tops = [];
  let current = -1;
  let digitAnimation = null;
  let resizeObserver = null;
  let formObserver = null;
  const formIntersections = new Set();
  const chapter = doc.createElement('button');
  chapter.type = 'button';
  chapter.className = 'chapter-counter';
  chapter.hidden = true;
  chapter.setAttribute('data-chapter-counter', '');
  chapter.setAttribute('data-no-ink', '');
  chapter.setAttribute('data-no-hover', '');
  chapter.setAttribute('data-corruption-protected', '');
  const currentWrap = doc.createElement('span');
  currentWrap.className = 'chapter-digit-window';
  currentWrap.setAttribute('aria-hidden', 'true');
  const digits = doc.createElement('span');
  digits.className = 'chapter-digit';
  currentWrap.append(digits);
  const total = doc.createElement('span');
  total.className = 'chapter-total';
  total.setAttribute('aria-hidden', 'true');
  chapter.append(currentWrap, total);
  doc.body.append(chapter);

  const listen = (target, event, callback, options) => {
    target.addEventListener(event, callback, options);
    removers.push(() => target.removeEventListener(event, callback, options));
  };

  function protectForm() {
    const blocked = formIntersections.size > 0 || Boolean(doc.activeElement?.closest?.('[data-inquiry-form]'));
    chapter.classList.toggle('is-over-form', blocked);
    chapter.tabIndex = blocked ? -1 : 0;
    if (blocked) chapter.setAttribute('aria-hidden', 'true');
    else chapter.removeAttribute('aria-hidden');
  }

  function observeFormControls() {
    formObserver?.disconnect(); formIntersections.clear(); protectForm();
    if (!chapters.length || !('IntersectionObserver' in view)) return;
    // A small observer region matches the fixed counter. Fade it only while
    // an actual form control passes underneath; it cannot steal a submit tap.
    const side = Math.max(0, (doc.documentElement.clientWidth - 100) / 2);
    formObserver = new view.IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) formIntersections.add(entry.target);
        else formIntersections.delete(entry.target);
      }
      protectForm();
    }, { rootMargin: `${-Math.max(0, view.innerHeight - 72)}px ${-side}px 0px ${-side}px`, threshold: 0 });
    for (const control of doc.querySelectorAll('[data-inquiry-form] input:not([type="hidden"]), [data-inquiry-form] textarea, [data-inquiry-form] button, .inquiry-file-label')) formObserver.observe(control);
  }

  function close({ focus = false } = {}) {
    if (!index.open) return;
    index.open = false;
    summary.setAttribute('aria-expanded', 'false');
    if (focus) summary.focus({ preventScroll: true });
  }

  function positionIndex() {
    if (!index.open) return;
    const controls = doc.querySelector('.hero:not([hidden]) [data-controls]');
    const summaryBox = summary.getBoundingClientRect();
    const controlBox = controls?.getBoundingClientRect();
    // The menu starts below the actual upper controls on Home, including when
    // those controls wrap on a narrow screen. Other pages use the compact gap.
    const top = controlBox && controlBox.bottom > summaryBox.bottom && controlBox.top < view.innerHeight
      ? Math.max(summaryBox.height + 10, controlBox.bottom - summaryBox.top + 12)
      : summaryBox.height + 10;
    index.style.setProperty('--index-panel-top', `${Math.round(top)}px`);
  }

  function paintChapter(next) {
    if (next < 0 || next === current) return;
    const previous = current;
    current = next;
    digitAnimation?.cancel();
    digits.textContent = String(current + 1).padStart(2, '0');
    total.textContent = ` / ${String(chapters.length).padStart(2, '0')}`;
    const nextChapter = chapters[(current + 1) % chapters.length];
    chapter.setAttribute('aria-label', `chapter ${current + 1} of ${chapters.length}, ${chapters[current].label}. go to ${nextChapter.label}`);
    chapter.dataset.chapter = String(current + 1);
    chapter.dataset.chapterTotal = String(chapters.length);
    if (previous >= 0 && !reduced.matches && typeof digits.animate === 'function') {
      digitAnimation = digits.animate([
        { transform: `translateY(${next > previous ? '90%' : '-90%'})`, opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ], { duration: 180, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }
  }

  function update() {
    frame = 0;
    if (disposed || doc.hidden || !chapters.length) return;
    if (dirty) {
      const scrollTop = view.scrollY;
      tops = chapters.map(({ element }) => element.getBoundingClientRect().top + scrollTop);
      dirty = false;
    }
    paintChapter(activeChapter(tops, view.scrollY, view.innerHeight));
    positionIndex();
  }

  function schedule(remeasure = false) {
    dirty ||= remeasure;
    if (!frame && !doc.hidden && !disposed) frame = view.requestAnimationFrame(update);
  }

  function refresh() {
    if (disposed) return;
    close();
    const primary = primaryIndexPage(doc.documentElement.dataset.page);
    for (const link of links) {
      if (link.dataset.indexPage === primary) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    resizeObserver?.disconnect();
    chapters = [];
    if (primary === 'home') {
      const hero = doc.querySelector('.hero:not([hidden])');
      if (hero) chapters.push({ element: hero, label: 'home' });
      for (const element of doc.querySelectorAll('#page-content > .content-section[data-motion]')) {
        const heading = element.querySelector('.kinetic-heading')?.textContent || element.dataset.motion;
        chapters.push({ element, label: heading.trim().replace(/^\d+\s*\/\s*/, '').toLowerCase() });
      }
      for (const { element } of chapters) {
        if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
        resizeObserver?.observe(element);
      }
    }
    chapter.hidden = chapters.length < 2;
    observeFormControls();
    current = -1;
    dirty = true;
    if (chapters.length) update();
  }

  if ('ResizeObserver' in view) resizeObserver = new view.ResizeObserver(() => schedule(true));
  listen(index, 'toggle', () => {
    summary.setAttribute('aria-expanded', String(index.open));
    positionIndex();
  });
  listen(index, 'click', event => {
    if (event.target.closest?.('a[href]')) close();
  });
  listen(doc, 'keydown', event => {
    if (event.key === 'Escape' && index.open) {
      event.preventDefault();
      close({ focus: true });
    }
  });
  listen(doc, 'pointerdown', event => {
    if (index.open && !index.contains(event.target)) close();
  }, { passive: true });
  listen(doc, 'focusin', event => {
    if (index.open && !index.contains(event.target)) close();
    protectForm();
  });
  listen(doc, 'focusout', () => view.queueMicrotask(protectForm));
  listen(chapter, 'click', () => {
    if (!chapters.length) return;
    const target = chapters[(current + 1) % chapters.length].element;
    // Focus gives the existing choreography its immediate, fully readable pose;
    // native scrolling remains free in either direction after this direct jump.
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'instant' : 'smooth' });
  });
  listen(doc, 'h4:pagechange', refresh);
  listen(doc, 'h4:navigationstart', close);
  listen(view, 'scroll', () => schedule(), { passive: true });
  listen(view, 'resize', () => { schedule(true); observeFormControls(); }, { passive: true });
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) {
      if (frame) view.cancelAnimationFrame(frame);
      frame = 0;
      digitAnimation?.cancel();
    } else schedule(true);
  });
  listen(reduced, 'change', () => {
    if (reduced.matches) digitAnimation?.cancel();
    schedule(true);
  });
  summary.setAttribute('aria-expanded', String(index.open));
  refresh();
  return Object.assign(() => {
    disposed = true;
    if (frame) view.cancelAnimationFrame(frame);
    digitAnimation?.cancel();
    resizeObserver?.disconnect();
    formObserver?.disconnect(); formIntersections.clear();
    for (const remove of removers) remove();
    chapter.remove();
    index.style.removeProperty('--index-panel-top');
    summary.removeAttribute('aria-expanded');
  }, { refresh });
}
