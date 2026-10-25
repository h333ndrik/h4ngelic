import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { buildInkSurfaceComponents, projectInkGeometry, isHeroInkClick, nextHeroInkColor,
  heroInkSVG, createHeroInk } from '../src/hero-ink.js';
import { heroInkSettings } from '../src/data/heroInkSettings.js';

const close = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-5, `${message}: ${a} vs ${b}`);
function frontHit(mesh, point = new THREE.Vector3(.1, .1, .025)) {
  mesh.updateWorldMatrix(true, true);
  const hit = new THREE.Raycaster(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 0, -1))
    .intersectObject(new THREE.Mesh(mesh.geometry))[0];
  return { point: mesh.localToWorld(point.clone()), face: { normal: new THREE.Vector3(0, 0, 1) }, faceIndex: hit.faceIndex };
}

test('the real extruded wordmark is split into physical lettering components rather than one projector target', async () => {
  const json = JSON.parse(await readFile(new URL('../public/fonts/wordmark.typeface.json', import.meta.url), 'utf8'));
  const geometry = new TextGeometry('h4ngelic', { font: new FontLoader().parse(json), size: 2, depth: .455,
    curveSegments: 8, steps: 1, bevelEnabled: true, bevelThickness: .055, bevelSize: .035, bevelSegments: 3 });
  const surface = buildInkSurfaceComponents(geometry);
  assert.ok(surface.components.length >= 8 && surface.components.length <= 16, `Actual wordmark has ${surface.components.length} disconnected surfaces.`);
  assert.equal(surface.faceComponents.length, geometry.getAttribute('position').count / 3);
  assert.equal(surface.components.reduce((count, faces) => count + faces.length, 0), surface.faceComponents.length);
  geometry.dispose();
});

test('a wide projector cannot paint a neighbouring disconnected letter even when both lie inside its volume', () => {
  const left = new THREE.PlaneGeometry(.24, 1).translate(-.14, 0, 0);
  const right = new THREE.PlaneGeometry(.24, 1).translate(.14, 0, 0);
  const mesh = new THREE.Mesh(mergeGeometries([left, right]));
  const hit = { point: new THREE.Vector3(-.14, 0, 0), face: { normal: new THREE.Vector3(0, 0, 1) }, faceIndex: 0 };
  const components = buildInkSurfaceComponents(mesh.geometry);
  assert.equal(components.components.length, 2);
  const result = projectInkGeometry(mesh, hit, { components, size: 1.6, depth: .2 });
  assert.ok(result?.geometry.getAttribute('position').count > 0);
  assert.ok(result.geometry.boundingBox.max.x < 0, 'No vertex may reach the unrelated right-hand letter.');
  assert.equal(projectInkGeometry(mesh, hit, { components, startedFaceIndex: 2 }), null,
    'A tap released on another disconnected surface is rejected.');
  result.geometry.dispose(); mesh.geometry.dispose(); left.dispose(); right.dispose();
});

test('local projection remains registered during genuine parent rotation, translation and nonuniform scale', () => {
  const parent = new THREE.Group();
  parent.position.set(3, -2, -5); parent.rotation.set(.4, .8, -.3); parent.scale.set(1.4, .8, 1.1);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .05));
  mesh.position.set(.2, -.1, .3); parent.add(mesh);
  const result = projectInkGeometry(mesh, frontHit(mesh), { size: .7, depth: .2, rotation: .42 });
  assert.ok(result);
  assert.ok(result.geometry.boundingBox.min.x > -.6 && result.geometry.boundingBox.max.x < .6,
    'Projected vertices remain local rather than containing the parent world translation.');
  const position = result.geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) close(position.getZ(i), .025, 'Back/side faces are excluded from a front impact');
  const decal = new THREE.Mesh(result.geometry); mesh.add(decal);
  const local = new THREE.Vector3().fromBufferAttribute(position, 0);
  let prior;
  for (let step = 0; step < 5; step++) {
    parent.rotation.y += .43; parent.rotation.x += .17;
    parent.position.x += .21; parent.scale.multiplyScalar(.94);
    parent.updateMatrixWorld(true);
    const actual = decal.localToWorld(local.clone());
    const expected = mesh.localToWorld(local.clone());
    assert.ok(actual.distanceTo(expected) < 1e-8, 'Paint inherits exactly one current sculpture transform.');
    if (prior) assert.ok(actual.distanceTo(prior) > .05, 'The verification really moves the surface.');
    prior = actual;
  }
  assert.deepEqual(decal.position.toArray(), [0, 0, 0]);
  assert.deepEqual(decal.scale.toArray(), [1, 1, 1]);
  result.geometry.dispose(); mesh.geometry.dispose();
});

test('angled surface impacts project onto the matching side and remain shallow', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .4));
  mesh.updateMatrixWorld(true);
  const hit = new THREE.Raycaster(new THREE.Vector3(3, .1, 0), new THREE.Vector3(-1, 0, 0)).intersectObject(mesh)[0];
  const result = projectInkGeometry(mesh, hit, { size: .6, depth: .12, rotation: .6 });
  assert.ok(result);
  const position = result.geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) close(position.getX(i), .5, 'Only the impacted side receives projected ink');
  assert.ok(result.normal.x > .99);
  result.geometry.dispose(); mesh.geometry.dispose();
});

