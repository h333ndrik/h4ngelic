#!/usr/bin/env node
/**
 * M3: ersetzt nur Material und Textur von Variante C.
 *
 * Geometrie und UVs bleiben unangetastet: der aktuelle GLB wird entpackt, in
 * Blender gebacken (AO in die Albedo), und mit exakt denselben Kompressions-
 * Einstellungen wie in scripts/build-mannequin-c.mjs wieder verpackt.
 *
 * Aufruf:
 *   KTX_TOOLS=/pfad/zu/ktx/bin node scripts/retexture-mannequin-c.mjs
 *   ... --resolution 1024    (Experiment: Default bleibt 2048)
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputs = resolve(root, '..', '..', '..', '2026-11-03', 'aufgabe-v3-2-m0-mannequin-vorschau', 'outputs', 'mannequin-remodeling');
const procreate = join(outputs, 'procreate');
const evidence = join(root, 'docs', 'validation', 'MANNEQUIN-C');
const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const ktxTools = process.env.KTX_TOOLS || '';
const gltf = ['--yes', '@gltf-transform/cli@4.5.1'];
const EXPECTED_TRIANGLES = 49838;
const argValue = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
// Zwei Bakes aus identischen UVs: 1024 fuer das Web-GLB (Payload), 2048 fuer
// die Malflaeche in Procreate. Beide nutzen dieselben AO-Konstanten.
const WEB_RESOLUTION = Number(argValue('resolution', 1024));
const PAINT_RESOLUTION = Number(argValue('paint-resolution', 2048));

// Muss identisch mit MTL_TEXT in scripts/bake-mannequin-ao.py bleiben.
// illum 1 = rein diffus; Glanzwerte des Ursprungsmaterials (Ns 722.5, Ks 0.5,
// illum 2) werden bewusst nicht uebernommen.
const MTL_TEXT = [
  '# h4ngelic mannequin_paint — Procreate-Roundtrip',
  '# matt: illum 1 (kein Specular), keine Glanzwerte des Ursprungsmaterials',
  'newmtl skincolor',
  'Ka 1.000000 1.000000 1.000000',
  'Kd 1.000000 1.000000 1.000000',
  'Ks 0.000000 0.000000 0.000000',
  'Ke 0.000000 0.000000 0.000000',
  'Ni 1.500000',
  'd 1.000000',
  'illum 1',
  'Ns 0.000000',
  'map_Kd skincolor.png',
  '',
].join('\n');

if (!existsSync(blender)) throw new Error(`Blender fehlt: ${blender}`);
const env = ktxTools ? { ...process.env, PATH: `${ktxTools}:${process.env.PATH}` } : process.env;
const run = (command, args, options = {}) => {
  process.stdout.write(`\n$ ${command} ${args.join(' ')}\n`);
  return execFileSync(command, args, { stdio: 'inherit', cwd: root, ...options });
};
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

const manifestPath = join(evidence, 'asset-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const current = join(root, manifest.derivative.file);
if (!existsSync(current)) throw new Error(`Aktuelles Asset fehlt: ${current}`);

const work = mkdtempSync(join(tmpdir(), 'mannequin-m3-'));
const decoded = join(work, 'decoded.glb');
const baked = join(work, 'baked.glb');
const ktx = join(work, 'ktx.glb');
const compressed = join(work, 'web.glb');
const compare = join(work, 'compare.glb');

mkdirSync(evidence, { recursive: true });
mkdirSync(procreate, { recursive: true });

// 1. Draco entpacken (Blender kann KTX2/Draco nicht direkt lesen).
run('npx', [...gltf, 'copy', current, decoded], { env });

// 2. Zwei Bakes aus identischen UVs. Nur die Texturen werden ersetzt: OBJ und
//    Geometrie des Procreate-Pakets bleiben unveraendert, weil ein erneuter
//    OBJ-Export aus dem quantisierten GLB die UVs auf das 16-Bit-Raster
//    schieben und zwei Faces beruehren wuerde.
// Eigenes Unterverzeichnis, aber derselbe Dateiname: der glTF-Exporter leitet
// den Bildnamen aus dem Dateinamen ab. "skincolor-web.png" wuerde den Bildnamen
// im GLB veraendern und damit den Content-Hash — obwohl die Pixel identisch sind.
const webTexture = join(work, 'web', 'skincolor.png');
const paintTexture = join(procreate, 'skincolor.png');
const paintGlb = join(work, 'baked-paint.glb');
const bakeArgs = (texture, glb, report, resolution) => [
  '-b', '--factory-startup', '--python', join(root, 'scripts', 'bake-mannequin-ao.py'), '--',
  '--input', decoded, '--glb', glb,
  '--texture', texture,
  '--report', report,
  '--resolution', String(resolution),
];
// MTL: relativ, matt. Liegt im Procreate-Paket und als Repo-Kopie fuer die Tests.
function writeMtl() {
  writeFileSync(join(procreate, 'mannequin_paint.mtl'), MTL_TEXT);
  mkdirSync(join(evidence, 'procreate'), { recursive: true });
  writeFileSync(join(evidence, 'procreate', 'mannequin_paint.mtl'), MTL_TEXT);
}

function bakePaint() {
  process.stdout.write(`\n== Bake Paint ${PAINT_RESOLUTION}px -> Procreate ==\n`);
  run(blender, bakeArgs(paintTexture, paintGlb, join(evidence, 'ao-bake-paint.json'), PAINT_RESOLUTION));
  copyFileSync(paintTexture, join(evidence, 'skincolor_paint_2048.png'));
}

/**
 * Nur die Malflaeche: 2048er Bake + MTL, GLB und Web-Textur bleiben
 * unangetastet. Gedacht fuer Nachbesserungen an der Procreate-Textur, ohne den
 * ausgelieferten Content-Hash anzufassen.
 */
