import { escapeHTML as escape } from './content-utils.js';
import { artworks } from './data/artworks.js';
import { inquirySettings } from './data/inquirySettings.js';

/** Only an actual published artwork can be passed into the inquiry context. */
export function inquiryArtwork(id) {
  return artworks.find(project => project.published !== false && project.id === id
    && Array.isArray(project.images) && project.images.length);
}

export function renderInquiryForm({ context = '', id = 'inquiry' } = {}) {
  const prefix = /^[a-z][a-z0-9-]*$/.test(id) ? id : 'inquiry';
  const project = inquiryArtwork(context);
  const address = inquirySettings.email;
  return `<div class="inquiry" data-inquiry>
    <p class="inquiry-intro">for tattoos, jewellery or other projects.</p>
    <form class="inquiry-form" action="${inquirySettings.endpoint}" method="post" enctype="multipart/form-data" data-inquiry-form aria-describedby="${prefix}-status">
      <input type="hidden" name="artwork" value="${escape(project?.id || '')}" data-inquiry-artwork />
      <input type="hidden" name="started" value="" data-inquiry-started />
      <p class="inquiry-context" data-inquiry-context${project ? '' : ' hidden'}>${project ? `regarding ${escape(project.title || project.id.replaceAll('-', ' '))}.` : ''}</p>
      <div class="inquiry-fields">
        <label class="inquiry-field" for="${prefix}-name"><span>YOUR NAME</span><input id="${prefix}-name" name="name" autocomplete="name" required maxlength="${inquirySettings.maximumNameLength}" /></label>
        <label class="inquiry-field" for="${prefix}-email"><span>HOW TO REACH YOU</span><input id="${prefix}-email" name="email" type="text" autocomplete="off" placeholder="email, instagram, phone number..." required maxlength="254" data-inquiry-contact /></label>
        <label class="inquiry-field inquiry-field-message" for="${prefix}-message"><span>WHAT'S ON YOUR MIND?</span><textarea id="${prefix}-message" name="message" rows="3" maxlength="${inquirySettings.maximumMessageLength}"></textarea></label>
      </div>
      <div class="inquiry-honey" aria-hidden="true"><label for="${prefix}-website">Leave this field empty<input id="${prefix}-website" name="website" tabindex="-1" autocomplete="off" /></label></div>
      <div class="inquiry-attachments">
        <label class="inquiry-file-label" for="${prefix}-files"><svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path d="m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg><span>ATTACH REFERENCES / IMAGES</span></label>
        <input class="inquiry-file-input" id="${prefix}-files" type="file" name="attachments" accept="${inquirySettings.accept}" multiple aria-describedby="${prefix}-file-help ${prefix}-file-error" />
        <p class="inquiry-file-help" id="${prefix}-file-help">jpg, png, webp, avif, gif or pdf · up to 5 files, 5 MB each, 12 MB total.</p>
        <p class="inquiry-error" id="${prefix}-file-error" data-inquiry-file-error role="alert"></p>
        <ul class="inquiry-file-list" data-inquiry-files aria-label="Selected references"></ul>
      </div>
      <button class="inquiry-submit" type="submit" data-inquiry-submit><span>SEND INQUIRY</span><i class="arrow" aria-hidden="true"></i></button>
      <p class="inquiry-status" id="${prefix}-status" data-inquiry-status role="status" aria-live="polite" aria-atomic="true"></p>
      <p class="inquiry-email-fallback" data-inquiry-email-fallback hidden>you can also email <a href="mailto:${address}">${address}</a>.</p>
      <p class="inquiry-privacy">your details and references are used to respond to your inquiry.</p>
      <noscript><p>send the form directly, or email <a href="mailto:${address}">${address}</a>. references are limited to 5 files and 12 MB in total.</p></noscript>
    </form>
  </div>`;
}
