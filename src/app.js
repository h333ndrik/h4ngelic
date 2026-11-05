import './style.css';
import './homepage.css';
import './archive-structure.css';
import './horizontal-drift.css';
import './flash-mannequin.css';
import './inquiry.css';
import './v6-polish.css';
import './easter-eggs.css';
import './cursor.css';
import { siteContent } from './data/siteContent.js';
import { renderRoutePage } from './pages.js';
import { resolveRoute } from './routes.js';
import { getPageMetadata, applyMetadata } from './seo.js';
import { initInteractions } from './interactions.js';
import { initGallery } from './gallery.js';
import { initScrollChoreography } from './scroll-choreography.js';
import { initNavigation } from './navigation.js';
import { initImageReveals } from './image-reveals.js';
import { featureFlags } from './data/featureFlags.js';
import { initCorruptionLifecycle } from './corruption-lifecycle.js';
import { initXRay } from './xray.js';
import { initModeIcons } from './mode-icons.js';
import { initInteractionMosh } from './interaction-mosh.js';
import { initMoshTransitions } from './mosh-transitions.js';
import { initEndReveal } from './end-reveal.js';
import { initMotionMosh } from './motion-mosh.js';
import { initGlobalNavigation } from './global-navigation.js';
import { initInquiry } from './inquiry.js';
import { initConnectedWork } from './connected-work.js';
import { heroPosterSettings } from './data/heroPosterSettings.js';
import { fitRubricRows } from './rubric-fit.js';

if (__H4_BUILD_LOG__) console.info(`[h4ngelic] build ${__H4_BUILD_SHA__}`);
document.documentElement.dataset.h4StylesReady = 'true';

let hero = document.querySelector('.hero');
const content = document.getElementById('page-content');
const standalone = document.documentElement.dataset.preview === 'standalone';
let heroLoaded = false;
let stopInteractions = () => {};
let stopGallery = () => {};
let stopMotion = () => {};
let stopImageReveals = () => {};
let stopEndReveal = () => {};
let stopDrift = () => {};
let stopMannequins = () => {};
let heroObserver = null;
let heroPreloadsActivated = false;
const heroReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const heroBootTimeoutMs = 6000;
let heroBootTimer = 0;
let heroSceneReady = false;
let heroBootFailed = false;
let moshTransitions = null;
let renderRevision = 0;
let renderedKind = '';
let renderedPath = '';
let stopInquiry = () => {};
let stopConnectedWork = () => {};
let slashInsetFrame = 0;
let otherSideController = null;
// One scroll offset for each real carousel; route changes reuse these small
// records rather than retaining detached gallery nodes or image resources.
const carouselPositions = new Map();
const globalNavigation = initGlobalNavigation(document);

function measureSlashInset() {
  const heading = document.querySelector('#selected-work-title .kinetic-heading-text');
  const section = heading?.closest('.content-section');
  if (!heading || !section) return;
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  let node, slashOffset = -1;
  while ((node = walker.nextNode())) {
    const index = node.textContent.indexOf('/');
    if (index >= 0) { slashOffset = index; break; }
  }
  if (slashOffset < 0) return;
  const range = document.createRange();
  range.setStart(node, slashOffset);
  range.setEnd(node, slashOffset + 1);
  const transform = getComputedStyle(heading).transform;
  const translation = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
  const sectionBox = section.getBoundingClientRect();
  const contentLeft = sectionBox.left + parseFloat(getComputedStyle(section).paddingLeft || '0');
  const inset = range.getBoundingClientRect().left - translation - contentLeft;
  if (Number.isFinite(inset) && inset > 0) {
    document.documentElement.style.setProperty('--slash-inset', `${Math.round(inset * 100) / 100}px`);
  }
}

function scheduleSlashInset() {
  if (slashInsetFrame) return;
  slashInsetFrame = requestAnimationFrame(() => {
    slashInsetFrame = 0;
    measureSlashInset();
    fitRubricRows();
  });
}

addEventListener('resize', scheduleSlashInset, { passive: true });
addEventListener('load', scheduleSlashInset, { passive: true });
// Rubric fitting reads real glyph widths: every late webfont must re-run it.
document.fonts?.ready.then(scheduleSlashInset);
document.fonts?.addEventListener?.('loadingdone', scheduleSlashInset);

function clearHeroBootTimer() {
  if (!heroBootTimer) return;
  clearTimeout(heroBootTimer);
  heroBootTimer = 0;
}

function heroStage() {
  return hero?.querySelector('#stage') || null;
}

function setHeroStatus(message) {
  const status = hero?.querySelector('#scene-status');
  if (status) status.textContent = message;
}

