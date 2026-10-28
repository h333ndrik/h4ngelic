import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { inquirySettings as limits } from '../src/data/inquirySettings.js';
import { inquiryArtwork } from '../src/inquiry-content.js';
import { validateInquiryContact } from '../src/inquiry-validation.js';

const RECIPIENT = 'h4ngelic@gmail.com';
const MAX_BODY = limits.maximumTotalBytes + 64 * 1024;
const ALLOWED_FIELDS = new Set(['name', 'email', 'message', 'artwork', 'started', 'website']);
const RATE_WINDOW = 10 * 60 * 1000;
const MIME_EXTENSIONS = { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'image/avif': ['avif'], 'image/gif': ['gif'], 'application/pdf': ['pdf'] };
const utf8 = new TextDecoder('utf-8', { fatal: true });

class InquiryError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function address(value) {
  if (typeof value !== 'string' || value.length > 254) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')
    || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  const labels = domain.split('.');
  return labels.length >= 2 && labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

/** Never trust the browser's MIME claim or filename extension alone. */
export function detectAttachmentType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6))) return 'image/gif';
  if (bytes.length >= 16 && bytes.toString('ascii', 4, 8) === 'ftyp') {
    const boxLength = bytes.readUInt32BE(0);
    if (boxLength >= 16 && boxLength <= bytes.length) {
      const brands = [bytes.toString('ascii', 8, 12)];
      for (let offset = 16; offset + 4 <= Math.min(boxLength, 128); offset += 4) brands.push(bytes.toString('ascii', offset, offset + 4));
      if (brands.some(brand => brand === 'avif' || brand === 'avis')) return 'image/avif';
    }
  }
  if (bytes.length >= 5 && bytes.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return '';
}

