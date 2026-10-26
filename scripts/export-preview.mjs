import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, sep } from 'node:path';
import { build } from 'vite';
import { artworks } from '../src/data/artworks.js';
import { siteContent } from '../src/data/siteContent.js';
import { corruptionSettings } from '../src/data/corruptionSettings.js';
import { modeIconSettings } from '../src/data/modeIconSettings.js';
import { livingDecayMaterialAssets } from '../src/data/livingDecaySettings.js';
import imageManifest from '../src/data/imageManifest.json' with { type: 'json' };

const root = new URL('../', import.meta.url);
// The website keeps Three.js in a homepage-only chunk. Only the downloadable
// preview combines it into one script, allowing genuinely offline navigation.
const previewBuild = new URL('artifacts/.preview-build/', root);
await build({
  root: fileURLToPath(root),
  build: {
    outDir: fileURLToPath(previewBuild),
    emptyOutDir: true,
    copyPublicDir: false,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
let html = (await readFile(new URL('index.html', previewBuild), 'utf8'))
  .replace('<html lang="en">', '<html lang="en" data-preview="standalone">');
const dataURL = async (file, type) => `data:${type};base64,${(await readFile(new URL(file, root))).toString('base64')}`;
const assets = new Map([
  ['/fonts/wordmark.typeface.json', await dataURL('public/fonts/wordmark.typeface.json', 'application/json')],
  ['/assets/tattoo-texture.webp', await dataURL('public/assets/tattoo-texture.webp', 'image/webp')],
  ['/assets/tattoo-texture-640.webp', await dataURL('public/assets/tattoo-texture-640.webp', 'image/webp')],
  ['/assets/h4ngelic-cursor.svg', await dataURL('public/assets/h4ngelic-cursor.svg', 'image/svg+xml')],
  ['/assets/h4-monogram.svg', await dataURL('public/assets/h4-monogram.svg', 'image/svg+xml')],
  ['/assets/h4ngelic-cursor-hover.svg', await dataURL('public/assets/h4ngelic-cursor-hover.svg', 'image/svg+xml')],
  ['/assets/h4ngelic-cursor-pressed.svg', await dataURL('public/assets/h4ngelic-cursor-pressed.svg', 'image/svg+xml')],
  ['/assets/wordmark-fallback.svg', await dataURL('public/assets/wordmark-fallback.svg', 'image/svg+xml')],
  ['/assets/xray-distress.webp', await dataURL('public/assets/xray-distress.webp', 'image/webp')],
  [corruptionSettings.assets.desktop, await dataURL(`public${corruptionSettings.assets.desktop}`, 'image/webp')],
  [corruptionSettings.assets.mobile, await dataURL(`public${corruptionSettings.assets.mobile}`, 'image/webp')],
  [livingDecayMaterialAssets.desktop, await dataURL(`public${livingDecayMaterialAssets.desktop}`, 'image/webp')],
  [livingDecayMaterialAssets.mobile, await dataURL(`public${livingDecayMaterialAssets.mobile}`, 'image/webp')],
]);
for (const path of new Set([
  ...Object.values(modeIconSettings.cursor.other),
  ...Object.values(modeIconSettings.favicon.normal),
  ...Object.values(modeIconSettings.favicon.other),
])) {
  assets.set(path, await dataURL(`public${path}`, path.endsWith('.svg') ? 'image/svg+xml' : 'image/png'));
}
const defaultPaths = new Set(assets.keys());
const portfolioAssets = new Map();
const portfolioImages = artworks.filter((project) => project.published !== false)
  .flatMap((project) => project.images || []).flatMap((image) => [image.src, image.fullSrc]);
if (siteContent.about.portrait?.src) portfolioImages.push(siteContent.about.portrait.src);
for (const asset of Object.values(imageManifest)) {
  for (const variant of asset.variants || []) portfolioImages.push(variant.src);
}
const publicDirectory = await realpath(new URL('public/', root));
const imageTypes = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.gif': 'image/gif' };
for (const imagePath of new Set(portfolioImages)) {
  if (typeof imagePath !== 'string' || !/^\/(?!\/)/.test(imagePath)) continue;
  const relativePath = decodeURIComponent(new URL(imagePath, 'https://preview.invalid').pathname);
  const localFile = await realpath(new URL(`public${relativePath}`, root));
  if (!localFile.startsWith(`${publicDirectory}${sep}`)) throw new Error(`Preview image must stay inside public/: ${imagePath}`);
  const type = imageTypes[extname(localFile).toLowerCase()];
  if (!type) throw new Error(`Unsupported preview image format: ${imagePath}`);
  const inline = `data:${type};base64,${(await readFile(localFile)).toString('base64')}`;
  assets.set(imagePath, inline);
  portfolioAssets.set(imagePath, inline);
}
const embed = (text, { script = false } = {}) => {
  for (const [path, inline] of [...assets].sort(([a], [b]) => b.length - a.length)) {
    if (script && portfolioAssets.has(path) && !defaultPaths.has(path)) continue;
    text = text.replaceAll(path, inline);
  }
  return text;
};
const scriptPath = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/)?.[1];
const stylePath = html.match(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/)?.[1];
if (!scriptPath || !stylePath) throw new Error('Expected one Vite JS and CSS output.');
const javascript = embed(await readFile(new URL(scriptPath.slice(1), previewBuild), 'utf8'), { script: true });
const css = embed(await readFile(new URL(stylePath.slice(1), previewBuild), 'utf8'));
// Embed document before inserting JS, preserving logical portfolio paths.
html = embed(html);
const previewImages = JSON.stringify(Object.fromEntries(portfolioAssets)).replaceAll('<', '\\u003c');
html = html.replace('</head>', `<script>globalThis.__H4_PREVIEW_IMAGES__=${previewImages};</script></head>`);
html = html.replace(/<script\b[^>]*src="[^"]+"[^>]*><\/script>/, () => `<script type="module">${javascript.replaceAll('</script', '<\\/script')}</script>`);
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`);
await mkdir(new URL('artifacts/', root), { recursive: true });
const output = new URL('artifacts/h4ngelic-preview.html', root);
await writeFile(output, html);
console.log(`Exported self-contained interactive preview: ${output.pathname}`);
