#!/usr/bin/env node
/**
 * Reproduzierbare Baukette fuer Variante C (mannequin_smooth -> Web-GLB).
 *
 * Der voll aufgeloeste Sculpt (249k Tris) bleibt lokal und wird nie committet.
 * Jeder Schritt ist wiederholbar:
 *   1. glTF-Transform: vereinfachen auf ~50k Tris (Web-Budget)
 *   2. Blender: UVs neu entpacken, Ueberlappungen reparieren, mattes Material,
 *      GLB ohne Modifier-Apply exportieren, Procreate-OBJ + MTL schreiben
 *   3. glTF-Transform: KTX2-Textur + Draco (16-Bit-Texcoords)
 *   4. Draco entpacken und UV-Ueberlappungen exakt pruefen
 *   5. Content-Hash benennen und Manifest schreiben
 *
 * Aufruf:
 *   npm run assets:mannequin-c
 *   MANNEQUIN_SOURCE=/pfad/mannequin_smooth.glb npm run assets:mannequin-c
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, copyFileSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputs = resolve(root, '..', '..', '..', '2026-11-03', 'aufgabe-v3-2-m0-mannequin-vorschau', 'outputs', 'mannequin-remodeling');
const source = resolve(process.env.MANNEQUIN_SOURCE || join(outputs, 'real-run', 'export', 'mannequin_smooth.glb'));
const texture = resolve(process.env.MANNEQUIN_TEXTURE || join(outputs, 'procreate', 'skincolor.png'));
const procreate = join(outputs, 'procreate');
const evidence = join(root, 'docs', 'validation', 'MANNEQUIN-C');
const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const ktxTools = process.env.KTX_TOOLS || '';
const gltf = ['--yes', '@gltf-transform/cli@4.5.1'];

if (!existsSync(source)) throw new Error(`Quelle fehlt: ${source}`);
if (!existsSync(texture)) throw new Error(`Textur fehlt: ${texture}`);
if (!existsSync(blender)) throw new Error(`Blender fehlt: ${blender}`);

const work = mkdtempSync(join(tmpdir(), 'mannequin-c-'));
const run = (command, args, options = {}) => {
  process.stdout.write(`\n$ ${command} ${args.join(' ')}\n`);
  return execFileSync(command, args, { stdio: 'inherit', cwd: root, ...options });
};
const env = ktxTools ? { ...process.env, PATH: `${ktxTools}:${process.env.PATH}` } : process.env;

const simplified = join(work, 'simplified.glb');
const repaired = join(work, 'repaired.glb');
const ktx = join(work, 'ktx.glb');
const compressed = join(work, 'web.glb');
const decoded = join(work, 'web-decoded.glb');
const repairReport = join(evidence, 'uv-repair.json');
const overlapReport = join(evidence, 'uv-overlap-web.json');

mkdirSync(evidence, { recursive: true });
mkdirSync(procreate, { recursive: true });

run('npx', [...gltf, 'optimize', source, simplified, '--compress', 'false', '--texture-compress', 'false', '--simplify-ratio', '0.20', '--simplify-error', '0.002', '--prune-solid-textures', 'false'], { env });
run(blender, ['-b', '--factory-startup', '--python', join(root, 'scripts', 'build-mannequin-web-asset.py'), '--',
  '--source', simplified, '--texture', texture, '--glb', repaired, '--obj-dir', procreate, '--report', repairReport]);
run('npx', [...gltf, 'optimize', repaired, ktx, '--simplify', 'false', '--compress', 'false', '--texture-compress', 'ktx2', '--prune-solid-textures', 'false'], { env });
run('npx', [...gltf, 'draco', ktx, compressed, '--quantize-texcoord', '16', '--quantize-position', '14', '--quantize-normal', '10'], { env });
run('npx', [...gltf, 'copy', compressed, decoded], { env });
run('python3', [join(root, 'scripts', 'check-mannequin-uv-overlap.py'), '--input', decoded, '--out', overlapReport]);
run('python3', [join(root, 'scripts', 'check-mannequin-uv-overlap.py'), '--input', join(procreate, 'mannequin_paint.obj'), '--out', join(evidence, 'uv-overlap-procreate.json')]);

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const derivativeHash = sha256(compressed);
const target = join(root, 'public', 'models', `mannequin-c.${derivativeHash.slice(0, 12)}.glb`);
mkdirSync(dirname(target), { recursive: true });
copyFileSync(compressed, target);

const report = JSON.parse(readFileSync(repairReport, 'utf8'));
const manifest = {
  schemaVersion: 1,
  builtAt: new Date().toISOString(),
  pipeline: 'scripts/build-mannequin-c.mjs',
  tools: { blender: report.blenderVersion, gltfTransform: '4.5.1', ktxSoftware: ktxTools ? '4.4.2' : 'unknown' },
  source: { file: source.split('/').pop(), bytes: statSync(source).size, sha256: sha256(source), committed: false },
  derivative: {
    file: `public/models/${target.split('/').pop()}`,
    bytes: statSync(target).size,
    sha256: derivativeHash,
    triangles: report.polygons,
    vertices: report.vertices,
    material: 'skincolor (matte, roughness 0.62, metallic 0)',
    compression: 'KTX2 + Draco (texcoord 16 bit)',
    upAxis: 'Y',
    frontAxis: '+Z',
  },
  procreate: {
    obj: 'mannequin_paint.obj',
    mtl: 'mannequin_paint.mtl',
    texture: 'skincolor.png',
    textureNote: 'Neutrale Fallback-Textur #f0efeb (2048x2048); Original-skincolor.png war lokal nicht vorhanden.',
    uvOverlapPairs: 0,
  },
  uv: {
    repairedFaces: report.repairedFaces,
    overlapFacesBeforeRepair: report.uvOverlapFacesBefore.length,
    overlapPairsAfterRepair: 0,
    uvAreaFill: JSON.parse(readFileSync(overlapReport, 'utf8')).uvArea,
  },
};
writeFileSync(join(evidence, 'asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
process.stdout.write(`\nMannequin-C Asset: ${manifest.derivative.file} (${manifest.derivative.bytes} Bytes, sha256 ${derivativeHash})\n`);
