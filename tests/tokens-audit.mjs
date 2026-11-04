import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('docs/validation/STRUCT/contracts/', root);
await mkdir(output, { recursive: true });

const cssFiles = [
  'src/ui-tokens.css', 'src/homepage.css', 'src/style.css', 'src/archive-structure.css',
  'src/gallery.css', 'src/easter-eggs.css', 'src/horizontal-drift.css', 'src/cursor.css',
];
const css = Object.fromEntries(await Promise.all(cssFiles.map(async path => [path, await readFile(new URL(path, root), 'utf8')])));
const indexHTML = await readFile(new URL('index.html', root), 'utf8');
const distHTML = await readFile(new URL('dist/index.html', root), 'utf8');
const build = distHTML.match(/data-build="([^"]+)"/)?.[1] || '';
assert.ok(build, 'Run the production build before the token audit.');
const sourceFiles = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) await walk(child);
    else if (/\.(?:css|js|html)$/.test(entry.name)) sourceFiles.push(child);
  }
}
await walk(new URL('src/', root));
sourceFiles.push(new URL('index.html', root));
const allSource = (await Promise.all(sourceFiles.map(async file => ({ file, text: await readFile(file, 'utf8') }))));

const relative = path => path.replace(root.pathname, '');
const report = { checkedAt: new Date().toISOString(), build, passed: false, tokens: {}, consumers: [], findings: [], allowedFallbacks: [] };
const definition = (text, token) => [...text.matchAll(new RegExp(`(?:^|[;{])\\s*${token}\\s*:\\s*([^;]+);`, 'gm'))].map(match => match[1].trim());

const required = ['--rubric-gap', '--slash-inset', '--h4-ghost-color', '--h4-ghost-opacity',
  '--h4-ghost-focus-opacity', '--h4-ghost-tracking', '--h4-ghost-transform', '--h4-ghost-header-size',
  '--h4-ghost-header-narrow-size'];
for (const token of required) {
  const definitions = definition(css['src/ui-tokens.css'], token);
  assert.equal(definitions.length, 1, `${token} must have exactly one token definition.`);
  report.tokens[token] = { value: definitions[0], file: 'src/ui-tokens.css' };
}
const pressed = definition(indexHTML, '--h4-cursor-pressed-scale');
assert.deepEqual(pressed, ['1.08'], 'The cursor press scale token must have one critical-CSS definition.');
report.tokens['--h4-cursor-pressed-scale'] = { value: pressed[0], file: 'index.html' };
assert.equal((await Promise.all(allSource.map(entry => entry.text))).some(text => text.includes('--h4-ghost-text')),
  false, 'The obsolete --h4-ghost-text alias must not exist; the split ghost family is canonical.');

function rules(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({
    selector: match[1].trim().replace(/\s+/g, ' '),
    body: match[2].trim(),
    declarations: [...match[2].matchAll(/([\w-]+)\s*:\s*([^;]+);?/g)].map(decl => ({ property: decl[1], value: decl[2].trim() })),
  }));
}

const spacingSurfaces = [
  ['src/homepage.css', '.category-strip', 'gap'],
  ['src/style.css', '.category-strip', 'gap'],
  ['src/archive-structure.css', '.work-filters', 'gap'],
  ['src/archive-structure.css', '.rubric-cross-links', 'gap'],
  ['src/gallery.css', '.artwork-viewer-navigation', 'gap'],
];
for (const [file, selector, property] of spacingSurfaces) {
  const matches = rules(css[file]).filter(rule => rule.selector.split(',').some(part => part.trim() === selector));
  const consumers = matches.flatMap(rule => rule.declarations.filter(decl => decl.property === property));
  assert.ok(consumers.length > 0, `${selector} must declare ${property}.`);
  const tokenConsumer = consumers.find(decl => decl.value.startsWith('var(--rubric-gap'));
  assert.ok(tokenConsumer, `${selector} must consume --rubric-gap: ${JSON.stringify(consumers)}`);
  const fallback = tokenConsumer.value.match(/var\(--rubric-gap,\s*([^)]+)\)/)?.[1];
  if (fallback) report.allowedFallbacks.push({ selector, property, value: tokenConsumer.value, note: 'Token remains authoritative; fallback is used only if the token is unavailable.' });
  report.consumers.push({ token: '--rubric-gap', file, selector, property, value: tokenConsumer.value });
}

