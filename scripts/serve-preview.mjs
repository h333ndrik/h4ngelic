import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { resolveRoute } from '../src/routes.js';
import { createInquiryHandler } from '../server/inquiry.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.hdr': 'application/octet-stream',
  '.mp3': 'audio/mpeg',
};

/** Serve the output as real documents, with strict route status and cached gzip. */
export async function createPreviewServer({ root = resolve(projectRoot, 'dist'), inquiryHandler = createInquiryHandler() } = {}) {
  const directory = await realpath(resolve(root));
  const manifest = JSON.parse(await readFile(resolve(directory, 'route-manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.routes)) throw new Error('Rebuild first: invalid route-manifest.json.');
  const routes = new Map(manifest.routes.map((route) => [route.path, route]));
  const cache = new Map();
  async function file(path) {
    const candidate = resolve(directory, `.${path}`);
    if (candidate !== directory && !candidate.startsWith(`${directory}${sep}`)) return null;
    let location;
    try {
      location = await realpath(candidate);
      if (location !== directory && !location.startsWith(`${directory}${sep}`)) return null;
      if (!(await stat(location)).isFile()) return null;
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code)) return null;
      throw error;
    }
    if (!cache.has(location)) {
      const bytes = await readFile(location);
      const extension = extname(location);
      cache.set(location, {
        bytes, type: mimeTypes[extension] || 'application/octet-stream',
        gzip: /\.(html|js|css|json|xml|txt|svg)$/.test(extension) && bytes.length > 1024 ? gzipSync(bytes) : null,
      });
    }
    return cache.get(location);
  }
  return createServer(async (request, response) => {
    try {
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Cache-Control', 'no-cache');
      if (new URL(request.url, 'http://preview.invalid').pathname === '/api/inquiry') {
        await inquiryHandler(request, response); return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' }); response.end('Method not allowed'); return;
      }
      let url;
      let path;
      try {
        url = new URL(request.url, 'http://preview.invalid');
        path = decodeURIComponent(url.pathname);
        if (/[\u0000-\u001f\u007f\\]/.test(path)) throw new Error('Invalid path');
      } catch {
        response.writeHead(400); response.end('Invalid URL'); return;
      }
      // Static document filenames are aliases, never duplicate canonical pages.
      if (path.endsWith('/index.html')) {
        const canonicalPath = path.slice(0, -'/index.html'.length) || '/';
        if (routes.has(canonicalPath)) {
          response.writeHead(301, { Location: canonicalPath, 'X-Robots-Tag': routes.get(canonicalPath).robots });
          response.end(); return;
        }
      }
      const route = resolveRoute(url);
      // Redirect only actual published routes; unknown URLs retain a real 404.
      if (route.redirectPath && routes.has(route.canonicalPath)) {
        response.writeHead(301, { Location: route.redirectPath, 'X-Robots-Tag': routes.get(route.canonicalPath).robots });
        response.end(); return;
      }
      const policy = routes.get(path);
      let resource = policy ? await file(path === '/' ? '/index.html' : `${path}/index.html`) : await file(path);
      let status = policy?.status || 200;
      if (!resource && !policy && (/\.[^/]+$/.test(path) || /^\/(?:assets|fonts|images)\//.test(path))) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, follow' });
        response.end(request.method === 'HEAD' ? undefined : 'File not found'); return;
      }
      if (!resource || path === '/404.html') {
        resource = await file('/404.html'); status = 404;
      }
      if (!resource) { response.writeHead(404); response.end('Page not found'); return; }
      if (resource.type.startsWith('text/html')) response.setHeader('X-Robots-Tag', status === 404 ? 'noindex, follow' : policy?.robots || 'noindex, follow');
      const acceptsGzip = (request.headers['accept-encoding'] || '').split(',').some((encoding) => {
        const [name, ...parameters] = encoding.trim().split(';');
        return name === 'gzip' && !parameters.some((parameter) => /^\s*q=0(?:\.0*)?\s*$/.test(parameter));
      });
      const compressed = Boolean(resource.gzip && acceptsGzip);
      const bytes = compressed ? resource.gzip : resource.bytes;
      response.setHeader('Content-Type', resource.type);
      response.setHeader('Content-Length', bytes.length);
      if (resource.gzip) response.setHeader('Vary', 'Accept-Encoding');
      if (compressed) response.setHeader('Content-Encoding', 'gzip');
      response.writeHead(status);
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      console.error(error);
      if (!response.headersSent) response.writeHead(500);
      response.end('Preview server error');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: {
    host: { type: 'string', default: '127.0.0.1' }, port: { type: 'string', default: '4173' },
    root: { type: 'string', default: resolve(projectRoot, 'dist') },
  } });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid preview port.');
  const server = await createPreviewServer({ root: values.root });
  server.listen(port, values.host, () => console.log(`Prerendered preview: http://${values.host}:${server.address().port}`));
}
