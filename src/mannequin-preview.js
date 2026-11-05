import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** One static studio render. There is deliberately no animation or render loop. */
export function initMannequinPreview(container) {
  const source = container.dataset.mannequinSrc;
  if (!source || !source.startsWith('/models/') || !source.endsWith('.glb')) {
    throw new Error('Unsafe mannequin model source.');
  }

  let disposed = false;
  let frame = 0;
  let resizeObserver = null;
  let renderer = null;
  let environmentTexture = null;
  let model = null;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  const target = new THREE.Vector3(0, 0.79, 0);

  scene.add(new THREE.HemisphereLight(0xfffaf3, 0x1b1d1f, 0.82));
  const key = new THREE.DirectionalLight(0xfff7ec, 1.75);
  key.position.set(-3.0, 3.0, 2.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.58);
  fill.position.set(2.8, 1.5, 2.4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.12);
  rim.position.set(-1.4, 2.4, -3.2);
  scene.add(rim);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'mannequin-preview-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.prepend(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04, 0.1, 50, { size: 256 });
  environmentTexture = environment.texture;
  scene.environment = environmentTexture;
  room.dispose();
  pmrem.dispose();

  function fitCamera() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    if (model) {
      const box = new THREE.Box3().setFromObject(model);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      target.set(sphere.center.x, 0.79, sphere.center.z);
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const distance = Math.max(
        sphere.radius / Math.sin(verticalFov / 2),
        sphere.radius / Math.sin(horizontalFov / 2),
      ) * 1.07;
      const direction = new THREE.Vector3(0.24, 0.06, 1).normalize();
      camera.position.copy(direction.multiplyScalar(distance).add(target));
      camera.lookAt(target);
    }
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function renderStatic() {
    frame = 0;
    if (disposed) return;
    fitCamera();
    renderer.render(scene, camera);
  }

  function scheduleRender() {
    if (frame || disposed) return;
    frame = requestAnimationFrame(renderStatic);
  }

  resizeObserver = new ResizeObserver(scheduleRender);
  resizeObserver.observe(container);
  const status = container.querySelector('[data-mannequin-status]');

  const disposePreview = () => {
    if (disposed) return;
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (model) scene.remove(model);
    disposeObject(model);
    model = null;
    environmentTexture?.dispose();
    environmentTexture = null;
    scene.environment = null;
    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer?.domElement.remove();
    renderer = null;
    container.dataset.mannequinState = 'disposed';
    if (status) status.textContent = 'Static mannequin preview released.';
  };

  const ready = new GLTFLoader().loadAsync(source).then((gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    model = gltf.scene;
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.frustumCulled = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material) material.envMapIntensity = 0.34;
      }
    });
    scene.add(model);
    renderStatic();
    container.dataset.mannequinState = 'ready';
    container.dataset.mannequinStatic = 'true';
    if (status) status.textContent = 'Static mannequin preview loaded.';
  }).catch((error) => {
    if (disposed) return;
    container.dataset.mannequinState = 'failed';
    if (status) status.textContent = 'The static mannequin preview is unavailable.';
    console.error('Unable to render the static mannequin preview.', error);
  });

  return { ready, dispose: disposePreview };
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
