import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inquirySettings as settings } from '../src/data/inquirySettings.js';
import { validateInquiryContact } from '../src/inquiry-validation.js';
import { GENERIC_INQUIRY_FAILURE } from '../server/inquiry.mjs';

const expectedFailureBody = Buffer.from(JSON.stringify({ error: GENERIC_INQUIRY_FAILURE }));
const defaults = {
  name: 'mail-01 smoke',
  mail: 'smoke@example.invalid',
  text: 'mail-01 delivery smoke; no reply needed.',
};

function finish(result, summary, failed = false) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.stderr.write(`${summary}\n`);
  process.exitCode = failed ? 1 : 0;
}

function readOptions() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      url: { type: 'string', short: 'u' },
      name: { type: 'string' },
      mail: { type: 'string' },
      text: { type: 'string' },
    },
  });
  return {
    url: values.url ?? positionals[0] ?? process.env.SMOKE_URL ?? '',
    name: values.name ?? process.env.SMOKE_NAME ?? defaults.name,
    mail: values.mail ?? process.env.SMOKE_MAIL ?? defaults.mail,
    text: values.text ?? process.env.SMOKE_TEXT ?? defaults.text,
  };
}

function previewURL(value) {
  const supplied = String(value || '').trim();
  const target = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(supplied) ? supplied : `https://${supplied}`);
  if (!/^https?:$/.test(target.protocol) || target.username || target.password) {
    throw new TypeError('SMOKE_URL must be an HTTP(S) preview URL without credentials.');
  }
  return target;
}

async function main() {
  const options = readOptions();
  if (!String(options.url).trim()) {
    finish({
      event: 'inquiry_smoke', status: null, bodyEqual: false, requestId: null,
      outcome: 'skipped', reason: 'SMOKE_URL not set',
    }, 'Inquiry smoke skipped: set SMOKE_URL to a preview base URL.');
    return;
  }

  let base;
  try { base = previewURL(options.url); }
  catch {
    finish({
      event: 'inquiry_smoke', status: null, bodyEqual: false, requestId: null,
      outcome: 'config_error', reason: 'invalid SMOKE_URL',
    }, 'Inquiry smoke not sent: SMOKE_URL is invalid.', true);
    return;
  }

  const name = String(options.name || '').trim();
  const mail = String(options.mail || '').trim();
  const text = String(options.text || '').trim();
  if (!name || name.length > settings.maximumNameLength || /[\x00-\x1f\x7f]/.test(name)) {
    finish({
      event: 'inquiry_smoke', status: null, bodyEqual: false, requestId: null,
      outcome: 'config_error', reason: 'invalid SMOKE_NAME',
    }, 'Inquiry smoke not sent: SMOKE_NAME is invalid.', true);
    return;
  }
  if (validateInquiryContact(mail)) {
    finish({
      event: 'inquiry_smoke', status: null, bodyEqual: false, requestId: null,
      outcome: 'config_error', reason: 'invalid SMOKE_MAIL',
    }, 'Inquiry smoke not sent: SMOKE_MAIL is invalid.', true);
    return;
  }
  if (!text || text.length > settings.maximumMessageLength || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) {
    finish({
      event: 'inquiry_smoke', status: null, bodyEqual: false, requestId: null,
      outcome: 'config_error', reason: 'invalid SMOKE_TEXT',
    }, 'Inquiry smoke not sent: SMOKE_TEXT is invalid.', true);
    return;
  }

  const body = new FormData();
  body.set('artwork', '');
  body.set('started', String(Date.now() - 2000));
  body.set('name', name);
  body.set('email', mail);
  body.set('message', text);
  body.set('website', '');

  let response;
  try {
    response = await fetch(new URL(settings.endpoint, `${base.origin}/`), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Origin: base.origin,
        'Sec-Fetch-Site': 'same-origin',
      },
      body,
      signal: AbortSignal.timeout(25000),
    });
  } catch (error) {
    finish({
      event: 'inquiry_smoke', status: null, bodyEqual: false, requestId: null,
      outcome: 'network_error', error: error?.name || 'NetworkError',
    }, 'Inquiry smoke could not reach the preview endpoint; check the URL and Vercel logs manually.', true);
    return;
  }

  const actualBody = Buffer.from(await response.arrayBuffer());
  let parsed = null;
  try { parsed = JSON.parse(actualBody.toString('utf8')); } catch { /* The byte check remains authoritative. */ }
  const bodyEqual = actualBody.equals(expectedFailureBody);
  const requestId = typeof parsed?.id === 'string' ? parsed.id : null;
  const mailFlowsOk = response.status === 200 || response.status === 201;
  const diagnosticObserved = response.status === 502 && bodyEqual;
  const outcome = mailFlowsOk ? 'mail_ok' : diagnosticObserved ? 'error_observed' : response.status === 502 ? 'body_mismatch' : 'unexpected_status';
  const conclusion = mailFlowsOk
    ? 'Mail-Flows o.k.; the earlier 502 was elsewhere or transient.'
    : diagnosticObserved
      ? 'Inquiry failure observed; read resend_rejected/resend_unreachable from Vercel function logs.'
      : 'Unexpected response; inspect Vercel edge/function logs before concluding a Resend cause.';
  finish({
    event: 'inquiry_smoke',
    status: response.status,
    bodyEqual,
    requestId,
    outcome,
    conclusion,
    submittedFields: ['artwork', 'started', 'name', 'email', 'message', 'website'],
    attachments: 0,
  }, `Inquiry smoke: HTTP ${response.status}; body-equal=${bodyEqual}; requestId=${requestId ?? 'not exposed'}; ${conclusion}`, !mailFlowsOk && !diagnosticObserved);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    finish({
      event: 'inquiry_smoke', status: null, bodyEqual: false, requestId: null,
      outcome: 'config_error',
    }, 'Inquiry smoke could not start; check the script arguments.', true);
  });
}
