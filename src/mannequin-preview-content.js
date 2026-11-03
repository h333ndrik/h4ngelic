/** Server-rendered placeholder. No canvas, Three.js module or GLB request. */
export function renderMannequinPreview() {
  return `<figure class="mannequin-preview">
    <div class="mannequin-preview-frame" data-mannequin-preview data-mannequin-src="/models/mannequin.glb" data-mannequin-state="deferred" role="img" aria-label="White faceted dress form on a three-foot stand">
      <span class="mannequin-preview-ground" aria-hidden="true"></span>
      <p class="sr-only" data-mannequin-status role="status">Static mannequin preview waits until it is visible.</p>
    </div>
    <figcaption><span>procedural form</span><span>static / b</span></figcaption>
  </figure>`;
}
