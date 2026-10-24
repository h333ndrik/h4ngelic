import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, sep } from 'node:path';
import { build } from 'vite';
import { artworks } from '../src/data/artworks.js';
import { siteContent } from '../src/data/siteContent.js';
import { corruptionSettings } from '../src/data/corruptionSettings.js';
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
  ['/assets/h4ngelic-cursor-hover.svg', await dataURL('public/assets/h4ngelic-cursor-hover.svg', 'image/svg+xml')],
  ['/assets/h4ngelic-cursor-pressed.svg', await dataURL('public/assets/h4ngelic-cursor-pressed.svg', 'image/svg+xml')],
  ['/assets/wordmark-fallback.svg', await dataURL('public/assets/wordmark-fallback.svg', 'image/svg+xml')],
  ['/assets/xray-distress.webp', await dataURL('public/assets/xray-distress.webp', 'image/webp')],
  [corruptionSettings.assets.desktop, await dataURL(`public${corruptionSettings.assets.desktop}`, 'image/webp')],
  [corruptionSettings.assets.mobile, await dataURL(`public${corruptionSettings.assets.mobile}`, 'image/webp')],
]);
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
  assets.set(imagePath, `data:${type};base64,${(await readFile(localFile)).toString('base64')}`);
}
const embed = (text) => {
  for (const [path, inline] of [...assets].sort(([a], [b]) => b.length - a.length)) text = text.replaceAll(path, inline);
  return text;
};
const scriptPath = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/)?.[1];
const stylePath = html.match(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/)?.[1];
if (!scriptPath || !stylePath) throw new Error('Expected one Vite JS and CSS output.');
const javascript = embed(await readFile(new URL(scriptPath.slice(1), previewBuild), 'utf8'));
const css = embed(await readFile(new URL(stylePath.slice(1), previewBuild), 'utf8'));
html = html.replace(/<script\b[^>]*src="[^"]+"[^>]*><\/script>/, () => `<script type="module">${javascript.replaceAll('</script', '<\\/script')}</script>`);
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`);
html = embed(html);
await mkdir(new URL('artifacts/', root), { recursive: true });
const output = new URL('artifacts/h4ngelic-preview.html', root);
await writeFile(output, html);
console.log(`Exported self-contained interactive preview: ${output.pathname}`);
