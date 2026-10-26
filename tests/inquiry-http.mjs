import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createInquiryHandler } from '../server/inquiry.mjs';

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
  const form = (bytes = original) => {
    const body = new FormData();
    body.set('name', 'loopback test visitor'); body.set('email', 'visitor@example.com');
    body.set('message', 'test-only inquiry'); body.set('website', '');
    body.set('started', String(Date.now() - 2000)); body.set('artwork', 'green-black-original');
    body.append('attachments', new Blob([bytes], { type: 'application/pdf' }), 'référence.pdf');
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
  const report = {
    checkedAt: new Date().toISOString(),
    method: 'Native loopback HTTP with browser-compatible FormData and local mock email-provider HTTP service. No external requests or real email delivery.',
    status: { accepted: accepted.status, crossOrigin: forbidden.status, providerFailure: failed.status, spoofedAttachment: spoofed.status, rateLimit: limited.status, unconfigured: unconfigured.status },
    fixedRecipient: received[0].to[0],
    replyTo: received[0].reply_to,
    unicodeFilename: received[0].attachments[0].filename,
    attachmentSHA256: createHash('sha256').update(original).digest('hex'),
    bytesPreserved: true,
    providerMockCalls: received.length,
    liveDeliveryVerified: false,
  };
  await mkdir(new URL('../artifacts/inquiry/', import.meta.url), { recursive: true });
  await writeFile(new URL('../artifacts/inquiry/http-results.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  service.closeAllConnections(); provider.closeAllConnections();
  await Promise.all([new Promise(resolve => service.close(resolve)), new Promise(resolve => provider.close(resolve))]);
}
