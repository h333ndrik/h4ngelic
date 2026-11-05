import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('docs/validation/STRUCT/contracts/', root);
await mkdir(output, { recursive: true });

const cssFiles = [
  'src/ui-tokens.css', 'src/homepage.css', 'src/style.css', 'src/archive-structure.css',
  'src/gallery.css', 'src/easter-eggs.css', 'src/horizontal-drift.css', 'src/cursor.css',
  'src/rubric-row.css',
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

const required = ['--row-gap-min', '--row-inset', '--row-arrow-gap', '--row-slot-mode', '--row-slot-visibility',
  '--chips-gap', '--chips-height', '--chips-underline-offset', '--chips-target-min',
  '--cluster-gap', '--cluster-target-min', '--slash-inset', '--h4-ghost-color', '--h4-ghost-opacity',
  '--h4-ghost-focus-opacity', '--h4-ghost-tracking', '--h4-ghost-transform', '--h4-ghost-header-size',
  '--h4-ghost-header-narrow-size'];
for (const token of required) {
  const definitions = definition(css['src/ui-tokens.css'], token);
  assert.equal(definitions.length, 1, `${token} must have exactly one token definition.`);
  report.tokens[token] = { value: definitions[0], file: 'src/ui-tokens.css' };
}
// Native cursor contract: three public tokens plus the pressed variants, and
// no other stylesheet may declare `cursor` at all.
const cursorTokens = ['--h4-cursor', '--h4-cursor-interactive', '--h4-cursor-pressed', '--h4-cursor-xray', '--h4-cursor-xray-pressed'];
for (const token of cursorTokens) {
  const definitions = definition(css['src/cursor.css'], token);
  assert.equal(definitions.length, 1, `${token} must have exactly one definition in cursor.css.`);
  assert.match(definitions[0], /url\('\/assets\/[a-z0-9-]+\.svg'\) \d+ \d+, url\('\/assets\/[a-z0-9-]+\.png'\) \d+ \d+, (?:auto|pointer)$/,
    `${token} needs the svg -> png -> keyword fallback chain.`);
  report.tokens[token] = { value: definitions[0], file: 'src/cursor.css' };
}
const foreignCursorDeclarations = allSource
  .filter(entry => !entry.file.pathname.endsWith('/src/cursor.css'))
  .flatMap(entry => [...entry.text.matchAll(/(^|[;{\s])cursor\s*:\s*([^;\n"]+)/g)]
    .filter(match => !/cursor:\s*controls\.|cursor\s*:\s*Object/.test(match[0]))
    .map(match => ({ file: relative(entry.file.pathname), value: match[2].trim().slice(0, 60) })));
assert.deepEqual(foreignCursorDeclarations, [],
  `Only cursor.css may declare cursor: ${JSON.stringify(foreignCursorDeclarations)}`);
const cursorDeclarations = [...css['src/cursor.css'].matchAll(/(?<![-\w])cursor\s*:\s*([^;]+);/g)]
  .map(match => match[1].trim());
const cursorLiterals = cursorDeclarations
  .filter(value => !/^var\(--h4-cursor(?:-interactive|-pressed|-xray|-xray-pressed)?\)(?:\s*!important)?$/.test(value));
assert.deepEqual(cursorLiterals, [], `cursor.css must only consume the cursor tokens: ${JSON.stringify(cursorLiterals)}`);
// Escalation contract: every cursor declaration is !important, so no legacy or
// third-party rule can repaint the pointer.
const impureDeclarations = cursorDeclarations.filter(value => !/!important$/.test(value));
assert.deepEqual(impureDeclarations, [], `Every cursor declaration must be !important: ${JSON.stringify(impureDeclarations)}`);
assert.match(css['src/cursor.css'], /@media \(any-hover: hover\) and \(any-pointer: fine\)/,
  'The cursor block must key off the any-* capabilities so hybrids keep the logo.');
assert.doesNotMatch(css['src/cursor.css'], /\(hover: hover\) and \(pointer: fine\)/,
  'The primary-pointer query misses hybrid devices.');
assert.doesNotMatch(css['src/cursor.css'], /cursor:\s*none/, 'The retired blanket rule must not survive.');
report.consumers.push({ token: '--h4-cursor*', count: [...css['src/cursor.css'].matchAll(/var\(--h4-cursor/g)].length, files: ['src/cursor.css'] });
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

// Row typology: each type declares and consumes exactly its own tokens.
const spacingSurfaces = [
  ['src/rubric-row.css', "[data-row='distributed']", 'column-gap', '--row-gap-min'],
  ['src/rubric-row.css', "[data-row='distributed']", 'padding-inline', '--row-inset'],
  ['src/rubric-row.css', "[data-row='chips']", 'column-gap', '--chips-gap'],
  ['src/rubric-row.css', "[data-row='cluster']", 'column-gap', '--cluster-gap'],
];
for (const [file, selector, property, token] of spacingSurfaces) {
  const matches = rules(css[file]).filter(rule => rule.selector.split(',').some(part => part.trim() === selector));
  const consumers = matches.flatMap(rule => rule.declarations.filter(decl => decl.property === property));
  assert.ok(consumers.length > 0, `${selector} must declare ${property}.`);
  const tokenConsumer = consumers.find(decl => decl.value.includes(`var(${token})`));
  assert.ok(tokenConsumer, `${selector} must consume ${token}: ${JSON.stringify(consumers)}`);
  report.consumers.push({ token, file, selector, property, value: tokenConsumer.value });
}

const slashDefinitions = allSource.flatMap(entry => [...entry.text.matchAll(/clamp\(\s*52px\s*,\s*16vw\s*,\s*138px\s*\)/g)].map(() => relative(entry.file.pathname)));
assert.equal(slashDefinitions.length, 1, `The slash inset formula must only exist in its token definition: ${JSON.stringify(slashDefinitions)}`);
const slashConsumers = allSource.flatMap(entry => [...entry.text.matchAll(/var\(--slash-inset\)/g)].map(() => relative(entry.file.pathname)));
assert.ok(slashConsumers.length >= 5, `The slash inset must have real consumers: ${JSON.stringify(slashConsumers)}`);
report.consumers.push({ token: '--slash-inset', count: slashConsumers.length, files: [...new Set(slashConsumers)] });

// The old shared token is retired without an alias: a single gap for three row
// types is exactly the coupling B-F25 removed.
assert.equal(allSource.some(entry => entry.text.includes('--rubric-gap')), false,
  '--rubric-gap must be gone without an alias.');
assert.equal(allSource.some(entry => /\.rubric-row(?!\.css)\b|\.rubric-item\b|--rubric-arrow-gap/.test(entry.text)), false,
  'The shared rubric-row selectors and their arrow token are retired.');

// The slot mode has one source of truth: the CSS token documents the default
// and the markup emits the same mode on every cross-link row.
assert.equal(definition(css['src/ui-tokens.css'], '--row-slot-mode')[0], 'width');
assert.match(await readFile(new URL('src/pages.js', root), 'utf8'), /const rowSlotMode = 'width';/,
  'The cross-link markup must mirror --row-slot-mode.');

// Cross-type consumption: a Type B or C selector may not read a Type A token
// (and vice versa). A violation is a finding, so the audit fails.
const typeSelectors = { A: "[data-row='distributed']", B: "[data-row='chips']", C: "[data-row='cluster']" };
const forbiddenTokens = { A: ['--chips-', '--cluster-'], B: ['--row-', '--cluster-'], C: ['--row-', '--chips-'] };
const itemSelectors = ['\.row-item', '\.category-link', '\.filter-link'];
const itemRegex = new RegExp(`(?:${itemSelectors.join('|')})(?![\\w-])`);
for (const [file, text] of Object.entries(css)) {
  for (const rule of rules(text)) {
    if (rule.selector.includes("[data-mode='xray']")) continue;
    for (const [type, selector] of Object.entries(typeSelectors)) {
      if (!rule.selector.includes(selector)) continue;
      for (const declaration of rule.declarations) {
        for (const prefix of forbiddenTokens[type]) {
          if (declaration.value.includes(`var(${prefix}`)) {
            report.findings.push({ token: prefix, file, selector: rule.selector, property: declaration.property,
              value: declaration.value, fix: `A Type ${type} selector must not consume another type's token.` });
          }
        }
        if (declaration.property === 'justify-content' && /space-(?:around|evenly)/.test(declaration.value)) {
          report.findings.push({ token: '--row-gap-min', file, selector: rule.selector, property: declaration.property,
            value: declaration.value, fix: 'Only Type A may distribute, and only with space-between.' });
        }
        if (declaration.property === 'grid-template-columns' && /repeat\([^)]*1fr/.test(declaration.value)) {
          report.findings.push({ token: '--row-gap-min', file, selector: rule.selector, property: declaration.property,
            value: declaration.value, fix: 'Equal grid tracks make the gap depend on the label length.' });
        }
      }
    }
    if (itemRegex.test(rule.selector)) {
      for (const declaration of rule.declarations) {
        // Token-driven margins (the arrow gap) are the component's own wiring;
        // only literal numbers on an item are findings.
        if (/^margin(?:-inline|-inline-start|-inline-end|-left|-right)?$/.test(declaration.property)
          && !/^var\(--/.test(declaration.value.trim())
          && !/^(?:0|\.?0(?:px|em|rem)?)$/.test(declaration.value.trim())) {
          report.findings.push({ token: '--row-gap-min', file, selector: rule.selector, property: declaration.property,
            value: declaration.value, fix: 'Spacing belongs to the row type, not to a single item.' });
        }
      }
    }
  }
}
// Distribution is a Type A decision, never a house style.
for (const [file, text] of Object.entries(css)) {
  for (const rule of rules(text)) {
    if (!rule.selector.includes('data-row=')) continue;
    if (!rule.declarations.some(declaration => declaration.property === 'justify-content'
      && /space-(?:between|around|evenly)/.test(declaration.value))) continue;
    assert.ok(rule.selector.includes("[data-row='distributed']"),
      `Only Type A distributes (${file}: ${rule.selector}).`);
  }
}
assert.ok(rules(css['src/rubric-row.css']).some(rule => /^\[data-row='distributed'\]$/.test(rule.selector)
  && rule.declarations.some(declaration => declaration.property === 'column-gap' && declaration.value.includes('--row-gap-min'))),
  'Type A must own --row-gap-min.');
assert.ok(rules(css['src/rubric-row.css']).some(rule => rule.selector.includes("[data-row='distributed'] .arrow")
  && rule.declarations.some(declaration => declaration.property === 'margin-inline-start' && declaration.value.includes('--row-arrow-gap'))),
  'The arrow gap must come from --row-arrow-gap.');

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

assert.doesNotMatch(indexHTML, /data-h4-cursor|h4-custom-cursor|cursor-overlay/,
  'The overlay markup, its class gate and its CSS must be gone.');

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
