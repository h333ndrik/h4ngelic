import './style.css';
import './homepage.css';
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

let hero = document.querySelector('.hero');
const content = document.getElementById('page-content');
const standalone = document.documentElement.dataset.preview === 'standalone';
let heroLoaded = false;
let stopInteractions = () => {};
let stopGallery = () => {};
let stopMotion = () => {};
let stopImageReveals = () => {};
let stopEndReveal = () => {};
let heroObserver = null;
let moshTransitions = null;

function ensureHero() {
  if (!hero) {
    const template = document.getElementById('hero-template');
    if (!template) return;
    template.before(template.content.cloneNode(true));
    template.remove();
    hero = document.querySelector('.hero');
  }
  document.getElementById('page-title').textContent = `${siteContent.name} © ${siteContent.copyrightYear}`;
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
  }
  if (restoreScroll) {
    scrollTo({ left: restoreScroll[0], top: restoreScroll[1], behavior: 'instant' });
    if (reset) (target || content).focus({ preventScroll: true });
  } else if (url.hash) {
    target?.scrollIntoView({ behavior: 'instant', block: 'start' });
    target?.focus({ preventScroll: true });
  } else if (reset) {
    scrollTo({ top: 0, behavior: 'instant' });
    content.focus({ preventScroll: true });
  }
}

function render({ reset = false, restoreScroll } = {}) {
  stopInteractions();
  stopGallery();
  stopMotion();
  stopImageReveals();
  stopEndReveal();
  heroObserver?.disconnect();
  const url = currentURL();
  const route = resolveRoute(url);
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

  if (standalone) {
    for (const link of document.querySelectorAll('a[href^="/"]')) {
      link.setAttribute('href', `#${link.getAttribute('href')}`);
    }
  }
  return scrollToTarget(url, { reset, restoreScroll });
}

render();
initEasterEggs(document);
if (featureFlags.otherSideEnabled) {
  const corruptionLifecycle = initCorruptionLifecycle();
  // Input handling is needed from startup. Bundle it with the entry stylesheet
  // instead of delaying first paint with an immediately requested CSS chunk.
  // Film, pixel rendering, damaged material and Web Audio stay gesture-driven.
  initXRay();
  initModeIcons();
  const motionMosh = initMotionMosh({ doc: document });
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('fx') === '1') {
    import('./dev/living-decay-panel.js').then(({ initLivingDecayPanel }) => {
      initLivingDecayPanel({ doc: document, getController: () => corruptionLifecycle.getController?.() });
    });
  }
  moshTransitions = initMoshTransitions({ doc: document });
  const interactionMosh = initInteractionMosh({ doc: document,
    onSnapshot: detail => moshTransitions.interaction(detail) });
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
    const commit = () => {
      if (revision !== hashRevision) return;
      render({ reset: true });
      document.dispatchEvent(new CustomEvent('h4:pagechange'));
    };
    if (!moshTransitions?.navigation(commit, { standalone: true })) commit();
  });
  document.querySelector('.skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    content.focus();
    content.scrollIntoView({ behavior: 'instant' });
  });
} else initNavigation({ render, moshTransitions });
