import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { mannequinPreviewConfig, mannequinVariant, mannequinVariantList } from '../src/mannequin-preview-config.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifestURL = new URL('../docs/validation/MANNEQUIN-C/asset-manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestURL, 'utf8'));

function readGLB(bytes) {
  assert.equal(bytes.toString('utf8', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  let offset = 12;
  let json = null;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const kind = bytes.readUInt32LE(offset + 4);
    if (kind === 0x4E4F534A) json = JSON.parse(bytes.subarray(offset + 8, offset + 8 + length).toString('utf8').replace(/\0+$/, ''));
    offset += 8 + length;
  }
  assert.ok(json, 'GLB must contain a JSON chunk.');
  return json;
}

test('variant C is the default and every variant points at an existing GLB', async () => {
  assert.equal(mannequinPreviewConfig.defaultVariant, 'C');
  assert.deepEqual(mannequinVariantList().map((variant) => variant.key), ['A', 'B', 'C']);
  assert.equal(mannequinVariant('C').design, false, 'The sculpted UV layout cannot take the authored decal.');
  assert.equal(mannequinVariant('A').design, true);
  assert.equal(mannequinVariant('B').design, true);
  for (const variant of mannequinVariantList()) {
    assert.match(variant.model, /^\/models\/[a-z0-9.-]+\.glb$/);
    assert.ok(existsSync(new URL(`../public${variant.model}`, import.meta.url)), `${variant.key} GLB missing`);
  }
  assert.equal(mannequinPreviewConfig.loaders.draco, '/draco/');
  assert.equal(mannequinPreviewConfig.loaders.basis, '/basis/');
});

test('the committed C asset matches the recorded size, hash and budget', async () => {
  const assetURL = new URL(`../${manifest.derivative.file}`, import.meta.url);
  const bytes = await readFile(assetURL);
  const info = await stat(assetURL);
  assert.equal(info.size, manifest.derivative.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.derivative.sha256);
  assert.equal(mannequinVariant('C').model, `/${manifest.derivative.file.replace(/^public\//, '')}`);
  assert.ok(info.size < 1_500_000, `C must stay under 1.5 MB (${info.size} bytes)`);
  assert.ok(manifest.derivative.triangles <= 60000, `C must stay at or below 60k triangles (${manifest.derivative.triangles})`);

  const gltf = readGLB(bytes);
  assert.equal(gltf.meshes.length, 1);
  assert.equal(gltf.materials.length, 1);
  assert.deepEqual(gltf.extensionsRequired.sort(), ['KHR_draco_mesh_compression', 'KHR_texture_basisu']);
  const primitive = gltf.meshes[0].primitives[0];
  assert.ok(primitive.attributes.TEXCOORD_0 !== undefined, 'Procreate roundtrip needs UVs in the GLB');
  assert.ok(primitive.attributes.NORMAL !== undefined);
  const material = gltf.materials[0];
  assert.equal(material.pbrMetallicRoughness.metallicFactor, 0);
  assert.ok(Math.abs(material.pbrMetallicRoughness.roughnessFactor - 0.62) < 0.001);
  assert.equal(gltf.images.length, 1);
  assert.equal(gltf.images[0].mimeType, 'image/ktx2');
});

test('the derivative pipeline is committed, deterministic and FBX-free', async () => {
  const script = await readFile(new URL('../scripts/build-mannequin-c.mjs', import.meta.url), 'utf8');
  const blender = await readFile(new URL('../scripts/build-mannequin-web-asset.py', import.meta.url), 'utf8');
  for (const source of [script, blender]) {
    assert.doesNotMatch(source, /\.fbx/i, 'The web pipeline must not import the licensed FBX.');
    assert.doesNotMatch(source, /sketchfab/i);
  }
  assert.match(script, /--simplify-ratio/);
  assert.match(script, /--quantize-texcoord', '16'/);
  assert.match(blender, /UV_SNAP_BITS = 16/);
  assert.match(blender, /export_apply=False/);
  assert.match(manifest.pipeline, /scripts\/build-mannequin-c\.mjs/);
  assert.equal(manifest.source.committed, false);
  assert.equal(manifest.uv.overlapPairsAfterRepair, 0);
  assert.ok(manifest.uv.repairedFaces > 0);
});

test('UV overlap reports prove the Procreate and web layouts are seam-safe', async () => {
  const web = JSON.parse(await readFile(new URL('../docs/validation/MANNEQUIN-C/uv-overlap-web.json', import.meta.url), 'utf8'));
  const procreate = JSON.parse(await readFile(new URL('../docs/validation/MANNEQUIN-C/uv-overlap-procreate.json', import.meta.url), 'utf8'));
  assert.equal(web.passed, true);
  assert.equal(web.overlappingPairs, 0);
  assert.equal(web.triangles, manifest.derivative.triangles);
  assert.equal(procreate.passed, true);
  assert.equal(procreate.overlappingPairs, 0);
  assert.ok(procreate.uvArea > 0.3, `UV packing should use more than 30% of the texture (${procreate.uvArea})`);
});

test('the Procreate MTL ships a relative texture path and no absolute user path', async () => {
  const mtl = await readFile(new URL('../docs/validation/MANNEQUIN-C/procreate/mannequin_paint.mtl', import.meta.url), 'utf8');
  assert.match(mtl, /^map_Kd skincolor\.png$/m);
  assert.doesNotMatch(mtl, /\/Users\//);
  assert.doesNotMatch(mtl, /Ns 722\.5/);
  assert.match(mtl, /newmtl skincolor/);
});

test('verify:assets passes against the committed manifest', () => {
  const output = execFileSync(process.execPath, ['scripts/verify-mannequin-assets.mjs'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /verify:assets — OK/);
  assert.match(output, /sha256/);
});