function markHeroReady() {
  heroSceneReady = true;
  heroBootFailed = false;
  clearHeroBootTimer();
  document.documentElement.dataset.heroLoading = 'false';
  const stage = heroStage();
  stage?.classList.remove('is-boot-slow', 'is-boot-failed', 'is-fallback');
}

function showHeroFailure(message = 'Static h4ngelic wordmark. The interactive version could not be loaded.') {
  clearHeroBootTimer();
  heroSceneReady = true;
  heroBootFailed = true;
  document.documentElement.dataset.heroLoading = 'false';
  const stage = heroStage();
  stage?.classList.remove('is-ready', 'is-boot-slow');
  stage?.classList.add('is-boot-failed', 'is-fallback');
  setHeroStatus(message);
  const hint = hero?.querySelector('#interaction-hint');
  if (hint) hint.textContent = 'h4ngelic';
  for (const id of ['pause-control', 'speed-control', 'reveal-control']) {
    const control = document.getElementById(id);
    if (control) control.disabled = true;
  }
}

function markHeroFailed(error) {
  showHeroFailure();
  console.error('Unable to load the interactive wordmark.', error);
}

function startHeroBoot() {
  if (heroReducedMotion.matches || heroSceneReady) return;
  document.documentElement.dataset.heroLoading = 'true';
  if (heroBootTimer) return;
  heroBootTimer = setTimeout(() => {
    heroBootTimer = 0;
    if (heroSceneReady || !hero || hero.hidden) return;
    heroStage()?.classList.add('is-boot-slow');
    setHeroStatus('The interactive wordmark is taking longer than usual.');
  }, heroBootTimeoutMs);
}

function ensureHero() {
  if (!hero) {
    const template = document.getElementById('hero-template');
    if (!template) return;
    template.before(template.content.cloneNode(true));
    template.remove();
    hero = document.querySelector('.hero');
  }
  const brand = document.querySelector('[data-floating-brand]');
  if (brand) brand.textContent = siteContent.name;
}


function activateHeroPreloads() {
  if (heroPreloadsActivated) return;
  heroPreloadsActivated = true;
  const template = document.getElementById('hero-preloads');
  if (!template) return;
  for (const link of template.content.querySelectorAll('[data-hero-preload]')) {
    if (document.head.querySelector(`[data-hero-preload="${link.dataset.heroPreload}"]`)) continue;
    document.head.append(link.cloneNode(true));
  }
  template.remove();
}

function configureHeroPoster() {
  const poster = hero?.querySelector('[data-hero-poster]');
  if (!poster) return;
  poster.style.setProperty('--hero-poster-image', `url("${heroPosterSettings.src}")`);
  poster.setAttribute('aria-label', heroPosterSettings.alt);
  const stage = hero.querySelector('#stage');
  stage?.style.setProperty('--hero-poster-fade', `${heroPosterSettings.fadeDurationMs}ms`);
}

function startsOnHero() {
  if (!location.hash) return true;
  let id = location.hash.slice(1);
  try { id = decodeURIComponent(id); } catch { /* Use the literal fragment. */ }
  const target = document.getElementById(id);
  return !target || target === hero || hero.contains(target);
}

function prepareHero() {
  ensureHero();
  if (!hero) return;
  hero.hidden = false;
  configureHeroPoster();
  if (heroBootFailed) {
    showHeroFailure();
    return;
  }
  clearHeroBootTimer();
  const stage = heroStage();
  stage?.classList.remove('is-boot-slow', 'is-boot-failed');
  heroSceneReady = Boolean(stage?.classList.contains('is-ready') || stage?.classList.contains('is-poster-static'));
  document.documentElement.dataset.heroLoading = heroSceneReady ? 'false' : 'true';
  if (heroReducedMotion.matches && heroPosterSettings.reducedMotionStatic) {
    stage?.classList.add('is-poster-static');
    const status = hero.querySelector('#scene-status');
    if (status) status.textContent = 'Static h4ngelic wordmark. Motion is disabled by your device preference.';
    heroSceneReady = true;
    document.documentElement.dataset.heroLoading = 'false';
    return;
  }
  stage?.classList.remove('is-poster-static');
  // A direct Home anchor such as /#contact opens below the hero. Do not fetch
  // the Three.js chunk, font or texture until the hero actually approaches.
  if (startsOnHero()) activateHeroPreloads();
  if (heroLoaded) {
    if (!heroSceneReady) startHeroBoot();
    return;
  }
  heroObserver?.disconnect();
  heroObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting || heroLoaded || hero.hidden) return;
    heroLoaded = true;
    heroObserver.disconnect();
    activateHeroPreloads();
    startHeroBoot();
    import('./main.js').catch(markHeroFailed);
  });
  heroObserver.observe(hero);
}

