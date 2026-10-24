/** Restrained camera composition; independent of the sculpture's animation. */
export const heroDepthSettings = Object.freeze({
  start: .02,
  end: .92,
  distance: .08,
  horizontal: .012,
  vertical: .005,
  fieldOfView: 1,
});

export function sampleHeroDepth(progress, reduced = false, settings = heroDepthSettings) {
  const local = reduced ? 0 : Math.max(0, Math.min(1, (progress - settings.start) / (settings.end - settings.start)));
  const amount = local * local * (3 - 2 * local);
  return { amount, distance: 1 + settings.distance * amount, x: settings.horizontal * amount,
    y: settings.vertical * amount, fieldOfView: settings.fieldOfView * amount };
}
