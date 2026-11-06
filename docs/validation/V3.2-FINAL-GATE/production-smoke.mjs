/** Post-deploy smoke against the live domain (d550824).
 * Records routes' runtime state, footer contract, ink, cursor raster and the
 * world-sound gesture gate. Read-only: it never writes to the site. */
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'https://www.h4ngelic.com';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();
const audio = [];
page.on('request', request => { if (/\/assets\/audio\/[^?]+\.m4a/.test(request.url())) audio.push(request.url()); });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const report = { base, build: null, checks: {} };
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('.footer-identity') !== null);
report.build = await page.evaluate(() => document.documentElement.dataset.build);
report.checks.audioBeforeGesture = audio.length;
report.checks.indexLabels = await page.evaluate(() => [...document.querySelectorAll('[data-index-page]')].map(node => node.textContent.replace(/\s+/g, ' ').trim()));
report.checks.footerLegalLinks = await page.evaluate(() => document.querySelectorAll('.footer-impressum, [data-other-side-imprint-slot], a[href*="impressum"]').length);
report.checks.heading = await page.evaluate(() => document.getElementById('about-preview-title')?.textContent.trim());

// ink in the empty band surface
await page.evaluate(() => document.querySelector('.page-footer').scrollIntoView({ block: 'end', behavior: 'instant' }));
await page.waitForTimeout(400);
const free = await page.evaluate(() => {
  const row = document.querySelector('.footer-identity').getBoundingClientRect();
  const blocked = 'a,button,input,textarea,select,label,form,nav,summary,canvas,dialog,[controls],[draggable="true"],[role="button"],[role="link"],[role="checkbox"],[role="switch"],[role="radio"],[role="tab"],[role="menuitem"],[role="combobox"],[role="slider"],[role="spinbutton"],[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"]):not([role="group"]),[aria-disabled="true"],.is-unconfigured,[data-no-ink]';
  const cluster = document.querySelector('.footer-left').getBoundingClientRect();
  for (let y = row.top + row.height / 2; y < row.bottom - 4; y += 3) {
    for (let x = cluster.left + 3; x < Math.min(cluster.right, innerWidth) - 3; x += 2) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || hit.closest(blocked) || hit.closest('.row-item') || hit.closest('.arrow')) continue;
      if (hit === hit.closest('.footer-left, .footer-details')) return { x, y };
    }
  }
  return null;
});
const before = await page.evaluate(() => document.querySelectorAll('.ink-mark').length);
if (free) {
  await page.mouse.move(free.x, free.y);
  await page.mouse.down();
  await page.waitForTimeout(70);
  await page.mouse.up();
  await page.waitForTimeout(280);
}
report.checks.ink = { point: free, before, after: await page.evaluate(() => document.querySelectorAll('.ink-mark').length) };

// cursor raster over the band (documentation only)
report.checks.cursor = await page.evaluate(() => {
  const row = document.querySelector('.footer-identity').getBoundingClientRect();
  const values = new Map();
  let points = 0;
  for (let y = row.top + 1; y < row.bottom - 1; y += 4) {
    for (let x = row.left + 1; x < row.right - 1; x += 4) {
      const element = document.elementFromPoint(x, y);
      if (!element) continue;
      const cursor = getComputedStyle(element).cursor;
      points += 1;
      values.set(/url\(/.test(cursor) ? 'image' : cursor, (values.get(/url\(/.test(cursor) ? 'image' : cursor) || 0) + 1);
    }
  }
  return { points, values: Object.fromEntries(values) };
});

// world sound: first gesture unlocks the bed
await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(300);
const beforeGesture = audio.length;
await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.down('4');
await page.waitForTimeout(1100);
await page.keyboard.up('4');
await page.waitForTimeout(1200);
report.checks.sound = { beforeGesture, afterGesture: audio.filter(url => url.includes('loop-333')).length, all: audio.length };
report.checks.errors = errors;
console.log(JSON.stringify(report, null, 2));
await browser.close();
