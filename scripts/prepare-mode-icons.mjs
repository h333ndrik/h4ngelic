import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { modeIconSettings as settings } from '../src/data/modeIconSettings.js';

const root = new URL('../public/', import.meta.url);
const file = path => new URL(path.slice(1), root);
const material = await readFile(file(settings.material));
const materialInfo = await sharp(material).metadata();
if (materialInfo.hasAlpha) throw new Error('Cursor material must be opaque to preserve the exact silhouette.');
const pattern = `<defs><pattern id="h4-r09-material" width="1" height="1" patternContentUnits="objectBoundingBox"><image width="1" height="1" preserveAspectRatio="none" href="data:image/png;base64,${material.toString('base64')}"/></pattern></defs>`;

// Reuse both original paths verbatim, including the white stroke and evenodd
// cutouts. No generation, vector simplification or new cursor shape occurs.
for (const state of ['base', 'hover', 'pressed']) {
  const original = await readFile(file(settings.cursor.normal[state]), 'utf8');
  if ((original.match(/fill="#000000"/g) || []).length !== 1) throw new Error('Expected one original black fill.');
  const colored = original.replace('</title>', `</title>${pattern}`)
    .replace('h4ngelic black cursor with white outline', 'h4ngelic distressed cursor with original white outline')
    .replace('fill="#000000"', 'fill="url(#h4-r09-material)"');
  await writeFile(file(settings.cursor.other[state]), colored);
}

const other = await readFile(file(settings.cursor.other.base), 'utf8');
await writeFile(file(settings.favicon.other.svg), other);
for (const mode of ['normal', 'other']) {
  const svg = await readFile(file(settings.favicon[mode].svg));
  for (const size of [16, 32]) {
    const result = await sharp(svg, { density: 288 }).resize(size, size, {
      fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png({ compressionLevel: 9 }).toFile(file(settings.favicon[mode][size]).pathname);
    console.log(`${settings.favicon[mode][size]}: ${result.width}×${result.height}, ${result.size} bytes`);
  }
}