document.addEventListener('h4:heroready', markHeroReady);
document.addEventListener('h4:herofailed', event => showHeroFailure(event.detail?.message));

function currentURL() {
  // The downloadable preview uses hash routes so its pages work without a server.
  // The real website always uses ordinary /creative, /about and /#contact anchors.
  return standalone
    ? new URL(location.hash.slice(1).startsWith('/') ? location.hash.slice(1) : '/', 'https://preview.invalid')
    : new URL(location.href);
}

function scrollToTarget(url, { reset = false, restoreScroll, smoothAnchor = false } = {}) {
  // View Transition update callbacks suspend animation frames. Apply layout,
  // scroll and focus together before their new-document snapshot is captured.
  let target = null;
  if (url.hash) {
    try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { /* Ignore malformed fragments. */ }
  }
  if (restoreScroll) {
    scrollTo({ left: restoreScroll[0], top: restoreScroll[1], behavior: 'instant' });
    if (reset) (target || content).focus({ preventScroll: true });
  } else if (target) {
    // Focus settles the existing scroll choreography immediately on a direct
    // jump; ordinary scrolling remains reversible after focus moves away.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: smoothAnchor && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant', block: 'start' });
  } else if (reset) {
    scrollTo({ top: 0, behavior: 'instant' });
    content.focus({ preventScroll: true });
  }
}

async function render({ reset = false, restoreScroll, smoothAnchor = false } = {}) {
  let url = currentURL();
  const route = resolveRoute(url);
  if (route.kind === 'impressum' && document.documentElement.dataset.mode === 'xray') otherSideController?.setMode('normal');
  if (route.redirectPath) {
    if (standalone) history.replaceState(history.state, '', `#${route.redirectPath}`);
    else history.replaceState(history.state, '', route.redirectPath);
    url = new URL(route.redirectPath, url);
  }
  // Same-document anchors retain canvas/input state; a different category is
  // a real page and must mount its own content even if the old archive has it.
  const sameDocument = route.kind === 'home' || route.kind === 'work' && renderedPath === route.canonicalPath;
  if (renderedKind === route.kind && sameDocument) {
    stopInquiry.refreshContext?.(url);
    if (route.kind === 'work') content.querySelector('[data-connected-work]').dataset.workContext = route.category;
    const metadataOptions = typeof __H4_SEO_CONFIG__ === 'undefined' ? {} : __H4_SEO_CONFIG__;
    applyMetadata(getPageMetadata(route, metadataOptions));
    scrollToTarget(url, { reset, restoreScroll, smoothAnchor });
    globalNavigation.refresh();
    return;
  }
  const revision = ++renderRevision;
  if (renderedKind === 'work') for (const section of content.querySelectorAll('[data-horizontal-drift]')) {
    carouselPositions.set(section.dataset.horizontalDrift, section.querySelector('.drift-viewport').scrollLeft);
  }
  renderedKind = '';
  renderedPath = '';
  stopInteractions();
  stopGallery();
  stopMotion();
  stopImageReveals();
  stopEndReveal();
  stopDrift();
  stopMannequins();
  stopInquiry();
  stopConnectedWork();
  stopDrift = stopMannequins = () => {};
  heroObserver?.disconnect();
  if (hero) hero.hidden = route.kind !== 'home';
  document.documentElement.dataset.page = route.kind;
  if (content.dataset.prerendered !== route.canonicalPath) content.innerHTML = renderRoutePage(route, { context: url.searchParams.get('artwork') || '' });
  delete content.dataset.prerendered;
  if (route.kind === 'home') prepareHero();
  const metadataOptions = typeof __H4_SEO_CONFIG__ === 'undefined' ? {} : __H4_SEO_CONFIG__;
  applyMetadata(getPageMetadata(route, metadataOptions));
  stopInteractions = initInteractions(document, { revealSections: false });
  stopGallery = initGallery(content);
  stopMotion = initScrollChoreography(content);
  stopEndReveal = initEndReveal(content);
  stopImageReveals = initImageReveals(content);
  stopInquiry = initInquiry(content);
  stopInquiry.refreshContext?.(url);
  stopConnectedWork = initConnectedWork(content);
  scheduleSlashInset();
  document.fonts?.ready.then(scheduleSlashInset);

  if (standalone) {
    for (const link of document.querySelectorAll('a[href^="/"]')) {
      link.setAttribute('href', `#${link.getAttribute('href')}`);
    }
  }
  // Empty archives pay no runtime cost for future galleries or models. CSS
  // remains in the entry so the prerendered image dimensions/sticky sections
  // are already reserved before these optional enhancements finish loading.
  const enhancements = [];
  if (content.querySelector('[data-horizontal-drift]')) enhancements.push(
    import('./horizontal-drift.js').then(({ initHorizontalDrift }) => {
      if (revision === renderRevision) stopDrift = initHorizontalDrift(content);
    }));
  if ((import.meta.env.DEV || typeof __H4_HAS_MANNEQUINS__ === 'undefined' || __H4_HAS_MANNEQUINS__)
    && content.querySelector('[data-flash-mannequin]')) enhancements.push(
    import('./flash-mannequin.js').then(({ initFlashMannequins }) => {
      if (revision === renderRevision) stopMannequins = initFlashMannequins(content);
    }));
  await Promise.allSettled(enhancements);
  if (revision !== renderRevision) return;
  if (route.kind === 'work') for (const section of content.querySelectorAll('[data-horizontal-drift]')) {
    const left = carouselPositions.get(section.dataset.horizontalDrift);
    if (Number.isFinite(left)) section.querySelector('.drift-viewport').scrollTo({ left, behavior: 'instant' });
  }
  renderedKind = route.kind;
  renderedPath = route.canonicalPath;
  scrollToTarget(url, { reset, restoreScroll, smoothAnchor });
  globalNavigation.refresh();
}

