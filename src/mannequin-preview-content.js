import { mannequinPreviewConfig, mannequinVariant } from './mannequin-preview-config.js';

const defaultVariant = mannequinPreviewConfig.defaultVariant;
const defaultProfile = mannequinVariant(defaultVariant);
const design = mannequinPreviewConfig.design;

/** Server-rendered placeholder. No canvas, Three.js module, GLB or design request. */
export function renderMannequinPreview() {
  return `<figure class="mannequin-preview">
    <div class="mannequin-preview-frame" data-mannequin-preview data-mannequin-variant="${defaultVariant}" data-mannequin-src="${defaultProfile.model}" data-mannequin-design-src="${design.url}" data-mannequin-state="deferred" role="img" aria-label="Female silver-chrome mannequin in a static A-pose preview">
      <svg class="mannequin-preview-poster" viewBox="0 0 220 600" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="mannequin-poster-silver" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#f4f4f1"/><stop offset=".34" stop-color="#8e8f8d"/>
            <stop offset=".62" stop-color="#282928"/><stop offset="1" stop-color="#c4c5c2"/>
          </linearGradient>
        </defs>
        <g fill="url(#mannequin-poster-silver)">
          <ellipse cx="110" cy="55" rx="25" ry="31"/><rect x="101" y="82" width="18" height="35" rx="5"/>
          <path d="M78 110 Q110 96 142 110 L154 146 Q149 188 133 207 Q128 229 141 256 L157 331 Q157 347 141 349 L79 349 Q63 347 63 331 L79 256 Q92 229 87 207 Q71 188 66 146Z"/>
          <path d="M69 128 Q50 136 45 160 L24 351 Q22 365 33 367 Q44 369 47 355 L70 182Z"/>
          <path d="M151 128 Q170 136 175 160 L196 351 Q198 365 187 367 Q176 369 173 355 L150 182Z"/>
          <path d="M76 346 Q93 357 104 365 L103 557 Q103 569 91 569 L76 569 Q67 569 67 557Z"/>
          <path d="M144 346 Q127 357 116 365 L117 557 Q117 569 129 569 L144 569 Q153 569 153 557Z"/>
          <path d="M24 349 L44 357 L42 373 L20 373 Z"/><path d="M196 349 L176 357 L178 373 L200 373 Z"/>
        </g>
      </svg>
      <span class="mannequin-preview-ground" aria-hidden="true"></span>
      <p class="sr-only" data-mannequin-status role="status">Static mannequin preview waits until it is visible.</p>
    </div>
    <figcaption>
      <span class="mannequin-preview-meta"><span>procedural female form</span><button class="mannequin-preview-design" type="button" data-mannequin-design-toggle aria-pressed="false" disabled>${design.label}</button></span>
      <span class="mannequin-preview-status">static / ${defaultVariant.toLowerCase()} · ${defaultProfile.label}</span>
    </figcaption>
  </figure>`;
}
