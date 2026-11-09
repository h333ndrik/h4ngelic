import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { creativeLandingURL, categoryURL } from '../src/routes.js';
import { siteContent } from '../src/data/siteContent.js';

// B-F28/B-F30: one route constant, derived from the section data, used by the
// INDEX shell and the hero bar. No second literal anywhere in the markup.
test('the creative landing constant is the first section of the first rubric', () => {
  assert.equal(creativeLandingURL, '/creative/tattoos');
  assert.equal(creativeLandingURL, categoryURL(siteContent.workGroups[0].children[0]));
});

test('index.html renders the shared token twice and no literal creative href', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/__H4_CREATIVE_URL__/g) || []).length, 2, 'INDEX and hero bar share one token.');
  assert.doesNotMatch(html, /href="\/creative"/, 'No hard-coded creative destination left.');
  assert.match(html, /<a href="__H4_CREATIVE_URL__" data-index-page="creative">/);
  assert.match(html, /<nav class="hero-nav"[^>]*>\s*<a href="__H4_CREATIVE_URL__">creative/);
});
