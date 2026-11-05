/**
 * Eine Quelle fuer Modelle, Varianten-Reihenfolge und Bewegung.
 *
 * A/B sind die prozeduralen Chrome-Puppen (unveraendert). C ist das sculpted
 * Mannequin: 49.838 Tris, Draco + KTX2, gebaut von scripts/build-mannequin-c.mjs.
 * Wegen der hohen Tris-Zahl laedt C nur, wenn die Variante aktiv ist.
 */
// A/B: verborgen, NICHT loeschen (V3.2). Die prozeduralen Chrome-Puppen leben
// nur noch im Dev-Server: `import.meta.env.DEV` ist im Production-Build false,
// der Bundler entfernt den Zweig. Damit gibt es fuer A/B im ausgelieferten
// Bundle keinen Ladepfad, keinen Import und keinen Request — auch keinen
// Asset-Namen im JS.
const devVariants = import.meta.env?.DEV ? {
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
} : {};
const variants = Object.freeze({ ...devVariants,
  C: Object.freeze({
    model: '/models/mannequin-c.d76abc164512.glb',
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

// Dev: A, B, C — Production: nur C.
export const mannequinVariantOrder = Object.freeze(Object.keys(variants));

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
    // Daempfung in 1/s: die Winkelgeschwindigkeit naehert sich der Zielrate
    // exponentiell (1 - e^(-k*dt)), also pro Sekunde, nicht pro Frame.
    inertiaDamping: 3.2,
    // Obergrenze fuer die Winkelbeschleunigung in rad/s^2. Begrenzt den
    // Uebergang von Auto- (0.18) auf Hover-Drehung (0.55) auf rund 0.34 s,
    // damit die Figur beim Ueberfahren nicht schlagartig losdreht.
    maxAngularAcceleration: 1.1,
    // Die Ziehgeschwindigkeit wird ueber ein Zeitfenster von 70 ms gemessen
    // (Ringpuffer im Modul), nicht mehr pro Ereignis. Rund vier Frames bei
    // 60 Hz: lang genug fuer ein ruhiges Signal, kurz genug fuer den Flick.
    pointerWindowMs: 70,
    dragVelocityLimit: 8,
    // Zerfall des Spitzenwerts (Flick-Schwelle) in 1/s. 3.7125 = -ln(0.94)*60,
    // d. h. bei der Referenzframerate 60 Hz genau der alte Faktor 0.94 pro
    // Frame. Der Zerfall laeuft pro Frame, nicht pro Pointer-Ereignis, damit
    // eine 1000-Hz-Maus den Peak nicht 16-mal schneller abklingen laesst.
    peakDecayPerSecond: 3.7125,
    // Referenzframerate, auf die die Startwerte abgestimmt sind. Bei 60 Hz
    // bleibt das Verhalten unveraendert; andere Frameraten liefern dieselbe
    // Bewegung pro Sekunde.
    referenceFrameRate: 60,
    // Tastatur: 15 Grad pro Tastendruck; gehalten laeuft die Drehung mit
    // derselben Daempfung wie das Ziehen weiter.
    keyStep: Math.PI / 12,
    keySpeed: 1.35,
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