if (process.argv.includes('--paint-only')) {
  // Der Bake braucht Geometrie; das GLB wird dafuer nur gelesen und dekodiert.
  bakePaint();
  writeMtl();
  run('python3', [join(root, 'scripts', 'check-mannequin-uv-overlap.py'), '--input', join(procreate, 'mannequin_paint.obj'),
    '--out', join(evidence, 'uv-overlap-procreate.json')]);
  const paint = JSON.parse(readFileSync(join(evidence, 'ao-bake-paint.json'), 'utf8'));
  const next = {
    ...manifest,
    builtAt: new Date().toISOString(),
    bake: {
      ...manifest.bake,
      paintResolution: paint.resolution,
      paintTextureBytes: statSync(paintTexture).size,
      paintLuminance: paint.luminance,
      paintTexture: 'skincolor_paint_2048.png',
    },
  };
  writeFileSync(join(evidence, 'asset-manifest.json'), JSON.stringify(next, null, 2) + '\n');
  process.stdout.write(`\nPaint-Textur ${paint.resolution}px, ${statSync(paintTexture).size} Bytes — GLB unveraendert.\n`);
  process.exit(0);
}

process.stdout.write(`\n== Bake Web ${WEB_RESOLUTION}px -> GLB ==\n`);
run(blender, bakeArgs(webTexture, baked, join(evidence, 'ao-bake.json'), WEB_RESOLUTION));
bakePaint();
writeMtl();

// 3. Identische Kompression wie M1/M2.
run('npx', [...gltf, 'optimize', baked, ktx, '--simplify', 'false', '--compress', 'false',
  '--texture-compress', 'ktx2', '--prune-solid-textures', 'false'], { env });
run('npx', [...gltf, 'draco', ktx, compressed, '--quantize-texcoord', '16', '--quantize-position', '14',
  '--quantize-normal', '10'], { env });

// 4. Pruefen: gleiche Tris, gleiche Bounds, UVs unveraendert.
run('npx', [...gltf, 'copy', compressed, compare], { env });

const readGLB = (path) => {
  const bytes = readFileSync(path);
  let offset = 12;
  let json = null;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const kind = bytes.readUInt32LE(offset + 4);
    if (kind === 0x4E4F534A) json = JSON.parse(bytes.subarray(offset + 8, offset + 8 + length).toString('utf8').replace(/\0+$/, ''));
    offset += 8 + length;
  }
  return json;
};
const geometryOf = (path) => {
  const gltf = readGLB(path);
  const primitive = gltf.meshes[0].primitives[0];
  const indices = gltf.accessors[primitive.indices];
  const position = gltf.accessors[primitive.attributes.POSITION];
  return {
    triangles: indices.count / 3,
    vertices: position.count,
    positions: [position.min, position.max],
    images: (gltf.images || []).map((image) => image.mimeType),
  };
};
const before = geometryOf(current);
const after = geometryOf(compare);
if (after.triangles !== EXPECTED_TRIANGLES) throw new Error(`Tri-Zahl ${after.triangles} != ${EXPECTED_TRIANGLES}`);
// Draco quantisiert Positionen auf 14 Bit; die Bounds duerfen sich deshalb nur
// minimal verschieben (Toleranz 0.005 von 5.0 Modellhoehe = 1 mm).
const BOUNDS_TOLERANCE = 0.005;
const boundsDrift = Math.max(
  ...before.positions[0].map((value, axis) => Math.abs(value - after.positions[0][axis])),
  ...before.positions[1].map((value, axis) => Math.abs(value - after.positions[1][axis])),
);
if (boundsDrift > BOUNDS_TOLERANCE) {
  throw new Error(`Bounding-Box hat sich geaendert: ${JSON.stringify(before.positions)} -> ${JSON.stringify(after.positions)}`);
}
process.stdout.write(`Bounding-Box-Drift: ${boundsDrift.toFixed(6)} (Toleranz ${BOUNDS_TOLERANCE})\n`);

