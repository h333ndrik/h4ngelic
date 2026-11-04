import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { mannequinPreviewConfig, mannequinDevVariant, mannequinVariant, mannequinVariantOrder } from './mannequin-preview-config.js';

const safePreviewURL = (value, pattern) => typeof value === 'string' && pattern.test(value);
const MODEL_PATTERN = /^\/models\/[a-z0-9.-]+\.glb$/;

const easeInOutCubic = (value) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2);
const easeOutCubic = (value) => 1 - (1 - value) ** 3;

/**
 * Ein Renderer, drei austauschbare Modelle. Rotation, Drag-Traegheit und der
 * Flick laufen hier; der Hero bleibt unberuehrt.
 */
export function initMannequinPreview(container) {
  const designSource = container.dataset.mannequinDesignSrc;
  if (!safePreviewURL(designSource, /^\/textures\/designs\/[a-z0-9-]+\.png$/)) throw new Error('Unsafe mannequin design source.');
  for (const key of mannequinVariantOrder) {
    if (!safePreviewURL(mannequinVariant(key).model, MODEL_PATTERN)) throw new Error('Unsafe mannequin model source.');
  }

  const config = mannequinPreviewConfig;
  const design = config.design;
  const motion = config.motion;
  const status = container.querySelector('[data-mannequin-status]');
  const figure = container.closest('.mannequin-preview');
  const designButton = figure?.querySelector('[data-mannequin-design-toggle]');
  const captionStatus = figure?.querySelector('.mannequin-preview-status');
  const designHint = figure?.querySelector('[data-mannequin-design-hint]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let disposed = false;
  let renderer = null;
  let environmentTarget = null;
  let frame = 0;
  let renderCount = 0;
  // Dev-Server: ?variant=a|b laedt eine versteckte Variante. Production bleibt C.
  let variant = mannequinDevVariant(window.location?.search) || container.dataset.mannequinVariant || config.defaultVariant;
  let modelRoot = null;
  let baseMesh = null;
  let activeVariant = null;
  let disposedModels = 0;
  let decal = null;
  let designTexture = null;
  let designRequested = false;
  let switchToken = 0;
  let visible = true;

  const buffers = new Map();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  const target = new THREE.Vector3(0, 0.85, 0);
  const pivot = new THREE.Group();
  scene.add(pivot);

  const view = {
    angle: 0,
    velocity: 0,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastTime: 0,
    lastInteraction: 0,
    hover: false,
    shootStart: 0,
    peakVelocity: 0,
  };

  const setData = (key, value) => { container.dataset[key] = String(value); };
  setData('mannequinInits', Number(container.dataset.mannequinInits || 0) + 1);

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (error) {
    container.dataset.mannequinState = 'failed';
    container.dataset.mannequinWebgl = 'unavailable';
    if (status) status.textContent = 'This browser cannot render 3D; the poster stays as the fallback.';
    console.warn('WebGL unavailable for the mannequin preview.', error);
    return { ready: Promise.resolve(), dispose() {} };
  }

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'mannequin-preview-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.prepend(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const compact = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 600;
  const environmentSize = compact ? config.chrome.environmentSizes.compact : config.chrome.environmentSizes.desktop;
  const studio = threeBandEnvironment();
  environmentTarget = pmrem.fromScene(studio.scene, config.chrome.environmentSigma, 0.1, 100, { size: environmentSize });
  studio.dispose();
  scene.environment = environmentTarget.texture;
  pmrem.dispose();
  container.dataset.mannequinEnvironment = 'three-band-pmrem';
  container.dataset.mannequinEnvironmentSize = String(environmentSize);
  container.dataset.mannequinEnvironmentSigma = String(config.chrome.environmentSigma);

  const dracoLoader = new DRACOLoader().setDecoderPath(config.loaders.draco);
  const ktx2Loader = new KTX2Loader().setTranscoderPath(config.loaders.basis).detectSupport(renderer);
  const loader = new GLTFLoader().setDRACOLoader(dracoLoader).setKTX2Loader(ktx2Loader);

  function fitCamera() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    if (modelRoot) {
      const box = new THREE.Box3().setFromObject(modelRoot);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      target.set(sphere.center.x, sphere.center.y, sphere.center.z);
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const distance = Math.max(
        sphere.radius / Math.sin(verticalFov / 2),
        sphere.radius / Math.sin(horizontalFov / 2),
      ) * 1.08;
      const direction = new THREE.Vector3(0.12, 0.04, 1).normalize();
      camera.position.copy(direction.multiplyScalar(distance).add(target));
      camera.lookAt(target);
    }
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function renderFrame() {
    if (disposed || !renderer) return;
    renderer.render(scene, camera);
    renderCount += 1;
    container.dataset.mannequinRenders = String(renderCount);
  }

  function scheduleFrame() {
    if (frame || disposed) return;
    frame = requestAnimationFrame(tick);
  }

  function applyShoot(now) {
    const shoot = motion.shoot;
    const elapsed = now - view.shootStart;
    const outEnd = shoot.outMs;
    const holdEnd = outEnd + shoot.holdMs;
    const backEnd = holdEnd + shoot.backMs;
    const box = new THREE.Box3().setFromObject(pivot);
    const height = Math.max(0.5, box.max.y - box.min.y);
    let progress;
    let eased;
    if (elapsed < outEnd) {
      progress = elapsed / outEnd;
      eased = easeInOutCubic(progress);
      pivot.position.set(eased * height * shoot.distance, eased * height * shoot.lift, 0);
      pivot.scale.setScalar(1 - eased * (1 - shoot.scale));
    } else if (elapsed < holdEnd) {
      pivot.position.set(height * shoot.distance, height * shoot.lift, 0);
      pivot.scale.setScalar(shoot.scale);
    } else if (elapsed < backEnd) {
      progress = (elapsed - holdEnd) / shoot.backMs;
      eased = easeOutCubic(progress);
      pivot.position.set((1 - eased) * height * shoot.distance, (1 - eased) * height * shoot.lift, 0);
      pivot.scale.setScalar(shoot.scale + eased * (1 - shoot.scale));
    } else {
      pivot.position.set(0, 0, 0);
      pivot.scale.setScalar(1);
      view.shootStart = 0;
      setData('mannequinShoot', 'idle');
      return false;
    }
    setData('mannequinShoot', 'playing');
    return true;
  }

  function tick(now) {
    frame = 0;
    if (disposed) return;
    const time = Number.isFinite(now) ? now : performance.now();
    const delta = view.lastTime ? Math.min(0.05, (time - view.lastTime) / 1000) : 0;
    view.lastTime = time;
    let animating = false;

    if (view.shootStart) animating = applyShoot(time);

    if (!view.dragging) {
      const idle = time - view.lastInteraction > motion.idleDelay;
      const wanted = reducedMotion.matches ? 0 : view.hover ? motion.hoverSpeed : idle ? motion.autoSpeed : 0;
      const blend = Math.min(1, delta * motion.inertiaDamping);
      view.velocity += (wanted - view.velocity) * blend;
      if (Math.abs(view.velocity) < 1e-4) view.velocity = 0;
      view.angle += view.velocity * delta;
      animating = animating || view.velocity !== 0;
    }
    pivot.rotation.y = view.angle;
    setData('mannequinAngle', view.angle.toFixed(4));
    setData('mannequinMotion', view.dragging ? 'drag' : reducedMotion.matches ? 'reduced' : view.velocity ? 'auto' : 'idle');
    renderFrame();
    // Nur sichtbare Sections animieren; reduzierte Bewegung rendert on demand.
    const keepGoing = visible && (view.dragging || view.shootStart !== 0 || !reducedMotion.matches);
    if (animating || keepGoing) scheduleFrame();
  }

  function wake() {
    view.lastTime = 0;
    scheduleFrame();
  }

  function handlePointerDown(event) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    view.dragging = true;
    view.pointerId = event.pointerId;
    view.lastX = event.clientX;
    view.velocity = 0;
    view.peakVelocity = 0;
    view.lastInteraction = performance.now();
    container.setPointerCapture?.(event.pointerId);
    container.dataset.mannequinDragging = 'true';
    wake();
  }

  function handlePointerMove(event) {
    if (!view.dragging || event.pointerId !== view.pointerId) return;
    const deltaX = event.clientX - view.lastX;
    view.lastX = event.clientX;
    view.angle += deltaX * motion.dragSensitivity;
    const now = performance.now();
    view.velocity = THREE.MathUtils.clamp((deltaX * motion.dragSensitivity) / Math.max(0.016, (now - view.lastInteraction) / 1000), -8, 8);
    // Spitzenwert statt Momentwert: Browser koaleszieren pointermove-Events, der
    // letzte Frame vor dem Loslassen hat oft deltaX 0.
    view.peakVelocity = Math.max(view.peakVelocity * 0.94, Math.abs(view.velocity));
    view.lastInteraction = now;
    setData('mannequinPeak', view.peakVelocity.toFixed(2));
    setData('mannequinMoves', Number(container.dataset.mannequinMoves || 0) + 1);
    wake();
  }

  function handlePointerUp(event) {
    if (!view.dragging || (event && event.pointerId !== view.pointerId)) return;
    view.dragging = false;
    view.pointerId = null;
    container.releasePointerCapture?.(event?.pointerId ?? 0);
    container.dataset.mannequinDragging = 'false';
    view.lastInteraction = performance.now();
    if (!reducedMotion.matches && view.peakVelocity > motion.flickVelocity) {
      view.velocity = 0;
      view.shootStart = performance.now();
      setData('mannequinFlicks', Number(container.dataset.mannequinFlicks || 0) + 1);
    }
    view.peakVelocity = 0;
    wake();
  }

  function handleHover(event) {
    view.hover = event.type === 'pointerenter';
    if (!view.hover) view.lastInteraction = performance.now();
    wake();
  }

  const onPointerDown = (event) => handlePointerDown(event);
  const onPointerMove = (event) => handlePointerMove(event);
  const onPointerUp = (event) => handlePointerUp(event);
  const onPointerEnter = (event) => handleHover(event);
  const onPointerLeave = (event) => handleHover(event);

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerUp);
  container.addEventListener('pointerenter', onPointerEnter);
  container.addEventListener('pointerleave', onPointerLeave);

  const visibilityObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) wake();
    }, { threshold: 0 })
    : null;
  visibilityObserver?.observe(container);
  const onMotionPreference = () => wake();
  reducedMotion.addEventListener?.('change', onMotionPreference);

  const resizeObserver = new ResizeObserver(() => {
    fitCamera();
    renderFrame();
  });
  resizeObserver.observe(container);

  function disposeModel() {
    if (!modelRoot) return;
    pivot.remove(modelRoot);
    disposeObject(modelRoot);
    modelRoot = null;
    baseMesh = null;
    activeVariant = null;
    if (decal) {
      pivot.remove(decal);
      decal.geometry.dispose();
      decal.material.dispose();
      decal = null;
    }
    designTexture?.dispose();
    designTexture = null;
    designRequested = false;
    disposedModels += 1;
    setData('mannequinDisposed', disposedModels);
  }

  function updateControls() {
    const profile = mannequinVariant(variant);
    container.dataset.mannequinVariant = variant;
    container.dataset.mannequinModel = profile.model;
    if (captionStatus) captionStatus.textContent = `${variant.toLowerCase()} · ${profile.label} · drag to turn`;
    if (designButton) {
      const available = Boolean(profile.design) && Boolean(baseMesh);
      designButton.disabled = !available;
      designButton.setAttribute('aria-disabled', String(!available));
      designButton.setAttribute('aria-pressed', 'false');
      designButton.title = profile.design ? '' : design.disabledNote;
      if (designHint) designHint.hidden = Boolean(profile.design);
      container.dataset.mannequinDesign = profile.design ? 'available' : 'unsupported';
    }
    if (!profile.design && status) status.textContent = design.disabledNote;
  }

  async function loadBuffers(key) {
    const profile = mannequinVariant(key);
    if (!buffers.has(key)) {
      const response = await fetch(profile.model);
      if (!response.ok) throw new Error(`Mannequin model ${profile.model} responded ${response.status}.`);
      buffers.set(key, await response.arrayBuffer());
    }
    return buffers.get(key);
  }

  let modelPromise = Promise.resolve();
  function selectVariant(key, { announce = true } = {}) {
    if (disposed || !mannequinPreviewConfig.variants[key] || key === variant && modelRoot) return modelPromise;
    variant = key;
    const token = ++switchToken;
    setData('mannequinState', 'loading');
    updateControls();
    if (announce && status) status.textContent = `Loading the ${key.toLowerCase()} mannequin.`;
    modelPromise = (async () => {
      const buffer = await loadBuffers(key);
      if (disposed || token !== switchToken) return;
      const gltf = await loader.parseAsync(buffer, '');
      if (disposed || token !== switchToken) {
        disposeObject(gltf.scene);
        return;
      }
      disposeModel();
      const profile = mannequinVariant(key);
      const root = gltf.scene;
      root.traverse((object) => {
        if (!object.isMesh) return;
        baseMesh = object;
        object.frustumCulled = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!material) continue;
          material.envMapIntensity = profile.envMapIntensity;
          container.dataset.mannequinMaterial = material.name || '';
          container.dataset.mannequinEnvIntensity = String(profile.envMapIntensity);
        }
      });
      if (!baseMesh) throw new Error('The mannequin GLB contains no mesh.');
      // Ursprung mittig unter die Figur legen, damit die Y-Rotation nicht eiert.
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      root.position.set(-center.x, -box.min.y, -center.z);
      pivot.add(root);
      modelRoot = root;
      activeVariant = key;
      // Startblick je Variante (C: +Z-Front), Konstanten in der Config.
      view.angle = profile.initialYaw || 0;
      view.velocity = 0;
      pivot.rotation.y = view.angle;
      fitCamera();
      setData('mannequinState', 'ready');
      setData('mannequinLoads', Number(container.dataset.mannequinLoads || 0) + 1);
      setData('mannequinStatic', 'false');
      setData('mannequinPolygons', String(countTriangles(root)));
      updateControls();
      if (status) status.textContent = profile.design
        ? `The ${profile.label} mannequin is ready. Demo design is available.`
        : `${profile.label} mannequin ready. ${design.disabledNote}`;
      view.lastInteraction = performance.now();
      wake();
    })().catch((error) => {
      if (disposed || token !== switchToken) return;
      setData('mannequinState', 'failed');
      if (status) status.textContent = 'The mannequin preview is unavailable; the poster stays visible.';
      console.error('Unable to render the mannequin preview.', error);
    });
    return modelPromise;
  }

  async function applyDemoDesign() {
    if (disposed || !baseMesh || !designButton || !mannequinVariant(variant).design) return;
    if (decal) {
      decal.visible = !decal.visible;
      designButton.setAttribute('aria-pressed', String(decal.visible));
      wake();
      return;
    }
    if (designRequested) return;
    designRequested = true;
    designButton.disabled = true;
    designButton.setAttribute('aria-busy', 'true');
    try {
      const [DecalGeometry, loadedTexture] = await Promise.all([
        import('three/addons/geometries/DecalGeometry.js').then((module) => module.DecalGeometry),
        new THREE.TextureLoader().loadAsync(designSource),
      ]);
      designTexture = loadedTexture;
      if (disposed) {
        designTexture.dispose();
        designTexture = null;
        return;
      }
      designTexture.colorSpace = THREE.SRGBColorSpace;
      designTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      designTexture.needsUpdate = true;
      modelRoot.updateMatrixWorld(true);
      const placement = design.placement;
      const position = new THREE.Vector3(...placement.position);
      modelRoot.localToWorld(position);
      const geometry = new DecalGeometry(
        baseMesh,
        position,
        new THREE.Euler(...placement.rotation),
        new THREE.Vector3(...placement.size),
      );
      const material = new THREE.MeshStandardMaterial({
        map: designTexture,
        transparent: true,
        alphaTest: 0.02,
        roughness: 0.68,
        metalness: 0.08,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
      });
      decal = new THREE.Mesh(geometry, material);
      decal.name = 'demo_design_decal';
      pivot.add(decal);
      container.dataset.mannequinDecal = 'applied';
      designButton.setAttribute('aria-pressed', 'true');
      designButton.removeAttribute('aria-busy');
      designButton.disabled = false;
      if (status) status.textContent = 'Demo design applied to the rotating mannequin.';
      wake();
    } catch (error) {
      if (disposed) return;
      container.dataset.mannequinDecal = 'failed';
      designButton.removeAttribute('aria-busy');
      designButton.disabled = true;
      if (status) status.textContent = 'The demo design is unavailable; the base mannequin remains visible.';
      console.error('Unable to apply the demo mannequin design.', error);
    }
  }

  const onDesignClick = () => { void applyDemoDesign(); };
  designButton?.addEventListener('click', onDesignClick);

  const ready = selectVariant(variant, { announce: false });

  const disposePreview = () => {
    if (disposed) return;
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    resizeObserver.disconnect();
    visibilityObserver?.disconnect();
    reducedMotion.removeEventListener?.('change', onMotionPreference);
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerUp);
    container.removeEventListener('pointerenter', onPointerEnter);
    container.removeEventListener('pointerleave', onPointerLeave);
    designButton?.removeEventListener('click', onDesignClick);
    disposeModel();
    pivot.removeFromParent();
    environmentTarget?.texture.dispose();
    environmentTarget?.dispose();
    environmentTarget = null;
    scene.environment = null;
    buffers.clear();
    dracoLoader.dispose();
    ktx2Loader.dispose();
    disposeObject(scene);
    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer?.domElement.remove();
    renderer = null;
    container.dataset.mannequinState = 'disposed';
    if (status) status.textContent = 'Mannequin preview released.';
  };

  return { ready, dispose: disposePreview, selectVariant };
}

/** A PMREM-ready studio: charcoal top, bright horizon, dark floor. */
function threeBandEnvironment() {
  const scene = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(40, 64, 32);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDirection;
      void main() {
        vec3 direction = normalize(vDirection);
        vec3 color;
        if (direction.y < -0.15) color = vec3(0.012, 0.014, 0.015);
        else if (direction.y < 0.16) color = vec3(1.45, 1.42, 1.34);
        else color = vec3(0.025, 0.028, 0.030);
        float angle = atan(direction.z, direction.x);
        float stripe = step(0.86, abs(sin(angle * 6.0))) * 0.30;
        if (direction.y >= -0.15 && direction.y < 0.16) color += vec3(stripe);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);
  return {
    scene,
    dispose() {
      scene.remove(sphere);
      geometry.dispose();
      material.dispose();
    },
  };
}

function countTriangles(root) {
  let triangles = 0;
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    const geometry = object.geometry;
    triangles += geometry.index ? geometry.index.count / 3 : (geometry.attributes.position?.count || 0) / 3;
  });
  return Math.round(triangles);
}

function disposeObject(root) {
  root?.traverse((object) => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}
