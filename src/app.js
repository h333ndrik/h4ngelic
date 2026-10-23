import './style.css';
import { siteContent } from './data/siteContent.js';
import { renderHomepageSections, renderWorkPage, renderAboutPage, renderNotFoundPage } from './pages.js';

const hero = document.querySelector('.hero');
const content = document.getElementById('page-content');
const standalone = document.documentElement.dataset.preview === 'standalone';
let heroLoaded = false;

document.getElementById('page-title').textContent = `${siteContent.name} © ${siteContent.copyrightYear}`;
document.querySelector('.edition').textContent = siteContent.location;

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
  const url = currentURL();
  const path = url.pathname.replace(/\/+$/, '') || '/';
  hero.hidden = path !== '/';
  document.documentElement.dataset.page = path === '/' ? 'home' : path.slice(1);
  if (path === '/') {
    content.innerHTML = renderHomepageSections();
    document.title = siteContent.name;
    if (!heroLoaded) {
      heroLoaded = true;
      import('./main.js').catch((error) => {
        console.error('Unable to load the interactive wordmark.', error);
      });
    }
  } else if (path === '/work') {
    content.innerHTML = renderWorkPage(url.searchParams.get('category'));
    document.title = `work — ${siteContent.name}`;
  } else if (path === '/about') {
    content.innerHTML = renderAboutPage();
    document.title = `about — ${siteContent.name}`;
  } else {
    content.innerHTML = renderNotFoundPage();
    document.title = `page not found — ${siteContent.name}`;
  }

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
