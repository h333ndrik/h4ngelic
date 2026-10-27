import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const out = new URL('../artifacts/master-foundation/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
try {
  for (const width of [1440, 390, 320]) for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/contact`, { waitUntil: 'networkidle' });
    const inquiry = page.locator('[data-inquiry]');
    const form = page.locator('[data-inquiry-form]');
    await inquiry.locator('[data-inquiry-contact]').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-inquiry]').dataset.inquiryReveal === 'visible');
    const entrance = await inquiry.evaluate(node => ({ duration: getComputedStyle(node).transitionDuration,
      immediate: node.hasAttribute('data-inquiry-reveal-immediate'), state: node.dataset.inquiryReveal }));
    assert.equal(entrance.duration, reduced ? '0s' : '0.7s, 0.7s');
    assert.equal(entrance.immediate, reduced);
    await page.waitForTimeout(reduced ? 10 : 750);
    const contact = form.locator('[data-inquiry-contact]');
    assert.equal(await contact.getAttribute('type'), 'text');
    assert.equal(await contact.getAttribute('required'), '');
    assert.equal(await contact.getAttribute('placeholder'), 'email, instagram, phone number...');
    assert.equal(await form.locator('label[for$="-email"] > span').innerText(), 'HOW TO REACH YOU');
    const geometry = await form.locator('.inquiry-field').evaluateAll(labels => labels.map(label => {
      const a = label.querySelector('span').getBoundingClientRect(), b = label.querySelector('input,textarea').getBoundingClientRect();
      return { gap: b.top - a.bottom, left: b.left, right: b.right };
    }));
    assert.ok(geometry.every(box => box.gap >= 0 && box.left >= 0 && box.right <= width), JSON.stringify(geometry));
    const before = await contact.boundingBox();
    await contact.focus();
    const after = await contact.boundingBox();
    assert.equal(after.width, before.width);
    assert.equal(after.height, before.height);
    assert.equal(after.x, before.x);
    assert.equal(await inquiry.getAttribute('data-inquiry-reveal-immediate'), '');
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
    const submitted = [];
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
    await page.route('**/api/inquiry', route => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ accepted: true, id: 'test-mock-only' }) }));
    await contact.fill('+49 170 1234567');
    await form.locator('[data-inquiry-submit]').click();
    await page.waitForFunction(() => document.querySelector('[data-inquiry-status]').dataset.state === 'success');
    assert.equal(await contact.inputValue(), '');
    assert.equal(await form.locator('.inquiry-file-row').count(), 0);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    assert.equal(await inquiry.getAttribute('data-inquiry-reveal'), 'visible');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    assert.deepEqual(errors, []);
    reports.push({ width, reduced, entrance, labelsAboveFields: true, focusSizeStable: true,
      acceptsEmailSocialPhone: true, errorsPreserveAllContent: true, mockAcceptanceOnly: true, runtimeErrors: errors });
    console.log(`PASS inquiry ${width}px ${reduced ? 'reduced' : 'animated'}`);
    await context.close();
  }
  await writeFile(new URL('inquiry.json', out), JSON.stringify({ checkedAt: new Date().toISOString(), reports, liveEmailVerified: false }, null, 2));
} finally { await browser.close(); }
