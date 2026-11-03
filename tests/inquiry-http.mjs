import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createInquiryHandler, GENERIC_INQUIRY_FAILURE } from '../server/inquiry.mjs';

const genericFailure = GENERIC_INQUIRY_FAILURE;

async function captureConsole(run) {
  const stdout = [], stderr = [];
  const original = { log: console.log, error: console.error };
  const text = args => args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' ');
  console.log = (...args) => stdout.push(text(args));
  console.error = (...args) => stderr.push(text(args));
  try {
    const value = await run();
    return { value, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
  } finally {
    console.log = original.log;
    console.error = original.error;
  }
}

const logLines = captured => captured.trim() ? captured.trim().split('\n').map(line => JSON.parse(line)) : [];

// This is a real loopback HTTP integration with a local email-provider mock.
// It never contacts Resend or sends email and is not an inbox-delivery check.
let providerFails = false;
const received = [];
const provider = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  received.push(JSON.parse(Buffer.concat(chunks).toString()));
  res.writeHead(providerFails ? 503 : 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(providerFails ? { error: 'mock unavailable' } : { id: 'local-mock-acceptance-id' }));
});
let handler;
const service = createServer((req, res) => handler(req, res));
try {
  provider.listen(0, '127.0.0.1'); await once(provider, 'listening');
  const providerURL = `http://127.0.0.1:${provider.address().port}`;
  const config = { apiKey: 'loopback-mock-only', from: 'inquiries@h4ngelic.com', allowedOrigins: ['https://h4ngelic.com'] };
  handler = createInquiryHandler({ config, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    return fetch(providerURL, options);
  } });
  service.listen(0, '127.0.0.1'); await once(service, 'listening');
  const serviceURL = `http://127.0.0.1:${service.address().port}`;
  config.allowedOrigins[0] = serviceURL;
  const original = Buffer.from('%PDF-1.7\nmock test reference; no real personal information.');
  const form = (bytes = original, contact = 'visitor@example.com', message = 'test-only inquiry', filename = 'référence.pdf') => {
    const body = new FormData();
    body.set('name', 'loopback test visitor'); body.set('email', contact);
    body.set('message', message); body.set('website', '');
    body.set('started', String(Date.now() - 2000)); body.set('artwork', 'green-black-original');
    body.append('attachments', new Blob([bytes], { type: 'application/pdf' }), filename);
    return body;
  };
  const send = (body, origin = serviceURL) => fetch(`${serviceURL}/api/inquiry`, { method: 'POST', headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin' }, body });
  const accepted = await send(form());
  assert.equal(accepted.status, 202);
  const acceptedBody = await accepted.json();
  assert.equal(acceptedBody.accepted, true); assert.ok(acceptedBody.id);
  assert.deepEqual(received[0].to, ['h4ngelic@gmail.com']);
  assert.equal(received[0].reply_to, 'visitor@example.com');
  assert.equal(received[0].attachments[0].filename, 'référence.pdf');
  assert.ok(Buffer.from(received[0].attachments[0].content, 'base64').equals(original));
  const forbidden = await send(form(), 'https://unrelated.example');
  assert.equal(forbidden.status, 403); await forbidden.json();
  providerFails = true;
  const failed = await send(form());
  assert.equal(failed.status, 502); assert.equal((await failed.json()).accepted, undefined);
  const spoofed = await send(form(Buffer.from('<script>not a PDF</script>')));
  assert.equal(spoofed.status, 415); await spoofed.json();
  const limited = await send(form());
  assert.equal(limited.status, 429); await limited.json();
  handler = createInquiryHandler({ config: { ...config, apiKey: '' } });
  const unconfigured = await send(form());
  assert.equal(unconfigured.status, 503); assert.equal((await unconfigured.json()).accepted, undefined);
  assert.equal(received.length, 2);
  providerFails = false;
  handler = createInquiryHandler({ config, fetchImpl: (_url, options) => fetch(providerURL, options) });
  for (const contact of ['@loopback-visitor', '+49 170 1234567']) {
    const response = await send(form(original, contact));
    assert.equal(response.status, 202);
    assert.equal((await response.json()).accepted, true);
    assert.equal(Object.hasOwn(received.at(-1), 'reply_to'), false);
    assert.ok(received.at(-1).text.includes(`how to reach you: ${contact}`));
  }
  assert.equal(received.length, 4);

  const diagnostics = [];
  const privateEmail = 'private-diagnostics@example.com';
  const privateMessage = 'PRIVATE-DIAGNOSTIC-MESSAGE-DO-NOT-LOG';
  const privateFilename = 'private-diagnostic-reference.pdf';
  const privateAttachment = 'PRIVATE-ATTACHMENT-DO-NOT-LOG';
  const privateProviderBody = 'PRIVATE-PROVIDER-BODY-DO-NOT-LOG';
  const privateNetworkDetail = 'PRIVATE-NETWORK-DIAGNOSTIC-DO-NOT-LOG';
  const privateForm = () => form(
    Buffer.from(`%PDF-1.7\n${privateAttachment}`),
    privateEmail,
    privateMessage,
    privateFilename,
  );
  const privateValues = [privateEmail, privateMessage, privateFilename, privateAttachment, privateProviderBody, privateNetworkDetail];
  const assertPrivateValuesAbsent = captured => {
    for (const value of privateValues) assert.equal(captured.includes(value), false, `diagnostic log leaked a private value: ${value}`);
  };

  const rejectionCases = [
    { status: 401, body: { name: 'invalid_api_key', message: privateProviderBody }, error: 'invalid_api_key' },
    { status: 403, body: { name: 'domain_not_verified', message: privateProviderBody }, error: 'domain_not_verified' },
    { status: 422, body: `not-json ${privateProviderBody}`, error: 'unparseable' },
    { status: 500, body: { name: 'internal_server_error', message: privateProviderBody }, error: 'internal_server_error' },
  ];
  for (const scenario of rejectionCases) {
    handler = createInquiryHandler({ config, fetchImpl: async () => new Response(
      typeof scenario.body === 'string' ? scenario.body : JSON.stringify(scenario.body),
      { status: scenario.status, headers: { 'Content-Type': 'application/json' } },
    ) });
    const captured = await captureConsole(() => send(privateForm()));
    assert.equal(captured.value.status, 502);
    assert.deepEqual(await captured.value.json(), { error: genericFailure });
    assert.equal(captured.stdout, '');
    const lines = logLines(captured.stderr);
    assert.equal(lines.length, 1);
    const [entry] = lines;
    assert.deepEqual(Object.keys(entry).sort(), ['error', 'event', 'requestId', 'status']);
    assert.match(entry.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.deepEqual({ event: entry.event, status: entry.status, error: entry.error }, {
      event: 'resend_rejected', status: scenario.status, error: scenario.error,
    });
    assertPrivateValuesAbsent(captured.stderr);
    diagnostics.push(entry);
  }

  const networkError = new Error(privateNetworkDetail);
  networkError.name = 'TimeoutError';
  handler = createInquiryHandler({ config, fetchImpl: async () => { throw networkError; } });
  const unreachable = await captureConsole(() => send(privateForm()));
  assert.equal(unreachable.value.status, 502);
  assert.deepEqual(await unreachable.value.json(), { error: genericFailure });
  assert.equal(unreachable.stdout, '');
  const unreachableLines = logLines(unreachable.stderr);
  assert.equal(unreachableLines.length, 1);
  const [unreachableEntry] = unreachableLines;
  assert.deepEqual(Object.keys(unreachableEntry).sort(), ['error', 'event', 'requestId']);
  assert.match(unreachableEntry.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.deepEqual({ event: unreachableEntry.event, error: unreachableEntry.error }, {
    event: 'resend_unreachable', error: 'TimeoutError',
  });
  assertPrivateValuesAbsent(unreachable.stderr);
  diagnostics.push(unreachableEntry);

  const report = {
    checkedAt: new Date().toISOString(),
    method: 'Native loopback HTTP with browser-compatible FormData and local mock email-provider HTTP service. No external requests or real email delivery.',
    status: { accepted: accepted.status, crossOrigin: forbidden.status, providerFailure: failed.status, spoofedAttachment: spoofed.status, rateLimit: limited.status, unconfigured: unconfigured.status },
    fixedRecipientConfigured: received[0].to[0] === 'h4ngelic@gmail.com',
    replyToForwarded: received[0].reply_to === 'visitor@example.com',
    freeTextContactChannelsAccepted: ['@loopback-visitor', '+49 170 1234567'],
    nonEmailReplyToOmitted: true,
    unicodeFilenamePreserved: received[0].attachments[0].filename === 'référence.pdf',
    attachmentSHA256: createHash('sha256').update(original).digest('hex'),
    bytesPreserved: true,
    providerMockCalls: received.length,
    resendDiagnostics: {
      entries: diagnostics,
      privateValuesAbsent: ['email', 'message', 'filename', 'attachment bytes', 'provider response body', 'network error detail'],
    },
    liveDeliveryVerified: false,
  };
  await mkdir(new URL('../artifacts/inquiry/', import.meta.url), { recursive: true });
  await writeFile(new URL('../artifacts/inquiry/http-results.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  service.closeAllConnections(); provider.closeAllConnections();
  await Promise.all([new Promise(resolve => service.close(resolve)), new Promise(resolve => provider.close(resolve))]);
}
