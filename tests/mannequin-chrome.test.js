import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { mannequinPreviewConfig, mannequinVariant } from '../src/mannequin-preview-config.js';

const files = {
  a: new URL('../public/models/mannequin-female-a.glb', import.meta.url),
  b: new URL('../public/models/mannequin-female-b.glb', import.meta.url),
  atlas: new URL('../public/textures/mannequin/uv-atlas.png', import.meta.url),
  atlasJSON: new URL('../public/textures/mannequin/uv-atlas.json', import.meta.url),
  designJSON: new URL('../public/textures/designs/demo-mark.json', import.meta.url),
  script: new URL('../scripts/mannequin-female-build.py', import.meta.url),
  reportA: new URL('../docs/validation/MANNEQUIN-CHROME/poly-trace-a.json', import.meta.url),
  reportB: new URL('../docs/validation/MANNEQUIN-CHROME/poly-trace-b.json', import.meta.url),
};

function readGLB(bytes) {
  assert.equal(bytes.toString('utf8', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  let offset = 12;
  let json = null;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const kind = bytes.readUInt32LE(offset + 4);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 8 + length;
    if (kind === 0x4E4F534A) json = JSON.parse(chunk.toString('utf8').replace(/\0+$/, ''));
  }
  assert.ok(json, 'GLB must contain a JSON chunk.');
  return json;
}

function indexTriples(bytes, json) {
  let offset = 12;
  let binary = null;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const kind = bytes.readUInt32LE(offset + 4);
    if (kind === 0x004E4942) binary = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 8 + length;
  }
  assert.ok(binary);
  const accessor = json.accessors[json.meshes[0].primitives[0].indices];
  const view = json.bufferViews[accessor.bufferView];
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const values = [];
  for (let index = 0; index < accessor.count; index += 1) values.push(binary.readUInt16LE(start + index * 2));
  return Array.from({ length: values.length / 3 }, (_, index) => values.slice(index * 3, index * 3 + 3));
}

function pngRGBA(bytes) {
  assert.equal(bytes.toString('hex', 0, 8), '89504e470d0a1a0a');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const chunks = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, 'PNG must use 8-bit channels.');
      assert.equal(data[9], 6, 'PNG must use RGBA.');
      colorType = data[9];
    } else if (type === 'IDAT') chunks.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  assert.equal(colorType, 6);
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  assert.equal(raw.length, height * (stride + 1));
  return { width, height, raw, stride };
}

function atlasPixel(atlas, x, y) {
  const row = y * (atlas.stride + 1);
  assert.equal(atlas.raw[row], 0, 'The deterministic atlas uses filter type 0.');
  const offset = row + 1 + x * 4;
  return [...atlas.raw.subarray(offset, offset + 4)];
}

test('both procedural female GLBs stay inside the chrome, topology and byte budget', async () => {
  const reports = await Promise.all([files.reportA, files.reportB].map(async file => JSON.parse(await readFile(file, 'utf8'))));
  for (const [index, key] of ['a', 'b'].entries()) {
    const bytes = await readFile(files[key]);
    const json = readGLB(bytes);
    const report = reports[index];
    const primitive = json.meshes?.[0]?.primitives?.[0];
    const triangles = json.accessors[primitive.indices].count / 3;
    const material = json.materials[0];
    const pbr = material.pbrMetallicRoughness;

    assert.equal(bytes.length, report.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), report.sha256);
    assert.ok(bytes.length <= 250 * 1024, `${key.toUpperCase()} GLB must stay below 250 KiB.`);
    assert.equal(json.meshes.length, 1);
    assert.equal(json.meshes[0].primitives.length, 1);
    assert.equal(json.materials.length, 1);
    assert.equal(material.name, 'mannequin_chrome');
    assert.equal(material.doubleSided, undefined);
    assert.equal(pbr.metallicFactor ?? 1, 1);
    assert.ok(Math.abs(pbr.roughnessFactor - (key === 'a' ? 0.18 : 0.30)) < 1e-6);
    assert.ok(Math.abs(pbr.baseColorFactor[0] - 0.7758222222328186) < 1e-6);
    assert.deepEqual(material.extensions?.KHR_materials_clearcoat, { clearcoatFactor: 0.15000000596046448, clearcoatRoughnessFactor: 0.11999999731779099 });
    assert.equal((json.textures || []).length, 0);
    assert.equal((json.images || []).length, 0);
    assert.ok(primitive.attributes.TEXCOORD_0 !== undefined, 'The contact sheet requires retained UVs.');
    assert.ok(triangles > 0 && triangles <= 6000);
    assert.equal(triangles, report.exported_triangles);
    const triples = indexTriples(bytes, json);
    const sortedTriples = [...triples].sort((left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2]);
    assert.deepEqual(triples, sortedTriples, 'Exported triangle order must be canonical and byte-reproducible.');
    assert.match(report.cleanup.index_order, /lexicographic/);
    assert.equal(report.mesh_count, 1);
    assert.equal(report.primitive_count, 1);
    assert.equal(report.image_count, 0);
    assert.ok(Math.abs(report.bounds_gltf.max[1] - 1.7) < 1e-6);
    assert.ok(Math.abs(report.bounds_gltf.min[1]) < 1e-6);
    assert.deepEqual(report.origin, [0, 0, 0]);
    assert.equal(report.front_axis, '+Z');
    assert.equal(report.up_axis, '+Y');
    assert.ok(Math.abs(report.leg_ratio - 0.5294117647058824) < 1e-9);
    assert.deepEqual(report.external_asset_inputs, []);
  }
});

