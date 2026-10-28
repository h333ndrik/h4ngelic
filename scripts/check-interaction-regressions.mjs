import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Serial browser verification only. Start the appropriate server first; this
// runner never builds, serves, measures Lighthouse, packages or deploys.
const group = 'dev';
const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.env.H4_BASE_URL;
assert.ok(base, 'Set H4_BASE_URL explicitly.');
const response = await fetch(new URL('/src/app.js', base));
assert.ok(response.ok && /(?:java|ecma)script/i.test(response.headers.get('content-type') || ''),
  'The broad suite needs Vite source modules and DEV hooks; point H4_BASE_URL at the dev server.');
const files = ["navigation-browser.mjs", "artwork-transitions-browser.mjs", "gallery-browser.mjs", "corruption-browser.mjs", "xray-browser.mjs", "mode-snapshot-browser.mjs", "mode-snapshot-modal-browser.mjs", "mode-audio-browser.mjs", "ref09-mode-cancel-browser.mjs", "ref09-icons-browser.mjs", "scroll-browser.mjs", "hover-browser.mjs", "microinteractions-browser.mjs", "wordmark-corruption-browser.mjs", "browser.mjs"];
const output = new URL('../artifacts/interaction-regression-results.json', import.meta.url);
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
let report = { startedAt: new Date().toISOString(), group, base, tests: files, completed: [], passed: false };
if (process.argv.includes('--resume')) {
  report = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(report.base, base);
  assert.deepEqual(report.tests, files, 'Resume requires the same suite list.');
  const failedAt = report.completed.findIndex(result => result.code !== 0 || result.signal !== null);
  if (failedAt >= 0) {
    report.previousFailures = [...(report.previousFailures || []), ...report.completed.slice(failedAt)];
    report.completed = report.completed.slice(0, failedAt);
  }
  report.resumedAt = new Date().toISOString();
  report.passed = false;
}
async function record() { await writeFile(output, JSON.stringify(report, null, 2) + '\n'); }
await record();
for (const file of files.slice(report.completed.length)) {
  const started = Date.now();
  console.log(`START ${group}: ${file}`);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`tests/${file}`], { cwd: root, env: process.env, stdio: 'inherit' });
    let memoryGuard;
    let sampling = false;
    let owned = [];
    if (file === 'mode-snapshot-browser.mjs') memoryGuard = setInterval(() => {
      if (sampling) return;
      sampling = true;
      execFile('ps', ['-eo', 'pid=,ppid=,rss='], (error, stdout) => {
        sampling = false;
        if (error) return;
        const rows = stdout.trim().split('\n').map(line => { const [pid, parent, rss] = line.trim().split(/\s+/).map(Number); return { pid, parent, rss }; });
        const ids = new Set([child.pid]);
        for (let previous = 0; previous !== ids.size;) { previous = ids.size; for (const row of rows) if (ids.has(row.parent)) ids.add(row.pid); }
        owned = rows.filter(row => ids.has(row.pid));
        if (owned.reduce((sum, row) => sum + row.rss, 0) > 4 * 1024 * 1024) {
          console.error('ABORT native pixel readback: owned browser process-tree RSS exceeded the 4 GiB test guard.');
          for (const row of owned.reverse()) try { process.kill(row.pid, 'SIGKILL'); } catch {}
        }
      });
    }, 200);
    child.once('error', reject);
    child.once('exit', (code, signal) => { clearInterval(memoryGuard); resolve({ code, signal }); });
  });
  report.completed.push({ file, ...result, elapsedMs: Date.now() - started });
  await record();
  assert.equal(result.signal, null, `${file} terminated by signal.`);
  assert.equal(result.code, 0, `${file} failed; remaining suites were not run.`);
}
report.finishedAt = new Date().toISOString();
report.passed = true;
await record();
console.log(`PASS ${group}: all ${files.length} suites completed serially.`);
