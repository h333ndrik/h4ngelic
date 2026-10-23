import { siteContent } from './data/siteContent.js';
import { easterSettings, visitorMessage } from './data/easterSettings.js';
import { escapeHTML as escape, contentURL, emailURL } from './content-utils.js';

/** Semantic, prerenderable footer. Storage and motion are progressive additions. */
export function renderFooter({ home = false } = {}) {
  const contacts = home ? [] : [
    ['instagram', contentURL(siteContent.contact.instagramURL, { relative: false })],
    ['email', emailURL(siteContent.contact.email)],
    ['book a tat', contentURL(siteContent.contact.bookingURL)],
  ].filter(([, url]) => url);
  return `<footer class="page-footer exhibition-footer${home ? ' exhibition-footer-home' : ''}" data-artist-footer>
    <div class="footer-identity">
      <span>${escape(siteContent.name)} © ${escape(siteContent.copyrightYear)}</span>
      <span>${escape(siteContent.location)}</span>
    </div>
    ${contacts.length ? `<nav class="footer-contact-links" aria-label="Contact">${contacts.map(([label, url]) => `<a href="${escape(url)}"${url.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label} <i class="arrow" aria-hidden="true"></i></a>`).join('')}</nav>` : ''}
    <div class="footer-personal">
      <span data-visit-message>${escape(visitorMessage(1))}</span>
      ${easterSettings.visits.showNumber ? '<span class="footer-visit-number" data-visit-number>visit 001</span>' : ''}
    </div>
    <button class="footer-secret" type="button" data-xray-toggle aria-label="toggle x-ray mode (4)" aria-pressed="false" aria-keyshortcuts="4">
      <span data-xray-hint><span data-xray-hint-text>PRESS 4 TO SEE THE OTHER SIDE.</span></span>
    </button>
    <span class="sr-only" data-mode-status role="status" aria-live="polite"></span>
  </footer>`;
}