test('the build script is procedural, deterministic and contains no source-asset reuse', async () => {
  const [script, report] = await Promise.all([readFile(files.script, 'utf8'), readFile(files.reportB, 'utf8')]);
  const parsed = JSON.parse(report);
  assert.doesNotMatch(script, /import_scene\.fbx|female_mannequin|skincolor|\.fbx/i);
  assert.match(script, /SEED = 340044/);
  assert.match(script, /TORSO_PROFILE/);
  assert.match(script, /ARM_OUTWARD_DEGREES = 15\.0/);
  assert.match(script, /ARM_FORWARD_DEGREES = 5\.0/);
  assert.equal(parsed.seed, 340044);
  assert.equal(parsed.generator, 'scripts/mannequin-female-build.py');
  assert.deepEqual(parsed.external_asset_inputs, []);
});

test('the 4096 atlas preserves the 0.48828125 mm-per-pixel scale and transparent seams', async () => {
  const [png, json, design] = await Promise.all([
    readFile(files.atlas),
    readFile(files.atlasJSON, 'utf8').then(JSON.parse),
    readFile(files.designJSON, 'utf8').then(JSON.parse),
  ]);
  const atlas = pngRGBA(png);
  assert.equal(atlas.width, 4096);
  assert.equal(atlas.height, 4096);
  assert.equal(json.scale.uvSpanMM, 2000);
  assert.equal(json.scale.mmPerPixel, 0.48828125);
  assert.equal(json.scale.mmPerPixel, 2000 / 4096);
  assert.equal(json.scale.bodyHeightPx, 1700 / (2000 / 4096));
  assert.equal(json.parts.torso_front.label, 'front torso / chest');
  assert.deepEqual(json.parts.left_upper_arm.pixelRect.slice(0, 2), [2376, 2707]);
  for (const part of Object.values(json.parts)) {
    assert.ok(part.pixelRect[2] > 0 && part.pixelRect[3] > 0);
    assert.ok(part.anchorUV[0] >= 0 && part.anchorUV[0] <= 1);
    assert.ok(part.anchorUV[1] >= 0 && part.anchorUV[1] <= 1);
  }

  const torso = json.parts.torso.pixelRect;
  assert.deepEqual(atlasPixel(atlas, torso[0] + 120, torso[1]), [0, 0, 0, 89]);
  assert.deepEqual(atlasPixel(atlas, torso[0] + 120, torso[1] + 1), [0, 0, 0, 89]);
  assert.deepEqual(atlasPixel(atlas, torso[0] + 120, torso[1] + 20), [0, 0, 0, 0]);
  assert.equal(design.part, 'torso_front');
  assert.equal(design.widthMM, 120);
  assert.equal(design.wrap, 'clamp');
});

test('one config is the source for default B, both variants and the deferred design', () => {
  assert.equal(mannequinPreviewConfig.defaultVariant, 'B');
  assert.equal(mannequinVariant().model, '/models/mannequin-female-b.glb');
  assert.equal(mannequinVariant('A').model, '/models/mannequin-female-a.glb');
  assert.equal(mannequinVariant('missing').shading, 'B');
  assert.equal(mannequinPreviewConfig.chrome.envMapIntensity, 1.35);
  assert.equal(mannequinPreviewConfig.chrome.environmentSigma, 0.035);
  assert.deepEqual(mannequinPreviewConfig.chrome.environmentSizes, { desktop: 256, compact: 128 });
  assert.equal(mannequinPreviewConfig.design.placement.widthMM, 120);
  assert.equal(mannequinPreviewConfig.design.url, '/textures/designs/demo-mark.png');
});
