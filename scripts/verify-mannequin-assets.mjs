#!/usr/bin/env node
/**
 * Prueft die committeten Mannequin-Assets gegen docs/validation/MANNEQUIN-C/asset-manifest.json.
 * Bricht mit Exit-Code 1 ab, wenn Hashes oder Groessen abweichen.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'docs', 'validation', 'MANNEQUIN-C', 'asset-manifest.json');
if (!existsSync(manifestPath)) {
  console.error('verify:assets — asset-manifest.json fehlt.');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const problems = [];
const derivative = join(root, manifest.derivative.file);
if (!existsSync(derivative)) {
  problems.push(`Derivat fehlt: ${manifest.derivative.file}`);
} else {
  const bytes = statSync(derivative).size;
  const hash = sha256(derivative);
  if (bytes !== manifest.derivative.bytes) problems.push(`Groesse ${bytes} != ${manifest.derivative.bytes}`);
  if (hash !== manifest.derivative.sha256) problems.push(`SHA-256 ${hash} != ${manifest.derivative.sha256}`);
  console.log(`verify:assets — Derivat ${manifest.derivative.file}: ${bytes} Bytes, sha256 ${hash}`);
}
const sourcePath = process.env.MANNEQUIN_SOURCE || join(root, '..', '..', '2026-11-03', 'aufgabe-v3-2-m0-mannequin-vorschau', 'outputs', 'mannequin-remodeling', 'real-run', 'export', manifest.source.file);
if (existsSync(sourcePath)) {
  const hash = sha256(sourcePath);
  if (hash !== manifest.source.sha256) problems.push(`Quell-Hash ${hash} != ${manifest.source.sha256}`);
  console.log(`verify:assets — Quelle ${manifest.source.file}: sha256 ${hash}`);
} else {
  console.log(`verify:assets — Quelle nicht lokal vorhanden (${manifest.source.file}); nur Derivat geprueft.`);
}
if (problems.length) {
  console.error('verify:assets — FEHLER:\n' + problems.map((line) => ` - ${line}`).join('\n'));
  process.exit(1);
}
console.log('verify:assets — OK');
