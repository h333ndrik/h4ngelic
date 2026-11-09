import { siteContent } from './data/siteContent.js';
import { featureFlags } from './data/featureFlags.js';
import { easterSettings, formatVisitCount } from './data/easterSettings.js';
import { escapeHTML as escape, contentURL } from './content-utils.js';

/** Semantic, prerenderable footer. Storage and motion are progressive additions. */
export function renderFooter({ home = false, otherSideEnabled = featureFlags.otherSideEnabled } = {}) {
  const instagram = contentURL(siteContent.contact.instagramURL, { relative: false });
  const hint = otherSideEnabled ? `<button class="footer-secret secret-hotspot" type="button" data-other-side-hint data-secret-hotspot data-mode-hold aria-label="hold for one second to enter the other side" aria-keyshortcuts="4" aria-describedby="footer-other-side-message">
      <span class="secret-message" data-secret-message data-xray-hint id="footer-other-side-message"><span data-xray-hint-text>hold 4 to see the other side.</span></span>
    </button>` : '';
  const arrow = '<i class="arrow" aria-hidden="true"></i>';
  // B-F8: the counter is a quiet statement, not a control. It keeps the ghost
  // register of the HOLD-4 hint, stays permanently visible and owns no link,
  // button, hover or reveal behaviour of its own.
  const counter = easterSettings.visits.showNumber ? `<span class="footer-visit row-item" data-visit-count>
      <span class="footer-visit-count" data-visit-number id="footer-visit-count">${formatVisitCount(1)}</span>
    </span>` : '';
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
    <div class="footer-identity" data-footer-row>
      <span class="footer-left" data-row="cluster" data-row-id="footer-left" role="group" aria-label="artist and local visit count" tabindex="0">${[
        `<span class="footer-brand row-item">${escape(siteContent.name)} © ${escape(siteContent.copyrightYear)}</span>`,
        // B-F29: the placeholder link is gone; the visit counter takes its place.
        counter,
      ].join('')}</span>
      <span class="footer-details" data-row="cluster" data-row-id="footer-details" role="group" aria-label="footer links, scroll horizontally when needed" tabindex="0">${[
        '<span data-smash-slot></span>',
        instagram ? `<a class="footer-instagram row-item" href="${escape(instagram)}" target="_blank" rel="noopener noreferrer">instagram ${arrow}</a>` : '',
        `<span class="footer-location row-item">${escape(siteContent.location)}</span>`,
      ].join('')}</span>
    </div>
    ${otherSideEnabled ? '<span class="sr-only" data-mode-status role="status" aria-live="polite"></span>' : ''}
  </footer>`;
}
