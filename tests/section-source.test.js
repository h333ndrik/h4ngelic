import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { renderWorkPage } from '../src/pages.js';
import { siteContent } from '../src/data/siteContent.js';

// B-F31 gate: the section list in src/data/siteContent.js is the only source.
// For every rubric the rendered section ids must match that list in set AND
// order, every section id literal may exist only in the data file, and the
// rubric-primary id must be built in exactly one place.

/** The id a section gets in the DOM: the rubric's own section keeps the
 * historical `finished-<rubric>` id, everything else uses its own id. */
const expectedIds = group => group.children
  .filter(id => id !== 'tools')
  .map(id => id === group.id ? `finished-${id}` : id);

const renderedSections = html => [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"[^>]*\bdata-archive-category="([^"]+)"/g)]
  .map(match => match[1]);

async function sourceFiles() {
  const root = new URL('../src/', import.meta.url);
  const files = [];
  const walk = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
      if (entry.isDirectory()) await walk(url);
      else if (entry.name.endsWith('.js')) files.push(url);
    }
  };
  await walk(root);
  return files;
}

test('every rubric renders exactly the sections of the data list, in order', () => {
  for (const group of siteContent.workGroups) {
    if (group.id === 'tools') continue; // the tools rubric is its own card section
    const rendered = renderedSections(renderWorkPage(group.id));
    assert.deepEqual(rendered, expectedIds(group), `${group.id} sections`);
  }
  // Tools renders one work-group section with the rubric id and no archive children.
  const tools = renderWorkPage('tools');
  assert.deepEqual(renderedSections(tools), []);
  assert.match(tools, /<section class="work-group[^"]*" id="tools"/);
});

test('the mannequin section lives in the data list, not in the markup', () => {
  const model = siteContent.categories.find(entry => entry.id === 'model-3d');
  assert.ok(model, 'model-3d is a section entry');
  assert.equal(model.presentation, 'model');
  assert.equal(model.route, false, 'the 3d model section owns no route');
  assert.ok(siteContent.workGroups.find(group => group.id === 'tattoos').children.includes('model-3d'));
  assert.equal(siteContent.categories.filter(entry => entry.presentation === 'model').length, 1);
});

test('no section id is hard-coded as a DOM id outside the data list', async () => {
  // A section id may legitimately appear as an artwork category value (flashes,
  // digital-artworks). What must not exist a second time is the DOM id itself.
  const files = await sourceFiles();
  const ids = [...new Set(siteContent.workGroups.flatMap(group => group.children))];
  for (const id of ids) {
    const hits = [];
    for (const file of files) {
      if (file.pathname.endsWith('/src/data/siteContent.js')) continue;
      const text = await readFile(file, 'utf8');
      if (new RegExp(`id="${id}"`).test(text)) hits.push(file.pathname.split('/src/')[1]);
    }
    assert.deepEqual(hits, [], `section id ${id} is hard-coded as a DOM id outside the data list`);
  }
});

test('the mannequin section id exists only once in the whole source tree', async () => {
  // model-3d is neither a rubric nor an artwork category, so the only legal
  // location for the literal is the section list.
  const files = await sourceFiles();
  const hits = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    if (/['"`]model-3d['"`]/.test(text)) hits.push(file.pathname.split('/src/')[1]);
  }
  assert.deepEqual(hits, ['data/siteContent.js']);
});

test('the rubric-primary id is built in exactly one place', async () => {
  const files = await sourceFiles();
  const builders = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const count = (text.match(/finished-\$\{/g) || []).length;
    if (count) builders.push({ file: file.pathname.split('/src/')[1], count });
  }
  assert.deepEqual(builders, [{ file: 'pages.js', count: 1 }], 'one builder, no literal duplicate');
  const pages = await readFile(new URL('../src/pages.js', import.meta.url), 'utf8');
  assert.equal((pages.match(/finished-tattoos/g) || []).length, 0, 'no hard-coded primary id left in pages.js');
});