run('python3', [join(root, 'scripts', 'check-mannequin-uv-overlap.py'), '--input', compare,
  '--out', join(evidence, 'uv-overlap-web.json')]);
run('python3', [join(root, 'scripts', 'check-mannequin-uv-overlap.py'), '--input', join(procreate, 'mannequin_paint.obj'),
  '--out', join(evidence, 'uv-overlap-procreate.json')]);

// 5. Neuer Content-Hash, altes Asset entfernen.
const hash = sha256(compressed);
const target = join(root, 'public', 'models', `mannequin-c.${hash.slice(0, 12)}.glb`);
copyFileSync(compressed, target);
for (const entry of readdirSync(join(root, 'public', 'models'))) {
  if (/^mannequin-c\.[a-f0-9]+\.glb$/.test(entry) && join(root, 'public', 'models', entry) !== target) {
    rmSync(join(root, 'public', 'models', entry));
    process.stdout.write(`entfernt: public/models/${entry}\n`);
  }
}

// 6. Config, Manifest und Evidence aktualisieren.
const configPath = join(root, 'src', 'mannequin-preview-config.js');
writeFileSync(configPath, readFileSync(configPath, 'utf8')
  .replace(/\/models\/mannequin-c\.[a-f0-9]+\.glb/, `/models/${target.split('/').pop()}`));

const bake = JSON.parse(readFileSync(join(evidence, 'ao-bake.json'), 'utf8'));
const paintBake = JSON.parse(readFileSync(join(evidence, 'ao-bake-paint.json'), 'utf8'));
const updated = {
  ...manifest,
  builtAt: new Date().toISOString(),
  pipeline: 'scripts/retexture-mannequin-c.mjs (M3: AO-Bake, Geometrie unveraendert; M4a: zwei Bakes)',
  derivative: {
    ...manifest.derivative,
    file: `public/models/${target.split('/').pop()}`,
    bytes: statSync(target).size,
    sha256: hash,
    triangles: after.triangles,
    vertices: after.vertices,
    texture: `skincolor_baked.png (AO x Basis #f0efeb, ${bake.resolution})`,
  },
  bake: {
    aoDistance: bake.aoDistance,
    aoStrength: bake.aoStrength,
    aoSamples: bake.aoSamples,
    gradientStrength: bake.gradientStrength,
    // Web bleibt bei 1024 (Payload), Procreate bekommt 2048 zum Malen.
    resolution: bake.resolution,
    luminance: bake.luminance,
    uvCoverage: bake.uvCoverage,
    paintResolution: paintBake.resolution,
    paintTextureBytes: statSync(paintTexture).size,
    paintLuminance: paintBake.luminance,
    paintTexture: 'skincolor_paint_2048.png',
  },
  uv: { ...manifest.uv, overlapPairsAfterRepair: 0 },
};
writeFileSync(join(evidence, 'asset-manifest.json'), JSON.stringify(updated, null, 2) + '\n');
// Evidence: Web-Textur (gehoert zum GLB) und Paint-Textur (gehoert zu Procreate).
copyFileSync(webTexture, join(evidence, 'skincolor_baked.png'));

process.stdout.write(`\nMannequin-C neu: ${updated.derivative.file} (${updated.derivative.bytes} Bytes, sha256 ${hash})\n`);
process.stdout.write(`Web-Textur ${bake.resolution}px, Paint-Textur ${paintBake.resolution}px (${updated.bake.paintTextureBytes} Bytes)\n`);
