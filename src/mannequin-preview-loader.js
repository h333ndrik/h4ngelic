/**
 * Side-effect-free lazy loader. It observes markup from the prerendered route
 * and imports the Three.js preview module only when the section approaches the
 * viewport. Cold Work pages therefore make no WebGL or GLB request.
 */
export function initMannequinPreviewLazy(root) {
  const targets = [...root.querySelectorAll('[data-mannequin-preview]')];
  if (!targets.length || typeof IntersectionObserver !== 'function') return () => {};
  let cancelled = false;
  let stopPreview = null;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || cancelled) continue;
      const target = entry.target;
      observer.unobserve(target);
      target.dataset.mannequinState = 'loading';
      const status = target.querySelector('[data-mannequin-status]');
      if (status) status.textContent = 'Loading static mannequin preview.';
      import('./mannequin-preview.js').then(({ initMannequinPreview }) => {
        if (cancelled || !target.isConnected) return;
        const preview = initMannequinPreview(target);
        stopPreview = () => preview.dispose();
      }).catch((error) => {
        if (cancelled || !target.isConnected) return;
        target.dataset.mannequinState = 'failed';
        if (status) status.textContent = 'The static mannequin preview is unavailable.';
        console.error('Unable to load the static mannequin preview.', error);
      });
    }
  }, { rootMargin: '240px 0px', threshold: 0.01 });
  for (const target of targets) observer.observe(target);
  return () => {
    cancelled = true;
    observer.disconnect();
    stopPreview?.();
    stopPreview = null;
  };
}
