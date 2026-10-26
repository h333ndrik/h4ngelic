import './flash-mannequin.css';
import { flashMannequinConfig, mannequinMaterialRole } from './flash-mannequin-content.js';
import { chooseRenderQuality } from './render-quality.js';

/** Dispose a loaded model even if a route/toggle changed during async loading. */
function disposeModel(model, extraMaterials = []) {
  const geometries = new Set(), materials = new Set(extraMaterials), textures = new Set();
  model?.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [].concat(object.material || [])) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
  }
  const images = new Set();
  for (const texture of textures) { if (texture.image) images.add(texture.image); texture.dispose(); }
  for (const image of images) image.close?.();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

/** No Three.js imports, requests or WebGL context until the explicit 3D button.
 * Model data is the same across worlds; mode changes never replace the viewer. */
export function initFlashMannequins(root = document) {
  const cleanups = [];
  for (const section of root.querySelectorAll('[data-flash-mannequin]')) {
    let config;
    try { config = flashMannequinConfig({ category: 'flashes', mannequin: {
      ...JSON.parse(section.dataset.flashMannequin), validated: true,
    } }); } catch { continue; }
    if (!config) continue;
    const doc = section.ownerDocument, view = doc.defaultView;
    const toggle = section.querySelector('[data-mannequin-toggle]');
    const reset = section.querySelector('[data-mannequin-reset]');
    const host = section.querySelector('[data-mannequin-view]');
    const help = section.querySelector('[data-mannequin-help]');
    const status = section.querySelector('[data-mannequin-status]');
    const flat = section.closest('.artwork-detail')?.querySelector('.project-images');
    if (!toggle || !reset || !host || !help || !status) continue;
    const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
    const removers = [], runtimeRemovers = [];
    const listen = (target, event, callback, options, list = removers) => {
      target.addEventListener(event, callback, options);
      list.push(() => target.removeEventListener(event, callback, options));
    };
    let disposed = false, opened = false, generation = 0, scene = null, model = null;
    let renderer = null, camera = null, group = null, frame = 0, lastTime = 0, near = false;
    let resizeObserver = null, observer = null, dragging = null, yaw = 0, pitch = 0;
    let originalMaterials = [], originalFlatHidden = flat?.hidden || false;

    function stopFrame() {
      if (frame) view.cancelAnimationFrame(frame);
      frame = lastTime = 0;
    }
    function schedule() {
      if (!frame && opened && renderer && near && !doc.hidden) frame = view.requestAnimationFrame(draw);
    }
    function draw(time) {
      frame = 0;
      if (!opened || !renderer || !near || doc.hidden) return;
      const dt = lastTime ? Math.min(.05, (time - lastTime) / 1000) : 0;
      lastTime = time;
      if (!reduced.matches && !dragging) yaw += dt * .12;
      group.rotation.set(pitch, yaw, 0);
      renderer.render(scene, camera);
      if (!reduced.matches) schedule();
    }
    function disposeRuntime() {
      stopFrame();
      resizeObserver?.disconnect(); resizeObserver = null;
      observer?.disconnect(); observer = null;
      for (const remove of runtimeRemovers.splice(0)) remove();
      disposeModel(model, originalMaterials);
      originalMaterials = [];
      renderer?.dispose();
      renderer?.forceContextLoss();
      host.replaceChildren();
      scene = model = group = camera = renderer = null;
      dragging = null; near = false;
    }
    function close() {
      ++generation; opened = false;
      disposeRuntime();
      if (flat) flat.hidden = originalFlatHidden;
      toggle.disabled = false;
      toggle.textContent = '3d placement';
      toggle.setAttribute('aria-pressed', 'false');
      host.hidden = help.hidden = reset.hidden = true;
      host.removeAttribute('aria-busy');
      status.textContent = '';
    }
    async function open() {
      const request = ++generation;
      opened = true;
      originalFlatHidden = flat?.hidden || false;
      toggle.textContent = 'flat artwork';
      toggle.setAttribute('aria-pressed', 'true');
      host.hidden = false;
      host.setAttribute('aria-busy', 'true');
      status.textContent = 'loading placement preview';
      let loaded = null;
      try {
        const [THREE, { GLTFLoader }] = await Promise.all([
          import('three'), import('three/addons/loaders/GLTFLoader.js'),
        ]);
        if (disposed || !opened || request !== generation) return;
        loaded = (await new GLTFLoader().loadAsync(config.model)).scene;
        if (disposed || !opened || request !== generation) { disposeModel(loaded); return; }
        model = loaded;
        const foundBody = new Set(), foundTattoo = new Set();
        model.traverse(object => {
          if (!object.isMesh) return;
          const array = Array.isArray(object.material);
          const materials = [].concat(object.material || []).map(material => {
            const role = mannequinMaterialRole(material.name, config);
            if (role === 'tattoo') { foundTattoo.add(material.name); return material; }
            if (role !== 'body') return material;
            foundBody.add(material.name);
            originalMaterials.push(material);
            const neutral = new THREE.MeshStandardMaterial({ color: 0xaaaaa5, roughness: .76, metalness: .02, side: material.side });
            neutral.name = material.name;
            return neutral;
          });
          object.material = array ? materials : materials[0];
        });
        if (config.bodyMaterialNames.some(name => !foundBody.has(name))
          || config.tattooMaterialNames.some(name => !foundTattoo.has(name))) {
          throw new Error('The configured separated materials are not present in this model.');
        }
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
        if (!Number.isFinite(radius) || radius <= 0) throw new Error('Model has no visible bounds.');
        model.position.sub(center);
        group = new THREE.Group(); group.add(model);
        scene = new THREE.Scene(); scene.add(group);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x55555a, 2));
        const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(3, 4, 5); scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 1.2); fill.position.set(-3, 1, -2); scene.add(fill);
        const quality = chooseRenderQuality({ pixelRatio: view.devicePixelRatio,
          coarsePointer: view.matchMedia('(pointer: coarse)').matches,
          memory: view.navigator.deviceMemory, cores: view.navigator.hardwareConcurrency,
          saveData: view.navigator.connection?.saveData });
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: quality.antialias, powerPreference: 'low-power' });
        renderer.setPixelRatio(quality.pixelRatio);
        camera = new THREE.PerspectiveCamera(35, 1, radius / 100, radius * 30);
        const canvas = renderer.domElement;
        canvas.tabIndex = 0;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'rotatable three-dimensional flash placement; use arrow keys or drag to rotate, home to reset');
        host.replaceChildren(canvas);
        if (flat) flat.hidden = true;
        function resize() {
          if (!renderer) return;
          const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
          renderer.setSize(width, height, false); camera.aspect = width / height;
          const halfFov = camera.fov * Math.PI / 360;
          camera.position.z = radius / Math.sin(Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect))) * 1.12;
          camera.updateProjectionMatrix(); schedule();
        }
        resizeObserver = new view.ResizeObserver(resize); resizeObserver.observe(host); resize();
        observer = new view.IntersectionObserver(([entry]) => {
          near = entry.isIntersecting; if (near) schedule(); else stopFrame();
        });
        observer.observe(host);
        const runtimeListen = (target, event, callback, options) => listen(target, event, callback, options, runtimeRemovers);
        runtimeListen(canvas, 'pointerdown', event => {
          if (!event.isPrimary || event.button !== 0) return;
          dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
          canvas.setPointerCapture(event.pointerId);
        });
        runtimeListen(canvas, 'pointermove', event => {
          if (dragging?.id !== event.pointerId) return;
          yaw += (event.clientX - dragging.x) / Math.max(200, host.clientWidth) * Math.PI;
          pitch = Math.max(-.5, Math.min(.5, pitch + (event.clientY - dragging.y) / Math.max(300, host.clientHeight)));
          dragging.x = event.clientX; dragging.y = event.clientY; schedule();
        });
        const release = event => {
          if (dragging?.id === event.pointerId) { dragging = null; schedule(); }
        };
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) runtimeListen(canvas, event, release);
        runtimeListen(canvas, 'keydown', event => {
          if (event.key === 'Escape') { event.preventDefault(); close(); toggle.focus(); return; }
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
          event.preventDefault();
          if (event.key === 'Home') yaw = pitch = 0;
          else if (event.key === 'ArrowLeft') yaw -= .15;
          else if (event.key === 'ArrowRight') yaw += .15;
          else pitch = Math.max(-.5, Math.min(.5, pitch + (event.key === 'ArrowUp' ? -.08 : .08)));
          schedule();
        });
        runtimeListen(canvas, 'webglcontextlost', event => {
          event.preventDefault();
          close(); status.textContent = '3d preview unavailable; the flat artwork remains available.';
        });
        yaw = pitch = 0;
        host.removeAttribute('aria-busy');
        help.hidden = reset.hidden = false;
        status.textContent = 'placement preview loaded';
        schedule();
      } catch {
        if (disposed || request !== generation) { if (loaded && loaded !== model) disposeModel(loaded); return; }
        close();
        status.textContent = '3d preview unavailable; the flat artwork remains available.';
      }
    }
    listen(toggle, 'click', () => { if (opened) close(); else open(); });
    listen(reset, 'click', () => { yaw = pitch = 0; schedule(); });
    listen(doc, 'visibilitychange', () => { if (doc.hidden) stopFrame(); else schedule(); });
    listen(reduced, 'change', () => { stopFrame(); schedule(); });
    cleanups.push(() => {
      disposed = true; close();
      for (const remove of removers) remove();
    });
  }
  return () => { for (const cleanup of cleanups) cleanup(); };
}
