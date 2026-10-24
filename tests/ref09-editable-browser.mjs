import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Custom input widgets own their keyboard events just like native form fields.
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('/work', base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.mode === 'normal');
  await page.evaluate(() => {
    window.__editableKeys = [];
    for (const role of ['searchbox', 'combobox', 'spinbutton', 'slider']) {
      const field = document.createElement('div');
      field.role = role; field.tabIndex = 0; field.dataset.editableRole = role; field.textContent = role;
      document.body.append(field);
    }
    document.addEventListener('keydown', event => {
      if (event.target.matches('[data-editable-role]')) window.__editableKeys.push({ role: event.target.role, key: event.key, prevented: event.defaultPrevented });
    });
  });
  for (const role of ['searchbox', 'combobox', 'spinbutton', 'slider']) {
    await page.locator(`[data-editable-role="${role}"]`).focus();
    await page.keyboard.down('4'); await page.waitForTimeout(1050); await page.keyboard.up('4');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal', `${role} cannot start the mode hold.`);
  }
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.down('4');
  try { await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray'); }
  finally { await page.keyboard.up('4'); }
  for (const role of ['searchbox', 'combobox', 'spinbutton', 'slider']) {
    await page.locator(`[data-editable-role="${role}"]`).focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('3');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', `${role} cannot count the reverse shortcut.`);
  }
  const keys = await page.evaluate(() => window.__editableKeys);
  assert.equal(keys.length, 16);
  assert.ok(keys.every(key => !key.prevented), 'Custom editing controls retain all ordinary digit keyboard events.');
  assert.deepEqual(errors, []);
  console.log('PASS Phase1 custom editing roles: searchbox/combobox/spinbutton/slider preserve digits and suppress enter/reverse shortcuts.');
} finally { await browser.close(); }
