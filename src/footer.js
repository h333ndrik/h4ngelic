import { siteContent } from './data/siteContent.js';
import { featureFlags } from './data/featureFlags.js';
import { easterSettings } from './data/easterSettings.js';
import { escapeHTML as escape, contentURL } from './content-utils.js';

/** Semantic, prerenderable footer. Storage and motion are progressive additions. */
export function renderFooter({ home = false, otherSideEnabled = featureFlags.otherSideEnabled } = {}) {
  const instagram = contentURL(siteContent.contact.instagramURL, { relative: false });
  const hint = otherSideEnabled ? `<button class="footer-secret secret-hotspot" type="button" data-other-side-hint data-secret-hotspot data-mode-hold aria-label="hold for one second to enter the other side" aria-keyshortcuts="4" aria-describedby="footer-other-side-message">
      <span class="secret-message" data-secret-message data-xray-hint id="footer-other-side-message"><span data-xray-hint-text>HOLD 4 TO SEE THE OTHER SIDE.</span></span>
    </button>` : '';
  const counter = easterSettings.visits.showNumber ? `<button class="footer-visit-hotspot secret-hotspot" type="button" data-secret-hotspot data-visit-counter-hotspot aria-label="local visit count" aria-describedby="footer-visit-count footer-visit-memory">
      <span data-visit-number id="footer-visit-count">visit 1</span><span class="secret-message footer-visit-memory" data-secret-message data-visit-message id="footer-visit-memory">nice to meet you.</span>
    </button>` : '';
  return `${home ? `<div class="footer-secret-space end-reveal" id="final-secret" data-footer-secret-space data-end-reveal>
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
      <span class="footer-details"><button type="button" class="footer-smash" data-smash aria-pressed="false" aria-label="play private soundtrack" disabled title="private soundtrack not supplied">smash</button>${instagram ? `<a class="footer-instagram" href="${escape(instagram)}" target="_blank" rel="noopener noreferrer">instagram${home ? ' <i class="arrow" aria-hidden="true"></i>' : ''}</a>` : ''}<span class="footer-location">${escape(siteContent.location)}</span></span>
    </div>
    ${otherSideEnabled ? '<span class="sr-only" data-mode-status role="status" aria-live="polite"></span>' : ''}
  </footer>`;
}