function afterFirstPaint(task) {
  const schedule = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => task(), { timeout: 500 });
    else setTimeout(task, 120);
  };
  const wait = () => requestAnimationFrame(() => requestAnimationFrame(schedule));
  if (document.readyState === 'complete') wait();
  else addEventListener('load', wait, { once: true });
}

render();
// The approved moshlab placeholder stays inert even before deferred easter eggs load.
document.addEventListener('click', event => {
  if (event.target.closest?.('[data-moshlab-placeholder]')) event.preventDefault();
});
// Ink sampling, visitor memory and the remaining easter-egg bindings are not
// needed for the first frame. Their module and initialization wait for idle,
// while hero input and the main navigation stay immediately responsive.
afterFirstPaint(() => {
  import('./easter-eggs.js').then(({ initEasterEggs }) => {
    if (!document.documentElement.dataset.h4EasterEggsReady) {
      document.documentElement.dataset.h4EasterEggsReady = 'true';
      initEasterEggs(document);
    }
  }).catch(() => {});
});
if (featureFlags.otherSideEnabled) {
  const corruptionLifecycle = initCorruptionLifecycle();
  // Input handling is needed from startup. Bundle it with the entry stylesheet
  // instead of delaying first paint with an immediately requested CSS chunk.
  // Film, pixel rendering, damaged material and Web Audio stay gesture-driven.
  otherSideController = initXRay({ memory: corruptionLifecycle });
  initModeIcons();
  const motionMosh = initMotionMosh({ doc: document });
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('fx') === '1') {
    import('./dev/living-decay-panel.js').then(({ initLivingDecayPanel }) => {
      initLivingDecayPanel({ doc: document, getController: () => corruptionLifecycle.getController?.() });
    });
  }
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('playground') === '1') {
    import('./dev/other-side-playground.js').then(({ initOtherSidePlayground }) => {
      window.__H4_PLAYGROUND__ = initOtherSidePlayground({ doc: document, getController: () => corruptionLifecycle.getController?.() });
    });
  }
  moshTransitions = initMoshTransitions({ doc: document });
  const interactionMosh = initInteractionMosh({ doc: document });
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
    window.__H4_INTERACTION_MOSH__ = { snapshot: () => ({
      events: interactionMosh.snapshot(), transitions: moshTransitions.snapshot(),
    }) };
    window.__H4_MOTION_MOSH__ = motionMosh;
  }
}
if (standalone) {
  let hashRevision = 0;
  const navigateHash = () => {
    const revision = ++hashRevision;
    document.dispatchEvent(new CustomEvent('h4:navigationstart'));
    const commit = async () => {
      if (revision !== hashRevision) return;
      await render({ reset: true, smoothAnchor: Boolean(currentURL().hash) });
      if (revision === hashRevision) document.dispatchEvent(new CustomEvent('h4:pagechange'));
    };
    if (!moshTransitions?.navigation(commit, { standalone: true })) commit();
  };
  addEventListener('hashchange', navigateHash);
  // Clicking the current hash does not emit hashchange. A persistent Home or
  // Contact link must still return to its real destination after free scrolling.
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.('a[href]');
    const destination = anchor?.getAttribute('href');
    if (!destination?.startsWith('#/') || destination !== location.hash || anchor.hasAttribute('download')
      || (anchor.target && anchor.target !== '_self')) return;
    event.preventDefault();
    navigateHash();
  });
  document.querySelector('.skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    content.focus();
    content.scrollIntoView({ behavior: 'instant' });
  });
} else initNavigation({ render, moshTransitions });
