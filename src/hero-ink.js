import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { createInkImprint } from './ink-imprint.js';
import { heroInkSettings } from './data/heroInkSettings.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = value => { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); };
const sample = random => clamp(Number(random()) || 0, 0, .999999999);
const vertex = new THREE.Vector3();
const edge = new THREE.Vector3();
const faceNormal = new THREE.Vector3();

/** Weld positions only for topology lookup. Hard-edge shading attributes stay
 * untouched. Separate letters/dots cannot receive paint through the projector.
 * Built once, on the first actual paint impact, never on pointer movement.
 */
export function buildInkSurfaceComponents(geometry) {
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const count = Math.floor((index?.count ?? position.count) / 3);
  const parents = Int32Array.from({ length: count }, (_, face) => face);
  const owners = new Map();
  const root = face => {
    let value = face;
    while (parents[value] !== value) { parents[value] = parents[parents[value]]; value = parents[value]; }
    return value;
  };
  for (let face = 0; face < count; face++) for (let corner = 0; corner < 3; corner++) {
    const offset = face * 3 + corner;
    const i = index ? index.getX(offset) : offset;
    const key = `${Math.round(position.getX(i) * 10000)},${Math.round(position.getY(i) * 10000)},${Math.round(position.getZ(i) * 10000)}`;
    if (owners.has(key)) parents[root(face)] = root(owners.get(key));
    else owners.set(key, face);
  }
  const ids = new Map(), components = [];
  const faceComponents = Int32Array.from({ length: count }, (_, face) => {
    const parent = root(face);
    if (!ids.has(parent)) { ids.set(parent, components.length); components.push([]); }
    const id = ids.get(parent);
    components[id].push(face);
    return id;
  });
  return { faceComponents, components };
}

/** DecalGeometry normally emits world positions. This identity-world proxy
 * projects in the wordmark's LOCAL space instead, so the resulting child mesh
 * inherits its parent's translation, rotation and scale exactly once.
 */
export function projectInkGeometry(mesh, hit, { components = buildInkSurfaceComponents(mesh.geometry),
  size = 1.2, depth = heroInkSettings.projectionDepth, rotation = 0,
  minimumNormalDot = heroInkSettings.minimumNormalDot, startedFaceIndex } = {}) {
  if (!hit?.point?.isVector3 || !hit.face?.normal?.isVector3 || !Number.isInteger(hit.faceIndex)
    || hit.faceIndex < 0 || hit.faceIndex >= components.faceComponents.length || !(size > 0) || !(depth > 0)) return null;
  const componentId = components.faceComponents[hit.faceIndex];
  if (Number.isInteger(startedFaceIndex) && components.faceComponents[startedFaceIndex] !== componentId) return null;
  mesh.updateWorldMatrix(true, false);
  const localPoint = mesh.worldToLocal(hit.point.clone());
  const normal = hit.face.normal.clone().normalize();
  if (!Number.isFinite(localPoint.lengthSq()) || normal.lengthSq() < .5) return null;
  const source = mesh.geometry;
  const position = source.getAttribute('position');
  const selected = [];
  const at = offset => source.index ? source.index.getX(offset) : offset;
  for (const face of components.components[componentId]) {
    const a = at(face * 3), b = at(face * 3 + 1), c = at(face * 3 + 2);
    vertex.fromBufferAttribute(position, a);
    edge.fromBufferAttribute(position, b).sub(vertex);
    faceNormal.fromBufferAttribute(position, c).sub(vertex).cross(edge).negate().normalize();
    if (faceNormal.dot(normal) < minimumNormalDot) continue;
    selected.push(a, b, c);
  }
  if (!selected.length) return null;
  const projectedSource = new THREE.BufferGeometry();
  projectedSource.setAttribute('position', position);
  if (source.getAttribute('normal')) projectedSource.setAttribute('normal', source.getAttribute('normal'));
  projectedSource.setIndex(selected);
  const proxy = new THREE.Mesh(projectedSource);
  proxy.matrixAutoUpdate = false;
  proxy.matrixWorld.identity();
  const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  orientation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rotation));
  const projectorSize = new THREE.Vector3(size, size * .88, depth);
  const geometry = new DecalGeometry(proxy, localPoint.clone().addScaledVector(normal, .002),
    new THREE.Euler().setFromQuaternion(orientation), projectorSize);
  projectedSource.dispose();
  if (!geometry.getAttribute('position').count) { geometry.dispose(); return null; }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, localPoint, normal, componentId, projectorSize };
}

