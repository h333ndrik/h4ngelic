import './style.css';
import { siteContent } from './data/siteContent.js';
import { renderRoutePage } from './pages.js';
import { resolveRoute } from './routes.js';
import { getPageMetadata, applyMetadata } from './seo.js';
import { initInteractions } from './interactions.js';
import { initGallery } from './gallery.js';

let hero = document.querySelector('.hero');
const content = document.getElementById('page-content');
const standalone = document.documentElement.dataset.preview === 'standalone';
let heroLoaded = false;
let stopInteractions = () => {};
let stopGallery = () => {};
let heroObserver = null;

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

function scrollToTarget(url, { reset = false } = {}) {
  requestAnimationFrame(() => {
    if (url.hash) {
      let id;
      try { id = decodeURIComponent(url.hash.slice(1)); } catch { return; }
      const target = document.getElementById(id);
      target?.scrollIntoView({ behavior: 'instant', block: 'start' });
      target?.focus({ preventScroll: true });
    } else if (reset) {
      scrollTo({ top: 0, behavior: 'instant' });
      content.focus({ preventScroll: true });
    }
  });
}

function render({ reset = false } = {}) {
  stopInteractions();
  stopGallery();
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
  stopInteractions = initInteractions(content);
  stopGallery = initGallery(content);

  if (standalone) {
    for (const link of document.querySelectorAll('a[href^="/"]')) {
      link.setAttribute('href', `#${link.getAttribute('href')}`);
    }
  }
  scrollToTarget(url, { reset });
}

render();
if (standalone) {
  addEventListener('hashchange', () => render({ reset: true }));
  document.querySelector('.skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    content.focus();
    content.scrollIntoView({ behavior: 'instant' });
  });
}
