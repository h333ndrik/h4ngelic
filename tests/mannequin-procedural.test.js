import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const glbURL = new URL('../public/models/mannequin.glb', import.meta.url);
const scriptURL = new URL('../scripts/mannequin-build.py', import.meta.url);
const reportURL = new URL('../docs/validation/MANNEQUIN-PROCEDURAL/build-report-b.json', import.meta.url);

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

test('procedural mannequin GLB is original, untextured, low-poly and Y-up', async () => {
  const [bytes, script, report] = await Promise.all([readFile(glbURL), readFile(scriptURL, 'utf8'), readFile(reportURL, 'utf8')]);
  const json = readGLB(bytes);
  const parsedReport = JSON.parse(report);
  const materials = json.materials || [];
  const primitives = (json.meshes || []).flatMap(mesh => mesh.primitives || []);
  const triangles = primitives.reduce((total, primitive) => {
    const accessor = json.accessors[primitive.indices];
    return total + Math.floor(accessor.count / 3);
  }, 0);

  assert.equal(json.asset.version, '2.0');
  assert.equal(materials.length, 1);
  assert.equal(materials[0].name, 'mannequin_matt');
  assert.notEqual(materials[0].doubleSided, true, 'The closed procedural surfaces use front-face culling.');
  assert.equal((json.textures || []).length, 0, 'No source or skin texture may enter the GLB.');
  assert.equal((json.images || []).length, 0);
  assert.equal(materials[0].pbrMetallicRoughness.metallicFactor, 0);
  assert.ok(Math.abs(materials[0].pbrMetallicRoughness.roughnessFactor - 0.85) < 1e-6);
  assert.ok(triangles > 0 && triangles <= 60000);
  assert.equal(primitives.some(primitive => primitive.extensions?.KHR_draco_mesh_compression), false);
  assert.equal(parsedReport.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(parsedReport.bytes, bytes.length);
  assert.equal(parsedReport.cleanup.non_manifold_edges, 0);
  assert.equal(parsedReport.cleanup.loose_vertices, 0);
  assert.equal(parsedReport.exported_triangles, triangles);
  assert.deepEqual(parsedReport.bounds_gltf.min.map(value => Number(value.toFixed(5))), [parsedReport.bounds_gltf.min[0], 0, parsedReport.bounds_gltf.min[2]].map(value => Number(value.toFixed(5))));
  assert.ok(Math.abs(parsedReport.bounds_gltf.max[1] - 1.5) < 1e-6);
  assert.deepEqual(parsedReport.external_mesh_inputs, []);
  assert.doesNotMatch(script, /import_scene\.fbx|female_mannequin|skincolor|\.fbx/i, 'The builder must not import or reference the rejected source asset.');
  assert.match(script, /TORSO_PROFILE/);
  assert.match(script, /SEED = 320032/);
});
