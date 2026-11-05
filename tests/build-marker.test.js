import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { applyBuildMarker, resolveBuildSha, shouldLogBuild } from '../scripts/build-marker.mjs';

test('the build marker is applied to html and mirrored in head metadata', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const sha = resolveBuildSha();
  const marked = applyBuildMarker(html, sha);
  assert.match(sha, /^[a-f0-9]{7,40}$/i);
  assert.match(marked, new RegExp(`<html[^>]*data-build="${sha}"`));
  assert.match(marked, new RegExp(`<meta name="h4-build" content="${sha}"\\s*/>`));
  assert.equal(applyBuildMarker('<html><head><meta charset="UTF-8" /></head></html>', '').match(/data-build="unknown"/)?.length, 1);
  assert.equal(shouldLogBuild({ VERCEL_ENV: 'production' }), false);
  assert.equal(shouldLogBuild({ VERCEL_ENV: 'preview' }), true);
  assert.equal(shouldLogBuild({}), true);
});
