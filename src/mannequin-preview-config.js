/** One source for the model, variant label and deferred Procreate design. */
const variants = Object.freeze({
  A: Object.freeze({
    model: '/models/mannequin-female-a.glb',
    label: 'smooth',
    shading: 'A',
  }),
  B: Object.freeze({
    model: '/models/mannequin-female-b.glb',
    label: 'faceted',
    shading: 'B',
  }),
});

export const mannequinPreviewConfig = Object.freeze({
  defaultVariant: 'B',
  variants,
  design: Object.freeze({
    url: '/textures/designs/demo-mark.png',
    label: 'demo design',
    placement: Object.freeze({
      part: 'torso_front',
      anchorUV: Object.freeze([0.2810354, 0.2384]),
      widthMM: 120,
      wrap: 'clamp',
      position: Object.freeze([0, 1.235, 0.17]),
      rotation: Object.freeze([0, 0, 0]),
      size: Object.freeze([0.30, 0.32, 0.32]),
    }),
  }),
  chrome: Object.freeze({
    envMapIntensity: 1.35,
    environmentSigma: 0.035,
    environmentSizes: Object.freeze({ desktop: 256, compact: 128 }),
  }),
});

export function mannequinVariant(variant = mannequinPreviewConfig.defaultVariant) {
  return mannequinPreviewConfig.variants[variant] || mannequinPreviewConfig.variants[mannequinPreviewConfig.defaultVariant];
}