test('deliberate mesh clicks are distinct from long holds, drags, out-and-back travel and cancelled mobile scrolling', () => {
  const candidate = { x: 10, y: 20, time: 100, travel: 0, pointerId: 3 };
  const event = { type: 'pointerup', clientX: 12, clientY: 23, pointerId: 3 };
  assert.equal(isHeroInkClick(candidate, event, 260), true);
  for (const [input, release, time] of [
    [null, event, 260], [candidate, { ...event, pointerId: 4 }, 260],
    [candidate, { ...event, type: 'pointercancel' }, 260], [candidate, event, 800],
    [{ ...candidate, travel: 20 }, { ...event, clientX: 10, clientY: 20 }, 260],
    [candidate, { ...event, clientY: 40 }, 260],
  ]) assert.equal(isHeroInkClick(input, release, time), false);
});

test('consecutive splashes have distinct dominant colors and procedural organic shapes without external assets', () => {
  let last = null;
  for (let index = 0; index < 100; index++) {
    const color = nextHeroInkColor(last, () => (index % 17) / 17);
    assert.ok(heroInkSettings.palette.includes(color)); assert.notEqual(color, last); last = color;
  }
  let seed = 7;
  const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 >>> 0; return seed / 4294967296; };
  const a = heroInkSVG('#bcff16', random), b = heroInkSVG('#bcff16', random);
  assert.notEqual(a, b);
  assert.match(a, /satellite-/); assert.match(a, /fill-rule="evenodd"/); assert.match(a, /color:#bcff16/);
  assert.doesNotMatch(a, /<image|(?:href|src)=/);
});

function fixture({ profile = 'desktop', textureFactory, reduced = false } = {}) {
  let time = 1000;
  const doc = Object.assign(new EventTarget(), { documentElement: { dataset: { mode: 'normal', page: 'home' } } });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .05));
  const camera = new THREE.PerspectiveCamera(35, 4 / 3, .1, 100); camera.position.z = 4; camera.updateMatrixWorld(true);
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) };
  const ink = createHeroInk({ mesh, camera, canvas, profile, doc, random: () => .5, now: () => time,
    reduced: () => reduced, textureFactory: textureFactory || (async () => new THREE.Texture()) });
  return { ink, mesh, doc, hit: frontHit(mesh), setTime(value) { time = value; },
    dispose() { ink.dispose(); mesh.geometry.dispose(); } };
}

test('surface paint is bounded, depth-tested, fades in the existing update call and disposes all GPU resources', async () => {
  const f = fixture();
  for (let i = 0; i < 8; i++) assert.equal(await f.ink.stamp(f.hit), true);
  let state = f.ink.snapshot();
  assert.equal(state.count, 6); assert.equal(state.created, 8); assert.equal(state.disposed, 2);
  assert.ok(state.marks.every((mark, i) => !i || mark.color !== state.marks[i - 1].color));
  f.setTime(1200); f.ink.update(1200);
  state = f.ink.snapshot();
  assert.ok(state.marks.every(mark => mark.opacity > .9 && mark.registrationError < 1e-8));
  for (const decal of f.mesh.children) {
    assert.equal(decal.material.depthTest, true); assert.equal(decal.material.depthWrite, false);
    assert.equal(decal.material.polygonOffset, true); assert.ok(decal.material.roughness > .6);
    assert.deepEqual(decal.scale.toArray(), [1, 1, 1]);
  }
  f.setTime(8500); f.ink.update(8500);
  assert.ok(f.ink.snapshot().marks.every(mark => mark.opacity > 0 && mark.opacity < .9));
  f.setTime(14000); f.ink.update(14000);
  state = f.ink.snapshot();
  assert.equal(state.count, 0); assert.equal(state.disposed, 8);
  assert.deepEqual(state.resourcesDisposed, { geometries: 8, materials: 8, textures: 8 });
  assert.equal(f.mesh.children.length, 0);
  f.dispose();
});

test('mobile resource limits and reduced-motion settling use the same registered geometry', async () => {
  const f = fixture({ profile: 'mobile', reduced: true });
  for (let i = 0; i < 5; i++) await f.ink.stamp(f.hit);
  f.setTime(1100); f.ink.update(1100);
  assert.equal(f.ink.snapshot().count, 3); assert.equal(f.ink.snapshot().maxMarks, 3);
  for (const decal of f.mesh.children) assert.deepEqual(decal.material.map.repeat.toArray(), [1, 1]);
  f.dispose();
});

test('mode and route changes clear paint, and an obsolete asynchronous texture decode cannot resurrect it', async () => {
  let resolve;
  const f = fixture({ textureFactory: () => new Promise(done => { resolve = done; }) });
  const request = f.ink.stamp(f.hit);
  assert.equal(f.ink.snapshot().pending, 1);
  f.doc.documentElement.dataset.mode = 'xray'; f.doc.dispatchEvent(new Event('h4:modechange'));
  assert.equal(f.ink.snapshot().pending, 0);
  const texture = new THREE.Texture(); let textureDisposals = 0;
  texture.addEventListener('dispose', () => textureDisposals++);
  resolve(texture);
  assert.equal(await request, false);
  assert.equal(textureDisposals, 1);
  assert.deepEqual(f.ink.snapshot().resourcesDisposed, { geometries: 1, materials: 0, textures: 1 });
  assert.equal(await f.ink.stamp(f.hit), false);
  f.doc.documentElement.dataset.mode = 'normal'; f.doc.documentElement.dataset.page = 'work';
  assert.equal(await f.ink.stamp(f.hit), false);
  f.dispose();
});

test('failed texture preparation remains a restrained no-paint fallback and releases its geometry', async () => {
  const f = fixture({ textureFactory: async () => { throw new Error('unsupported image decoder'); } });
  assert.equal(await f.ink.stamp(f.hit), false);
  const state = f.ink.snapshot();
  assert.equal(state.failed, 1); assert.equal(state.count, 0); assert.equal(state.pending, 0);
  assert.equal(state.resourcesDisposed.geometries, 1);
  f.dispose();
});
