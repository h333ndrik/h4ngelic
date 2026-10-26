import { siteContent } from './data/siteContent.js';
import { featureFlags } from './data/featureFlags.js';
import { easterSettings } from './data/easterSettings.js';
import { escapeHTML as escape, contentURL, emailURL } from './content-utils.js';

/** Semantic, prerenderable footer. Storage and motion are progressive additions. */
export function renderFooter({ home = false, otherSideEnabled = featureFlags.otherSideEnabled } = {}) {
  const contacts = home ? [] : [
    ['instagram', contentURL(siteContent.contact.instagramURL, { relative: false })],
    ['email', emailURL(siteContent.contact.email)],
    ['book a tat', contentURL(siteContent.contact.bookingURL)],
  ].filter(([, url]) => url);
  const hint = otherSideEnabled ? `<button class="footer-secret secret-hotspot" type="button" data-other-side-hint data-secret-hotspot data-mode-hold aria-label="hold for one second to enter the other side" aria-keyshortcuts="4" aria-describedby="footer-other-side-message">
      <span class="secret-message" data-secret-message data-xray-hint id="footer-other-side-message"><span data-xray-hint-text>PRESS 4 TO SEE THE OTHER SIDE</span></span>
    </button>` : '';
  const counter = home && easterSettings.visits.showNumber ? `<button class="footer-visit-hotspot secret-hotspot" type="button" data-secret-hotspot data-visit-counter-hotspot aria-label="reveal local visit count" aria-describedby="footer-visit-count">
      <span class="secret-message" data-secret-message data-visit-number id="footer-visit-count">VISIT 001</span>
    </button>` : '';
  return `${home ? `<div class="footer-secret-space end-reveal" data-footer-secret-space data-end-reveal>
    <div class="end-reveal-mark" aria-hidden="true">
      <svg class="end-reveal-relief" viewBox="0 0 615 1006" focusable="false">
        <defs><filter id="h4-end-relief" x="-8%" y="-5%" width="116%" height="110%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="height" data-end-relief-blur />
          <feDiffuseLighting in="height" surfaceScale="0" diffuseConstant=".72" lighting-color="#ffffff" result="light" data-end-relief-depth>
            <fePointLight x="110" y="-130" z="560" data-end-relief-light />
          </feDiffuseLighting>
          <feComponentTransfer in="light" result="charcoal">
            <feFuncR type="linear" slope=".065" intercept=".112" />
            <feFuncG type="linear" slope=".065" intercept=".112" />
            <feFuncB type="linear" slope=".065" intercept=".112" />
          </feComponentTransfer>
          <feComposite in="charcoal" in2="SourceAlpha" operator="in" />
        </filter></defs>
        <image href="/assets/h4-monogram.svg" width="615" height="1006" filter="url(#h4-end-relief)" />
      </svg><span class="end-reveal-material"></span></div>${hint}</div>` : ''}<footer class="page-footer exhibition-footer${home ? ' exhibition-footer-home' : ''}" data-artist-footer>
    <div class="footer-identity">
      <span class="footer-brand">${escape(siteContent.name)} © ${escape(siteContent.copyrightYear)}</span>
      ${counter}
      <span class="footer-location">${escape(siteContent.location)}</span>
    </div>
    ${contacts.length ? `<nav class="footer-contact-links" aria-label="Contact">${contacts.map(([label, url]) => `<a href="${escape(url)}"${url.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label} <i class="arrow" aria-hidden="true"></i></a>`).join('')}</nav>` : ''}
    ${otherSideEnabled ? '<span class="sr-only" data-mode-status role="status" aria-live="polite"></span>' : ''}
  </footer>`;
}
