import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mannequinPreviewConfig } from './mannequin-preview-config.js';

const safePreviewURL = (value, pattern) => typeof value === 'string' && pattern.test(value);

/** One static studio render. There is deliberately no animation or render loop. */
export function initMannequinPreview(container) {
  const source = container.dataset.mannequinSrc;
  const designSource = container.dataset.mannequinDesignSrc;
  if (!safePreviewURL(source, /^\/models\/[a-z0-9-]+\.glb$/)) throw new Error('Unsafe mannequin model source.');
  if (!safePreviewURL(designSource, /^\/textures\/designs\/[a-z0-9-]+\.png$/)) throw new Error('Unsafe mannequin design source.');

  const design = mannequinPreviewConfig.design;
  const chrome = mannequinPreviewConfig.chrome;
  let disposed = false;
  let frame = 0;
  let renderCount = 0;
  let resizeObserver = null;
  let renderer = null;
  let environmentTexture = null;
  let environmentTarget = null;
  let model = null;
  let baseMesh = null;
  let decal = null;
  let designTexture = null;
  let designRequested = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  const target = new THREE.Vector3(0, 0.85, 0);
  const status = container.querySelector('[data-mannequin-status]');
  const designButton = container.closest('.mannequin-preview')?.querySelector('.mannequin-preview-design[data-mannequin-design-toggle]');

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
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
  const environmentSize = compact ? chrome.environmentSizes.compact : chrome.environmentSizes.desktop;
  const studio = threeBandEnvironment();
  environmentTarget = pmrem.fromScene(studio.scene, chrome.environmentSigma, 0.1, 100, { size: environmentSize });
  studio.dispose();
  environmentTexture = environmentTarget.texture;
  scene.environment = environmentTexture;
  pmrem.dispose();
  container.dataset.mannequinEnvironment = 'three-band-pmrem';
  container.dataset.mannequinEnvironmentSize = String(environmentSize);
  container.dataset.mannequinEnvironmentSigma = String(chrome.environmentSigma);

  function fitCamera() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    if (model) {
      const box = new THREE.Box3().setFromObject(model);
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

  function renderStatic() {
    frame = 0;
    if (disposed) return;
    fitCamera();
    renderer.render(scene, camera);
    renderCount += 1;
    container.dataset.mannequinRenders = String(renderCount);
  }

  function scheduleRender() {
    if (frame || disposed) return;
    frame = requestAnimationFrame(renderStatic);
  }

  async function applyDemoDesign() {
    if (disposed || !baseMesh || !designButton) return;
    if (decal) {
      decal.visible = !decal.visible;
      designButton.setAttribute('aria-pressed', String(decal.visible));
      renderStatic();
      return;
    }
    if (designRequested) return;
    designRequested = true;
    designButton.disabled = true;
    designButton.setAttribute('aria-busy', 'true');
    try {
      const [DecalGeometry, loadedTexture] = await Promise.all([
        import('three/addons/geometries/DecalGeometry.js').then(module => module.DecalGeometry),
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
      model.updateMatrixWorld(true);
      const placement = design.placement;
      const position = new THREE.Vector3(...placement.position);
      model.localToWorld(position);
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
      scene.add(decal);
      container.dataset.mannequinDecal = 'applied';
      designButton.setAttribute('aria-pressed', 'true');
      designButton.removeAttribute('aria-busy');
      designButton.disabled = false;
      if (status) status.textContent = 'Demo design applied to the static mannequin.';
      renderStatic();
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

  resizeObserver = new ResizeObserver(scheduleRender);
  resizeObserver.observe(container);

  const disposePreview = () => {
    if (disposed) return;
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    resizeObserver?.disconnect();
    resizeObserver = null;
    designButton?.removeEventListener('click', onDesignClick);
    if (decal) {
      scene.remove(decal);
      decal.geometry.dispose();
      decal.material.dispose();
      decal = null;
    }
    designTexture?.dispose();
    designTexture = null;
    if (model) scene.remove(model);
    disposeObject(model);
    model = null;
    baseMesh = null;
    environmentTexture?.dispose();
    environmentTexture = null;
    environmentTarget?.dispose();
    environmentTarget = null;
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
      baseMesh = object;
      object.frustumCulled = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        material.envMapIntensity = chrome.envMapIntensity;
        container.dataset.mannequinMaterial = material.name || '';
        container.dataset.mannequinEnvIntensity = String(chrome.envMapIntensity);
      }
    });
    if (!baseMesh) throw new Error('The mannequin GLB contains no mesh.');
    scene.add(model);
    renderStatic();
    container.dataset.mannequinState = 'ready';
    container.dataset.mannequinStatic = 'true';
    if (designButton) designButton.disabled = false;
    if (status) status.textContent = 'Static chrome mannequin preview loaded. Demo design is available.';
  }).catch((error) => {
    if (disposed) return;
    container.dataset.mannequinState = 'failed';
    if (status) status.textContent = 'The static mannequin preview is unavailable.';
    console.error('Unable to render the static mannequin preview.', error);
  });

  return { ready, dispose: disposePreview };
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
