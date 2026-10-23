/** Escape editable content before inserting it into an HTML template. */
export function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

/** Permit site-relative destinations or explicit HTTPS URLs; reject code URLs. */
export function contentURL(value, { relative = true } = {}) {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (!url || /[\u0000-\u0020\u007f\\]/.test(url)) return '';
  if (relative && /^\/(?!\/)/.test(url)) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : '';
  } catch {
    return '';
  }
}

export function emailURL(value) {
  if (typeof value !== 'string') return '';
  const address = value.trim();
  return /^[^\s@<>?&#]+@[^\s@<>?&#]+\.[^\s@<>?&#]+$/.test(address) ? `mailto:${address}` : '';
}
