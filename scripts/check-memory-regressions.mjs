import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url), out=new URL('artifacts/v71/regressions.json',root);
const tests=['ref09-mode-cancel-browser.mjs','mode-audio-browser.mjs','hover-browser.mjs','xray-browser.mjs','hero-ink-browser.mjs','browser.mjs','v6-browser.mjs'];
let report={startedAt:new Date().toISOString(),base:process.env.H4_BASE_URL,tests,completed:[],passed:false};
assert.ok(report.base,'Set H4_BASE_URL explicitly.');
await mkdir(new URL('artifacts/v71/',root),{recursive:true});
if(process.argv.includes('--resume')){
 const previous=JSON.parse(await readFile(out,'utf8'));assert.equal(previous.base,report.base);assert.deepEqual(previous.tests,tests);
 const failed=previous.completed.findIndex(item=>item.code!==0||item.signal!==null);
 report={...previous,resumedAt:new Date().toISOString(),passed:false};
 if(failed>=0){report.previousFailures=[...(previous.previousFailures||[]),...previous.completed.slice(failed)];report.completed=previous.completed.slice(0,failed);}
}
for(const file of tests.slice(report.completed.length)){
 console.log(`START ${file}`);const start=Date.now();
 const result=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[`tests/${file}`],{cwd:root,env:process.env,stdio:'inherit'});child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
 report.completed.push({file,...result,elapsedMs:Date.now()-start});await writeFile(out,JSON.stringify(report,null,2));
 assert.equal(result.code,0,`${file} failed`);assert.equal(result.signal,null);
}
report.passed=true;report.finishedAt=new Date().toISOString();await writeFile(out,JSON.stringify(report,null,2));console.log(`PASS all ${tests.length} P0 regression suites`);
