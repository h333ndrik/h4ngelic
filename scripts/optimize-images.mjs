import sharp from 'sharp';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { artworks } from '../src/data/artworks.js';
import { siteContent } from '../src/data/siteContent.js';

export async function optimizeImages({ root = new URL('../', import.meta.url), projects = artworks, portrait = siteContent.about.portrait } = {}) {
  const publicRoot = await realpath(new URL('public/', root));
  const output = new URL('public/images/optimized/', root);
  const sources = projects.filter((project) => project.published !== false)
    .flatMap((project) => project.images || []).flatMap((image) => [image.src, image.fullSrc]);
  if (portrait?.src) sources.push(portrait.src);
  const manifest = {};
  const widths = [320, 640, 960, 1440, 1920];
  for (const source of new Set(sources)) {
    if (typeof source !== 'string' || !/^\/(?!\/)/.test(source)) continue;
    const pathname = decodeURIComponent(new URL(source, 'https://local.invalid').pathname);
    const path = await realpath(new URL(`public${pathname}`, root));
    if (!path.startsWith(`${publicRoot}${sep}`)) throw new Error(`Image must be inside public/: ${source}`);
    const bytes = await readFile(path);
    const metadata = await sharp(bytes).metadata();
    if ((metadata.pages || 1) > 1) throw new Error(`Animated images need a separate static portfolio export: ${source}`);
    // Use display dimensions after EXIF rotation so the browser reserves the
    // correct space before images decode. Original files are never overwritten.
    const rotated = [5, 6, 7, 8].includes(metadata.orientation);
    const width = rotated ? metadata.height : metadata.width;
    const height = rotated ? metadata.width : metadata.height;
    if (!width || !height) throw new Error(`Cannot determine image dimensions: ${source}`);
    const hash = createHash('sha256').update(bytes).update('webp-q82-v1').digest('hex').slice(0, 12);
    const name = basename(path, extname(path)).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const targets = [...new Set(widths.map((target) => Math.min(target, width)))];
    const variants = [];
    await mkdir(output, { recursive: true });
    for (const target of targets) {
      const filename = `${name}-${hash}-${target}.webp`;
      const result = await sharp(bytes).rotate().resize({ width: target, withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 }).toFile(new URL(filename, output).pathname);
      variants.push({ src: `/images/optimized/${filename}`, width: result.width, height: result.height });
    }
    manifest[source] = { width, height, variants };
    console.log(`${source}: ${width}×${height} → ${variants.map((variant) => variant.width).join(', ')}px WebP`);
  }
  await writeFile(new URL('src/data/imageManifest.json', root), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Prepared ${Object.keys(manifest).length} local portfolio/portrait images. Originals preserved.`);
  return manifest;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await optimizeImages();
