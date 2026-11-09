#!/usr/bin/env node
/**
 * Prueft ein Procreate-Paket gegen die Auslieferungsregeln:
 *  - kein absoluter Pfad ("/Users/") in irgendeiner Datei
 *  - MTL: map_Kd relativ, kein Glanz des Ursprungsmaterials
 *    (kein "Ns 722.5", kein "Ks 0.5", kein "illum 2")
 *  - PNG: Aufloesung und Bytes werden ausgewiesen
 *
 * Aufruf: node scripts/check-procreate-package.mjs <verzeichnis>
 * Ausgabe: JSON auf stdout. Exit 1 bei Verstoss.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const directory = resolve(process.argv[2] || '');
const TEXT = new Set(['.obj', '.mtl', '.md', '.txt', '.json']);
// OBJ/MTL werden zeilenweise geprueft; alles andere als Ganzes.
const files = [];
const violations = [];

for (const name of readdirSync(directory).sort()) {
  const path = join(directory, name);
  if (!statSync(path).isFile()) continue;
  const bytes = readFileSync(path);
  const entry = { name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  if (extname(name) === '.png') {
    if (bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') violations.push(`${name}: kein PNG`);
    entry.width = bytes.readUInt32BE(16);
    entry.height = bytes.readUInt32BE(20);
  }
  if (TEXT.has(extname(name))) {
    const text = bytes.toString('utf8');
    const hits = text.split('\n').filter((line) => line.includes('/Users/'));
    if (hits.length) violations.push(`${name}: absoluter Pfad in ${hits.length} Zeile(n)`);
  }
  files.push(entry);
}

const mtl = files.find((file) => file.name.endsWith('.mtl'));
if (!mtl) violations.push('keine MTL im Paket');
else {
  const text = readFileSync(join(directory, mtl.name), 'utf8');
  if (!/^map_Kd skincolor\.png$/m.test(text)) violations.push('map_Kd ist nicht relativ');
  for (const forbidden of ['Ns 722.5', 'Ks 0.5', 'illum 2']) {
    if (text.includes(forbidden)) violations.push(`MTL enthaelt "${forbidden}"`);
  }
  if (!/^illum 1$/m.test(text)) violations.push('MTL ist nicht auf illum 1 (matt) gestellt');
}

// Nur der Ordnername wandert ins Evidence-JSON: absolute Pfade sind
// maschinenspezifisch und gehoeren nicht in das Repo.
const result = { directory: basename(directory), files, violations, passed: violations.length === 0 };
console.log(JSON.stringify(result, null, 2));
process.exit(result.passed ? 0 : 1);