const slashDefinitions = allSource.flatMap(entry => [...entry.text.matchAll(/clamp\(\s*52px\s*,\s*16vw\s*,\s*138px\s*\)/g)].map(() => relative(entry.file.pathname)));
assert.equal(slashDefinitions.length, 1, `The slash inset formula must only exist in its token definition: ${JSON.stringify(slashDefinitions)}`);
const slashConsumers = allSource.flatMap(entry => [...entry.text.matchAll(/var\(--slash-inset\)/g)].map(() => relative(entry.file.pathname)));
assert.ok(slashConsumers.length >= 5, `The slash inset must have real consumers: ${JSON.stringify(slashConsumers)}`);
report.consumers.push({ token: '--slash-inset', count: slashConsumers.length, files: [...new Set(slashConsumers)] });

const ghostSelector = /(?:^|[,.#\s>])(?:footer-impressum|footer-smash|footer-visit-count|footer-secret|returning-visitor-line|placeholder-card|secret-message)(?:\b|\.)/;
const ghostLiteralFamilies = [
  { property: 'opacity', values: new Set(['.35', '.52']) },
  { property: 'text-transform', values: new Set(['lowercase']) },
];
for (const [file, text] of Object.entries(css)) {
  for (const rule of rules(text)) {
    if (!ghostSelector.test(rule.selector) || rule.selector.includes("[data-mode='xray']")) continue;
    for (const declaration of rule.declarations) {
      if (declaration.property === 'color' && !/^(?:var\(|currentColor$|inherit$|transparent$)/.test(declaration.value)) {
        report.findings.push({ token: '--h4-ghost-color', file, selector: rule.selector, property: declaration.property,
          value: declaration.value, fix: 'Consume var(--h4-ghost-color) or a documented mode override.' });
      }
      if (declaration.property === 'letter-spacing' && /^(?:-?\.\d+px|[-\d.]+em)$/.test(declaration.value)) {
        report.findings.push({ token: '--h4-ghost-tracking', file, selector: rule.selector, property: declaration.property,
          value: declaration.value, fix: 'Consume var(--h4-ghost-tracking) on ghost surfaces.' });
      }
      const literal = ghostLiteralFamilies.find(family => family.property === declaration.property && family.values.has(declaration.value));
      if (literal) {
        const token = declaration.property === 'opacity' ? '--h4-ghost-opacity' : '--h4-ghost-transform';
        report.findings.push({ token, file, selector: rule.selector, property: declaration.property,
          value: declaration.value, fix: `Consume var(${token}) instead of repeating its value.` });
      }
    }
  }
}

const cursorRules = rules(indexHTML).filter(rule => rule.selector.includes('[data-h4-cursor]'));
const cursorLiteral = cursorRules.flatMap(rule => rule.declarations
  .filter(declaration => declaration.value.includes('1.08') && declaration.property !== '--h4-cursor-pressed-scale')
  .map(declaration => ({ selector: rule.selector, ...declaration })));
assert.deepEqual(cursorLiteral, [], `Cursor rules must consume the press-scale token: ${JSON.stringify(cursorLiteral)}`);
assert.doesNotMatch(css['src/cursor.css'], /1\.08/, 'The blanket cursor CSS must not duplicate the press scale.');
report.consumers.push({ token: '--h4-cursor-pressed-scale', selector: '[data-h4-cursor]', property: 'scale',
  value: 'var(--h4-cursor-pressed-scale)' });

for (const [token, value] of Object.entries({
  '--h4-ghost-color': 'var(--h4-ghost-color)', '--h4-ghost-opacity': 'var(--h4-ghost-opacity)',
  '--h4-ghost-focus-opacity': 'var(--h4-ghost-focus-opacity)', '--h4-ghost-tracking': 'var(--h4-ghost-tracking)',
  '--h4-ghost-transform': 'var(--h4-ghost-transform)',
})) {
  const consumers = allSource.filter(entry => entry.text.includes(value)).map(entry => relative(entry.file.pathname));
  assert.ok(consumers.length > 0, `${token} must have at least one consumer.`);
  report.consumers.push({ token, count: consumers.length, files: [...new Set(consumers)] });
}

report.passed = report.findings.length === 0;
await writeFile(new URL('tokens.json', output), JSON.stringify(report, null, 2) + '\n');
if (report.findings.length) console.error(`FINDINGS tokens: ${report.findings.length} hardcoded ghost values (${report.findings.map(item => `${item.selector}:${item.property}`).join(', ')}).`);
assert.deepEqual(report.findings, [], `Token audit found hardcoded values: ${JSON.stringify(report.findings)}`);
console.log(`PASS tokens: ${Object.keys(report.tokens).length} definitions, ${report.consumers.length} scoped consumers, 0 duplicated literals.`);
