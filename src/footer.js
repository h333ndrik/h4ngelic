import { siteContent } from './data/siteContent.js';
import { featureFlags } from './data/featureFlags.js';
import { escapeHTML as escape, contentURL, emailURL } from './content-utils.js';

/** Semantic, prerenderable footer. Storage and motion are progressive additions. */
export function renderFooter({ home = false, otherSideEnabled = featureFlags.otherSideEnabled } = {}) {
  const contacts = home ? [] : [
    ['instagram', contentURL(siteContent.contact.instagramURL, { relative: false })],
    ['email', emailURL(siteContent.contact.email)],
    ['book a tat', contentURL(siteContent.contact.bookingURL)],
  ].filter(([, url]) => url);
  const hint = otherSideEnabled ? `<button class="footer-secret secret-hotspot" type="button" data-other-side-hint data-secret-hotspot aria-label="reveal the other side shortcut" aria-describedby="footer-other-side-message">
      <span class="secret-message" data-secret-message data-xray-hint id="footer-other-side-message"><span data-xray-hint-text>press 4 for the other side.</span></span>
    </button>` : '';
  return `${home ? `<div class="footer-secret-space" data-footer-secret-space>${hint}</div>` : ''}<footer class="page-footer exhibition-footer${home ? ' exhibition-footer-home' : ''}" data-artist-footer>
    <div class="footer-identity">
      <span>${escape(siteContent.name)} © ${escape(siteContent.copyrightYear)}</span>
      <span>${escape(siteContent.location)}</span>
    </div>
    ${contacts.length ? `<nav class="footer-contact-links" aria-label="Contact">${contacts.map(([label, url]) => `<a href="${escape(url)}"${url.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label} <i class="arrow" aria-hidden="true"></i></a>`).join('')}</nav>` : ''}
  </footer>`;
}
