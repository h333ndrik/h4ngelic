import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
let html = await readFile(new URL('dist/index.html', root), 'utf8');
const dataURL = async (file, type) => `data:${type};base64,${(await readFile(new URL(file, root))).toString('base64')}`;
const assets = new Map([
  ['/fonts/wordmark.typeface.json', await dataURL('public/fonts/wordmark.typeface.json', 'application/json')],
  ['/fonts/LiberationSans-Bold.ttf', await dataURL('public/fonts/LiberationSans-Bold.ttf', 'font/ttf')],
  ['/assets/tattoo-texture.webp', await dataURL('public/assets/tattoo-texture.webp', 'image/webp')],
  ['/assets/h4ngelic-cursor.svg', await dataURL('public/assets/h4ngelic-cursor.svg', 'image/svg+xml')],
]);
const embed = (text) => {
  for (const [path, inline] of assets) text = text.replaceAll(path, inline);
  return text;
};
const scriptPath = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/)?.[1];
const stylePath = html.match(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/)?.[1];
if (!scriptPath || !stylePath) throw new Error('Expected one Vite JS and CSS output.');
const javascript = embed(await readFile(new URL(`dist${scriptPath}`, root), 'utf8'));
const css = embed(await readFile(new URL(`dist${stylePath}`, root), 'utf8'));
html = html.replace(/<script\b[^>]*src="[^"]+"[^>]*><\/script>/, () => `<script type="module">${javascript.replaceAll('</script', '<\\/script')}</script>`);
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`);
html = embed(html);
await mkdir(new URL('artifacts/', root), { recursive: true });
const output = new URL('artifacts/h4ngelic-preview.html', root);
await writeFile(output, html);
console.log(`Exported self-contained interactive preview: ${output.pathname}`);