export function isHeroInkClick(candidate, event, time, settings = heroInkSettings) {
  return Boolean(candidate && event.type === 'pointerup' && event.pointerId === candidate.pointerId
    && Number.isFinite(time) && time >= candidate.time && time - candidate.time <= settings.maximumClickMs
    && candidate.travel <= settings.maximumPointerTravel
    && Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) <= settings.maximumPointerTravel);
}

export function nextHeroInkColor(previous, random = Math.random, palette = heroInkSettings.palette) {
  const old = palette.indexOf(previous);
  const index = old < 0 ? Math.floor(sample(random) * palette.length)
    : (old + 1 + Math.floor(sample(random) * (palette.length - 1))) % palette.length;
  return palette[index];
}

/** Reuse the site's organic contour, dry gaps and satellites, with one dominant
 * pigment and tonal accents. No artwork URL, video or external image is used.
 */
export function heroInkSVG(color, random = Math.random, resolution = 256, id = 'h4-surface-ink') {
  const pigment = new THREE.Color(color);
  const dark = `#${pigment.clone().multiplyScalar(.48).getHexString()}`;
  const light = `#${pigment.clone().lerp(new THREE.Color('#ffffff'), .28).getHexString()}`;
  const accent = `#${pigment.clone().lerp(new THREE.Color('#ffffff'), .64).getHexString()}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${resolution}" height="${resolution}" viewBox="0 0 100 100" style="color:${color};--ink-accent-1:${dark};--ink-accent-2:${light};--ink-accent-3:${accent}">${createInkImprint(random, { id })}</svg>`;
}

