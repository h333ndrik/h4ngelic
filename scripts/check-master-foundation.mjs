import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const output = new URL('artifacts/master-foundation/regressions.json', root);
const tests = ['gallery-browser.mjs','horizontal-drift-browser.mjs','v6-browser.mjs','portfolio-browser.mjs','memory-mosh-browser.mjs'];
assert.ok(process.env.H4_BASE_URL, 'Set H4_BASE_URL to the running development site.');
let report = { startedAt: new Date().toISOString(), base: process.env.H4_BASE_URL, tests, completed: [], passed: false };
await mkdir(new URL('artifacts/master-foundation/', root), { recursive: true });
if (process.argv.includes('--resume')) {
  const previous = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(previous.base, report.base); assert.deepEqual(previous.tests, tests);
  const failure = previous.completed.findIndex(item => item.code !== 0 || item.signal !== null);
  report = { ...previous, resumedAt: new Date().toISOString(), passed: false };
  if (failure >= 0) {
    report.previousFailures = [...(report.previousFailures || []), ...report.completed.slice(failure)];
    report.completed = report.completed.slice(0, failure);
  }
}
for (const file of tests.slice(report.completed.length)) {
  console.log(`START ${file}`);
  const start = Date.now();
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`tests/${file}`], { cwd: root, env: process.env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  report.completed.push({ file, ...result, elapsedMs: Date.now() - start });
  await writeFile(output, JSON.stringify(report, null, 2));
  assert.equal(result.code, 0, `${file} failed`); assert.equal(result.signal, null);
}
report.passed = true; report.finishedAt = new Date().toISOString();
await writeFile(output, JSON.stringify(report, null, 2));
console.log('PASS all five master-foundation integration suites.');
