import { readFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// Pre-render the editable procedural SVG once, instead of evaluating turbulence
// and displacement filters while compositing every animated WebGL frame.
const source = new URL('./assets/xray-distress.svg', import.meta.url);
const destination = new URL('../public/assets/xray-distress.webp', import.meta.url);
await mkdir(new URL('.', destination), { recursive: true });
const info = await sharp(await readFile(source)).resize(450, 550)
  .flatten({ background: '#25142f' }).webp({ quality: 55, effort: 6 }).toFile(destination.pathname);
console.log(`Prepared static X-Ray texture: ${info.width}×${info.height}, ${info.size} bytes.`);
