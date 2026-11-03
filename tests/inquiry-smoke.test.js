import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { GENERIC_INQUIRY_FAILURE } from '../server/inquiry.mjs';

const script = fileURLToPath(new URL('../scripts/smoke-inquiry.mjs', import.meta.url));

function runSmoke(env) {
  return new Promise(resolve => {
    execFile(process.execPath, [script], { env, encoding: 'utf8' }, (error, stdout, stderr) => {
      resolve({ code: error?.code ?? 0, stdout, stderr });
    });
  });
}

async function close(server) {
  server.closeAllConnections?.();
  await new Promise(resolve => server.close(resolve));
}

test('smoke script skips cleanly without SMOKE_URL', async () => {
  const result = await runSmoke({ ...process.env, SMOKE_URL: '', SMOKE_NAME: '', SMOKE_MAIL: '', SMOKE_TEXT: '' });
  assert.equal(result.code, 0);
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 1);
  const report = JSON.parse(lines[0]);
  assert.equal(report.event, 'inquiry_smoke');
  assert.equal(report.outcome, 'skipped');
  assert.equal(report.status, null);
  assert.match(result.stderr, /skipped/i);
});

test('smoke script sends exactly one PII-safe inquiry and checks the 502 body byte-for-byte', async t => {
  const requests = [];
  const mock = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({ method: request.method, url: request.url, headers: request.headers, body: Buffer.concat(chunks) });
    const body = Buffer.from(JSON.stringify({ error: GENERIC_INQUIRY_FAILURE }));
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
    response.end(body);
  });
  mock.listen(0, '127.0.0.1');
  await once(mock, 'listening');
  t.after(() => close(mock));

  const base = `http://127.0.0.1:${mock.address().port}`;
  const privateName = 'SMOKE-PRIVATE-NAME';
  const privateMail = 'smoke-private@example.invalid';
  const privateText = 'SMOKE-PRIVATE-MESSAGE';
  const result = await runSmoke({
    ...process.env,
    SMOKE_URL: base,
    SMOKE_NAME: privateName,
    SMOKE_MAIL: privateMail,
    SMOKE_TEXT: privateText,
  });

  assert.equal(result.code, 0, result.stderr);
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 1);
  const report = JSON.parse(lines[0]);
  assert.deepEqual(report, {
    event: 'inquiry_smoke',
    status: 502,
    bodyEqual: true,
    requestId: null,
    outcome: 'error_observed',
    conclusion: 'Inquiry failure observed; read resend_rejected/resend_unreachable from Vercel function logs.',
    submittedFields: ['artwork', 'started', 'name', 'email', 'message', 'website'],
    attachments: 0,
  });
  for (const captured of [result.stdout, result.stderr]) {
    assert.equal(captured.includes(privateName), false);
    assert.equal(captured.includes(privateMail), false);
    assert.equal(captured.includes(privateText), false);
  }

  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(request.method, 'POST');
  assert.equal(request.url, '/api/inquiry');
  assert.equal(request.headers.origin, base);
  assert.equal(request.headers['sec-fetch-site'], 'same-origin');
  assert.match(request.headers['content-type'], /^multipart\/form-data; boundary=/);
  const form = await new Response(request.body, { headers: { 'content-type': request.headers['content-type'] } }).formData();
  assert.equal(form.get('artwork'), '');
  assert.ok(Number(form.get('started')) <= Date.now() - 800);
  assert.equal(form.get('name'), privateName);
  assert.equal(form.get('email'), privateMail);
  assert.equal(form.get('message'), privateText);
  assert.equal(form.get('website'), '');
  assert.equal(form.getAll('attachments').length, 0);
});

test('smoke script reports mail flow success for a 201 response', async t => {
  let requests = 0;
  const mock = createServer(async (request, response) => {
    for await (const _chunk of request) { /* The response is the contract under test. */ }
    requests++;
    const body = Buffer.from(JSON.stringify({ accepted: true, id: 'mock-preview-request-id' }));
    response.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
    response.end(body);
  });
  mock.listen(0, '127.0.0.1');
  await once(mock, 'listening');
  t.after(() => close(mock));

  const base = `http://127.0.0.1:${mock.address().port}`;
  const result = await runSmoke({ ...process.env, SMOKE_URL: base, SMOKE_NAME: 'smoke', SMOKE_MAIL: 'smoke@example.invalid', SMOKE_TEXT: 'smoke' });
  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(result.stdout.trim());
  assert.equal(report.status, 201);
  assert.equal(report.requestId, 'mock-preview-request-id');
  assert.equal(report.outcome, 'mail_ok');
  assert.match(report.conclusion, /Mail-Flows o\.k\./);
  assert.equal(requests, 1);
});
