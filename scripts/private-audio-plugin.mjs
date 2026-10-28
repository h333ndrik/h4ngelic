import { createReadStream, statSync } from 'node:fs';
import { join } from 'node:path';
import { posix } from 'node:path';

export const privateAudioFilename = 'h4ngelic_v8_full_sound_remaster_v11.mp3';
export const privateAudioPath = '/__h4_private_audio/smash';

/** Deliberately serve-only. The approved soundtrack is never imported into the
 * application graph, copied to public/dist or embedded in the HTML export. */
export function privateAudioPlugin() {
  let root = process.cwd();
  const filename = () => join(root, 'private', 'audio', privateAudioFilename);
  const exists = () => { try { return statSync(filename()).isFile() && statSync(filename()).size > 0; } catch { return false; } };
  return {
    name: 'h4ngelic-private-local-audio',
    apply: 'serve',
    config(config) {
      // Preserve Vite 8's default secret-file denials when adding our own.
      const deny = config.server?.fs?.deny || ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**'];
      return { server: { fs: { deny: [...deny, '**/private/audio/**'] } } };
    },
    configResolved(config) { root = config.root; },
    transformIndexHtml() {
      if (!exists()) return [];
      return [{ tag: 'script', children: `globalThis.__H4_PRIVATE_SMASH_URL__=${JSON.stringify(privateAudioPath)};`, injectTo: 'head' }];
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url, 'http://localhost');
        let path = url.pathname;
        try { for (let index = 0; index < 3 && /%[0-9a-f]{2}/i.test(path); index++) path = decodeURIComponent(path); } catch { /* Invalid escapes cannot name the asset. */ }
        path = posix.normalize(path.replaceAll('\\', '/'));
        // Vite normally exposes root files and /@fs absolute files. Never allow
        // either path (including encoded spellings) to bypass the private route.
        if (/(?:^|\/)private\/audio(?:\/|$)/i.test(path)) { response.writeHead(403); response.end(); return; }
        if (url.pathname !== privateAudioPath) { next(); return; }
        // Even a development server bound to 0.0.0.0 may only stream this local
        // copyrighted file to loopback clients. There is no production route.
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket?.remoteAddress)) {
          response.writeHead(403); response.end(); return;
        }
        if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
        if (!exists()) { response.writeHead(404); response.end(); return; }
        const { size } = statSync(filename());
        response.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': size, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
        if (request.method === 'HEAD') { response.end(); return; }
        const stream = createReadStream(filename());
        stream.on('error', () => response.destroy());
        response.on('close', () => stream.destroy());
        stream.pipe(response);
      });
    },
  };
}
