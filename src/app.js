import './style.css';
import './homepage.css';
import './archive-structure.css';
import './horizontal-drift.css';
import './digital-ink.css';
import './flash-mannequin.css';
import './inquiry.css';
import './v6-polish.css';
import { siteContent } from './data/siteContent.js';
import { renderRoutePage } from './pages.js';
import { resolveRoute } from './routes.js';
import { getPageMetadata, applyMetadata } from './seo.js';
import { initInteractions } from './interactions.js';
import { initGallery } from './gallery.js';
import { initScrollChoreography } from './scroll-choreography.js';
import { initNavigation } from './navigation.js';
import { initEasterEggs } from './easter-eggs.js';
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
let stopDigitalInk = () => {};
let stopMannequins = () => {};
let heroObserver = null;
let moshTransitions = null;
let renderRevision = 0;
let renderedKind = '';
let stopInquiry = () => {};
let stopConnectedWork = () => {};
const globalNavigation = initGlobalNavigation(document);

function ensureHero() {
  if (!hero) {
    const template = document.getElementById('hero-template');
    if (!template) return;
    template.before(template.content.cloneNode(true));
    template.remove();
    hero = document.querySelector('.hero');
  }
  const brand = document.querySelector('#page-title .hero-brand');
  if (brand) brand.textContent = siteContent.name;
  const tagline = hero.querySelector('.identity');
  if (tagline) tagline.textContent = siteContent.home.tagline;
  document.querySelector('.edition').textContent = siteContent.location;
}

function prepareHero() {
  ensureHero();
  if (!hero) return;
  hero.hidden = false;
  if (heroLoaded) return;
  heroObserver?.disconnect();
  heroObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting || heroLoaded || hero.hidden) return;
    heroLoaded = true;
    heroObserver.disconnect();
    import('./main.js').catch((error) => {
      console.error('Unable to load the interactive wordmark.', error);
    });
  });
  heroObserver.observe(hero);
}

function currentURL() {
  // The downloadable preview uses hash routes so its pages work without a server.
  // The real website always uses ordinary /work, /about and /#contact anchors.
  return standalone
    ? new URL(location.hash.slice(1).startsWith('/') ? location.hash.slice(1) : '/', 'https://preview.invalid')
    : new URL(location.href);
}

function scrollToTarget(url, { reset = false, restoreScroll } = {}) {
  // View Transition update callbacks suspend animation frames. Apply layout,
  // scroll and focus together before their new-document snapshot is captured.
  let target = null;
  if (url.hash) {
    try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { /* Ignore malformed fragments. */ }
  } else {
    const route = resolveRoute(url);
    if (route.kind === 'work' && route.category !== 'all') target = document.getElementById(route.category);
  }
  if (restoreScroll) {
    scrollTo({ left: restoreScroll[0], top: restoreScroll[1], behavior: 'instant' });
    if (reset) (target || content).focus({ preventScroll: true });
  } else if (target) {
    // Focus settles the existing scroll choreography immediately on a direct
    // jump; ordinary scrolling remains reversible after focus moves away.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: 'instant', block: 'start' });
  } else if (reset) {
    scrollTo({ top: 0, behavior: 'instant' });
    content.focus({ preventScroll: true });
  }
}

async function render({ reset = false, restoreScroll } = {}) {
  const url = currentURL();
  const route = resolveRoute(url);
  // Anchors in Home/Work navigate the existing document. Retain canvas state,
  // gallery positions and input values instead of remounting the page.
  if (renderedKind === route.kind && ['home', 'work'].includes(route.kind)) {
    const metadataOptions = typeof __H4_SEO_CONFIG__ === 'undefined' ? {} : __H4_SEO_CONFIG__;
    applyMetadata(getPageMetadata(route, metadataOptions));
    scrollToTarget(url, { reset, restoreScroll });
    globalNavigation.refresh();
    return;
  }
  const revision = ++renderRevision;
  renderedKind = '';
  stopInteractions();
  stopGallery();
  stopMotion();
  stopImageReveals();
  stopEndReveal();
  stopDrift();
  stopDigitalInk();
  stopMannequins();
  stopInquiry();
  stopConnectedWork();
  stopDrift = stopDigitalInk = stopMannequins = () => {};
  heroObserver?.disconnect();
  if (!standalone && route.redirectPath) history.replaceState(history.state, '', route.redirectPath);
  if (hero) hero.hidden = route.kind !== 'home';
  document.documentElement.dataset.page = route.kind;
  if (content.dataset.prerendered !== route.canonicalPath) content.innerHTML = renderRoutePage(route);
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
  stopConnectedWork = initConnectedWork(content);

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
  if (content.querySelector('[data-digital-ink]')) enhancements.push(
    import('./digital-ink.js').then(({ initDigitalInk }) => {
      if (revision === renderRevision) stopDigitalInk = initDigitalInk(content);
    }));
  if ((import.meta.env.DEV || typeof __H4_HAS_MANNEQUINS__ === 'undefined' || __H4_HAS_MANNEQUINS__)
    && content.querySelector('[data-flash-mannequin]')) enhancements.push(
    import('./flash-mannequin.js').then(({ initFlashMannequins }) => {
      if (revision === renderRevision) stopMannequins = initFlashMannequins(content);
    }));
  await Promise.allSettled(enhancements);
  if (revision !== renderRevision) return;
  renderedKind = route.kind;
  scrollToTarget(url, { reset, restoreScroll });
  globalNavigation.refresh();
}

render();
initEasterEggs(document);
if (featureFlags.otherSideEnabled) {
  const corruptionLifecycle = initCorruptionLifecycle();
  // Input handling is needed from startup. Bundle it with the entry stylesheet
  // instead of delaying first paint with an immediately requested CSS chunk.
  // Film, pixel rendering, damaged material and Web Audio stay gesture-driven.
  initXRay({ memory: corruptionLifecycle });
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
  addEventListener('hashchange', () => {
    const revision = ++hashRevision;
    document.dispatchEvent(new CustomEvent('h4:navigationstart'));
    const commit = async () => {
      if (revision !== hashRevision) return;
      await render({ reset: true });
      if (revision === hashRevision) document.dispatchEvent(new CustomEvent('h4:pagechange'));
    };
    if (!moshTransitions?.navigation(commit, { standalone: true })) commit();
  });
  document.querySelector('.skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    content.focus();
    content.scrollIntoView({ behavior: 'instant' });
  });
} else initNavigation({ render, moshTransitions });
