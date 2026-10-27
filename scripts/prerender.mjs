import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { routeDefinitions, resolveRoute } from '../src/routes.js';
import { renderRoutePage } from '../src/pages.js';
import { getPageMetadata, renderHead, seoEnvironment } from '../src/seo.js';
import { escapeHTML } from '../src/content-utils.js';
import { renderNAAVI } from '../src/naavi-content.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

function replaceBlock(html, name, replacement) {
  const pattern = new RegExp(`<!--${name}:start-->[\\s\\S]*?<!--${name}:end-->`, 'g');
  const matches = [...html.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`Expected exactly one ${name} marker pair in built index.html.`);
  return html.replace(pattern, () => `<!--${name}:start-->${replacement}<!--${name}:end-->`);
}

/** Preserve the original hero, with no active hero DOM or asset requests on other pages. */
export function prerenderHTML(shell, route, metadata = getPageMetadata(route)) {
  const hero = shell.match(/<!--hero:start-->([\s\S]*?)<!--hero:end-->/)?.[1];
  if (!hero) throw new Error('Built index.html is missing its hero markers.');
  const heroMarkup = route.kind === 'home'
    ? hero.replace(/(<section\b[^>]*?)\s+hidden(?=[\s>])/i, '$1')
    : `<template id="hero-template">${hero}</template>`;
  let html = replaceBlock(shell, 'hero', heroMarkup);
  html = replaceBlock(html, 'content', `<div id="page-content" tabindex="-1" data-prerendered="${escapeHTML(route.canonicalPath)}">${renderRoutePage(route)}</div>`);
  if (html.includes('<!--naavi:start-->')) html = replaceBlock(html, 'naavi', renderNAAVI(route));
  html = replaceBlock(html, 'seo', `\n${renderHead(metadata)}\n`);
  // Navigation visibility is correct before hydration and without JavaScript.
  // The source shell defaults to Home for the downloadable preview.
  html = html.replace(/<html\b([^>]*)>/i, (_, attributes) =>
    `<html${attributes.replace(/\sdata-page=(?:"[^"]*"|'[^']*')/i, '')} data-page="${escapeHTML(route.kind)}">`);
  return html;
}

export function buildSitemap(metadata) {
  const urls = metadata.filter((page) => page.indexable && page.canonicalURL)
    .map((page) => `  <url><loc>${escapeHTML(page.canonicalURL)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}${urls ? '\n' : ''}</urlset>\n`;
}

export function buildRobots(config, existing = '') {
  if (config.deployment !== 'production' || !config.indexing) return 'User-agent: *\nDisallow: /\n';
  // Do not replace an established crawler/training policy with new permissions.
  if (existing.trim()) return existing;
  return `# No crawler-specific access rules are introduced by this build.\n# Search and training crawler policy is documented in docs/SEO.md.\nSitemap: ${config.productionURL}/sitemap.xml\n`;
}

function routeFile(root, path) {
  if (!/^\/(?:[a-z0-9-]+\/)*[a-z0-9-]*$/.test(path)) throw new Error(`Unsafe prerender route: ${path}`);
  return resolve(root, `.${path}`, 'index.html');
}

export async function prerender({ outDir = resolve(projectRoot, 'dist'), config = seoEnvironment(process.env) } = {}) {
  const root = resolve(outDir);
  const shell = await readFile(resolve(root, 'index.html'), 'utf8');
  const routes = routeDefinitions();
  const pages = [];
  for (const route of routes) {
    const metadata = getPageMetadata(route, config);
    const destination = routeFile(root, route.canonicalPath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, prerenderHTML(shell, route, metadata));
    pages.push(metadata);
  }
  const missing = resolveRoute('/404');
  await writeFile(resolve(root, '404.html'), prerenderHTML(shell, missing, getPageMetadata(missing, config)));
  const existing = await readFile(resolve(projectRoot, 'public/robots.txt'), 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  const manifest = {
    version: 1, deployment: config.deployment, productionURL: config.productionURL,
    routes: pages.map(({ path, status, indexable, robots, canonicalURL }) => ({ path, status, indexable, robots, canonicalURL })),
  };
  await Promise.all([
    writeFile(resolve(root, 'sitemap.xml'), buildSitemap(pages)),
    writeFile(resolve(root, 'robots.txt'), buildRobots(config, existing)),
    writeFile(resolve(root, 'route-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
  ]);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { 'out-dir': { type: 'string', default: resolve(projectRoot, 'dist') } } });
  const manifest = await prerender({ outDir: values['out-dir'] });
  console.log(`Prerendered ${manifest.routes.length} routes + 404 (${manifest.deployment}; ${manifest.routes.filter((route) => route.indexable).length} indexable).`);
}
