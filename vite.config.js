import { defineConfig } from 'vite';
import { resolveRoute, publishedProjects } from './src/routes.js';
import { renderRoutePage } from './src/pages.js';
import { getPageMetadata, renderHead, seoEnvironment } from './src/seo.js';
import { buildRobots, buildSitemap } from './scripts/prerender.mjs';
import { flashMannequinConfig } from './src/flash-mannequin-content.js';
import { createInquiryHandler } from './server/inquiry.mjs';
import { heroPosterSettings } from './src/data/heroPosterSettings.js';
import { applyBuildMarker, buildSha, shouldLogBuild } from './scripts/build-marker.mjs';

const config = seoEnvironment(process.env);

export default defineConfig({
  define: {
    __H4_SEO_CONFIG__: JSON.stringify(config),
    // An absent optional model must not enlarge the hero's shared Three chunk.
    // Publishing a validated Flash placement enables this on the next build.
    __H4_HAS_MANNEQUINS__: JSON.stringify(publishedProjects().some(project => Boolean(flashMannequinConfig(project)))),
    __H4_BUILD_SHA__: JSON.stringify(buildSha),
    __H4_BUILD_LOG__: JSON.stringify(shouldLogBuild(process.env)),
  },
  plugins: [{
    name: 'h4ngelic-build-marker',
    enforce: 'pre',
    transformIndexHtml(html) {
      return applyBuildMarker(html, buildSha);
    },
  }, {
    name: 'h4ngelic-hero-poster',
    transformIndexHtml(html, context) {
      const path = context.path?.split('?')[0] || '/';
      if (path !== '/' && path !== '/index.html') html = html.replace(/\s*<link rel="preload" href="\/assets\/wordmark-fallback\.svg"[^>]*data-hero-poster-preload[^>]*>/,'');
      return html
        .replaceAll('__H4_HERO_POSTER_URL__', heroPosterSettings.src)
        .replaceAll('__H4_HERO_POSTER_FADE_MS__', String(heroPosterSettings.fadeDurationMs))
        .replaceAll('__H4_HERO_ARTWORK_DESKTOP__', heroPosterSettings.artwork.desktop)
        .replaceAll('__H4_HERO_ARTWORK_MOBILE__', heroPosterSettings.artwork.mobile)
        .replace(/href="\/{0,2}(assets\/tattoo-texture[^"]*)"/g, 'href="/$1"');
    },
  }, {
    // Vite copies a modulepreload href that points at /src as a raw asset.
    // Point the Home template at the real emitted hero chunk instead, and drop
    // the duplicate raw copy so the preload cannot execute stale source.
    name: 'h4ngelic-hero-module-preload',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') return;
      const heroChunk = Object.values(bundle).find(item => item.type === 'chunk'
        && item.facadeModuleId?.replaceAll('\\', '/').endsWith('/src/main.js'));
      if (!heroChunk?.fileName) return;
      let rawFileName = '';
      const source = String(html.source).replace(
        /(<link rel="modulepreload" href=")([^"]+)(" data-hero-preload="module")/,
        (_, before, href, after) => {
          rawFileName = href.replace(/^\//, '');
          return `${before}/${heroChunk.fileName}${after}`;
        },
      );
      html.source = source;
      if (!rawFileName) return;
      for (const [key, item] of Object.entries(bundle)) {
        if (item.type === 'asset' && item.fileName === rawFileName) delete bundle[key];
      }
    },
  }, {
    name: 'h4ngelic-document-routes',
    configureServer(server) {
      const inquiry = createInquiryHandler();
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url, 'http://dev.invalid');
        if (url.pathname === '/api/inquiry') { void inquiry(request, response); return; }
        if (url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml') {
          response.setHeader('Content-Type', url.pathname.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8');
          response.end(url.pathname.endsWith('.xml') ? buildSitemap([]) : buildRobots({ deployment: 'preview' })); return;
        }
        // Source, Vite internals, public files and image requests are handled by Vite.
        if (/^\/(?:@|src\/|node_modules\/|assets\/|fonts\/|images\/)/.test(url.pathname)
          || (url.pathname !== '/index.html' && /\.[^/]+$/.test(url.pathname))) { next(); return; }
        const route = resolveRoute(url);
        if (route.redirectPath) { response.writeHead(301, { Location: route.redirectPath }); response.end(); return; }
        if (route.kind === 'not-found') {
          response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, follow' });
          response.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">${renderHead(getPageMetadata(route, config))}<link rel="stylesheet" href="/src/style.css"></head><body><main id="page-content">${renderRoutePage(route)}</main></body></html>`); return;
        }
        response.setHeader('X-Robots-Tag', 'noindex, follow');
        next();
      });
    },
  }],
});
