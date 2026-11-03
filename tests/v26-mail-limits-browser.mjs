import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { inquirySettings } from '../src/data/inquirySettings.js';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_MAIL_LIMITS_ARTIFACTS || 'artifacts/v312/V26'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const fileBuffer = (bytes, over = 0) => {
  const buffer = Buffer.alloc(bytes + over, 0x20);
  Buffer.from('%PDF-1.7\n').copy(buffer);
  return buffer;
};
try {
  for (const profile of profiles) {
    console.log(`CHECK V26 mail limits ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 }, deviceScaleFactor: 1,
      isMobile: profile.width < 600, hasTouch: profile.width < 600, reducedMotion: profile.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); const errors = [], submissions = [];
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/inquiry') submissions.push(request.url()); });
    try {
      await page.goto(new URL('/#contact', base).href, { waitUntil: 'networkidle' });
      const form = page.locator('[data-inquiry-form]');
      await form.waitFor();
      assert.equal(await form.getAttribute('data-max-request-bytes'), String(inquirySettings.maximumRequestBytes));
      assert.equal(await page.locator('.inquiry-file-help').textContent(), 'jpg, png, webp, avif, gif or pdf · up to 5 files, 4 MB total.');
      const input = page.locator('.inquiry-file-input');
      await input.setInputFiles({ name: 'at-limit.pdf', mimeType: 'application/pdf', buffer: fileBuffer(inquirySettings.maximumFileBytes) });
      await page.waitForTimeout(100);
      assert.equal(await page.locator('[data-inquiry-file-error]').textContent(), '', 'A file at the 4 MB payload limit is accepted.');
      assert.equal(await page.locator('[data-inquiry-files] li').count(), 1);
      await page.locator('.inquiry-file-remove').click();
      await input.setInputFiles({ name: 'one-byte-over.pdf', mimeType: 'application/pdf', buffer: fileBuffer(inquirySettings.maximumFileBytes, 1) });
      await page.waitForTimeout(100);
      const message = await page.locator('[data-inquiry-file-error]').textContent();
      assert.match(message, /4 MB/, `One byte over the limit has a clear error: ${message}`);
      assert.equal(await page.locator('[data-inquiry-files] li').count(), 0);
      assert.deepEqual(submissions, [], 'Oversized files are rejected before any request.');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: new URL(`limits-${profile.width}-${profile.reduced}.png`, output).pathname });
      reports.push({ ...profile, hint: await page.locator('.inquiry-file-help').textContent(), limitMessage: message, submissions, errors }); await save();
      console.log(`PASS V26 ${profile.width}px reduced=${profile.reduced}: 4 MB hint, at-limit file accepted, one byte over rejected before upload.`);
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors }); await save();
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
