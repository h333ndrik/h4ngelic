import { inquirySettings as settings } from './data/inquirySettings.js';

/** The existing multipart field name stays compatible with the mail adapter,
 * but a reply channel can be an email, social handle, telephone or other text. */
export function validateInquiryContact(value) {
  return typeof value !== 'string' || !value.trim() || value.trim().length > 254 || /[\x00-\x1f\x7f]/.test(value)
    ? 'please enter how to reach you.' : '';
}

/** Client-side convenience checks; the server independently inspects bytes. */
export function validateInquiryFiles(files, fields = {}) {
  if (files.length > settings.maximumFiles) return 'please choose up to 5 files.';
  if (files.some(file => file.size > settings.maximumFileBytes)) return 'each reference must be 4 MB or smaller.';
  const fileBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (fileBytes > settings.maximumTotalBytes) return 'please keep the references below 4 MB in total.';
  if (files.some(file => !file.size || !/\.(?:jpe?g|png|webp|avif|gif|pdf)$/i.test(file.name)
    || file.type && !settings.supportedTypes.includes(file.type))) return 'please choose jpg, png, webp, avif, gif or pdf files.';
  const textBytes = Object.values(fields).reduce((sum, value) => sum + new TextEncoder().encode(String(value ?? '')).length, 0);
  const requestBytes = fileBytes + textBytes + 512 + files.length * 256;
  if (requestBytes > settings.maximumRequestBytes) return 'please keep the whole message and references below 4 MB.';
  return '';
}
