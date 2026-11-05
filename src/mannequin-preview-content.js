import { mannequinPreviewConfig, mannequinVariant } from './mannequin-preview-config.js';

const defaultVariant = mannequinPreviewConfig.defaultVariant;
const defaultProfile = mannequinVariant(defaultVariant);
const design = mannequinPreviewConfig.design;

/**
 * Server-rendered placeholder. No canvas, Three.js module, GLB or design request.
 * Sichtbar ist nur Variante C; A/B bleiben in der Registry (siehe config.js) und
 * sind ausschliesslich im Dev-Server ueber ?variant=a|b erreichbar.
 */
export function renderMannequinPreview() {
  return `<figure class="mannequin-preview">
    <div class="mannequin-preview-frame" data-mannequin-preview data-mannequin-variant="${defaultVariant}" data-mannequin-src="${defaultProfile.model}" data-mannequin-design-src="${design.url}" data-mannequin-state="deferred" role="img" tabindex="0" aria-label="3D model: female mannequin. Use the left and right arrow keys to turn it." aria-describedby="mannequin-viewer-help" aria-keyshortcuts="ArrowLeft ArrowRight Home Escape">
      <!-- Poster = echtes Render aus demselben Renderer (yaw 0, gleiche
           Kamera, gleiches Licht), transparent statt SVG-Silhouette. Dadurch
           ist der Crossfade beim Laden ein weicher Uebergang und kein Bild-
           sprung. Zwei Zuschnitte, weil der Renderer je nach Seitenverhaeltnis
           auf Hoehe oder Breite einpasst. -->
      <picture class="mannequin-preview-poster" aria-hidden="true">
        <!-- WebP zuerst (rund 60 % kleiner, Alpha verlustfrei), PNG bleibt
             Fallback fuer Browser ohne WebP. Gleiche Pixelmaße und Breakpoints. -->
        <source media="(max-width: 600px)" type="image/webp" srcset="/images/mannequin-poster-tall-fdf806bf.webp" width="692" height="906">
        <source media="(max-width: 600px)" srcset="/images/mannequin-poster-tall-915dcaff.png" width="692" height="906">
        <source type="image/webp" srcset="/images/mannequin-poster-wide-2e2cce6c.webp" width="2740" height="1442">
        <img src="/images/mannequin-poster-wide-20c3b7b4.png" alt="" width="2740" height="1442" decoding="async">
      </picture>
    </div>
    <!-- Ausserhalb von role="img": ein Bild-Role macht seine Kinder zu
         presentational, dann waere die Live-Region fuer Screenreader weg. -->
    <p class="sr-only" data-mannequin-status role="status">Mannequin preview waits until it is visible.</p>
    <p class="sr-only" id="mannequin-viewer-help">Interactive 3D viewer. Left and right arrow keys turn the mannequin in 15 degree steps, holding a key keeps it turning, Home resets the view, Escape stops a spin. Dragging with the pointer does the same.</p>
    <figcaption>
      <span class="mannequin-preview-meta">
        <button class="mannequin-preview-design" type="button" data-mannequin-design-toggle aria-pressed="false" aria-disabled="true" aria-describedby="mannequin-design-hint" disabled>${design.label}</button>
        <span class="mannequin-preview-hint" id="mannequin-design-hint" data-mannequin-design-hint>no decals on the sculpted uv layout</span>
      </span>
      <span class="mannequin-preview-status">${defaultVariant.toLowerCase()} · ${defaultProfile.label} · drag to turn</span>
    </figcaption>
  </figure>`;
}
