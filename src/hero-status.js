/** On-device diagnostics for the hero, opt-in via `?status`.
 *
 * iOS has no console without a Mac, so a device-only hero problem (poster still
 * visible, canvas black or corrupted) cannot be reported otherwise. The panel
 * changes nothing unless the query parameter is present: no extra DOM, no
 * styles, no listeners on a normal visit. */
export function initHeroStatus(doc = document, view = window) {
  if (!new URLSearchParams(view.location.search).has('status')) return () => {};
  const root = doc.documentElement;
  const panel = doc.createElement('pre');
  panel.setAttribute('data-hero-status', '');
  panel.setAttribute('data-corruption-protected', '');
  panel.setAttribute('data-no-mosh', '');
  panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;margin:0;padding:8px 10px;'
    + 'background:rgba(0,0,0,.86);color:#f0efeb;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;'
    + 'white-space:pre;pointer-events:none;border:1px solid rgba(240,239,235,.28);border-radius:3px;max-width:94vw;';
  const gl = (type) => { try { const probe = doc.createElement('canvas'); return Boolean(probe.getContext(type)); } catch { return false; } };
  const webgl = `webgl2 ${gl('webgl2')} · webgl ${gl('webgl')}`;
  const read = () => {
    const stage = doc.getElementById('stage');
    const poster = doc.querySelector('[data-hero-poster]');
    const canvas = doc.getElementById('logo-canvas');
    const p = poster ? view.getComputedStyle(poster) : null;
    const c = canvas ? view.getComputedStyle(canvas) : null;
    const matrix = c && c.transform !== 'none' ? new DOMMatrixReadOnly(c.transform) : null;
    return [
      `build ${root.dataset.build || '(none)'}`,
      `stage ${stage ? stage.className : '(none)'}`,
      `loading ${root.dataset.heroLoading} · quality ${root.dataset.heroQuality || '(n/a)'}`,
      `poster ${p ? `${p.display} op ${Number(p.opacity).toFixed(2)} anim ${p.animationName}` : '(none)'}`,
      `canvas ${c ? `${c.display} op ${Number(c.opacity).toFixed(2)} y ${matrix ? Math.round(matrix.m42) : 0}` : '(none)'}`,
      `buffer ${canvas ? `${canvas.width}×${canvas.height}` : '(none)'}`,
      `${webgl}`,
      `dpr ${view.devicePixelRatio} · ${view.innerWidth}×${view.innerHeight}`,
      `reduce ${view.matchMedia('(prefers-reduced-motion: reduce)').matches} · coarse ${view.matchMedia('(pointer: coarse)').matches}`,
    ].join('\n');
  };
  const paint = () => { panel.textContent = read(); };
  paint();
  doc.body.append(panel);
  const timer = view.setInterval(paint, 700);
  return () => { view.clearInterval(timer); panel.remove(); };
}
