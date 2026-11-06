import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { creativeLandingURL, categoryURL } from '../src/routes.js';
import { siteContent } from '../src/data/siteContent.js';

// B-F28: one route constant, derived from the section data, used by the INDEX
// shell. No hard-coded destination in the markup.
test('the creative landing constant is the first section of the first rubric', () => {
  assert.equal(creativeLandingURL, '/creative/tattoos');
  assert.equal(creativeLandingURL, categoryURL(siteContent.workGroups[0].children[0]));
});

test('index.html renders the shared token for the creative entry', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/__H4_CREATIVE_URL__/g) || []).length, 1, 'INDEX renders the shared token.');
  assert.match(html, /<a href="__H4_CREATIVE_URL__" data-index-page="creative">/);
});
