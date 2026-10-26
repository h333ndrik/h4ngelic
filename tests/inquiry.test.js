import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { renderInquiryForm, inquiryArtwork } from '../src/inquiry-content.js';
import { validateInquiryFiles } from '../src/inquiry-validation.js';
import { createInquiryHandler, detectAttachmentType, parseInquiryMultipart, readInquiryConfig, validateInquiryFields } from '../server/inquiry.mjs';

const origin = 'https://h4ngelic.com';
const now = () => 1800000000000;
const config = { apiKey: 'mock-test-key', from: 'inquiries@h4ngelic.com', allowedOrigins: [origin] };
const fields = { name: 'a visitor', email: 'visitor@example.com', message: 'a real question', artwork: '', started: String(now() - 2000), website: '' };

function multipart(values = fields, files = [], boundary = 'h4-test-boundary') {
  const pieces = [];
  for (const [name, value] of Object.entries(values)) pieces.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  for (const file of files) pieces.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="attachments"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`), file.bytes, Buffer.from('\r\n'));
  pieces.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(pieces), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function request(handler, { values = fields, files = [], headers = {}, method = 'POST', url = '/api/inquiry', bodyOverride, ip = '127.0.0.1' } = {}) {
  const { body, contentType } = multipart(values, files);
  const req = Readable.from([bodyOverride || body]);
  req.url = url; req.method = method; req.socket = { remoteAddress: ip };
  req.headers = { origin, 'sec-fetch-site': 'same-origin', 'content-type': contentType, ...headers };
  const res = { headersSent: false, destroyed: false,
    writeHead(status, sentHeaders) { this.status = status; this.headers = sentHeaders; this.headersSent = true; },
    end(value) { this.body = JSON.parse(value); },
  };
  await handler(req, res);
  return res;
}

test('inquiry renders semantic native form with real email fallback and no fabricated artwork', () => {
  const html = renderInquiryForm({ context: '<script>', id: '"><img>' });
  assert.match(html, /method="post" enctype="multipart\/form-data"/);
  assert.match(html, /name="name"[^>]*required/);
  assert.match(html, /type="email"[^>]*required/);
  assert.match(html, /name="attachments"[^>]*multiple/);
  assert.match(html, /mailto:h4ngelic@gmail.com/);
  assert.match(html, /id="inquiry-name"/);
  assert.doesNotMatch(html, /<script>|<img>/);
  assert.equal(inquiryArtwork('not-a-real-project'), undefined);
  assert.match(renderInquiryForm({ context: 'green-black-original' }), /regarding green black original/);
});

test('client checks attachment count, total size, per-file size and allowed types', () => {
  const valid = { name: 'reference.jpg', type: 'image/jpeg', size: 1024 };
  assert.equal(validateInquiryFiles([valid]), '');
  assert.match(validateInquiryFiles(Array(6).fill(valid)), /up to 5/);
  assert.match(validateInquiryFiles([{ ...valid, size: 6 * 1024 * 1024 }]), /5 MB/);
  assert.match(validateInquiryFiles(Array(3).fill({ ...valid, size: 5 * 1024 * 1024 })), /12 MB/);
  assert.match(validateInquiryFiles([{ ...valid, name: 'script.svg', type: 'image/svg+xml' }]), /choose jpg/);
  assert.match(validateInquiryFiles([{ ...valid, name: 'image.jpg.exe' }]), /choose jpg/);
  assert.match(validateInquiryFiles([{ ...valid, size: 0 }]), /choose jpg/);
});

test('server recognizes supported binary signatures and rejects SVG or disguised HTML', () => {
  assert.equal(detectAttachmentType(Buffer.from([255, 216, 255, 0])), 'image/jpeg');
  assert.equal(detectAttachmentType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'image/png');
  assert.equal(detectAttachmentType(Buffer.from('RIFFxxxxWEBPdata')), 'image/webp');
  assert.equal(detectAttachmentType(Buffer.from('GIF89adata')), 'image/gif');
  assert.equal(detectAttachmentType(Buffer.from('%PDF-1.7\ndata')), 'application/pdf');
  const avif = Buffer.from([0, 0, 0, 20, ...Buffer.from('ftypavif0000avif')]);
  assert.equal(detectAttachmentType(avif), 'image/avif');
  assert.equal(detectAttachmentType(Buffer.from('<svg>')), '');
  assert.equal(detectAttachmentType(Buffer.from('<html>')), '');
});

test('binary parser preserves attachment bytes including a false boundary prefix', () => {
  const bytes = Buffer.concat([Buffer.from([255, 216, 255]), Buffer.from('\r\n--h4-test-boundary-incorrect\r\nremaining-binary')]);
  const { body, contentType } = multipart(fields, [{ name: 'reference.jpg', type: 'image/jpeg', bytes }]);
  const result = parseInquiryMultipart(body, contentType);
  assert.equal(result.fields.message, fields.message);
  assert.equal(result.attachments.length, 1);
  assert.ok(Buffer.from(result.attachments[0].content, 'base64').equals(bytes));
});

test('parser rejects malformed, duplicate and forbidden fields and unsafe attachment data', () => {
  assert.throws(() => parseInquiryMultipart(Buffer.from('bad'), 'multipart/form-data; boundary=x'), /invalid form data/);
  assert.throws(() => parseInquiryMultipart(Buffer.from(''), 'multipart/form-data; boundary="bad\r\nheader"'), /encoding/);
  const duplicate = multipart({ name: 'hello' });
  const closing = duplicate.body.lastIndexOf('--h4-test-boundary--');
  const duplicated = Buffer.concat([duplicate.body.subarray(0, closing), duplicate.body]);
  assert.throws(() => parseInquiryMultipart(duplicated, duplicate.contentType), /invalid form field/);
  const unknown = multipart({ ...fields, recipient: 'attacker@example.com' });
  assert.throws(() => parseInquiryMultipart(unknown.body, unknown.contentType), /invalid form field/);
  for (const file of [
    { name: 'fake.jpg', type: 'image/jpeg', bytes: Buffer.from('<script>') },
    { name: 'real.jpg', type: 'text/html', bytes: Buffer.from([255, 216, 255]) },
    { name: 'fake.svg', type: 'image/svg+xml', bytes: Buffer.from('<svg>') },
    { name: 'mismatch.pdf', type: 'application/pdf', bytes: Buffer.from([255, 216, 255]) },
  ]) {
    const data = multipart(fields, [file]);
    assert.throws(() => parseInquiryMultipart(data.body, data.contentType), /genuine jpg/);
  }
});

test('binary parser enforces actual file and total-byte limits independently of headers', () => {
  const small = { name: 'reference.jpg', type: 'image/jpeg', bytes: Buffer.from([255, 216, 255]) };
  const many = multipart(fields, Array(6).fill(small));
  assert.throws(() => parseInquiryMultipart(many.body, many.contentType), /up to 5 files/);
  const tooLarge = multipart(fields, [{ ...small, bytes: Buffer.concat([small.bytes, Buffer.alloc(5 * 1024 * 1024)]) }]);
  assert.throws(() => parseInquiryMultipart(tooLarge.body, tooLarge.contentType), /5 MB/);
  const fourMiB = Buffer.alloc(4 * 1024 * 1024 + 1); small.bytes.copy(fourMiB);
  const tooMuch = multipart(fields, Array(3).fill({ ...small, bytes: fourMiB }));
  assert.throws(() => parseInquiryMultipart(tooMuch.body, tooMuch.contentType), /12 MB in total/);
});

test('filename handling preserves Unicode and strips path/control hazards', () => {
  const file = { name: '../../tätowierung-日本語.pdf', type: 'application/pdf', bytes: Buffer.from('%PDF-1.7') };
  const { body, contentType } = multipart(fields, [file]);
  assert.equal(parseInquiryMultipart(body, contentType).attachments[0].filename, 'tätowierung-日本語.pdf');
  const invalidText = multipart({ name: 'PLACEHOLDER' });
  const at = invalidText.body.indexOf('PLACEHOLDER');
  invalidText.body[at] = 0xff;
  assert.throws(() => parseInquiryMultipart(invalidText.body, invalidText.contentType), /text encoding/);
  const duplicateHeader = Buffer.from(body.toString().replace('Content-Type: application/pdf', 'Content-Type: application/pdf\r\nContent-Type: text/html'));
  assert.throws(() => parseInquiryMultipart(duplicateHeader, contentType), /invalid form headers/);
});

test('server independently validates required fields, header injection, honeypot, timing and genuine artwork context', () => {
  assert.equal(validateInquiryFields(fields, now()).email, fields.email);
  assert.equal(validateInquiryFields({ ...fields, message: '' }, now()).message, '');
  assert.equal(validateInquiryFields({ ...fields, started: '' }, now()).name, fields.name, 'native no-JS submissions remain valid');
  for (const change of [{ name: '' }, { name: '\r\nBcc: attacker' }, { email: 'visitor@example.com\r\nBcc:x' }, { website: 'bot' }, { started: String(now() - 10) }, { started: 'NaN' }, { artwork: 'fake-project' }, { message: 'x'.repeat(8001) }]) assert.throws(() => validateInquiryFields({ ...fields, ...change }, now()));
  for (const email of ['a,b@example.com', 'name <visitor@example.com>', '.visitor@example.com', 'visitor..name@example.com', 'visitor@-example.com']) assert.throws(() => validateInquiryFields({ ...fields, email }, now()));
  assert.equal(validateInquiryFields({ ...fields, artwork: 'green-black-original' }, now()).artwork, 'green-black-original');
});

test('missing email credentials return 503 without reading or pretending to send', async () => {
  let fetched = false;
  const handler = createInquiryHandler({ config: { ...config, apiKey: '' }, fetchImpl: async () => { fetched = true; } });
  const result = await request(handler);
  assert.equal(result.status, 503); assert.equal(fetched, false); assert.equal(result.body.accepted, undefined);
});

test('origin, cross-site, method and body-size protections reject before provider access', async () => {
  let fetched = false;
  const handler = createInquiryHandler({ config, fetchImpl: async () => { fetched = true; } });
  assert.equal((await request(handler, { headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request(handler, { headers: { origin: undefined } })).status, 403);
  assert.equal((await request(handler, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await request(handler, { method: 'GET' })).status, 405);
  assert.equal((await request(handler, { url: '/not-api' })).status, 404);
  assert.equal((await request(handler, { url: 'http://[' })).status, 400);
  assert.equal((await request(handler, { headers: { 'content-length': String(13 * 1024 * 1024) } })).status, 413);
  assert.equal(fetched, false);
});

test('provider mock receives fixed recipient, reply-to and intact attachment; only accepted ID produces success', async () => {
  let captured;
  const file = { name: 'reference.pdf', type: 'application/pdf', bytes: Buffer.from('%PDF-1.7\nreference') };
  const handler = createInquiryHandler({ config, now, fetchImpl: async (url, options) => { captured = { url, options, payload: JSON.parse(options.body) }; return { ok: true, json: async () => ({ id: 'mock-provider-id' }) }; } });
  const result = await request(handler, { files: [file], values: { ...fields, artwork: 'green-black-original' } });
  assert.equal(result.status, 202); assert.equal(result.body.accepted, true); assert.ok(result.body.id);
  assert.equal(captured.url, 'https://api.resend.com/emails');
  assert.deepEqual(captured.payload.to, ['h4ngelic@gmail.com']);
  assert.equal(captured.payload.reply_to, fields.email);
  assert.equal(captured.payload.from, config.from);
  assert.match(captured.payload.text, /https:\/\/h4ngelic.com\/work\/digital-artworks\/green-black-original/);
  assert.ok(Buffer.from(captured.payload.attachments[0].content, 'base64').equals(file.bytes));
  assert.equal(result.headers['Cache-Control'], 'no-store');
});

test('provider rejection, missing acceptance ID and transport failure never claim success', async () => {
  for (const fetchImpl of [
    async () => ({ ok: false, json: async () => ({ error: 'invalid key' }) }),
    async () => ({ ok: true, json: async () => ({}) }),
    async () => { throw new Error('private provider diagnostic'); },
  ]) {
    const result = await request(createInquiryHandler({ config, now, fetchImpl }));
    assert.equal(result.status, 502); assert.equal(result.body.accepted, undefined);
    assert.doesNotMatch(JSON.stringify(result.body), /private provider/);
  }
});

test('bounded per-socket rate limit does not trust forged proxy headers', async () => {
  let calls = 0;
  const handler = createInquiryHandler({ config, now, fetchImpl: async () => { calls++; return { ok: true, json: async () => ({ id: 'mock' }) }; } });
  for (let index = 0; index < 3; index++) assert.equal((await request(handler, { headers: { 'x-forwarded-for': `fake-${index}` } })).status, 202);
  const blocked = await request(handler, { headers: { 'x-forwarded-for': 'a-fourth-fake' } });
  assert.equal(blocked.status, 429); assert.equal(calls, 3); assert.equal(blocked.headers['Retry-After'], '600');
});

test('actual streamed bytes are bounded even without Content-Length', async () => {
  let calls = 0;
  const handler = createInquiryHandler({ config, now, fetchImpl: async () => { calls++; } });
  const result = await request(handler, { bodyOverride: Buffer.alloc(13 * 1024 * 1024) });
  assert.equal(result.status, 413); assert.equal(calls, 0);
});

test('in-flight provider requests are bounded and slots are released after completion', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const handler = createInquiryHandler({ config, now, fetchImpl: async () => {
    calls++; await gate; return { ok: true, json: async () => ({ id: 'mock' }) };
  } });
  const pending = Array.from({ length: 4 }, (_, index) => request(handler, { ip: `127.0.0.${index + 1}` }));
  for (let index = 0; index < 20 && calls < 4; index++) await new Promise(setImmediate);
  assert.equal(calls, 4);
  assert.equal((await request(handler, { ip: '127.0.0.5' })).status, 429);
  release();
  assert.ok((await Promise.all(pending)).every(result => result.status === 202));
  assert.equal((await request(handler, { ip: '127.0.0.6' })).status, 202);
});

test('rate-identity storage has a fixed cap and expired entries release capacity', async () => {
  let time = now();
  const handler = createInquiryHandler({ config, now: () => time, fetchImpl: async () => { throw new Error('must not send'); } });
  const oversized = { 'content-length': String(13 * 1024 * 1024) };
  for (let index = 0; index < 2000; index++) assert.equal((await request(handler, { ip: `test-address-${index}`, headers: oversized })).status, 413);
  assert.equal((await request(handler, { ip: 'new-identity', headers: oversized })).status, 429);
  time += 10 * 60 * 1000;
  assert.equal((await request(handler, { ip: 'new-identity', headers: oversized })).status, 413);
});

test('configuration accepts only exact origins and keeps credentials server-only', () => {
  const result = readInquiryConfig({ RESEND_API_KEY: 'test', INQUIRY_FROM: 'sender@example.com', INQUIRY_ALLOWED_ORIGINS: `${origin},javascript:alert(1),https://evil.example/path` });
  assert.deepEqual(result.allowedOrigins, [origin]);
  const markup = renderInquiryForm();
  assert.doesNotMatch(markup, /RESEND_API_KEY|Authorization|test-key/);
});
