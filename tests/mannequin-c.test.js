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

test('only variant C ships; A/B stay dev-only and never reach the production load path', () => {
  const markup = renderMannequinPreview();
  assert.match(markup, /data-mannequin-variant="C"/);
  assert.doesNotMatch(markup, /data-mannequin-variant-option/, 'No visible variant switcher.');
  assert.doesNotMatch(markup, />\s*A · |B · /, 'A/B labels are not rendered.');
  // Der Node-Lauf entspricht dem Production-Build: import.meta.env fehlt, also
  // enthaelt die Registry ausschliesslich C. A/B sind Code im Dev-Zweig.
  assert.deepEqual(Object.keys(mannequinPreviewConfig.variants), ['C'],
    'Production registry contains exactly one variant.');
  assert.equal(mannequinPreviewConfig.variants.A, undefined);
  assert.equal(mannequinPreviewConfig.variants.B, undefined);
  // ?variant= ist ausschliesslich im Dev-Server aktiv (import.meta.env.DEV).
  assert.equal(mannequinDevVariant('?variant=a'), null);
  assert.equal(mannequinDevVariant('?variant=b'), null);
  assert.equal(mannequinPreviewConfig.defaultVariant, 'C');
  assert.equal(mannequinVariant('C').initialYaw, 0, 'C starts front-on (+Z) with a documented yaw constant.');
  assert.equal(typeof mannequinVariant('C').initialYaw, 'number');
});

test('the viewer is announced as an image and documents its keyboard control', () => {
  const markup = renderMannequinPreview();
  assert.match(markup, /role="img"/);
  assert.equal(markup.includes('tabindex="-1"'), false);
  assert.match(markup, /tabindex="0"/);
  assert.match(markup, /aria-label="[^"]*arrow keys[^"]*"/i, 'The label names the keyboard control.');
  assert.match(markup, /aria-describedby="mannequin-viewer-help"/);
  assert.match(markup, /aria-keyshortcuts="ArrowLeft ArrowRight Home Escape"/);
  assert.match(markup, /<p class="sr-only" id="mannequin-viewer-help">[^<]+<\/p>/, 'The help text exists as DOM text, not only as an attribute.');
  // role="img" macht seine Kinder presentational — die Live-Region muss draussen liegen.
  const frame = markup.match(/<div class="mannequin-preview-frame"[\s\S]*?<\/div>/);
  assert.ok(frame, 'The viewer frame is a single div without nested divs.');
  assert.equal(frame[0].includes('data-mannequin-status'), false, 'No live region inside role="img".');
  assert.equal(markup.includes('aria-live'), false, 'Rotation updates are never announced.');
});

