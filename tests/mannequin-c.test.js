import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { mannequinDevVariant, mannequinPreviewConfig, mannequinVariant, mannequinVariantList } from '../src/mannequin-preview-config.js';
import { renderMannequinPreview } from '../src/mannequin-preview-content.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifestURL = new URL('../docs/validation/MANNEQUIN-C/asset-manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestURL, 'utf8'));

// Bewusst als Konstante: aendert sich das Asset, muss der Hash hier UND im
// Manifest UND im Dateinamen mitwandern (verify:assets prueft dasselbe).
const EXPECTED_DERIVATIVE_SHA256 = 'd76abc1645120eb217d0de062887ed029f40d963994f18d8024d64e93fbd71fb';
const EXPECTED_DERIVATIVE_BYTES = 457000;
// 1024 statt 2048 nach der Vorab-Regel aus M3 (GLB 30,08 % kleiner, SSIM der
// 3/4-Renderings 1,000000). Begruendung in docs/validation/MANNEQUIN-C/REPORT.md.
const EXPECTED_TEXTURE_RESOLUTION = 1024;

/** Minimaler PNG-Leser (8 Bit, RGB/RGBA) fuer den Textur-Check. */
function readPNG(bytes) {
  assert.equal(bytes.toString('hex', 0, 8), '89504e470d0a1a0a');
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const chunks = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, 'PNG must use 8-bit channels.');
      channels = data[9] === 2 ? 3 : data[9] === 6 ? 4 : 0;
      assert.ok(channels, 'PNG must be RGB or RGBA.');
    } else if (type === 'IDAT') chunks.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)];
    const source = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    for (let column = 0; column < stride; column += 1) {
      const left = column >= channels ? pixels[row * stride + column - channels] : 0;
      const up = row > 0 ? pixels[(row - 1) * stride + column] : 0;
      const upLeft = row > 0 && column >= channels ? pixels[(row - 1) * stride + column - channels] : 0;
      let value = source[column];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      pixels[row * stride + column] = value & 0xFF;
    }
  }
  return { width, height, channels, pixels };
}

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

test('only variant C is visible; A/B stay registered but hidden', () => {
  const markup = renderMannequinPreview();
  assert.match(markup, /data-mannequin-variant="C"/);
  assert.doesNotMatch(markup, /data-mannequin-variant-option/, 'No visible variant switcher.');
  assert.doesNotMatch(markup, />\s*A · |B · /, 'A/B labels are not rendered.');
  for (const key of ['A', 'B']) {
    assert.ok(mannequinPreviewConfig.variants[key], `${key} stays in the registry.`);
    assert.equal(typeof mannequinVariant(key).model, 'string');
  }
  // ?variant= ist ausschliesslich im Dev-Server aktiv (import.meta.env.DEV).
  assert.equal(mannequinDevVariant('?variant=a'), null);
  assert.equal(mannequinDevVariant('?variant=b'), null);
  assert.equal(mannequinPreviewConfig.defaultVariant, 'C');
  assert.equal(mannequinVariant('C').initialYaw, 0, 'C starts front-on (+Z) with a documented yaw constant.');
  assert.equal(typeof mannequinVariant('C').initialYaw, 'number');
});

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
  assert.equal(manifest.derivative.sha256, EXPECTED_DERIVATIVE_SHA256, 'Manifest hash matches the pinned constant.');
  assert.equal(info.size, EXPECTED_DERIVATIVE_BYTES, 'Manifest size matches the pinned constant.');
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

test('the baked albedo is not a flat colour any more', async () => {
  const png = readPNG(await readFile(new URL('../docs/validation/MANNEQUIN-C/skincolor_baked.png', import.meta.url)));
  assert.equal(png.width, EXPECTED_TEXTURE_RESOLUTION);
  assert.equal(png.height, EXPECTED_TEXTURE_RESOLUTION);
  const luminance = [];
  for (let texel = 0; texel < png.width * png.height; texel += 1) {
    const index = texel * png.channels;
    luminance.push(0.2126 * png.pixels[index] + 0.7152 * png.pixels[index + 1] + 0.0722 * png.pixels[index + 2]);
  }
  const mean = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
  const variance = luminance.reduce((sum, value) => sum + (value - mean) ** 2, 0) / luminance.length;
  const darkest = luminance.reduce((lowest, value) => Math.min(lowest, value), 255);
  assert.ok(Math.sqrt(variance) > 4, `Texture must show AO variance (stdev ${Math.sqrt(variance).toFixed(2)}).`);
  assert.ok(darkest < 230, `Texture must contain shaded texels (darkest ${darkest.toFixed(0)}).`);
  assert.ok(mean > 150 && mean < 236, `Texture stays inside the neutral range (mean ${mean.toFixed(1)}).`);
  const bake = JSON.parse(await readFile(new URL('../docs/validation/MANNEQUIN-C/ao-bake.json', import.meta.url), 'utf8'));
  assert.equal(bake.resolution, EXPECTED_TEXTURE_RESOLUTION, 'Bake resolution matches the pinned constant.');
  assert.equal(bake.baseColor, '#f0efeb', 'Base colour is unchanged.');
  assert.equal(bake.uvUnchanged, true, 'UV layout was not touched by the bake.');
  assert.equal(bake.triangles, manifest.derivative.triangles);
  assert.ok(bake.aoStrength >= 0.25 && bake.aoStrength <= 0.4, 'AO strength stays in the documented range.');
  assert.ok(bake.gradientStrength >= 0 && bake.gradientStrength <= 0.05, 'Vertical gradient stays subtle.');
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
  assert.match(manifest.pipeline, /scripts\/(build|retexture)-mannequin-c\.mjs/);
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
