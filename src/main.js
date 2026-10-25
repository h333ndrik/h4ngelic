import './style.css';
import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LogoPhysics } from './physics.js';
import { sampleBase } from './motion.js';
import { bindControls } from './controls.js';
import { attachArtwork, revealWeight } from './reveal.js';
import { chooseRenderQuality, AdaptiveResolution } from './render-quality.js';
import { featureFlags } from './data/featureFlags.js';
import { createHeroDepth } from './hero-depth.js';
import { sampleHero } from './data/motionSettings.js';
import { createVisualMotionPublisher } from './motion-mosh.js';
import { createHeroInk, isHeroInkClick } from './hero-ink.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('logo-canvas');
const status = document.getElementById('scene-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const physics = new LogoPhysics();
const basePosition = new THREE.Vector3();
const baseQuaternion = new THREE.Quaternion();
let paused = reducedMotion.matches;
let speed = 1;
let revealEnabled = true;
let renderer;
let running = true;
let frameCount = 0;
let animationTime = .55;
let previousFrame = performance.now();
let dragPointer = null;
let activePointer = false;
let previousPoint = null;
let previousPointerTime = 0;
let lastHit = -Infinity;
let artwork = null;
let disposeScene = () => {};
let stageIsVisible = false;
let sceneReady = false;
let animationFrame = 0;
let pendingPointer = null;
let syncRendering = () => {};
const quality = chooseRenderQuality({
  pixelRatio: devicePixelRatio,
  coarsePointer: matchMedia('(pointer: coarse)').matches,
  memory: navigator.deviceMemory,
  cores: navigator.hardwareConcurrency,
  saveData: navigator.connection?.saveData,
});
const resolution = new AdaptiveResolution(quality.pixelRatio);

const controls = bindControls({
  initiallyPaused: paused,
  onPause: (value) => { paused = value; },
  onSpeed: (value) => { speed = value; },
  onReveal: (value) => { revealEnabled = value; },
});

function fallback(message) {
  running = false;
  stage.classList.remove('is-ready');
  stage.classList.add('is-fallback');
  status.textContent = message;
  document.getElementById('interaction-hint').textContent = 'h4ngelic';
  for (const id of ['pause-control', 'speed-control', 'reveal-control']) document.getElementById(id).disabled = true;
}

async function initialize() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, alpha: true, stencil: false, powerPreference: 'low-power' });
  renderer.setClearColor('#242424', 0);
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 150);
  const environment = new RoomEnvironment();
  environment.traverse((object) => {
    if (object.material?.isMeshStandardMaterial) object.material.color.setScalar(.42);
  });
  // Softboxes supply reflected light; the charcoal studio leaves dark bands.
  const panelMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 6), side: THREE.DoubleSide });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), panelMaterial);
  panel.position.set(-1, 5, 9);
  panel.lookAt(0, 0, 0);
  environment.add(panel);
  const lowerPanel = new THREE.Mesh(new THREE.PlaneGeometry(9, 4), panelMaterial);
  lowerPanel.position.set(3, -8, 6);
  lowerPanel.lookAt(0, 0, 0);
  environment.add(lowerPanel);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentMap = pmrem.fromScene(environment, .035, .1, 100, { size: quality.environmentSize });
  scene.environment = environmentMap.texture;
  environment.dispose();
  pmrem.dispose();

  const font = await new FontLoader().loadAsync('/fonts/wordmark.typeface.json');
  const geometry = new TextGeometry('h4ngelic', {
    font, size: 2, depth: .455, curveSegments: quality.curveSegments, steps: 1,
    bevelEnabled: true, bevelThickness: .055, bevelSize: .035, bevelSegments: quality.bevelSegments,
  });
  geometry.center();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const chrome = new THREE.MeshPhysicalMaterial({ color: '#e4e4e4', metalness: 1, roughness: .135, envMapIntensity: 1.35, clearcoat: .15, clearcoatRoughness: .12 });
  const wordmark = new THREE.Mesh(geometry, chrome);
  const logo = new THREE.Group();
  logo.add(wordmark);
  scene.add(logo);
  const heroInk = createHeroInk({ mesh: wordmark, camera, canvas, profile: quality.name,
    reduced: () => reducedMotion.matches });
  let inkCandidate = null;
  const cancelInkGesture = () => { inkCandidate = null; };
  document.addEventListener('h4:modechange', cancelInkGesture);
  document.addEventListener('h4:pagechange', cancelInkGesture);
  window.addEventListener('blur', cancelInkGesture);

  // Only an explicitly supplied original artwork is loaded. No substitute art.
  const artworkUrl = import.meta.env.VITE_TATTOO_ARTWORK_URL || (quality.name === 'desktop' ? '/assets/tattoo-texture.webp' : '/assets/tattoo-texture-640.webp');
  if (artworkUrl) {
    try {
      artwork = await attachArtwork(chrome, { url: artworkUrl, width: size.x, height: size.y });
      controls.setRevealAvailable(true);
    } catch (error) {
      console.warn('Tattoo artwork could not be loaded; reveal remains unavailable.', error);
    }
  }
  // Install after the artwork hook so both treatments share one mesh program.
  // Uniform updates leave the hero's existing visibility/RAF lifecycle intact.
  let wordmarkXRay = null;
  let materialLoading = null;
  let materialDisposed = false;
  const prepareMaterial = () => {
    if (materialLoading || materialDisposed) return materialLoading;
    materialLoading = import('./wordmark-xray.js').then(({ attachWordmarkXRay }) => {
      if (!materialDisposed) wordmarkXRay = attachWordmarkXRay(chrome, { renderer });
    }).catch(error => {
      materialLoading = null;
      if (!materialDisposed) console.warn('The damaged material is unavailable; the original chrome remains usable.', error);
    });
    return materialLoading;
  };
  if (featureFlags.otherSideEnabled) {
    document.addEventListener('h4:modeprepare', prepareMaterial);
    if (document.documentElement.dataset.mode === 'xray' || document.documentElement.hasAttribute('data-mode-holding')) await prepareMaterial();
  }

  const bounds = { x: 1, y: 1 };
  const halfExtents = new THREE.Vector3();
  const worldBox = new THREE.Box3();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const planePoint = new THREE.Vector3();
  const pointerVelocity = new THREE.Vector3();
  const lever = new THREE.Vector3();
  const worldSize = { x: 1, y: 1 };
  const heroDepth = createHeroDepth(camera, { worldSize });
  const motionPublisher = createVisualMotionPublisher({ doc: document });
  const motionPoint = new THREE.Vector3();
  const motionQuaternion = new THREE.Quaternion();
  const motionCorners = Array.from({ length: 8 }, (_, index) => new THREE.Vector3(
    index & 1 ? geometry.boundingBox.max.x : geometry.boundingBox.min.x,
    index & 2 ? geometry.boundingBox.max.y : geometry.boundingBox.min.y,
    index & 4 ? geometry.boundingBox.max.z : geometry.boundingBox.min.z,
  ));
  let motionLayout = null;
  let previousMotionTime = null;

  function resize() {
    // Layout dimensions exclude the separate CSS scroll-fade/scale wrapper.
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (width <= 0 || height <= 0) return;
    camera.aspect = width / Math.max(height, 1);
    const tangent = Math.tan(THREE.MathUtils.degToRad(35 / 2));
    const distance = Math.max(size.x * 1.48 / (2 * tangent * camera.aspect), size.x * 1.12 / (2 * tangent));
    const rect = stage.closest('.hero').getBoundingClientRect();
    motionLayout = { left: rect.left + scrollX + stage.offsetLeft, top: rect.top + scrollY + stage.offsetTop,
      width, height, heroTop: rect.top + scrollY, heroHeight: rect.height || 1 };
    previousMotionTime = null;
    heroDepth.resize({ distance, top: rect.top + scrollY, height: rect.height, scrollPosition: scrollY, reduced: reducedMotion.matches });
    renderer.setSize(width, height, false);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  // The new homepage has sections below the hero; suspend GPU work offscreen.
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    stageIsVisible = entry.isIntersecting;
    syncRendering();
  });
  visibilityObserver.observe(stage);
  resize();

  function publishLogoMotion(timestamp) {
    if (!featureFlags.otherSideEnabled || !motionLayout || !motionPublisher.ready(timestamp)) return;
    // Project the sculpture already computed by this render frame. The layout
    // cache and the established hero scale supply viewport CSS coordinates;
    // no DOM rectangle, new animation loop or physics update is needed here.
    const pose = stage.hasAttribute('data-scroll-hero')
      ? sampleHero((scrollY - motionLayout.heroTop) / motionLayout.heroHeight) : { scale: 1, opacity: 1 };
    const width = motionLayout.width * pose.scale;
    const height = motionLayout.height * pose.scale;
    const left = motionLayout.left - scrollX + (motionLayout.width - width) / 2;
    const top = motionLayout.top - scrollY + (motionLayout.height - height) / 2;
    motionPoint.setFromMatrixPosition(wordmark.matrixWorld).project(camera);
    const x = left + (motionPoint.x + 1) * width / 2;
    const y = top + (1 - motionPoint.y) * height / 2;
    let minimumX = Infinity;
    let maximumX = -Infinity;
    let minimumY = Infinity;
    let maximumY = -Infinity;
    const points = [];
    for (const [id, corner] of motionCorners.entries()) {
      motionPoint.copy(corner).applyMatrix4(wordmark.matrixWorld).project(camera);
      minimumX = Math.min(minimumX, motionPoint.x);
      maximumX = Math.max(maximumX, motionPoint.x);
      minimumY = Math.min(minimumY, motionPoint.y);
      maximumY = Math.max(maximumY, motionPoint.y);
      points.push({ id, x: left + (motionPoint.x + 1) * width / 2, y: top + (1 - motionPoint.y) * height / 2 });
    }
    const angularVelocity = previousMotionTime === null ? 0
      : logo.quaternion.angleTo(motionQuaternion) * 1000 / Math.max(1, timestamp - previousMotionTime);
    motionQuaternion.copy(logo.quaternion);
    previousMotionTime = timestamp;
    motionPublisher.publish([{ kind: 'logo', target: canvas, x, y,
      width: Math.max(1, (maximumX - minimumX) * width / 2),
      height: Math.max(1, (maximumY - minimumY) * height / 2), opacity: pose.opacity, angularVelocity, points }], timestamp);
  }

  function locate(event) {
    heroDepth.update(scrollY, reducedMotion.matches);
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(plane, planePoint);
    return raycaster.intersectObject(wordmark, false)[0];
  }

  function pointerMove(event) {
    if (dragPointer !== null && event.pointerId !== dragPointer) return;
    if (document.hidden || !stageIsVisible) return;
    if (inkCandidate?.pointerId === event.pointerId) inkCandidate.travel = Math.max(inkCandidate.travel,
      Math.hypot(event.clientX - inkCandidate.x, event.clientY - inkCandidate.y));
    pendingPointer = { clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId, pointerType: event.pointerType };
  }

  function processPointer(event, timestamp) {
    const hit = locate(event);
    const now = timestamp / 1000;
    const dt = now - previousPointerTime;
    if (physics.dragging) {
      physics.dragTo(planePoint, basePosition, Math.max(dt, .001), now);
    } else if (previousPoint && dt > .001 && dt < .5) {
      pointerVelocity.copy(planePoint).sub(previousPoint).divideScalar(dt);
      if (hit && event.pointerType !== 'touch' && now - lastHit > .07 && !reducedMotion.matches) {
        physics.hit(pointerVelocity, lever.copy(hit.point).sub(logo.position), now);
        lastHit = now;
      }
    }
    previousPoint ??= new THREE.Vector3();
    previousPoint.copy(planePoint);
    previousPointerTime = now;
    if (activePointer !== Boolean(hit)) {
      activePointer = Boolean(hit);
      canvas.classList.toggle('is-hovering', activePointer);
    }
  }

  function pointerDown(event) {
    if (!event.isPrimary || event.button !== 0) return;
    inkCandidate = null;
    pendingPointer = null;
    const hit = locate(event);
    if (!hit) return;
    if (document.documentElement.dataset.mode === 'normal' && document.documentElement.dataset.page === 'home') {
      inkCandidate = { x: event.clientX, y: event.clientY, time: performance.now(), travel: 0,
        pointerId: event.pointerId, faceIndex: hit.faceIndex };
    }
    dragPointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    physics.beginDrag(planePoint, basePosition, performance.now() / 1000);
    previousPoint = planePoint.clone();
    previousPointerTime = performance.now() / 1000;
    canvas.classList.add('is-dragging');
    // touch-action:pan-y stays intact: vertical touch scroll cancels this drag.
  }

  function pointerUp(event) {
    if (event.pointerId !== dragPointer) return;
    const now = performance.now();
    // Preserve the last coalesced drag sample even when release precedes the
    // next frame. A cancelled touch scroll must not apply that queued movement.
    if (event.type === 'pointerup' && pendingPointer && !document.hidden && stageIsVisible) processPointer(pendingPointer, now);
    const paintCandidate = inkCandidate;
    const paintHit = !document.hidden && stageIsVisible && isHeroInkClick(paintCandidate, event, now) ? locate(event) : null;
    inkCandidate = null;
    physics.endDrag(now / 1000);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    dragPointer = null;
    pendingPointer = null;
    previousPoint = null;
    canvas.classList.remove('is-dragging');
    if (reducedMotion.matches) {
      physics.velocity.set(0, 0, 0);
      physics.angularVelocity.set(0, 0, 0);
    }
    if (paintHit) void heroInk.stamp(paintHit, { startedFaceIndex: paintCandidate.faceIndex });
  }

  function pointerLeave() {
    if (!physics.dragging) {
      previousPoint = null;
      pendingPointer = null;
      activePointer = false;
      canvas.classList.remove('is-hovering');
    }
  }
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('lostpointercapture', pointerUp);
  canvas.addEventListener('pointerleave', pointerLeave);

  function animate(timestamp) {
    animationFrame = 0;
    if (!running || !sceneReady || document.hidden || !stageIsVisible) return;
    animationFrame = requestAnimationFrame(animate);
    const dt = Math.min((timestamp - previousFrame) / 1000, .25);
    previousFrame = timestamp;
    heroDepth.update(scrollY, reducedMotion.matches);
    if (pendingPointer) {
      processPointer(pendingPointer, timestamp);
      pendingPointer = null;
    }
    if (!paused) animationTime += dt * speed;
    sampleBase(animationTime, 1, basePosition, baseQuaternion);
    // Reduced motion retains direct dragging, without free drift or auto tumble.
    if (!reducedMotion.matches || physics.dragging) physics.update(dt, timestamp / 1000, bounds, basePosition);
    logo.position.copy(basePosition).add(physics.offset);
    logo.quaternion.copy(physics.orientation).multiply(baseQuaternion);
    logo.updateMatrixWorld(true);
    worldBox.copy(geometry.boundingBox).applyMatrix4(wordmark.matrixWorld);
    worldBox.getSize(halfExtents).multiplyScalar(.5);
    const perspectiveMargin = 1 + halfExtents.z / camera.position.z;
    bounds.x = Math.max(.15, worldSize.x / 2 / perspectiveMargin - halfExtents.x - .2);
    bounds.y = Math.max(.15, worldSize.y / 2 / perspectiveMargin - halfExtents.y - .2);
    publishLogoMotion(timestamp);
    heroInk.update(timestamp);
    if (artwork) artwork.opacity.value = revealEnabled ? revealWeight(logo.quaternion, Number(import.meta.env.VITE_REVEAL_ANGLE || 150)) : 0;
    renderer.render(scene, camera);
    if (frameCount === 0) {
      stage.classList.add('is-ready');
      status.textContent = '3D wordmark ready. Use the animation controls below; pointer dragging is optional.';
    }
    const nextRatio = resolution.sample(dt, timestamp);
    if (nextRatio !== null) {
      renderer.setPixelRatio(nextRatio);
      resize();
    }
    frameCount++;
  }

  syncRendering = () => {
    if (!running || !sceneReady || document.hidden || !stageIsVisible) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      pendingPointer = null;
      previousPoint = null;
      inkCandidate = null;
      resolution.reset();
      motionPublisher.reset();
      previousMotionTime = null;
      return;
    }
    if (!animationFrame) {
      previousFrame = performance.now();
      animationFrame = requestAnimationFrame(animate);
    }
  };
  document.addEventListener('visibilitychange', syncRendering);

  if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
    window.__H4_TEST__ = {
      snapshot: () => ({ baseTime: animationTime, position: logo.position.toArray(), offset: physics.offset.toArray(), orientation: physics.orientation.toArray(), velocity: physics.velocity.toArray(), angularVelocity: physics.angularVelocity.toArray(), isDragging: physics.dragging, revealOpacity: artwork?.opacity.value || 0, xrayAmount: wordmarkXRay?.amount.value || 0, camera: heroDepth.snapshot(), pixelRatio: renderer.getPixelRatio(), qualityName: quality.name, frameCount,
        heroInk: { ...heroInk.snapshot(), gpu: { ...renderer.info.memory } } }),
      hitPoint: ({ minFacing = 0, maxFacing = 1, minAbsNormalZ = 0, maxAbsNormalZ = 1 } = {}) => {
        // Search real geometry instead of guessing a point inside a glyph hole.
        const vertices = geometry.getAttribute('position');
        const point = new THREE.Vector3();
        const rect = canvas.getBoundingClientRect();
        const triangle = new THREE.Vector3();
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(wordmark.matrixWorld);
        const cameraPoint = camera.getWorldPosition(new THREE.Vector3());
        const searchStep = minFacing === 0 && maxFacing === 1 && minAbsNormalZ === 0 && maxAbsNormalZ === 1 ? 21 : 3;
        for (let i = 0; i + 2 < vertices.count; i += searchStep) {
          point.fromBufferAttribute(vertices, i);
          point.add(triangle.fromBufferAttribute(vertices, i + 1));
          point.add(triangle.fromBufferAttribute(vertices, i + 2)).divideScalar(3);
          point.applyMatrix4(wordmark.matrixWorld).project(camera);
          const x = rect.left + (point.x + 1) * rect.width / 2;
          const y = rect.top + (1 - point.y) * rect.height / 2;
          if (point.z < 1 && x > 10 && x < innerWidth - 10 && y > rect.top + 10 && y < rect.bottom - 10) {
            const hit = locate({ clientX: x, clientY: y });
            if (!hit) continue;
            const facing = hit.face.normal.clone().applyNormalMatrix(normalMatrix)
              .dot(cameraPoint.clone().sub(hit.point).normalize());
            const normalZ = Math.abs(hit.face.normal.z);
            if (facing >= minFacing && facing <= maxFacing && normalZ >= minAbsNormalZ && normalZ <= maxAbsNormalZ) return { x, y, facing,
              faceIndex: hit.faceIndex, normal: hit.face.normal.toArray() };
          }
        }
        return null;
      },
    };
  }

  // Let browsers with parallel shader compilation prepare the chrome program
  // before its first visible frame instead of blocking that first interaction.
  await renderer.compileAsync(scene, camera);
  sceneReady = true;
  previousFrame = performance.now();
  syncRendering();

  disposeScene = () => {
    materialDisposed = true;
    document.removeEventListener('h4:modeprepare', prepareMaterial);
    document.removeEventListener('h4:modechange', cancelInkGesture);
    document.removeEventListener('h4:pagechange', cancelInkGesture);
    window.removeEventListener('blur', cancelInkGesture);
    heroInk.dispose();
    observer.disconnect();
    visibilityObserver.disconnect();
    document.removeEventListener('visibilitychange', syncRendering);
    cancelAnimationFrame(animationFrame);
    motionPublisher.reset();
    geometry.dispose();
    environmentMap.dispose();
    wordmarkXRay?.dispose();
    artwork?.dispose();
    chrome.dispose();
    renderer.dispose();
  };
}

reducedMotion.addEventListener('change', () => {
  controls.setPaused(reducedMotion.matches);
  physics.reset();
});
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  fallback('3D graphics are unavailable. Showing the static wordmark. Reload to retry.');
});
addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  running = false;
  startupObserver.disconnect();
  document.removeEventListener('visibilitychange', startVisibleHero);
  controls.destroy();
  disposeScene();
});

// A homepage module download can finish after an internal navigation. Wait for
// the actual visible hero before creating a WebGL context or fetching its art.
let startupVisible = false;
let startupStarted = false;
const startupObserver = new IntersectionObserver(([entry]) => {
  startupVisible = entry.isIntersecting;
  startVisibleHero();
});
function startVisibleHero() {
  if (startupStarted || !running || !startupVisible || document.hidden || stage.closest('.hero')?.hidden) return;
  startupStarted = true;
  startupObserver.disconnect();
  document.removeEventListener('visibilitychange', startVisibleHero);
  initialize().catch((error) => {
    console.warn('3D wordmark unavailable:', error);
    fallback('3D graphics are unavailable. Showing the static wordmark.');
  });
}
document.addEventListener('visibilitychange', startVisibleHero);
startupObserver.observe(stage);
