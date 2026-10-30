import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import { privateAudioPlugin, privateAudioFilename, privateAudioPath } from '../scripts/private-audio-plugin.mjs';

test('private soundtrack route exists only in development, with the exact local filename and no eager request', async () => {
  const root = await mkdtemp(join(tmpdir(), 'h4-private-audio-'));
  const plugin = privateAudioPlugin();
  plugin.configResolved({ root });
  assert.equal(plugin.apply, 'serve');
  assert.deepEqual(plugin.config({ server: { fs: { deny: ['existing-private-file'] } } }).server.fs.deny, ['existing-private-file', '**/private/audio/**']);
  assert.deepEqual(plugin.transformIndexHtml(), [], 'Missing approved asset exposes no URL or substitute.');
  await mkdir(join(root, 'private', 'audio'), { recursive: true });
  await writeFile(join(root, 'private', 'audio', 'another-file.mp3'), 'fixture, not audio');
  assert.deepEqual(plugin.transformIndexHtml(), [], 'A differently named track is not accepted.');
  const fixture = Buffer.from('private HTTP fixture; never portfolio or music content');
  await writeFile(join(root, 'private', 'audio', privateAudioFilename), fixture);
  const tags = plugin.transformIndexHtml();
  assert.equal(tags.length, 1);
  assert.match(tags[0].children, /__H4_PRIVATE_SMASH_URL__/);
  assert.ok(!tags[0].children.includes('base64'), 'The track is not inlined into HTML.');
  let middleware;
  plugin.configureServer({ middlewares: { use(callback) { middleware = callback; } } });
  const server = createServer((request, response) => middleware(request, response, () => { response.writeHead(404); response.end(); }));
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${base}${privateAudioPath}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), fixture);
    const wrong = await fetch(`${base}/private/audio/${privateAudioFilename}`);
    assert.equal(wrong.status, 403);
    const head = await fetch(`${base}${privateAudioPath}`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    let status;
    middleware({ url: privateAudioPath, socket: { remoteAddress: '203.0.113.2' }, method: 'GET' }, { writeHead(value) { status = value; }, end() {} }, () => assert.fail('private route cannot fall through'));
    assert.equal(status, 403, 'Non-loopback clients cannot stream the copyrighted local track.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test('Vite raw/root/@fs file paths cannot bypass the private soundtrack route', async () => {
  const root = await mkdtemp(join(tmpdir(), 'h4-private-vite-'));
  await mkdir(join(root, 'private', 'audio'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<!doctype html><title>private fixture</title>');
  await writeFile(join(root, 'private', 'audio', privateAudioFilename), 'private test bytes');
  const server = await createViteServer({ root, configFile: false, logLevel: 'silent', plugins: [privateAudioPlugin()], server: { host: '127.0.0.1', port: 0, watch: null } });
  try {
    await server.listen();
    const base = server.resolvedUrls.local[0];
    for (const path of [`private/audio/${privateAudioFilename}`, `%70rivate/audio/${privateAudioFilename}?raw`, `@fs${root}/private/audio/${privateAudioFilename}`, `@fs${root}/%70rivate/audio/${privateAudioFilename}?url`]) {
      const response = await fetch(new URL(path, base));
      assert.equal(response.status, 403, `Denied Vite bypass: ${path}`);
    }
    assert.equal((await fetch(new URL(privateAudioPath, base))).status, 200);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
