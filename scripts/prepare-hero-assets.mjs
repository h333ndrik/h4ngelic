import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const original = await readFile(new URL('public/assets/tattoo-original.svg', root), 'utf8');
const embedded = original.match(/href="data:image\/png;base64,([^"]+)"/);
if (!embedded) throw new Error('Expected the original embedded PNG in the supplied artwork SVG.');
const result = await sharp(Buffer.from(embedded[1], 'base64')).rotate().resize({ width: 640, withoutEnlargement: true })
  .webp({ quality: 82, effort: 5 }).toFile(new URL('public/assets/tattoo-texture-640.webp', root).pathname);
console.log(`Compact reflection texture: ${result.width}×${result.height}, ${result.size} bytes. Original SVG unchanged.`);
