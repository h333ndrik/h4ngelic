/** Sparse finger samples, independent of DOM events or animation frames.
 * Client and scroll travel are measured independently: during native panning
 * they can cancel in document coordinates while the finger is still moving.
 */
export function createTouchInkSampler({ minimumIntervalMs = 180, minimumTravel = 24, initialTravel = 18 } = {}) {
  const finite = point => point && ['x', 'y', 'scrollX', 'scrollY', 'time'].every(key => Number.isFinite(point[key]))
    && point.time >= 0 && point.id !== undefined;
  const interval = Math.max(80, Number.isFinite(minimumIntervalMs) ? minimumIntervalMs : 180);
  const distance = Math.max(12, Number.isFinite(minimumTravel) ? minimumTravel : 24);
  const firstDistance = Math.max(8, Number.isFinite(initialTravel) ? initialTravel : 18);
  let anchor = null;
  let lastTime = -Infinity;
  let acceptedAt = null;
  let accepted = 0;
  const clear = () => { anchor = null; lastTime = -Infinity; acceptedAt = null; accepted = 0; };
  return {
    begin(point) {
      clear();
      if (!finite(point)) return false;
      anchor = { ...point };
      lastTime = point.time;
      return true;
    },
    sample(point) {
      if (!anchor || !finite(point) || point.id !== anchor.id || point.time < lastTime) return null;
      lastTime = point.time;
      const travel = Math.max(Math.hypot(point.x - anchor.x, point.y - anchor.y),
        Math.hypot(point.scrollX - anchor.scrollX, point.scrollY - anchor.scrollY),
        Math.hypot(point.x + point.scrollX - anchor.x - anchor.scrollX,
          point.y + point.scrollY - anchor.y - anchor.scrollY));
      if (travel < (acceptedAt === null ? firstDistance : distance)
        || acceptedAt !== null && point.time - acceptedAt < interval) return null;
      anchor = { ...point };
      acceptedAt = point.time;
      accepted++;
      return { id: point.id, clientX: point.x, clientY: point.y, scrollX: point.scrollX, scrollY: point.scrollY,
        x: point.x + point.scrollX, y: point.y + point.scrollY, time: point.time };
    },
    end(id) { if (id === undefined || anchor?.id === id) clear(); },
    snapshot: () => ({ active: Boolean(anchor), id: anchor?.id ?? null, accepted }),
  };
}
