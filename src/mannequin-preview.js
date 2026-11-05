import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { mannequinPreviewConfig, mannequinDevVariant, mannequinVariant, mannequinVariantOrder } from './mannequin-preview-config.js';

const safePreviewURL = (value, pattern) => typeof value === 'string' && pattern.test(value);
const MODEL_PATTERN = /^\/models\/[a-z0-9.-]+\.glb$/;

const easeInOutCubic = (value) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2);
const easeOutCubic = (value) => 1 - (1 - value) ** 3;

// Obergrenze fuer einen einzelnen Frame-Schritt. Sie faengt nur Rueckkehr aus
// dem Hintergrund-Tab oder einen blockierten Hauptthread ab; alles bis 30 Hz
// laeuft ungekuerzt. Die Bewegung selbst rechnet in Sekunden, damit 30/60/144 Hz
// dieselbe Drehung pro Sekunde ergeben.
const MAX_FRAME_DELTA = 1 / 30;
// Untergrenze fuer eine gemessene Zeitspanne — ausschliesslich Divisionsschutz.
// Sie liegt unter dem kuerzesten real moeglichen Pointer-Intervall (1000-Hz-Maus
// liefert alle 1 ms ein Ereignis) und glaettet daher nichts.
const MIN_POINTER_DELTA = 1 / 2000;

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
  const figure = container.closest('.mannequin-preview');
  // Die Live-Region liegt ausserhalb von role="img" (presentational children).
  const status = figure?.querySelector('[data-mannequin-status]');
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
  // Ringpuffer der letzten Zeigerpositionen (Zeitstempel + x) fuer die
  // Geschwindigkeit ueber das Zeitfenster.
  const pointerSamples = [];
  let pointerSampleCount = 0;
  let coalescedSampleCount = 0;
  // Einmal gemessene Modell-Bounds; applyShoot transformiert nur diese Kopie.
  const modelBounds = new THREE.Box3();
  const shootBounds = new THREE.Box3();
  let boundsBuilds = 0;
  let shootFrameMs = 0;
  let shootFrameMsAvg = 0;
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
    // -1 links, 1 rechts, 0 losgelassen
    keyDirection: 0,
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

  /**
   * Scene-weite Bounds werden nur beim Laden und bei Resizes gebraucht. Jeder
   * Aufruf wird gezaehlt (data-mannequin-bounds-builds), damit ein Rueckfall
   * auf "Bounds pro Frame" in den Tests auffaellt.
   */
  function sceneBounds(object) {
    boundsBuilds += 1;
    setData('mannequinBoundsBuilds', boundsBuilds);
    return new THREE.Box3().setFromObject(object);
  }

  function fitCamera() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    if (modelRoot) {
      const box = sceneBounds(modelRoot);
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
    // Nur die beim Laden gemessene Box mit der aktuellen Pivot-Matrix
    // transformieren: kein Scene-Traversal und keine Allokation pro Frame.
    pivot.updateWorldMatrix(false, false);
    shootBounds.copy(modelBounds).applyMatrix4(pivot.matrixWorld);
    const height = Math.max(0.5, shootBounds.max.y - shootBounds.min.y);
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
    const rawDelta = view.lastTime ? (time - view.lastTime) / 1000 : 0;
    const delta = Math.min(Math.max(rawDelta, 0), MAX_FRAME_DELTA);
    view.lastTime = time;
    let animating = false;

    // Der Flick-Peak zerfaellt pro Frame, nicht pro Pointer-Ereignis: sonst
    // klaenge er bei einer 1000-Hz-Maus 16-mal schneller ab als bei 60 Hz.
    if (view.peakVelocity) view.peakVelocity *= Math.exp(-motion.peakDecayPerSecond * delta);

    if (view.shootStart) {
      const shootStarted = performance.now();
      animating = applyShoot(time);
      shootFrameMs = performance.now() - shootStarted;
      shootFrameMsAvg = shootFrameMsAvg ? shootFrameMsAvg * 0.9 + shootFrameMs * 0.1 : shootFrameMs;
      setData('mannequinShootMs', shootFrameMs.toFixed(4));
      setData('mannequinShootAvgMs', shootFrameMsAvg.toFixed(4));
    }

    if (!view.dragging) {
      const idle = time - view.lastInteraction > motion.idleDelay;
      // Gehaltene Pfeiltasten drehen auch bei Reduced Motion (nur Auto und
      // Flick sind dort aus).
      const wanted = view.keyDirection
        ? view.keyDirection * motion.keySpeed
        : reducedMotion.matches ? 0 : view.hover ? motion.hoverSpeed : idle ? motion.autoSpeed : 0;
      // Exaktes exponentielles Daempfen pro Sekunde. Die Naeherung k*dt gilt nur
      // bei 60 Hz; 1 - e^(-k*dt) liefert bei jeder Framerate dieselbe Kurve.
      const blend = 1 - Math.exp(-motion.inertiaDamping * delta);
      const step = (wanted - view.velocity) * blend;
      // Die Beschleunigung ist in rad/s^2 definiert und wird mit der echten
      // Framedauer skaliert. Ohne Untergrenze: bei delta = 0 aendert sich nichts.
      const maxStep = motion.maxAngularAcceleration * delta;
      const previousVelocity = view.velocity;
      view.velocity += THREE.MathUtils.clamp(step, -maxStep, maxStep);
      if (Math.abs(view.velocity) < 1e-4) view.velocity = 0;
      // Trapezregel: bei konstanter Beschleunigung exakt, deshalb ist der Winkel
      // pro Sekunde bei 30/60/144 Hz gleich. Euler (v_neu * dt) liegt auf
      // derselben Rampe bei 30 Hz um 2,4 %, bei 144 Hz um 0,5 % daneben.
      view.angle += (previousVelocity + view.velocity) * 0.5 * delta;
      animating = animating || view.velocity !== 0;
    }
    pivot.rotation.y = view.angle;
    setData('mannequinAngle', view.angle.toFixed(4));
    // Diagnosewert fuer das Framerate-Audit (und Tests), nur lesbar.
    setData('mannequinVelocity', view.velocity.toFixed(4));
    setData('mannequinMotion', view.dragging ? 'drag' : reducedMotion.matches ? 'reduced' : view.velocity ? 'auto' : 'idle');
    renderFrame();
    // Nur sichtbare Sections animieren; reduzierte Bewegung rendert on demand.
    const keepGoing = visible && (view.dragging || view.shootStart !== 0 || !reducedMotion.matches);
    if (animating || keepGoing) scheduleFrame();
  }

  function wake() {
    // Nur nach einer Pause die Zeitbasis zuruecksetzen: sonst verliert jedes
    // Zeiger-Ereignis einen ganzen Frame Bewegung, bei 30 Hz also 33 ms statt
    // 7 ms bei 144 Hz. Laeuft der Loop, bleibt `lastTime` unangetastet.
    if (!frame) view.lastTime = 0;
    scheduleFrame();
  }

  /**
   * Positionen eines pointermove-Ereignisses. Browser buendeln mehrere
   * Zwischenpositionen: `getCoalescedEvents` ist die einzige Quelle dafuer.
   * Die API ist nicht ueberall vorhanden (HeadlessChrome 156 kennt sie nicht)
   * und liefert fuer synthetische Ereignisse eine leere Liste — dann bleibt es
   * bei der einen Position des Ereignisses (Fallback ohne Feature).
   */
  function pointerPoints(event, now) {
    const coalesced = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
    if (!coalesced.length) return [{ t: now, x: event.clientX, coalesced: false }];
    // Nur die Relativabstaende der Browser-Uhr zaehlen; der Anker ist die
    // Ankunftszeit des Ereignisses (performance.now), damit beide Zeitbasen
    // nicht vermischt werden.
    const base = event.timeStamp;
    const points = coalesced.map((sample) => ({
      t: now - (base - sample.timeStamp),
      x: sample.clientX,
      coalesced: true,
    }));
    const last = points[points.length - 1];
    if (last.x !== event.clientX) points.push({ t: now, x: event.clientX, coalesced: false });
    return points;
  }

  function pushPointerPoint(point) {
    pointerSamples.push(point);
    const cutoff = point.t - motion.pointerWindowMs;
    while (pointerSamples.length > 2 && pointerSamples[0].t < cutoff) pointerSamples.shift();
    pointerSampleCount += 1;
    setData('mannequinPointerSamples', pointerSampleCount);
    if (point.coalesced) {
      coalescedSampleCount += 1;
      setData('mannequinCoalescedSamples', coalescedSampleCount);
    }
  }

  /**
   * Geschwindigkeit aus dem Zeitfenster statt aus einem einzelnen Ereignis:
   * (Distanz im Fenster) / (Zeitspanne im Fenster). Damit haengt das Ergebnis
   * nicht davon ab, wie oft der Zeiger Ereignisse liefert.
   */
  function windowVelocity(now) {
    const cutoff = now - motion.pointerWindowMs;
    const lastIndex = pointerSamples.length - 1;
    // Ohne Allokation rueckwaerts bis zum aeltesten Sample im Fenster laufen:
    // bei 1000 Hz sind das rund 70 Positionen pro Abfrage.
    let firstIndex = lastIndex;
    while (firstIndex > 0 && pointerSamples[firstIndex - 1].t >= cutoff) firstIndex -= 1;
    if (firstIndex === lastIndex) return 0;
    const first = pointerSamples[firstIndex];
    const last = pointerSamples[lastIndex];
    const span = (last.t - first.t) / 1000;
    const pixelsPerSecond = (last.x - first.x) / Math.max(span, MIN_POINTER_DELTA);
    return THREE.MathUtils.clamp(pixelsPerSecond * motion.dragSensitivity,
      -motion.dragVelocityLimit, motion.dragVelocityLimit);
  }

  function handlePointerDown(event) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    view.dragging = true;
    view.pointerId = event.pointerId;
    view.lastX = event.clientX;
    view.velocity = 0;
    view.peakVelocity = 0;
    view.lastInteraction = performance.now();
    pointerSamples.length = 0;
    pointerSampleCount = 0;
    coalescedSampleCount = 0;
    setData('mannequinPointerSamples', 0);
    setData('mannequinCoalescedSamples', 0);
    pushPointerPoint({ t: view.lastInteraction, x: event.clientX, coalesced: false });
    container.setPointerCapture?.(event.pointerId);
    container.dataset.mannequinDragging = 'true';
    wake();
  }

  function handlePointerMove(event) {
    if (!view.dragging || event.pointerId !== view.pointerId) return;
    const now = performance.now();
    for (const point of pointerPoints(event, now)) {
      view.angle += (point.x - view.lastX) * motion.dragSensitivity;
      view.lastX = point.x;
      pushPointerPoint(point);
    }
    view.velocity = windowVelocity(now);
    // Spitzenwert statt Momentwert: der letzte Frame vor dem Loslassen hat oft
    // deltaX 0. Abklingen passiert pro Frame in tick().
    view.peakVelocity = Math.max(view.peakVelocity, Math.abs(view.velocity));
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
    // Auch beim Loslassen gilt nur das letzte Zeitfenster: wer vor dem
    // Loslassen 70 ms stillgehalten hat, loest keinen Flick aus.
    view.velocity = windowVelocity(view.lastInteraction);
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

  /** Beendet Flick und Restgeschwindigkeit und setzt die Figur zurueck. */
  function cancelMotion() {
    view.keyDirection = 0;
    view.velocity = 0;
    view.shootStart = 0;
    view.peakVelocity = 0;
    pivot.position.set(0, 0, 0);
    pivot.scale.setScalar(1);
    setData('mannequinShoot', 'idle');
  }

  function handleKeyDown(event) {
    // preventDefault nur im fokussierten Viewer; ausserhalb scrollt die Seite
    // unveraendert weiter.
    if (document.activeElement !== container) return;
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step) {
      event.preventDefault();
      view.keyDirection = step;
      // Erster Druck = ein messbarer 15-Grad-Schritt; Wiederholungen nicht
      // noch einmal, sonst rast die Figur bei gehaltener Taste.
      if (!event.repeat) {
        view.angle += step * motion.keyStep;
        // Sofort spiegeln: der Frame-Loop laeuft erst im naechsten Bild.
        setData('mannequinAngle', view.angle.toFixed(4));
      }
      view.lastInteraction = performance.now();
      setData('mannequinKeyboard', 'turn');
      wake();
      return;
    }
    if (event.key === 'Home' || event.key === '0') {
      event.preventDefault();
      cancelMotion();
      view.angle = mannequinVariant(variant).initialYaw || 0;
      view.lastInteraction = performance.now();
      setData('mannequinAngle', view.angle.toFixed(4));
      setData('mannequinKeyboard', 'reset');
      wake();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelMotion();
      // Auto-Rotation kommt nach der normalen Idle-Zeit zurueck (idleDelay).
      view.lastInteraction = performance.now();
      setData('mannequinKeyboard', 'escape');
      wake();
    }
  }

  function handleKeyUp(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    view.keyDirection = 0;
    view.lastInteraction = performance.now();
    wake();
  }

  function handleBlur() {
    // Fokus weg, Taste evtl. noch gedrueckt: nicht weiterdrehen.
    view.keyDirection = 0;
  }

  const onKeyDown = (event) => handleKeyDown(event);
  const onKeyUp = (event) => handleKeyUp(event);
  const onBlur = () => handleBlur();
  container.addEventListener('keydown', onKeyDown);
  container.addEventListener('keyup', onKeyUp);
  container.addEventListener('blur', onBlur);

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
    modelBounds.makeEmpty();
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
      const box = sceneBounds(root);
      const center = box.getCenter(new THREE.Vector3());
      root.position.set(-center.x, -box.min.y, -center.z);
      pivot.add(root);
      modelRoot = root;
      // Flick-Bounds einmal messen (Pivot-Koordinaten inkl. Ursprungs-Offset);
      // applyShoot transformiert spaeter nur diese Kopie.
      modelBounds.copy(box).translate(root.position);
      activeVariant = key;
      // Startblick je Variante (C: +Z-Front), Konstanten in der Config.
      view.angle = profile.initialYaw || 0;
      view.velocity = 0;
      pivot.rotation.y = view.angle;
      fitCamera();
      // Erster Frame MIT Modell, bevor das Poster freigegeben wird. Ohne diesen
      // Render blendet der Crossfade auf einen noch leeren Canvas — das war
      // der sichtbare Zwischenzustand.
      renderFrame();
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
    container.removeEventListener('keydown', onKeyDown);
    container.removeEventListener('keyup', onKeyUp);
    container.removeEventListener('blur', onBlur);
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
