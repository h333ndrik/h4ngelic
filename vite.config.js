import { defineConfig } from 'vite';
import { resolveRoute, publishedProjects } from './src/routes.js';
import { renderRoutePage } from './src/pages.js';
import { getPageMetadata, renderHead, seoEnvironment } from './src/seo.js';
import { buildRobots, buildSitemap } from './scripts/prerender.mjs';
import { flashMannequinConfig } from './src/flash-mannequin-content.js';

const config = seoEnvironment(process.env);

export default defineConfig({
  define: {
    __H4_SEO_CONFIG__: JSON.stringify(config),
    // An absent optional model must not enlarge the hero's shared Three chunk.
    // Publishing a validated Flash placement enables this on the next build.
    __H4_HAS_MANNEQUINS__: JSON.stringify(publishedProjects().some(project => Boolean(flashMannequinConfig(project)))),
  },
  plugins: [{
    name: 'h4ngelic-document-routes',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url, 'http://dev.invalid');
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
