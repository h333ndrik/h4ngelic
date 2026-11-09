import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../docs/validation/GATEPREP/TOKEN-CLEANUP/gallery/', import.meta.url);
const baselineMode = process.env.TOKEN_SNAPSHOT_MODE === 'baseline';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, mode: baselineMode ? 'baseline' : 'compare', build: '', images: [] };

async function pixels(path) {
  const image = sharp(path).removeAlpha();
  const { width, height } = await image.metadata();
  return image.extract({ left: 2, top: 2, width: width - 4, height: height - 4 })
    .raw().toBuffer({ resolveWithObject: true });
}

async function compare(before, after) {
  const [a, b] = await Promise.all([pixels(before), pixels(after)]);
  assert.equal(a.info.width, b.info.width, 'Snapshot widths must match.');
  assert.equal(a.info.height, b.info.height, 'Snapshot heights must match.');
  let changed = 0, maximumDelta = 0;
  for (let index = 0; index < a.data.length; index += 1) {
    const delta = Math.abs(a.data[index] - b.data[index]);
    maximumDelta = Math.max(maximumDelta, delta);
    if (delta) changed += 1;
  }
  return { width: a.info.width, height: a.info.height, changedChannels: changed, maximumDelta };
}

try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1,
      reducedMotion: 'reduce', isMobile: width < 600, hasTouch: width < 600 });
    await context.addInitScript(() => {
      localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({ count: 5, lastSeen: Date.now() }));
      localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .2 }));
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true');
      report.build ||= await page.locator('html').getAttribute('data-build');
      const row = page.locator('[data-footer-row]');
      await row.scrollIntoViewIfNeeded();
      // Baseline mode reproduces the three removed literal declarations on the
      // same production build. This keeps the comparison independent of the
      // animated Living Decay backdrop and proves that token substitution is
      // visually identical rather than comparing two different paint clocks.
      if (baselineMode) await page.addStyleTag({ content: `
        .footer-smash { text-transform: lowercase; }
        .secret-message.is-discovered { opacity: .35; }
        .footer-secret .secret-message.is-discovered { opacity: .35; }
      ` });
      await row.evaluate(element => {
        element.style.background = '#242424';
        element.style.position = 'relative';
        element.style.zIndex = '1';
      });
      await page.locator('[data-other-side-hint]').focus();
      await page.locator('[data-other-side-hint] .secret-message').waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelector('[data-other-side-hint] .secret-message')?.classList.contains('is-discovered'));
      const normal = new URL(`normal-${width}.png`, output).pathname;
      const afterNormal = new URL(`after-normal-${width}.png`, output).pathname;
      if (baselineMode) await row.screenshot({ path: normal, animations: 'disabled' });
      else await row.screenshot({ path: afterNormal, animations: 'disabled' });

      await page.keyboard.down('4');
      await page.waitForTimeout(1100);
      await page.keyboard.up('4');
      await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray');
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(120);
      const other = new URL(`other-${width}.png`, output).pathname;
      const afterOther = new URL(`after-other-${width}.png`, output).pathname;
      if (baselineMode) await row.screenshot({ path: other, animations: 'disabled' });
      else await row.screenshot({ path: afterOther, animations: 'disabled' });
      assert.deepEqual(errors, []);
      if (baselineMode) report.images.push({ width, normal, other });
      else report.images.push({ width,
        normal: await compare(new URL(`normal-${width}.png`, output).pathname, afterNormal),
        other: await compare(new URL(`other-${width}.png`, output).pathname, afterOther) });
    } finally { await context.close(); }
  }
  assert.ok(report.build, 'The production build marker must be present.');
  if (!baselineMode) for (const image of report.images) {
    assert.equal(image.normal.changedChannels, 0, `Normal footer pixels changed at ${image.width}px: ${JSON.stringify(image.normal)}`);
    assert.equal(image.other.changedChannels, 0, `Other Side footer pixels changed at ${image.width}px: ${JSON.stringify(image.other)}`);
  }
  await writeFile(new URL('results.json', output), JSON.stringify(report, null, 2) + '\n');
  console.log(`PASS token visual ${report.mode} ${report.build}: ${report.images.length * 2} footer snapshots.`);
} finally { await browser.close(); }
