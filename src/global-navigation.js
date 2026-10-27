import './global-navigation.css';
import { activeChapter, primaryIndexPage, hasFinalChapterStop, clearChapterTop } from './global-navigation-state.js';

/** Persistent navigation around the existing page renderer. Native details and
 * anchors remain usable in prerendered HTML without this enhancement. */
export function initGlobalNavigation(doc = document) {
  const view = doc.defaultView;
  const index = doc.querySelector('[data-global-index]');
  if (!view || !index) return Object.assign(() => {}, { refresh: () => {} });
  const summary = index.querySelector('summary');
  const originalIndexHidden = index.hidden;
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
  let finalStop = null;
  let finalTop = Infinity;
  let maximumScroll = 0;
  let formRectangles = [];
  let counterGeometry = null;
  let counterShift = 0;
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

  function measureCounter() {
    const bottom = parseFloat(view.getComputedStyle(chapter).bottom) || 12;
    const width = Math.max(100, chapter.offsetWidth * 1.08);
    const height = Math.max(48, chapter.offsetHeight * 1.08);
    counterGeometry = { top: view.innerHeight - bottom - chapter.offsetHeight,
      left: (view.innerWidth - width) / 2, right: (view.innerWidth + width) / 2,
      height, actualHeight: chapter.offsetHeight, bottom };
    formRectangles = [...doc.querySelectorAll('[data-inquiry-form] input:not([type="hidden"]), [data-inquiry-form] textarea, [data-inquiry-form] button, .inquiry-file-label')]
      .filter(control => !control.closest('.inquiry-honey'))
      .map(control => {
        const box = control.getBoundingClientRect();
        // The Contact entrance only translates horizontally. Cache its natural
        // footprint so the navigation is safe before that entrance has settled.
        const moving = control.closest('[data-motion-item="form"]');
        const entranceX = parseFloat(moving?.style.getPropertyValue('--kinetic-x')) || 0;
        return { left: box.left - entranceX, right: box.right - entranceX,
          top: box.top + view.scrollY, bottom: box.bottom + view.scrollY, width: box.width, height: box.height };
      }).filter(box => box.width > 2 && box.height > 2);
  }

  function positionCounter() {
    if (!counterGeometry) return;
    const viewportTop = view.visualViewport?.offsetTop || 0;
    const viewportBottom = viewportTop + (view.visualViewport?.height || view.innerHeight);
    const preferredTop = Math.min(counterGeometry.top, viewportBottom - counterGeometry.bottom - counterGeometry.actualHeight);
    const obstacles = formRectangles.filter(box => box.right > counterGeometry.left - 6 && box.left < counterGeometry.right + 6)
      .map(box => ({ top: box.top - view.scrollY, bottom: box.bottom - view.scrollY }));
    const top = clearChapterTop({ preferredTop, previousTop: counterGeometry.top + counterShift,
      height: counterGeometry.height, viewportTop, viewportBottom, obstacles });
    const shift = Math.round((top - counterGeometry.top) * 100) / 100;
    if (shift !== counterShift) {
      counterShift = shift;
      chapter.style.setProperty('--chapter-dodge-y', `${shift}px`);
    }
    chapter.classList.toggle('is-over-form', Math.abs(top - preferredTop) > 1);
  }

  function nextDestination() {
    if (finalStop && hasFinalChapterStop({ current, count: chapters.length, scrollTop: view.scrollY, finalTop, maximumScroll })) {
      return { element: finalStop, label: 'the final h4 reveal', key: 'final' };
    }
    const next = chapters[(current + 1) % chapters.length];
    return next && { ...next, key: (current + 1) % chapters.length === 0 ? 'home' : String((current + 1) % chapters.length + 1) };
  }

  function close({ focus = false } = {}) {
    if (!index.open) return;
    index.open = false;
    summary.setAttribute('aria-expanded', 'false');
    if (focus && !index.hidden) summary.focus({ preventScroll: true });
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
    if (next < 0) return;
    const previous = current;
    current = next;
    const nextChapter = nextDestination();
    const label = `chapter ${current + 1} of ${chapters.length}, ${chapters[current].label}. go to ${nextChapter.label}`;
    if (chapter.getAttribute('aria-label') !== label) chapter.setAttribute('aria-label', label);
    if (chapter.dataset.chapterTarget !== nextChapter.key) chapter.dataset.chapterTarget = nextChapter.key;
    if (next === previous) return;
    digitAnimation?.cancel();
    digits.textContent = String(current + 1).padStart(2, '0');
    total.textContent = ` / ${String(chapters.length).padStart(2, '0')}`;
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
      finalTop = finalStop ? finalStop.getBoundingClientRect().top + scrollTop : Infinity;
      maximumScroll = Math.max(0, doc.documentElement.scrollHeight - view.innerHeight);
      measureCounter();
      dirty = false;
    }
    paintChapter(activeChapter(tops, view.scrollY, view.innerHeight));
    positionCounter();
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
    index.hidden = primary === 'home';
    for (const link of links) {
      if (link.dataset.indexPage === primary) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    resizeObserver?.disconnect();
    chapters = [];
    finalStop = null;
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
      // The quiet h4 ending remains part of Contact (chapter 4). Give it a
      // reachable next stop before wrapping the chapter navigation to Home.
      finalStop = doc.querySelector('[data-footer-secret-space]');
      if (finalStop) {
        if (!finalStop.hasAttribute('tabindex')) finalStop.setAttribute('tabindex', '-1');
        resizeObserver?.observe(finalStop);
      }
      for (const form of doc.querySelectorAll('[data-inquiry-form]')) resizeObserver?.observe(form);
    }
    chapter.hidden = chapters.length < 2;
    formRectangles = [];
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
    schedule(true);
  });
  listen(doc, 'focusout', () => schedule(true));
  listen(chapter, 'click', () => {
    if (!chapters.length) return;
    const target = nextDestination()?.element;
    if (!target) return;
    // Focus gives the existing choreography its immediate, fully readable pose;
    // native scrolling remains free in either direction after this direct jump.
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'instant' : 'smooth' });
  });
  listen(doc, 'h4:pagechange', refresh);
  listen(doc, 'h4:navigationstart', close);
  listen(view, 'scroll', () => schedule(), { passive: true });
  listen(view, 'resize', () => schedule(true), { passive: true });
  if (view.visualViewport) {
    listen(view.visualViewport, 'resize', () => schedule(true), { passive: true });
    listen(view.visualViewport, 'scroll', () => schedule(), { passive: true });
  }
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
    for (const remove of removers) remove();
    chapter.remove();
    index.hidden = originalIndexHidden;
    index.style.removeProperty('--index-panel-top');
    summary.removeAttribute('aria-expanded');
  }, { refresh });
}