function safeFilename(name) {
  return name.replaceAll('\\', '/').split('/').at(-1).replace(/[\x00-\x1f\x7f"<>]/g, '_').slice(-120) || 'reference';
}

/** A bounded, strict multipart parser. Binary content is never converted into
 * strings; only a valid delimiter line ends a part. No disk files are created. */
export function parseInquiryMultipart(body, contentType) {
  if (body.length > MAX_BODY) throw new InquiryError(413, 'please keep the references below 12 MB in total.');
  const match = /^multipart\/form-data\s*;\s*boundary=(?:"([^"\r\n]+)"|([^;\s]+))\s*$/i.exec(contentType || '');
  const boundary = match?.[1] || match?.[2];
  if (!boundary || !/^[0-9A-Za-z'()+_,\-./:=?]{1,70}$/.test(boundary)) throw new InquiryError(400, 'invalid form encoding.');
  const delimiter = Buffer.from(`--${boundary}`);
  const separator = Buffer.from(`\r\n--${boundary}`);
  if (!body.subarray(0, delimiter.length).equals(delimiter)) throw new InquiryError(400, 'invalid form data.');
  const fields = {}, attachments = [];
  let cursor = delimiter.length, parts = 0, totalFileBytes = 0;
  while (true) {
    if (body.subarray(cursor, cursor + 2).toString() === '--') {
      const tail = body.subarray(cursor + 2);
      if (tail.length && !tail.equals(Buffer.from('\r\n'))) throw new InquiryError(400, 'invalid form ending.');
      break;
    }
    if (body.subarray(cursor, cursor + 2).toString() !== '\r\n' || ++parts > 12) throw new InquiryError(400, 'invalid form data.');
    cursor += 2;
    const headerEnd = body.indexOf('\r\n\r\n', cursor);
    if (headerEnd < 0 || headerEnd - cursor > 2048) throw new InquiryError(400, 'invalid form headers.');
    let headerText;
    try { headerText = utf8.decode(body.subarray(cursor, headerEnd)); }
    catch { throw new InquiryError(400, 'invalid form headers.'); }
    const lines = headerText.split('\r\n');
    const headers = {};
    for (const line of lines) {
      const colon = line.indexOf(':');
      if (colon < 1 || /[\x00-\x1f\x7f]/.test(line)) throw new InquiryError(400, 'invalid form headers.');
      const key = line.slice(0, colon).toLowerCase();
      if (!/^[a-z-]+$/.test(key) || headers[key] !== undefined || !['content-disposition', 'content-type'].includes(key)) throw new InquiryError(400, 'invalid form headers.');
      headers[key] = line.slice(colon + 1).trim();
    }
    const disposition = /^form-data;\s*name="([a-z]+)"(?:;\s*filename="([^"\r\n]*)")?$/i.exec(headers['content-disposition'] || '');
    if (!disposition) throw new InquiryError(400, 'invalid form field.');
    const name = disposition[1];
    let end = body.indexOf(separator, headerEnd + 4);
    while (end >= 0) {
      const after = end + separator.length;
      const suffix = body.subarray(after, after + 2).toString();
      if (suffix === '--' || suffix === '\r\n') break;
      end = body.indexOf(separator, end + 1);
    }
    if (end < 0) throw new InquiryError(400, 'incomplete form data.');
    const data = body.subarray(headerEnd + 4, end);
    const filename = disposition[2];
    if (filename !== undefined) {
      if (name !== 'attachments') throw new InquiryError(400, 'unexpected attachment field.');
      // Browsers include an empty multipart file when no attachment was chosen.
      if (filename || data.length) {
        if (attachments.length >= limits.maximumFiles) throw new InquiryError(413, 'please choose up to 5 files.');
        if (!data.length || data.length > limits.maximumFileBytes) throw new InquiryError(413, 'each reference must be between 1 byte and 5 MB.');
        totalFileBytes += data.length;
        if (totalFileBytes > limits.maximumTotalBytes) throw new InquiryError(413, 'please keep the references below 12 MB in total.');
        const type = detectAttachmentType(data);
        const extension = filename.split('.').at(-1).toLowerCase();
        if (!type || !MIME_EXTENSIONS[type].includes(extension)
          || headers['content-type'] && ![type, 'application/octet-stream'].includes(headers['content-type'].toLowerCase())) {
          throw new InquiryError(415, 'please choose genuine jpg, png, webp, avif, gif or pdf files.');
        }
        attachments.push({ filename: safeFilename(filename), content_type: type, content: data.toString('base64') });
      }
    } else {
      if (!ALLOWED_FIELDS.has(name) || Object.hasOwn(fields, name) || data.length > 32000) throw new InquiryError(400, 'invalid form field.');
      try { fields[name] = utf8.decode(data); }
      catch { throw new InquiryError(400, 'invalid form text encoding.'); }
    }
    cursor = end + separator.length;
  }
  return { fields, attachments };
}

export function validateInquiryFields(fields, now = Date.now()) {
  const name = (fields.name || '').trim();
  const email = (fields.email || '').trim();
  const message = (fields.message || '').trim();
  if (!name || name.length > limits.maximumNameLength || /[\x00-\x1f\x7f]/.test(fields.name || '')) throw new InquiryError(400, 'please enter your name.');
  const contactError = validateInquiryContact(fields.email);
  if (contactError) throw new InquiryError(400, contactError);
  if (message.length > limits.maximumMessageLength || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(message)) throw new InquiryError(400, 'please keep the message below 8000 characters.');
  if (fields.website) throw new InquiryError(400, 'the inquiry could not be accepted.');
  if (fields.started) {
    const elapsed = now - Number(fields.started);
    if (!Number.isFinite(elapsed) || elapsed < 800 || elapsed > 24 * 60 * 60 * 1000) throw new InquiryError(400, 'please wait a moment, or reload the form and try again.');
  }
  const project = fields.artwork ? inquiryArtwork(fields.artwork) : null;
  if (fields.artwork && !project) throw new InquiryError(400, 'the artwork reference is unavailable.');
  return { name, email, message, artwork: project?.id || '', artworkTitle: project?.title || project?.id || '' };
}

export function readInquiryConfig(env = process.env) {
  const values = (env.INQUIRY_ALLOWED_ORIGINS || 'https://h4ngelic.com').split(',').map(value => value.trim()).filter(Boolean);
  const allowedOrigins = values.filter(value => {
    try { const url = new URL(value); return /^https?:$/.test(url.protocol) && url.origin === value; } catch { return false; }
  });
  return { apiKey: env.RESEND_API_KEY || '', from: env.INQUIRY_FROM || '', allowedOrigins };
}

function respond(res, status, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(JSON.stringify(body));
}

/** The only outbound destination is Resend's HTTPS email API. Neither request
 * fields nor environment variables can override the recipient or API origin. */
export function createInquiryHandler({ config = readInquiryConfig(), fetchImpl = fetch, now = Date.now } = {}) {
  const rates = new Map();
  let inFlight = 0;
  const configured = Boolean(config.apiKey && address(config.from) && config.allowedOrigins.length);
  return async function inquiryHandler(req, res) {
    let path;
    try { path = new URL(req.url, 'http://inquiry.invalid').pathname; }
    catch { return respond(res, 400, { error: 'invalid request URL.' }); }
    if (path !== '/api/inquiry') return respond(res, 404, { error: 'not found.' });
    if (req.method !== 'POST') return respond(res, 405, { error: 'use the inquiry form to send a message.' }, { Allow: 'POST' });
    if (!configured) return respond(res, 503, { error: 'inquiry delivery is not configured yet.' });
    const origin = req.headers.origin;
    if (typeof origin !== 'string' || !config.allowedOrigins.includes(origin) || req.headers['sec-fetch-site'] === 'cross-site') return respond(res, 403, { error: 'this form cannot be submitted from another website.' });
    // Trust the direct socket only. Forwarded headers are not a visitor identity.
    // A reverse proxy should apply its own edge rate limit before this service.
    const ip = req.socket.remoteAddress || 'unknown';
    const time = now();
    for (const [key, value] of rates) if (time - value.started >= RATE_WINDOW) rates.delete(key);
    if ((!rates.has(ip) && rates.size >= 2000) || inFlight >= 4) return respond(res, 429, { error: 'please try again later.' }, { 'Retry-After': '600' });
    const rate = rates.get(ip) || { started: time, count: 0 };
    rates.set(ip, rate);
    if (++rate.count > 3) return respond(res, 429, { error: 'please wait a little before trying again.' }, { 'Retry-After': String(Math.ceil((RATE_WINDOW - (time - rate.started)) / 1000)) });
    const declared = req.headers['content-length'];
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY)) return respond(res, 413, { error: 'please keep the references below 12 MB in total.' });
    inFlight++;
    let timer;
    try {
      const chunks = [];
      let bytes = 0;
      timer = setTimeout(() => req.destroy(new InquiryError(408, 'the upload took too long.')), 15000);
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > MAX_BODY) throw new InquiryError(413, 'please keep the references below 12 MB in total.');
        chunks.push(chunk);
      }
      clearTimeout(timer);
      const parsed = parseInquiryMultipart(Buffer.concat(chunks, bytes), req.headers['content-type']);
      const fields = validateInquiryFields(parsed.fields, now());
      const requestId = randomUUID();
      const text = [`name: ${fields.name}`, `how to reach you: ${fields.email}`, ...(fields.artwork ? [`artwork: ${fields.artworkTitle}`, `https://h4ngelic.com/work/${inquiryArtwork(fields.artwork).category}/${fields.artwork}`] : []), '', fields.message || '(no message supplied)'].join('\n');
      let response;
      try {
        response = await fetchImpl('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(12000), headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `h4-inquiry-${requestId}` }, body: JSON.stringify({ from: config.from, to: [RECIPIENT], ...(address(fields.email) ? { reply_to: fields.email } : {}), subject: 'new h4ngelic inquiry', text, ...(parsed.attachments.length ? { attachments: parsed.attachments } : {}) }) });
      } catch { throw new InquiryError(502, 'your inquiry could not be sent. please try again or email instead.'); }
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.id !== 'string' || !result.id) throw new InquiryError(502, 'your inquiry could not be sent. please try again or email instead.');
      // Provider acceptance is not a claim of inbox delivery. Do not log the
      // email, contents, filenames or references, or persist them on disk.
      return respond(res, 202, { accepted: true, id: requestId });
    } catch (error) {
      if (!res.headersSent && !res.destroyed) respond(res, error instanceof InquiryError ? error.status : 400, { error: error instanceof InquiryError ? error.message : 'the inquiry could not be read. please try again.' });
    } finally { clearTimeout(timer); inFlight--; }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.INQUIRY_PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INQUIRY_PORT must be a valid port.');
  const server = createServer(createInquiryHandler());
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 30;
  server.listen(port, '127.0.0.1', () => console.log(`Inquiry service listening on 127.0.0.1:${port}. No messages are logged.`));
}