async function loadTexture(svg, doc) {
  const Constructor = doc.defaultView?.Image || globalThis.Image;
  const image = new Constructor();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('Surface ink texture unavailable'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** Bounded surface paint. update() is called by the hero's existing render loop.
 * Pending decodes cannot resurrect marks after a mode/route change or disposal.
 */
export function createHeroInk({ mesh, camera, canvas, profile = 'desktop', doc = document,
  settings = heroInkSettings, random = Math.random, now = () => performance.now(), reduced = () => false,
  textureFactory = svg => loadTexture(svg, doc) } = {}) {
  const marks = [], pending = new Map();
  const maximum = profile === 'desktop' ? settings.maximumMarks : settings.mobileMaximumMarks;
  const textureSize = profile === 'desktop' ? settings.textureSize : settings.mobileTextureSize;
  let components = null, generation = 0, sequence = 0, lastColor = null;
  let created = 0, disposed = 0, failed = 0, rejected = 0, destroyed = false;
  const resourcesDisposed = { geometries: 0, materials: 0, textures: 0 };
  const enabled = () => !destroyed && settings.enabled && doc.documentElement.dataset.mode === 'normal'
    && doc.documentElement.dataset.page === 'home';
  const disposeGeometry = geometry => { if (geometry) { geometry.dispose(); resourcesDisposed.geometries++; } };
  const disposeTexture = texture => { if (texture) { texture.dispose(); resourcesDisposed.textures++; } };
  function remove(mark) {
    marks.splice(marks.indexOf(mark), 1);
    mesh.remove(mark.mesh);
    disposeGeometry(mark.mesh.geometry);
    mark.mesh.material.dispose(); resourcesDisposed.materials++;
    disposeTexture(mark.mesh.material.map);
    disposed++;
  }
  function clear() {
    generation++;
    for (const mark of [...marks]) remove(mark);
    for (const request of pending.values()) { disposeGeometry(request.projection.geometry); request.projection.geometry = null; }
    pending.clear();
  }
  function lifecycle() { if (!enabled()) clear(); }
  doc.addEventListener('h4:modechange', lifecycle);
  doc.addEventListener('h4:pagechange', lifecycle);

  async function stamp(hit, { startedFaceIndex } = {}) {
    if (!enabled() || pending.size >= maximum) { rejected++; return false; }
    while (marks.length + pending.size >= maximum && marks.length) remove(marks[0]);
    components ||= buildInkSurfaceComponents(mesh.geometry);
    const size = settings.minimumSize + sample(random) * (settings.maximumSize - settings.minimumSize);
    const projection = projectInkGeometry(mesh, hit, { components, size, depth: settings.projectionDepth,
      rotation: sample(random) * Math.PI * 2, minimumNormalDot: settings.minimumNormalDot, startedFaceIndex });
    if (!projection) { rejected++; return false; }
    const id = ++sequence;
    const color = nextHeroInkColor(lastColor, random, settings.palette);
    lastColor = color;
    const request = { projection, generation, id };
    pending.set(id, request);
    let texture;
    try {
      texture = await textureFactory(heroInkSVG(color, random, textureSize, `h4-surface-${id}`));
    } catch {
      pending.delete(id); disposeGeometry(projection.geometry); projection.geometry = null;
      failed++;
      return false;
    }
    pending.delete(id);
    if (request.generation !== generation || !enabled()) {
      disposeGeometry(projection.geometry); disposeTexture(texture); projection.geometry = null;
      return false;
    }
    const material = new THREE.MeshStandardMaterial({ map: texture, color: '#ffffff', metalness: .04,
      roughness: .76, emissive: color, emissiveIntensity: .08, transparent: true, opacity: 0,
      depthTest: true, depthWrite: false, alphaTest: .018, polygonOffset: true,
      polygonOffsetFactor: -4, polygonOffsetUnits: -1 });
    const decal = new THREE.Mesh(projection.geometry, material);
    decal.name = `surface-ink-${id}`;
    decal.renderOrder = 2 + id % 1000 * .0001;
    // Vertices already use the wordmark's local frame. Identity transform only.
    mesh.add(decal);
    marks.push({ ...projection, mesh: decal, id, color, createdAt: now(),
      lifetime: settings.minimumLifetimeMs + sample(random) * (settings.maximumLifetimeMs - settings.minimumLifetimeMs) });
    created++;
    return true;
  }

  function update(time = now()) {
    if (!enabled()) { if (marks.length || pending.size) clear(); return; }
    for (const mark of [...marks]) {
      const age = Math.max(0, time - mark.createdAt);
      if (age >= mark.lifetime) { remove(mark); continue; }
      const intensity = Math.min(1, age / 100) * (1 - smooth((age / mark.lifetime - settings.fadeStart) / (1 - settings.fadeStart)));
      mark.mesh.material.opacity = intensity * settings.opacity;
      // Settle the pigment in its existing surface UVs; never scale/lift the
      // geometry away from the sculpture or change its registered local frame.
      const repeat = reduced() ? 1 : 1.035 - .035 * smooth(age / settings.settleMs);
      mark.mesh.material.map.repeat.set(repeat, repeat);
      mark.mesh.material.map.offset.set((1 - repeat) / 2, (1 - repeat) / 2);
    }
  }

  function snapshot() {
    if (marks.length) mesh.updateWorldMatrix(true, true);
    const rect = marks.length ? canvas.getBoundingClientRect() : null;
    const cameraPoint = camera.getWorldPosition(new THREE.Vector3());
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    return { count: marks.length, pending: pending.size, maxMarks: maximum, created, disposed, failed, rejected,
      destroyed, resourcesDisposed: { ...resourcesDisposed },
      marks: marks.map(mark => {
        const worldPoint = mark.localPoint.clone().applyMatrix4(mesh.matrixWorld);
        const worldNormal = mark.normal.clone().applyNormalMatrix(normalMatrix);
        const facing = worldNormal.dot(cameraPoint.clone().sub(worldPoint).normalize());
        const point = worldPoint.clone().project(camera);
        const tangent = new THREE.Vector3(0, 1, 0).cross(mark.normal);
        if (tangent.lengthSq() < .01) tangent.set(1, 0, 0);
        tangent.normalize();
        const radiusPoint = mark.localPoint.clone().addScaledVector(tangent, mark.projectorSize.x * .35)
          .applyMatrix4(mesh.matrixWorld).project(camera);
        const localVertex = new THREE.Vector3().fromBufferAttribute(mark.mesh.geometry.getAttribute('position'), 0);
        const registrationError = localVertex.clone().applyMatrix4(mark.mesh.matrixWorld)
          .distanceTo(localVertex.applyMatrix4(mesh.matrixWorld));
        return { id: mark.id, color: mark.color, localPoint: mark.localPoint.toArray(), normal: mark.normal.toArray(),
          worldPoint: worldPoint.toArray(), facing,
          projected: { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2,
            z: point.z, radius: Math.max(3, Math.hypot((radiusPoint.x - point.x) * rect.width / 2,
              (radiusPoint.y - point.y) * rect.height / 2)), frontFacing: facing > 0 },
          ageMs: Math.max(0, now() - mark.createdAt), lifetimeMs: mark.lifetime, opacity: mark.mesh.material.opacity,
          vertexCount: mark.mesh.geometry.getAttribute('position').count, componentId: mark.componentId, registrationError };
      }) };
  }
  return { stamp, update, clear, snapshot,
    dispose() { if (destroyed) return; clear(); destroyed = true;
      doc.removeEventListener('h4:modechange', lifecycle); doc.removeEventListener('h4:pagechange', lifecycle);
      components = null; },
  };
}
