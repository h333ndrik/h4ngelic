import './gallery.css';
import { animateArtworkFlight, artworkRect } from './artwork-transitions.js';
import { inquiryArtwork } from './inquiry-content.js';
import { contactURL } from './routes.js';

/** Native modal artwork viewer. No scene, animation library or scroll handler. */
export function initGallery(root = document) {
  const triggers = [...root.querySelectorAll('[data-artwork-open]')];
  if (!triggers.length) return () => {};

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const dialog = document.createElement('dialog');
  dialog.className = 'artwork-dialog';
  dialog.setAttribute('aria-labelledby', 'artwork-viewer-title');
  dialog.innerHTML = `<div class="artwork-viewer-header">
      <h2 class="sr-only" id="artwork-viewer-title">artwork</h2>
      <a class="artwork-inquire text-link" href="${contactURL()}" data-inquiry-link>inquire</a>
      <button class="artwork-close" type="button" autofocus aria-label="close artwork viewer">close</button>
    </div>
    <figure class="artwork-viewer-figure">
      <div class="artwork-viewer-stage"></div>
      <figcaption class="artwork-viewer-caption"></figcaption>
    </figure>
    <div class="artwork-viewer-navigation">
      <button class="artwork-previous" type="button" aria-label="previous artwork image">previous</button>
      <p class="artwork-viewer-count" aria-live="polite"></p>
      <button class="artwork-next" type="button" aria-label="next artwork image">next</button>
    </div>
    <p class="artwork-viewer-status sr-only" role="status" aria-live="polite"></p>`;
  if (triggers.some(trigger => !trigger.closest('[data-horizontal-drift]'))) document.body.append(dialog);
  const stage = dialog.querySelector('.artwork-viewer-stage');
  const caption = dialog.querySelector('.artwork-viewer-caption');
  const count = dialog.querySelector('.artwork-viewer-count');
  const status = dialog.querySelector('.artwork-viewer-status');
  const title = dialog.querySelector('#artwork-viewer-title');
  const closeButton = dialog.querySelector('.artwork-close');
  const previousButton = dialog.querySelector('.artwork-previous');
  const nextButton = dialog.querySelector('.artwork-next');
  const removers = [];
  const timers = new Set();
  let images = [];
  let selected = 0;
  let displayed = 0;
  let opener = null;
  let ticket = 0;
  let closed = false;
  let closeTimer;
  let savedOverflow = '';
  let savedPadding = '';
  let pageLocked = false;
  let flight = null;
  let closing = false;
  let driftSection = null;
  let driftItem = null;
  let savedScroll = null;
  let savedDriftScroll = null;
  let outsidePress = null;
  let openingImage = null;
  let openingVisibility = '';
  let expanded = null;

  // Native archives keep their own image in its existing layout slot. The
  // same gallery controller handles this deliberately smaller interaction;
  // regular project images retain the established accessible detail viewer.
  function collapseInline() {
    if (!expanded) return;
    expanded.classList.remove('is-drift-expanded');
    expanded.setAttribute('aria-pressed', 'false');
    expanded.closest('[data-drift-item]')?.classList.remove('is-drift-expanded');
    expanded = null;
  }
  function toggleInline(trigger) {
    const same = expanded === trigger;
    collapseInline();
    if (same) return;
    expanded = trigger;
    trigger.classList.add('is-drift-expanded');
    trigger.setAttribute('aria-pressed', 'true');
    trigger.closest('[data-drift-item]')?.classList.add('is-drift-expanded');
  }

  const listen = (element, type, handler, options) => {
    element.addEventListener(type, handler, options);
    removers.push(() => element.removeEventListener(type, handler, options));
  };
  const delay = (milliseconds) => new Promise((resolve) => {
    const timer = setTimeout(() => { timers.delete(timer); resolve(); }, milliseconds);
    timers.add(timer);
  });
  const cancelFlight = () => { flight?.cancel(); flight = null; };

  // A loading class is opt-in only while JS is active; images remain visible
  // without JS or when they have already arrived from the browser cache.
  for (const trigger of triggers) {
    const image = trigger.querySelector('img');
    if (!image || image.complete) continue;
    trigger.classList.add('is-image-loading');
    const ready = () => trigger.classList.remove('is-image-loading');
    listen(image, 'load', ready, { once: true });
    listen(image, 'error', ready, { once: true });
  }

  async function showImage(index, { openingFrom, openingRect } = {}) {
    if (closing) return;
    cancelFlight();
    const request = ++ticket;
    selected = (index + images.length) % images.length;
    const thumbnail = images[selected];
    const source = thumbnail.dataset.fullSrc || thumbnail.currentSrc || thumbnail.src;
    const image = new Image();
    image.className = 'artwork-viewer-image';
    image.alt = thumbnail.alt;
    image.decoding = 'async';
    image.dataset.artworkImage = thumbnail.dataset.artworkImage || String(selected);
    image.src = source;
    status.textContent = 'loading image';
    count.textContent = `${selected + 1} / ${images.length}`;
    previousButton.hidden = nextButton.hidden = images.length < 2;
    try {
      await image.decode();
      if (closed || request !== ticket || !dialog.open) return;
      if (stage.firstElementChild && !reducedMotion.matches) {
        stage.classList.add('is-switching');
        await delay(110);
        if (closed || request !== ticket || !dialog.open) return;
      }
      stage.replaceChildren(image);
      if (!openingFrom && openingImage?.isConnected) openingImage.style.visibility = 'hidden';
      displayed = images.indexOf(thumbnail);
      caption.textContent = thumbnail.closest('figure')?.querySelector('figcaption')?.textContent || '';
      stage.classList.remove('has-image-error');
      if (openingFrom) {
        stage.classList.remove('is-switching');
        dialog.classList.add('is-open');
        const movement = animateArtworkFlight({ from: openingFrom, to: image, host: dialog, fromRect: openingRect });
        flight = movement;
        if (movement) {
          await movement.finished;
          if (flight === movement) flight = null;
          if (closed || request !== ticket || !dialog.open) return;
        }
        // The original keeps its layout slot while the photograph is enlarged;
        // avoid showing a second copy behind the centered shared element.
        if (!closing && openingImage?.isConnected) openingImage.style.visibility = 'hidden';
      } else if (reducedMotion.matches) stage.classList.remove('is-switching');
      else requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!closed && request === ticket) stage.classList.remove('is-switching');
      }));
      status.textContent = `image ${selected + 1} of ${images.length}`;
    } catch {
      if (closed || request !== ticket || !dialog.open) return;
      const message = document.createElement('p');
      message.className = 'artwork-image-error';
      message.textContent = 'image unavailable.';
      stage.replaceChildren(message);
      stage.classList.remove('is-switching');
      stage.classList.add('has-image-error');
      caption.textContent = '';
      status.textContent = 'image could not be loaded';
    }
  }

  function restorePage() {
    if (!pageLocked) return;
    pageLocked = false;
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPadding;
    if (openingImage) openingImage.style.visibility = openingVisibility;
    openingImage = null;
    if (driftSection) {
      driftSection.classList.remove('is-artwork-focused');
      driftSection.removeAttribute('data-drift-paused');
      driftSection.setAttribute('data-drift-focus-restore', '');
      driftItem?.classList.remove('is-drift-selected');
      opener?.classList.remove('is-artwork-selected');
      if (savedDriftScroll !== null) driftSection.querySelector('.drift-viewport')?.scrollTo({ left: savedDriftScroll, behavior: 'instant' });
    }
    if (savedScroll) scrollTo({ left: savedScroll[0], top: savedScroll[1], behavior: 'instant' });
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    driftSection?.removeAttribute('data-drift-focus-restore');
    driftSection = driftItem = savedScroll = savedDriftScroll = null;
  }

  function finishClose() {
    clearTimeout(closeTimer);
    if (!dialog.open) return;
    cancelFlight();
    closing = false;
    outsidePress = null;
    dialog.classList.remove('is-open');
    dialog.close();
    stage.replaceChildren();
    restorePage();
  }

  function requestClose() {
    if (!dialog.open || closing) return;
    closing = true;
    const request = ++ticket;
    const currentRect = flight?.currentRect();
    cancelFlight();
    const image = stage.querySelector('.artwork-viewer-image');
    // A carousel project can include hidden detail photographs. Return to its
    // actual opening photograph, rather than to a hidden or offscreen detail.
    // Ordinary multi-image pages can still return to the matching visible view.
    const destination = driftSection ? opener?.querySelector('img') : images[displayed];
    const movement = image && destination ? animateArtworkFlight({
      from: image, to: destination, host: dialog, direction: 'closing', fromRect: currentRect,
    }) : null;
    if (movement) {
      flight = movement;
      movement.finished.then(() => {
        if (flight === movement) flight = null;
        if (!closed && request === ticket && dialog.open) finishClose();
      });
    } else {
      dialog.classList.remove('is-open');
      if (reducedMotion.matches) finishClose();
      else closeTimer = setTimeout(finishClose, 160);
    }
  }

  function open(trigger) {
    if (closed || typeof dialog.showModal !== 'function') return;
    clearTimeout(closeTimer);
    cancelFlight();
    closing = false;
    opener = trigger;
    const project = trigger.closest('.project') || root;
    const identity = project.dataset?.projectUrl?.split('/').at(-1);
    const inquiryPath = contactURL(inquiryArtwork(identity) ? identity : '');
    dialog.querySelector('[data-inquiry-link]').setAttribute('href', document.documentElement.dataset.preview === 'standalone' ? `#${inquiryPath}` : inquiryPath);
    images = [...project.querySelectorAll('[data-artwork-open] img')];
    selected = images.indexOf(trigger.querySelector('img'));
    if (selected < 0) return;
    if (dialog.open) { dialog.classList.add('is-open'); showImage(selected); return; }
    title.textContent = project.querySelector('h1, h2')?.textContent || 'artwork';
    const openingFrom = trigger.querySelector('img');
    const openingRect = artworkRect(openingFrom);
    openingImage = openingFrom;
    openingVisibility = openingFrom.style.visibility;
    savedScroll = [scrollX, scrollY];
    driftSection = trigger.closest('[data-horizontal-drift]');
    driftItem = trigger.closest('[data-drift-item]');
    if (driftSection) {
      savedDriftScroll = driftSection.querySelector('.drift-viewport')?.scrollLeft ?? null;
      driftSection.setAttribute('data-drift-paused', '');
      driftSection.classList.add('is-artwork-focused');
      driftItem?.classList.add('is-drift-selected');
      trigger.classList.remove('is-artwork-selected');
      // The original rect was captured before the selection glow and before
      // neighbouring planes recede. Closing targets that unchanged plane.
      trigger.classList.add('is-artwork-selected');
    }
    savedOverflow = document.body.style.overflow;
    savedPadding = document.body.style.paddingRight;
    const scrollbar = innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
    document.body.style.overflow = 'hidden';
    pageLocked = true;
    stage.classList.add('is-switching');
    dialog.showModal();
    // One opening-time layout read establishes the opacity start state.
    dialog.getBoundingClientRect();
    closeButton.focus({ preventScroll: true });
    if (reducedMotion.matches) dialog.classList.add('is-open');
    else requestAnimationFrame(() => {
      if (!closed && dialog.open && !closing) dialog.classList.add('is-open');
    });
    showImage(selected, { openingFrom, openingRect });
  }

  for (const trigger of triggers) listen(trigger, 'click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (trigger.closest('[data-horizontal-drift]')) {
      event.preventDefault();
      toggleInline(trigger);
      return;
    }
    collapseInline();
    // Published image links retain their detail URLs without JavaScript;
    // modified clicks retain native new-tab behavior.
    if (typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    open(trigger);
  });
  listen(document, 'click', event => {
    if (expanded && !expanded.contains(event.target)) collapseInline();
  });
  listen(document, 'keydown', event => {
    if (event.key === 'Escape' && expanded) { event.preventDefault(); collapseInline(); }
  });
  listen(closeButton, 'click', requestClose);
  listen(previousButton, 'click', () => showImage(selected - 1));
  listen(nextButton, 'click', () => showImage(selected + 1));
  listen(dialog, 'cancel', (event) => { event.preventDefault(); requestClose(); });
  listen(dialog, 'pointerdown', (event) => {
    // Track the start of a background gesture so selecting caption text or
    // dragging across the photograph cannot accidentally dismiss the viewer.
    outsidePress = event.button === 0 ? { x: event.clientX, y: event.clientY, target: event.target } : null;
  }, { passive: true });
  listen(dialog, 'click', (event) => {
    const target = event.target;
    const press = outsidePress;
    outsidePress = null;
    if (target.closest?.('a, button') || target.closest?.('.artwork-viewer-caption')) return;
    if (target.matches?.('.artwork-viewer-image')) {
      requestClose();
      return;
    }
    // The dialog itself is transparent: its stage/figure blank space is also
    // visibly outside the photograph, not only the narrow native backdrop.
    const background = target === dialog || target === stage || target.matches?.('.artwork-viewer-figure');
    if (background && (!press || (press.target === target && Math.hypot(event.clientX - press.x, event.clientY - press.y) < 8))) requestClose();
  });
  listen(dialog, 'keydown', (event) => {
    if (event.key === 'ArrowLeft' && images.length > 1) { event.preventDefault(); showImage(selected - 1); }
    if (event.key === 'ArrowRight' && images.length > 1) { event.preventDefault(); showImage(selected + 1); }
  });
  listen(dialog, 'close', () => {
    if (dialog.open) return;
    ++ticket;
    clearTimeout(closeTimer);
    cancelFlight(); closing = false; dialog.classList.remove('is-open'); stage.replaceChildren(); restorePage();
  });
  listen(reducedMotion, 'change', () => {
    if (!reducedMotion.matches) return;
    cancelFlight();
    stage.classList.remove('is-switching');
    if (closing) finishClose();
  });
  listen(window, 'resize', cancelFlight);

  return () => {
    closed = true;
    collapseInline();
    ++ticket;
    cancelFlight();
    clearTimeout(closeTimer);
    for (const timer of timers) clearTimeout(timer);
    for (const remove of removers) remove();
    if (dialog.open) { dialog.close(); restorePage(); }
    dialog.remove();
    for (const trigger of triggers) trigger.classList.remove('is-image-loading');
  };
}
