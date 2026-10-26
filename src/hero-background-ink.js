// Share the existing mesh raycast with document ink without importing Three.js
// on other routes. Entries and event results disappear with their DOM owners.
const hitTests = new WeakMap();
const eventHits = new WeakMap();

export function registerHeroInkHitTest(canvas, hitTest) {
  hitTests.set(canvas, hitTest);
  return () => { if (hitTests.get(canvas) === hitTest) hitTests.delete(canvas); };
}

export function rememberHeroInkHit(event, hit) {
  eventHits.set(event, Boolean(hit));
  return hit;
}

export function isExposedHeroBackground(event) {
  const canvas = event?.target;
  if (canvas?.id !== 'logo-canvas' || !canvas.matches?.('canvas')) return false;
  const hero = canvas.closest('.hero');
  if (!hero || hero.hidden) return false;
  if (!eventHits.has(event)) {
    const test = hitTests.get(canvas);
    // Before startup, and in the no-WebGL fallback, the canvas is simply an
    // exposed surface. Never download a renderer to answer a blank click.
    if (test) eventHits.set(event, Boolean(test(event)));
  }
  return !eventHits.get(event);
}
