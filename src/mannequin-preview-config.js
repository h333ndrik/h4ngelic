/**
 * Eine Quelle fuer Modelle, Varianten-Reihenfolge und Bewegung.
 *
 * A/B sind die prozeduralen Chrome-Puppen (unveraendert). C ist das sculpted
 * Mannequin: 49.838 Tris, Draco + KTX2, gebaut von scripts/build-mannequin-c.mjs.
 * Wegen der hohen Tris-Zahl laedt C nur, wenn die Variante aktiv ist.
 */
// A/B: verborgen, NICHT loeschen (V3.2). Die Registry bleibt vollstaendig, damit
// die prozeduralen Chrome-Puppen fuer spaetere Laeufe erreichbar sind. Sichtbar
// in der Rubrik ist nur C; A/B laden ausschliesslich ueber ?variant=a|b im
// Dev-Server (kein Link, keine Navigation).
const variants = Object.freeze({
  A: Object.freeze({
    model: '/models/mannequin-female-a.glb',
    label: 'smooth',
    shading: 'A',
    design: true,
    compression: null,
    envMapIntensity: 1.35,
    // A/B sind mit -Z nach vorn modelliert; 0 zeigt ihre Rueckseite.
    initialYaw: 0,
  }),
  B: Object.freeze({
    model: '/models/mannequin-female-b.glb',
    label: 'faceted',
    shading: 'B',
    design: true,
    compression: null,
    envMapIntensity: 1.35,
    initialYaw: 0,
  }),
  C: Object.freeze({
    model: '/models/mannequin-c.d8306c2b1b08.glb',
    label: 'sculpted',
    shading: 'C',
    design: false,
    compression: 'draco-ktx2',
    envMapIntensity: 0.85,
    // Startblick der Rubrik: C ist mit +Z nach vorn modelliert und die Kamera
    // steht auf +Z, deshalb 0 rad = frontale Ansicht. Hier justierbar, ohne die
    // GLB-Assets anzufassen.
    initialYaw: 0,
  }),
});

export const mannequinVariantOrder = Object.freeze(['A', 'B', 'C']);

export const mannequinPreviewConfig = Object.freeze({
  defaultVariant: 'C',
  variants,
  design: Object.freeze({
    url: '/textures/designs/demo-mark.png',
    label: 'demo design',
    disabledNote: 'demo design is offline for the sculpted variant: its UV layout does not match the authored decal placement.',
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
    environmentSigma: 0.035,
    environmentSizes: Object.freeze({ desktop: 256, compact: 128 }),
  }),
  loaders: Object.freeze({
    draco: '/draco/',
    basis: '/basis/',
  }),
  motion: Object.freeze({
    autoSpeed: 0.18,
    hoverSpeed: 0.55,
    idleDelay: 2000,
    dragSensitivity: 0.0075,
    inertiaDamping: 3.2,
    // 2.4 rad/s entspricht rund 320 px/s Zeigergeschwindigkeit: ein beherzter
    // Wisch loest die Animation aus, ein ruhiges Ziehen nicht.
    flickVelocity: 2.4,
    shoot: Object.freeze({
      // TODO(V3.2-M1): Die Hero-Logo-Animation "aus dem Viewport schiessen und
      // zurueckkehren" existiert im Repo nicht (src/physics.js kennt nur
      // Impuls/Rotation). Bis dahin laeuft diese dokumentierte Standard-Kurve.
      outMs: 620,
      holdMs: 180,
      backMs: 760,
      distance: 1.35,
      lift: 0.28,
      scale: 0.24,
    }),
  }),
});

export function mannequinVariant(variant = mannequinPreviewConfig.defaultVariant) {
  return mannequinPreviewConfig.variants[variant] || mannequinPreviewConfig.variants[mannequinPreviewConfig.defaultVariant];
}

/** Alle drei Varianten als Array fuer die UI (Reihenfolge ist stabil). */
export function mannequinVariantList() {
  return mannequinVariantOrder.map((key) => ({ key, ...mannequinPreviewConfig.variants[key] }));
}

/**
 * Nur Dev-Server: ?variant=a|b laedt A/B intern zum Vergleich. Im Production-
 * Build ist der Zweig tot (import.meta.env.DEV === false) und die Rubrik zeigt
 * ausschliesslich C.
 */
export function mannequinDevVariant(search) {
  if (!import.meta.env?.DEV) return null;
  const requested = new URLSearchParams(search ?? '').get('variant')?.toUpperCase();
  return requested && mannequinPreviewConfig.variants[requested] ? requested : null;
}
