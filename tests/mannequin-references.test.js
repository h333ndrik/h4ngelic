import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mannequinPreviewConfig, mannequinVariant } from '../src/mannequin-preview-config.js';

/**
 * M4i: Es gibt genau ein ausgeliefertes C-Asset. Jede aktive Referenz muss
 * darauf zeigen; aeltere Hashes duerfen nur in datierten/historischen
 * Abschnitten oder in der Evidence liegen.
 */
const root = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set(['node_modules', 'dist', '.git', 'outputs', 'artifacts', 'images', 'models']);
const TEXT = /\.(md|js|mjs|json|css|html|py|txt)$/;
// Absichtlich zusammengesetzt: sonst wuerde dieser Test sich selbst finden.
const STALE = 'd9edb0e4' + 'd7b0';
const HISTORIC = /histor|ueberholt|überholt|superseded/i;

async function walk(directory, list = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path, list);
    else if (TEXT.test(entry.name)) list.push(path);
  }
  return list;
}

const files = await walk(root);
const mentions = [];
for (const file of files) {
  const relativePath = relative(root, file).replaceAll('\\', '/');
  const lines = (await readFile(file, 'utf8')).split('\n');
  // Heading-Stack: ein Abschnitt gilt als historisch, wenn irgendeine
  // umschliessende Ueberschrift ihn so kennzeichnet.
  const stack = [];
  for (const [index, line] of lines.entries()) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      stack.length = heading[1].length - 1;
      stack[heading[1].length - 1] = line;
    }
    if (!line.includes(STALE)) continue;
    const historic = HISTORIC.test(line) || stack.some((entry) => entry && HISTORIC.test(entry));
    const evidence = relativePath.startsWith('docs/validation/');
    mentions.push({ file: relativePath, line: index + 1, historic, evidence });
  }
}

test('the stale 2048 asset hash only survives in dated evidence or marked history', () => {
  assert.ok(files.length > 200, `Der Scan erreicht das Repo (${files.length} Textdateien).`);
  const active = mentions.filter((entry) => !entry.historic && !entry.evidence);
  assert.deepEqual(active, [], `Aktive Nennungen von ${STALE}: ${JSON.stringify(active, null, 2)}`);
  // Der Scan selbst muss den erwarteten Bestand sehen, sonst prueft er nichts.
  assert.ok(mentions.length > 0, 'Der Scan findet die historischen Nennungen (Selbsttest).');
});

test('config and manifest agree on the single delivered asset', async () => {
  const manifest = JSON.parse(await readFile(new URL('../docs/validation/MANNEQUIN-C/asset-manifest.json', import.meta.url), 'utf8'));
  const delivered = manifest.derivative;
  assert.equal(mannequinVariant('C').model, `/${delivered.file.replace(/^public\//, '')}`,
    'Die Config zeigt auf genau das Asset aus dem Manifest.');
  assert.equal(delivered.bytes, 457000);
  assert.equal(delivered.triangles, 49838);
  assert.match(delivered.sha256, /^d76abc164512/);
  const otherAssets = Object.values(mannequinPreviewConfig.variants).filter((variant) => variant.model !== mannequinVariant('C').model);
  assert.equal(otherAssets.length, 0, 'Vor dem Merge laedt nur C; A/B sind dev-only.');
});
