/** Shared, bounded controls for the Other Side. Consumers read one stable
 * object per frame; updates replace it rather than mutating frozen defaults.
 */
export const livingDecayDefaults = Object.freeze({
  seed: null,
  idleIntensity: .45,
  mutationSpeed: .22,
  scrollStrength: 1.15,
  scrollInertia: .72,
  scrollMosh: 1.1,
  sectionMosh: .9,
  typographyMosh: .8,
  cursorRadius: 35,
  cursorMosh: 1.25,
  hoverMosh: 1.1,
  clickMosh: 1.4,
  navigationMosh: 1.25,
  feedbackPersistence: .9,
  blockSize: 28,
  organicDecay: 1.15,
  colorVariation: 1.15,
  voidCoverage: .34,
  bleachCoverage: .3,
});

/** Background-only sources. The original film maps used by the hero shader
 * remain independent and unchanged.
 */
export const livingDecayMaterialAssets = Object.freeze({
  desktop: '/assets/living-decay-material.webp',
  mobile: '/assets/living-decay-material-mobile.webp',
});

const control = (label, minimum, maximum, step) => Object.freeze({ label, minimum, maximum, step });

export const livingDecaySchema = Object.freeze({
  seed: control('Composition seed', 0, 0xffffffff, 1),
  idleIntensity: control('Idle motion', 0, 2, .01),
  mutationSpeed: control('Material mutation', 0, 2, .01),
  scrollStrength: control('Scroll displacement', 0, 3, .01),
  scrollInertia: control('Scroll inertia', 0, 1, .01),
  scrollMosh: control('Scroll datamoshing', 0, 2, .01),
  sectionMosh: control('Section entrance corruption', 0, 2, .01),
  typographyMosh: control('Typography corruption', 0, 2, .01),
  cursorRadius: control('Cursor radius (px)', 25, 45, 1),
  cursorMosh: control('Cursor datamoshing', 0, 2, .01),
  hoverMosh: control('Hover datamoshing', 0, 2, .01),
  clickMosh: control('Click rupture', 0, 2, .01),
  navigationMosh: control('Navigation datamoshing', 0, 2, .01),
  feedbackPersistence: control('Frame feedback', 0, .98, .01),
  blockSize: control('Compression block size', 6, 64, 1),
  organicDecay: control('Organic decay', 0, 2, .01),
  colorVariation: control('Color variation', 0, 2, .01),
  voidCoverage: control('Dark void coverage', 0, .85, .01),
  bleachCoverage: control('Bleached coverage', 0, .85, .01),
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

/** Numeric seeds round-trip exactly; text seeds are useful reproducible labels. */
export function normalizeLivingSeed(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) >>> 0 : fallback >>> 0;
  if (typeof value !== 'string' || !value.trim()) return fallback >>> 0;
  const text = value.trim();
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return Math.trunc(numeric) >>> 0;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return hash >>> 0;
}

/** Unknown keys and non-finite input cannot leak into rendering controls. */
export function createLivingDecaySettings(patch = {}, base = livingDecayDefaults) {
  const result = { ...livingDecayDefaults };
  for (const input of [base, patch]) {
    if (!input || typeof input !== 'object') continue;
    for (const [key, bounds] of Object.entries(livingDecaySchema)) {
      if (!Object.hasOwn(input, key)) continue;
      if (key === 'seed') {
        if (input.seed === null) result.seed = null;
        else if (typeof input.seed === 'number' && Number.isFinite(input.seed)
          || typeof input.seed === 'string' && input.seed.trim()) result.seed = normalizeLivingSeed(input.seed, result.seed ?? 0);
        continue;
      }
      const value = typeof input[key] === 'string' && input[key].trim() ? Number(input[key]) : input[key];
      if (Number.isFinite(value)) result[key] = clamp(value, bounds.minimum, bounds.maximum);
    }
  }
  return Object.freeze(result);
}

let current = createLivingDecaySettings();
const subscribers = new Set();

export const getLivingDecaySettings = () => current;

export function configureLivingDecay(patch) {
  const next = createLivingDecaySettings(patch, current);
  const changed = Object.keys(livingDecayDefaults).filter(key => next[key] !== current[key]);
  if (!changed.length) return current;
  const previous = current;
  current = next;
  for (const subscriber of [...subscribers]) subscriber(current, { changed, previous });
  return current;
}

export function subscribeLivingDecay(callback) {
  if (typeof callback !== 'function') return () => {};
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