test('variant C is the default and every variant points at an existing GLB', async () => {
  assert.equal(mannequinPreviewConfig.defaultVariant, 'C');
  assert.deepEqual(mannequinVariantList().map((variant) => variant.key), ['C']);
  assert.equal(mannequinVariant('C').design, false, 'The sculpted UV layout cannot take the authored decal.');
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

test('the derivative pipeline is committed and deterministic', async () => {
  const script = await readFile(new URL('../scripts/build-mannequin-c.mjs', import.meta.url), 'utf8');
  const blender = await readFile(new URL('../scripts/build-mannequin-web-asset.py', import.meta.url), 'utf8');
  for (const source of [script, blender]) {
    // Der Web-Build arbeitet auf dem freigegebenen Zwischenstand, nie direkt
    // auf dem Download-Asset.
    assert.doesNotMatch(source, /\.fbx/i, 'The web pipeline must not import the FBX directly.');
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

test('CREDITS.md documents the base mesh provenance and its license', async () => {
  const credits = await readFile(new URL('../CREDITS.md', import.meta.url), 'utf8');
  assert.match(credits, /free-female-mannequin-base-mesh/, 'The base mesh is named.');
  assert.match(credits, /CC0 1\.0 Universal \(Public Domain Dedication\)/, 'The license is stated.');
  assert.match(credits, /creativecommons\.org\/publicdomain\/zero\/1\.0/, 'The license link points at CC0.');
  assert.match(credits, /female_mannequin\.fbx/, 'The original file is named.');
  assert.match(credits, /97\.794 Polygone \/ 48\.872 Vertices/, 'The source geometry is quantified.');
  assert.match(credits, /keine Attributionspflicht/i, 'CC0 is explained as voluntary provenance documentation.');
  assert.match(credits, /Nutzer, 05\.11\.2026/, 'The license confirmation is dated and attributed.');
  assert.match(credits, /audit-2026-11-05/, 'The provenance audit is referenced.');
  assert.match(credits, /nicht erfasst/, 'Author and URL are not invented.');
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

test('the Procreate MTL is relative, matte and free of the source gloss values', async () => {
  const mtl = await readFile(new URL('../docs/validation/MANNEQUIN-C/procreate/mannequin_paint.mtl', import.meta.url), 'utf8');
  assert.match(mtl, /newmtl skincolor/);
  assert.match(mtl, /^map_Kd skincolor\.png$/m, 'The texture path stays relative to the package.');
  assert.doesNotMatch(mtl, /\/Users\//, 'No absolute user path.');
  // Glanz des Ursprungsmaterials: darf nicht mitgehen.
  assert.doesNotMatch(mtl, /Ns 722\.5/);
  assert.doesNotMatch(mtl, /Ks 0\.5/, 'The source specular colour is not reused.');
  assert.doesNotMatch(mtl, /illum 2/, 'illum 2 would reintroduce a specular highlight.');
  assert.match(mtl, /^illum 1$/m, 'Diffuse only.');
  assert.match(mtl, /^Ks 0\.000000 0\.000000 0\.000000$/m);
  assert.match(mtl, /^Ns 0\.000000$/m);
});

test('two bakes share the UV layout but keep separate resolutions', async () => {
  const bake = JSON.parse(await readFile(new URL('../docs/validation/MANNEQUIN-C/ao-bake.json', import.meta.url), 'utf8'));
  const paint = JSON.parse(await readFile(new URL('../docs/validation/MANNEQUIN-C/ao-bake-paint.json', import.meta.url), 'utf8'));
  assert.equal(bake.resolution, 1024, 'The web bake stays at 1024.');
  assert.equal(paint.resolution, 2048, 'The painting surface gets 2048.');
  for (const settings of [bake, paint]) {
    assert.equal(settings.aoDistance, 0.18);
    assert.equal(settings.aoStrength, 0.35);
    assert.equal(settings.aoSamples, 64);
    assert.equal(settings.gradientStrength, 0.04);
    assert.equal(settings.baseColor, '#f0efeb');
    assert.equal(settings.uvFillBefore, 0.372054, 'Identical UV layout in both bakes.');
    assert.equal(settings.uvFillAfter, 0.372054);
    assert.equal(settings.uvUnchanged, true);
    assert.equal(settings.triangles, 49838);
  }
  assert.equal(manifest.bake.resolution, 1024);
  assert.equal(manifest.bake.paintResolution, 2048);
  assert.ok(manifest.bake.paintTextureBytes > bake.textureBytes, 'The paint texture carries more data than the web one.');
});

test('the Procreate package scan reports no violations', async () => {
  const report = JSON.parse(await readFile(new URL('../docs/validation/MANNEQUIN-C/procreate-package.json', import.meta.url), 'utf8'));
  assert.equal(report.passed, true);
  assert.deepEqual(report.violations, []);
  const texture = report.files.find((file) => file.name === 'skincolor.png');
  assert.equal(texture.width, 2048);
  assert.equal(texture.height, 2048);
  assert.equal(report.files.some((file) => file.name.endsWith('.obj')), true, 'The package still ships the OBJ.');
});

test('the package scanner itself passes on the committed evidence copy', () => {
  const output = execFileSync(process.execPath,
    ['scripts/check-procreate-package.mjs', 'docs/validation/MANNEQUIN-C/procreate'],
    { cwd: root, encoding: 'utf8' });
  const report = JSON.parse(output);
  assert.equal(report.passed, true);
  assert.deepEqual(report.violations, []);
});

test('verify:assets passes against the committed manifest', () => {
  const output = execFileSync(process.execPath, ['scripts/verify-mannequin-assets.mjs'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /verify:assets — OK/);
  assert.match(output, /sha256/);
});
