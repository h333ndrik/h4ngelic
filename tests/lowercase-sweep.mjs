import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const output = new URL('../docs/validation/GATEPREP/BATCH-2/gallery/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), build: '', profiles: [], failures: [] };

const expected = {
  moreAbout: 'more about',
  labels: ['your name', 'how to reach you', "what's on your mind?"],
  submit: 'send message',
  attach: 'attach references / images',
};

try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'no-preference' });
    await context.addInitScript(() => localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({ count: 5, lastSeen: Date.now() })));
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      report.build ||= await page.locator('html').getAttribute('data-build');

      const copy = await page.evaluate(() => {
        const text = element => element?.textContent.replace(/\s+/g, ' ').trim() || null;
        const style = element => element ? { transform: getComputedStyle(element).textTransform, size: getComputedStyle(element).fontSize } : null;
        const moreAbout = document.querySelector('.about-preview .text-link');
        const labels = [...document.querySelectorAll('.inquiry-field > span')];
        const submit = document.querySelector('[data-inquiry-submit] span');
        const attach = document.querySelector('.inquiry-file-label span');
        return {
          moreAbout: text(moreAbout), moreAboutStyle: style(moreAbout),
          labels: labels.map(text), labelStyles: labels.map(style),
          submit: text(submit), submitStyle: style(submit),
          attach: text(attach), attachStyle: style(attach),
        };
      });

      assert.equal(copy.moreAbout, expected.moreAbout, `About link copy at ${width}px: ${copy.moreAbout}`);
      assert.deepEqual(copy.labels, expected.labels, `Form labels at ${width}px: ${JSON.stringify(copy.labels)}`);
      assert.equal(copy.submit, expected.submit, `Submit copy at ${width}px: ${copy.submit}`);
      assert.equal(copy.attach, expected.attach, `Attachment label at ${width}px: ${copy.attach}`);

      // A lowercase source must not be re-uppercased by CSS.
      for (const style of [copy.moreAboutStyle, ...copy.labelStyles, copy.submitStyle, copy.attachStyle]) {
        assert.equal(style.transform, 'none', 'Lowercase copy must not rely on a text-transform override.');
      }
      for (const value of [copy.moreAbout, ...copy.labels, copy.submit, copy.attach]) {
        assert.equal(value, value.toLowerCase(), `Copy is not lowercase: ${value}`);
      }

      await page.locator('.about-preview').scrollIntoViewIfNeeded();
      await page.screenshot({ path: new URL(`lowercase-about-${width}.png`, output).pathname });
      await page.locator('#contact').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: new URL(`lowercase-form-${width}.png`, output).pathname });
      assert.deepEqual(errors, []);
      report.profiles.push({ width, copy, errors, passed: true });
      console.log(`PASS lowercase sweep ${width}px: ${copy.labels.join(' / ')}, “${copy.submit}”, “${copy.moreAbout}”.`);
    } catch (error) {
      report.failures.push({ width, error: error.stack });
      throw error;
    } finally { await context.close(); }
  }
  assert.ok(report.build, 'The production build marker must be present.');
  await writeFile(new URL('lowercase.json', output), JSON.stringify(report, null, 2) + '\n');
} finally { await browser.close(); }
