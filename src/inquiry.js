import './inquiry.css';
import { inquirySettings as settings } from './data/inquirySettings.js';
import { inquiryArtwork } from './inquiry-content.js';
import { validateInquiryFiles } from './inquiry-validation.js';
export { validateInquiryFiles } from './inquiry-validation.js';

/** Progressive enhancement only: ordinary labels, input validation and native
 * multipart form submission remain available without JavaScript. */
export function initInquiry(root = document) {
  const doc = root.ownerDocument || root;
  const view = doc.defaultView;
  const disposers = [];
  for (const form of root.querySelectorAll('[data-inquiry-form]')) {
    const input = form.querySelector('[type=file]');
    const list = form.querySelector('[data-inquiry-files]');
    const error = form.querySelector('[data-inquiry-file-error]');
    const status = form.querySelector('[data-inquiry-status]');
    const fallback = form.querySelector('[data-inquiry-email-fallback]');
    const contextInput = form.querySelector('[data-inquiry-artwork]');
    const contextLabel = form.querySelector('[data-inquiry-context]');
    const started = form.querySelector('[data-inquiry-started]');
    const controls = [...form.querySelectorAll('input, textarea, button')];
    const originalDisabled = new Map(controls.map(control => [control, control.disabled]));
    const offline = doc.documentElement.dataset.preview === 'standalone';
    let files = [], objectURLs = [], controller = null, disposed = false;
    form.dataset.enhanced = '';
    started.value = String(Date.now());
    let url;
    try { url = new URL(offline ? view.location.hash.slice(1) : view.location.href, 'https://preview.invalid'); } catch { /* Invalid optional URL context is ignored. */ }
    const project = inquiryArtwork(url?.searchParams.get('artwork'));
    if (project) {
      contextInput.value = project.id;
      contextLabel.textContent = `regarding ${project.title || project.id.replaceAll('-', ' ')}.`;
      contextLabel.hidden = false;
    }
    const setStatus = (text, state = '') => { status.textContent = text; status.dataset.state = state; };
    const clearURLs = () => { for (const url of objectURLs) view.URL.revokeObjectURL(url); objectURLs = []; };
    function renderFiles(focusIndex) {
      clearURLs();
      list.replaceChildren();
      files.forEach((file, index) => {
        const row = doc.createElement('li'); row.className = 'inquiry-file-row';
        if (/^image\//.test(file.type)) {
          const image = doc.createElement('img');
          image.alt = ''; image.width = image.height = 48;
          image.src = view.URL.createObjectURL(file); objectURLs.push(image.src);
          row.append(image);
        }
        const label = doc.createElement('span');
        label.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
        const remove = doc.createElement('button');
        remove.type = 'button'; remove.className = 'inquiry-file-remove'; remove.textContent = 'remove';
        remove.setAttribute('aria-label', `remove ${file.name}`);
        remove.addEventListener('click', () => {
          files.splice(index, 1); error.textContent = ''; input.removeAttribute('aria-invalid');
          renderFiles(Math.min(index, files.length - 1));
        }, { once: true });
        row.append(label, remove); list.append(row);
      });
      if (typeof focusIndex === 'number') (list.querySelectorAll('button')[focusIndex] || input).focus({ preventScroll: true });
    }
    function change() {
      const additions = [...input.files];
      const combined = files.slice();
      for (const file of additions) if (!combined.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) combined.push(file);
      const message = validateInquiryFiles(combined);
      error.textContent = message;
      if (message) input.setAttribute('aria-invalid', 'true');
      else { input.removeAttribute('aria-invalid'); files = combined; renderFiles(); }
      input.value = '';
    }
    async function send(event) {
      event.preventDefault();
      if (controller || !form.reportValidity()) return;
      if (offline) {
        setStatus('sending is unavailable in this downloaded preview. please email your inquiry instead.', 'error');
        fallback.hidden = false; return;
      }
      const message = validateInquiryFiles(files);
      if (message) { error.textContent = message; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      const body = new FormData(form);
      body.delete('attachments');
      for (const file of files) body.append('attachments', file, file.name);
      controller = new AbortController();
      const activeController = controller;
      const timeout = view.setTimeout(() => activeController.abort(), 25000);
      for (const control of controls) control.disabled = true;
      for (const remove of list.querySelectorAll('button')) remove.disabled = true;
      form.setAttribute('aria-busy', 'true');
      setStatus(files.length ? 'sending your inquiry and references…' : 'sending your inquiry…');
      try {
        const response = await view.fetch(settings.endpoint, { method: 'POST', body, signal: activeController.signal, credentials: 'same-origin', headers: { Accept: 'application/json' } });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.accepted !== true || typeof result.id !== 'string' || !result.id) {
          throw new Error(response.status === 429 ? 'please wait a little before trying again.'
            : response.status === 503 ? 'inquiry delivery is not configured yet. please email your inquiry instead.'
              : result?.error && response.status >= 400 && response.status < 500 ? String(result.error).slice(0, 240)
                : 'your inquiry could not be sent. please try again or email instead.');
        }
        if (disposed) return;
        setStatus("thank you. i'll get back to you.", 'success');
        form.reset(); files = []; renderFiles();
        contextInput.value = ''; contextLabel.hidden = true; started.value = String(Date.now());
      } catch (failure) {
        if (!disposed) {
          setStatus(failure.name === 'AbortError' ? 'the request took too long. please try again or email instead.' : failure.message, 'error');
          fallback.hidden = false;
        }
      } finally {
        view.clearTimeout(timeout);
        controller = null;
        if (!disposed) {
          for (const control of controls) control.disabled = originalDisabled.get(control);
          for (const remove of list.querySelectorAll('button')) remove.disabled = false;
          form.removeAttribute('aria-busy');
        }
      }
    }
    input.addEventListener('change', change);
    form.addEventListener('submit', send);
    disposers.push(() => { disposed = true; controller?.abort(); input.removeEventListener('change', change); form.removeEventListener('submit', send); clearURLs(); });
  }
  return () => { for (const dispose of disposers) dispose(); };
}
