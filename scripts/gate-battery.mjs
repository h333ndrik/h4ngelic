/** V3.2 final gate — serial browser battery (no parallelism, no silent skips).
 *
 * Every suite is started one after another with the base URL its own contract
 * needs: suites that use the Vite DEV hooks (`?test=1`) run against `H4_GATE_DEV`,
 * everything else against the production preview `H4_GATE_PREVIEW`.
 *
 *   H4_GATE_DEV=http://127.0.0.1:5183 H4_GATE_PREVIEW=http://127.0.0.1:55241 \
 *     node scripts/gate-battery.mjs before
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const phase = process.argv[2] || 'before';
const dev = process.env.H4_GATE_DEV || 'http://127.0.0.1:5183';
const preview = process.env.H4_GATE_PREVIEW || 'http://127.0.0.1:55241';
const output = new URL('../docs/validation/V3.2-FINAL-GATE/', import.meta.url);
const file = new URL(`battery-${phase}.json`, output);
await mkdir(output, { recursive: true });

const suites = (process.env.H4_GATE_SUITES || '').split(',').filter(Boolean);
const all = [
  'tokens-audit', 'typography-contract', 'link-glyph-contract', 'row-geometry-contract',
  'footer-zone-contract', 'footer-v31-browser', 'v32-structure-browser', 'v32-micro-browser',
  'label-format-browser', 'naavi-format-browser', 'tools-rubric-browser', 'creative-landing-browser', 'mobile-parity-browser', 'rubric-gap-browser',
  'rubric-hit-area-browser', 'greeting-browser', 'lowercase-sweep', 'v25-cross-links-browser',
  'v23-static-titles-browser', 'v7-visitor-tiers-browser', 'v31-navigation-browser', 'v31-ui-browser',
  'portfolio-browser', 'about-browser', 'hero-poster-browser', 'hero-boot-browser',
  'digital-ink-browser', 'smash-v31-browser', 'v312-r3-production-cursor', 'v312-r3-entrance-browser',
  'gallery-browser', 'artwork-transitions-browser', 'hover-browser', 'microinteractions-browser',
  'mobile-interactions-browser', 'master-accessibility-browser', 'seo-browser', 'cursor-hit-test',
  'standalone-browser', 'standalone-native-browser',
];
const list = suites.length ? suites : all;
const forceDev = new Set((process.env.H4_GATE_FORCE_DEV || '').split(',').filter(Boolean));

const results = [];
for (const suite of list) {
  const path = `tests/${suite}.mjs`;
  let source = '';
  try { source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }
  catch { results.push({ suite, status: 'MISSING', note: `${path} not present on this branch` }); console.log(`SKIP ${suite}: not present`); continue; }
  const needsDev = forceDev.has(suite) || /\?test=1|__H4_TEST__|src\//.test(source);
  const base = needsDev ? dev : preview;
  const env = { ...process.env, H4_BASE_URL: base, H4_PREVIEW_URL: base };
  if (!process.env.CHROMIUM_PATH) {
    const { chromium } = await import('playwright');
    env.CHROMIUM_PATH = chromium.executablePath();
  }
  const started = Date.now();
  console.log(`START ${suite} (${needsDev ? 'dev' : 'preview'} ${base})`);
  const result = await new Promise(resolve => {
    const child = spawn(process.execPath, [path], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    child.stdout.on('data', chunk => { text += chunk; });
    child.stderr.on('data', chunk => { text += chunk; });
    child.on('exit', (code, signal) => resolve({ code, signal, text }));
  });
  const elapsedMs = Date.now() - started;
  const lines = result.text.split('\n').map(line => line.trim()).filter(Boolean);
  const passLine = [...lines].reverse().find(line => line.startsWith('PASS')) || '';
  const failLine = [...lines].reverse().find(line => line.startsWith('FAIL') || /AssertionError|TimeoutError|Error:/.test(line)) || '';
  const status = result.code === 0 ? 'PASS' : 'FAIL';
  results.push({ suite, base: needsDev ? 'dev' : 'preview', status, code: result.code, elapsedMs,
    passLine, failLine: status === 'FAIL' ? (failLine || lines.slice(-3).join(' | ')) : '' });
  console.log(`${status} ${suite} ${Math.round(elapsedMs / 1000)}s ${passLine}`);
  await writeFile(file, JSON.stringify({ phase, dev, preview, startedAt: new Date().toISOString(), results }, null, 2) + '\n');
}
const passed = results.filter(entry => entry.status === 'PASS');
const failed = results.filter(entry => entry.status === 'FAIL');
const missing = results.filter(entry => entry.status === 'MISSING');
await writeFile(file, JSON.stringify({ phase, dev, preview, finishedAt: new Date().toISOString(), results }, null, 2) + '\n');
console.log(`SUMMARY ${phase}: ${passed.length} pass, ${failed.length} fail, ${missing.length} missing of ${results.length}`);
if (failed.length) console.log(`FAILED: ${failed.map(entry => entry.suite).join(', ')}`);
