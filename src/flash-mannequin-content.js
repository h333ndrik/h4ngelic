import { contentURL, escapeHTML } from './content-utils.js';

const names = value => Array.isArray(value)
  ? [...new Set(value.filter(name => typeof name === 'string' && name.trim()).map(name => name.trim()))] : [];

/** A model is opt-in only after an editor has actually validated its UVs and
 * separate body/tattoo materials. No model is inferred from a flat flash. */
export function flashMannequinConfig(project) {
  if (project?.category !== 'flashes' || project?.mannequin?.validated !== true) return null;
  const entry = project.mannequin;
  const model = contentURL(entry.model);
  if (!model || !/\.glb(?:[?#]|$)/i.test(model)) return null;
  const bodyMaterialNames = names(entry.bodyMaterialNames);
  const tattooMaterialNames = names(entry.tattooMaterialNames);
  if (!bodyMaterialNames.length || !tattooMaterialNames.length
    || bodyMaterialNames.some(name => tattooMaterialNames.includes(name))) return null;
  return { model, bodyMaterialNames, tattooMaterialNames };
}

/** Unknown materials are preserved. Tattoo imagery always has precedence. */
export function mannequinMaterialRole(name, config) {
  if (config?.tattooMaterialNames?.includes(name)) return 'tattoo';
  if (config?.bodyMaterialNames?.includes(name)) return 'body';
  return 'preserve';
}

/** CSS-free markup: safe for prerendering and content/unit tests. */
export function renderFlashMannequin(project) {
  const config = flashMannequinConfig(project);
  if (!config) return '';
  return `<section class="flash-placement" data-flash-mannequin="${escapeHTML(JSON.stringify(config))}" aria-label="optional flash placement preview">
    <div class="flash-placement-controls">
      <button type="button" class="text-link" data-mannequin-toggle aria-pressed="false">3d placement</button>
      <button type="button" class="text-link" data-mannequin-reset hidden>reset view</button>
    </div>
    <div class="flash-placement-view" data-mannequin-view hidden></div>
    <p class="flash-placement-help" data-mannequin-help hidden>drag to rotate · arrow keys to adjust · home to reset</p>
    <p class="flash-placement-status" data-mannequin-status role="status" aria-live="polite"></p>
  </section>`;
}
