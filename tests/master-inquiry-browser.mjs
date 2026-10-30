import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const out = new URL('../artifacts/v31/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
let currentProfile = null;
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
try {
  for (const width of [1440, 390, 320]) for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const errors = [], expected503Diagnostics = [], unexpectedConsoleErrors = [];
    let mock503Active = false;
    currentProfile = { width, reduced, errors, expected503Diagnostics, unexpectedConsoleErrors };
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const diagnostic = { message: message.text(), url: message.location().url || '' };
      let apiDiagnostic = false;
      try { apiDiagnostic = new URL(diagnostic.url).pathname === '/api/inquiry'; } catch { /* Missing/invalid locations remain unexpected. */ }
      // Chromium reports a failed-resource console error for the deliberately
      // mocked unavailable endpoint. Record that exact diagnostic separately;
      // unrelated errors, other URLs/status codes and real delivery failures fail.
      if (mock503Active && apiDiagnostic && /Failed to load resource/i.test(diagnostic.message) && /\b503\b/.test(diagnostic.message)) {
        expected503Diagnostics.push(diagnostic);
      } else unexpectedConsoleErrors.push(diagnostic);
    });
    await page.goto(`${base}/#contact`, { waitUntil: 'networkidle' });
    const inquiry = page.locator('[data-inquiry]');
    const form = page.locator('[data-inquiry-form]');
    await inquiry.locator('[data-inquiry-contact]').waitFor();
    assert.equal(await page.locator('[data-inquiry-form]').count(), 1);
    await page.waitForFunction(() => document.querySelector('[data-inquiry-form]').hasAttribute('data-enhanced'));
    await frames(page);
    const entrance = await inquiry.evaluate(node => {
      const parent = node.closest('.inquiry-enter');
      const style = getComputedStyle(parent);
      const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
      const heading = node.closest('#contact').querySelector('.kinetic-heading-text');
      return { duration: style.transitionDuration, opacity: Number(style.opacity), x: matrix.m41, y: matrix.m42,
        headingOpacity: Number(getComputedStyle(heading).opacity),
        oneShotAttributes: document.querySelectorAll('[data-inquiry-reveal], [data-inquiry-reveal-immediate]').length };
    });
    assert.equal(entrance.duration, '0s', 'The existing scroll clock owns the entrance without a second CSS transition.');
    assert.equal(entrance.oneShotAttributes, 0, 'The retired once-only observer attributes stay absent.');
    assert.equal(entrance.opacity, 1, 'Direct Contact navigation exposes the form immediately.');
    assert.equal(entrance.headingOpacity, 1);
    assert.ok(Math.abs(entrance.x) < .002 && Math.abs(entrance.y) < .002);
    const contact = form.locator('[data-inquiry-contact]');
    assert.equal(await contact.getAttribute('type'), 'text');
    assert.equal(await contact.getAttribute('required'), '');
    assert.equal(await contact.getAttribute('placeholder'), 'email, instagram, phone number...');
    assert.equal(await form.locator('[name=name]').getAttribute('placeholder'), 'max musterperson');
    assert.equal(await form.locator('label[for$="-email"] > span').innerText(), 'HOW TO REACH YOU');
    assert.equal(await form.locator('[name=message]').getAttribute('placeholder'), 'could be an inquiry, a question or just a thought.\nfeel free to write anything.');
    assert.equal(await form.locator('[data-inquiry-submit] > span').innerText(), 'SEND MESSAGE');
    assert.equal(await form.locator('.inquiry-privacy').count(), 0);
    const geometry = await form.locator('.inquiry-field').evaluateAll(labels => labels.map(label => {
      const field = label.querySelector('input,textarea');
      const a = label.querySelector('span').getBoundingClientRect(), b = field.getBoundingClientRect();
      const own = getComputedStyle(field), parent = getComputedStyle(label), placeholder = getComputedStyle(field, '::placeholder');
      return { gap: b.top - a.bottom, left: b.left, right: b.right,
        fieldBorder: own.borderBottomWidth, labelBorder: parent.borderBottomWidth,
        fieldBackground: own.backgroundColor, labelBackground: parent.backgroundColor,
        radius: own.borderRadius, shadow: own.boxShadow, outline: own.outlineWidth,
        placeholder: { fontSize: placeholder.fontSize, lineHeight: placeholder.lineHeight, color: placeholder.color,
          fontFamily: placeholder.fontFamily, fontWeight: placeholder.fontWeight, opacity: placeholder.opacity } };
    }));
    const surface = await page.evaluate(() => ({
      radius: getComputedStyle(document.documentElement).getPropertyValue('--radius-soft').trim(),
      panel: getComputedStyle(document.querySelector('.global-index-links')).backgroundColor,
    }));
    assert.ok(geometry.every(box => box.gap >= 0 && box.left >= 0 && box.right <= width), JSON.stringify(geometry));
    assert.ok(geometry.every(box => box.fieldBorder === '1px' && box.labelBorder === '0px'
      && box.fieldBackground !== 'rgba(0, 0, 0, 0)' && box.labelBackground === 'rgba(0, 0, 0, 0)'), JSON.stringify(geometry));
    assert.ok(geometry.every(box => box.radius === surface.radius && box.radius === '4px'
      && box.fieldBackground === surface.panel && box.shadow === 'none' && box.outline === '0px'),
    'One shared-radius field surface matches INDEX, without nested outlines or shadows.');
    const placeholderStyle = ({ lineHeight, ...style }) => style;
    assert.ok(geometry.every(box => JSON.stringify(placeholderStyle(box.placeholder)) === JSON.stringify(placeholderStyle(geometry[0].placeholder))),
      'Name, contact and message placeholders share typography, colour and opacity.');
    // Chromium exposes `normal` for single-line input placeholder line height,
    // even when the same 1.5 declaration also styles a multiline textarea.
    assert.equal(geometry[0].placeholder.lineHeight, geometry[1].placeholder.lineHeight);
    assert.equal(parseFloat(geometry[2].placeholder.lineHeight), parseFloat(geometry[2].placeholder.fontSize) * 1.5);
    const grid = await page.evaluate(() => ({ form: document.querySelector('[data-inquiry]').getBoundingClientRect().left,
      about: document.querySelector('.about-preview-copy').getBoundingClientRect().left }));
    assert.ok(Math.abs(grid.form - grid.about) < 1, JSON.stringify(grid));
    const before = await contact.boundingBox();
    await contact.focus();
    const after = await contact.boundingBox();
    assert.equal(after.width, before.width);
    assert.equal(after.height, before.height);
    assert.equal(after.x, before.x);
    assert.equal(await page.locator('[data-inquiry-reveal], [data-inquiry-reveal-immediate]').count(), 0);
    assert.equal(await inquiry.locator('..').evaluate(node => Number(getComputedStyle(node).opacity)), 1,
      'Keyboard focus keeps the complete inquiry immediately usable.');
    for (const value of ['visitor@example.com', '@browser-visitor', '+49 170 1234567']) {
      await contact.fill(value);
      assert.equal(await contact.evaluate(node => node.checkValidity()), true, value);
    }
    await contact.fill('   ');
    assert.equal(await contact.evaluate(node => node.checkValidity()), false);
    await form.locator('[name=name]').fill('Browser-only fixture');
    await contact.fill('@browser-visitor');
    await form.locator('[name=message]').fill('This is a browser test; no actual mail is sent.');
    await form.locator('[type=file]').setInputFiles({ name: 'reference.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nTest fixture') });
    await page.evaluate(() => {
      window.__v3InquiryForm = document.querySelector('[data-inquiry-form]');
      const link = document.createElement('a');
      link.id = 'v3-context-test-link'; link.href = '/?artwork=green-black-original#contact';
      link.textContent = 'browser-only navigation fixture';
      document.querySelector('[data-inquiry]').append(link);
    });
    await page.locator('#v3-context-test-link').click();
    await page.waitForURL('**/?artwork=green-black-original#contact');
    assert.equal(await form.locator('[data-inquiry-artwork]').inputValue(), 'green-black-original');
    assert.equal(await page.evaluate(() => window.__v3InquiryForm === document.querySelector('[data-inquiry-form]')), true);
    await page.locator('#v3-context-test-link').evaluate(link => { link.href = '/#contact'; });
    await page.locator('#v3-context-test-link').click();
    await page.waitForURL('**/#contact');
    assert.equal(await form.locator('[data-inquiry-artwork]').inputValue(), '');
    assert.equal(await form.locator('[data-inquiry-context]').isHidden(), true);
    assert.equal(await form.locator('[name=name]').inputValue(), 'Browser-only fixture');
    assert.equal(await contact.inputValue(), '@browser-visitor');
    assert.equal(await form.locator('[name=message]').inputValue(), 'This is a browser test; no actual mail is sent.');
    assert.equal(await form.locator('.inquiry-file-row').count(), 1);
    await page.locator('#v3-context-test-link').evaluate(link => link.remove());
    const submitted = [];
    mock503Active = true;
    await page.route('**/api/inquiry', async route => {
      submitted.push(route.request().postData());
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'delivery is not configured.' }) });
    });
    await form.locator('[data-inquiry-submit]').click();
    await page.waitForFunction(() => document.querySelector('[data-inquiry-status]').dataset.state === 'error');
    assert.equal(await form.locator('[name=name]').inputValue(), 'Browser-only fixture');
    assert.equal(await contact.inputValue(), '@browser-visitor');
    assert.equal(await form.locator('[name=message]').inputValue(), 'This is a browser test; no actual mail is sent.');
    assert.equal(await form.locator('.inquiry-file-row').count(), 1);
    assert.equal(await form.locator('[data-inquiry-email-fallback]').isVisible(), true);
    assert.ok(submitted[0].includes('@browser-visitor'));
    await page.unroute('**/api/inquiry');
    mock503Active = false;
    await page.route('**/api/inquiry', route => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ accepted: true, id: 'test-mock-only' }) }));
    await contact.fill('+49 170 1234567');
    await form.locator('[data-inquiry-submit]').click();
    await page.waitForFunction(() => document.querySelector('[data-inquiry-status]').dataset.state === 'success');
    assert.equal(await contact.inputValue(), '');
    assert.equal(await form.locator('.inquiry-file-row').count(), 0);
    await page.evaluate(() => { document.activeElement?.blur(); scrollTo({ top: 0, behavior: 'instant' }); });
    await page.waitForFunction(expected => Number(getComputedStyle(document.querySelector('.inquiry-enter')).opacity) === expected,
      reduced ? 1 : 0);
    assert.equal(await page.locator('[data-inquiry-reveal], [data-inquiry-reveal-immediate]').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpectedConsoleErrors, []);
    assert.ok(expected503Diagnostics.length <= submitted.length, 'Only diagnostics from the deliberately mocked 503 response are expected.');
    reports.push({ width, reduced, entrance, labelsAboveFields: true, focusSizeStable: true, geometry, surface, grid,
      contextRefreshPreservesDraftAndUploads: true, acceptsEmailSocialPhone: true, errorsPreserveAllContent: true,
      scrubReplacesOnceOnlyEntrance: true, mockAcceptanceOnly: true, runtimeErrors: errors,
      unexpectedConsoleErrors, expected503DiagnosticCount: expected503Diagnostics.length, expected503Diagnostics });
    console.log(`PASS V3.1 inquiry ${width}px ${reduced ? 'reduced' : 'scrubbed'}: validation, real upload/draft retention, shared field surfaces and retired one-shot entrance.`);
    await context.close();
    currentProfile = null;
  }
} catch (error) {
  failures.push({ ...currentProfile, error: error.stack });
  throw error;
} finally {
  await writeFile(new URL('inquiry.json', out), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures, liveEmailVerified: false }, null, 2));
  await browser.close();
}
