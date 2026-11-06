import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const output = new URL('../docs/validation/GATEPREP/BATCH-2/gallery/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, build: '', profiles: [], failures: [] };

const headingMetrics = () => {
  const element = document.querySelector('.kinetic-heading-text, .numbered-heading');
  const style = getComputedStyle(element);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node; let slashRel = null;
  while ((node = walker.nextNode())) {
    const index = node.textContent.indexOf('/');
    if (index < 0) continue;
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    slashRel = Math.round((range.getBoundingClientRect().left - element.getBoundingClientRect().left) * 100) / 100;
    break;
  }
  return { text: element.textContent.trim().replace(/\s+/g, ' '), fontSize: style.fontSize,
    lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, slashRel };
};

try {
  for (const width of [1440, 390, 320]) {
    const height = width === 1440 ? 900 : 844;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'no-preference' });
    await context.addInitScript(() => localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({ count: 5, lastSeen: Date.now() })));
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      const headings = [];
      for (const [path, name] of [['/', 'home'], ['/about', 'about'], ['/creative', 'creative']]) {
        await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
        report.build ||= await page.locator('html').getAttribute('data-build');
        const row = await page.evaluate(headingMetrics);
        headings.push({ path, ...row });
        const heading = page.locator('.kinetic-heading-text, .numbered-heading').first();
        await heading.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        const box = await heading.boundingBox();
        const top = Math.max(0, Math.min(height - 8, box.y - 12));
        await page.screenshot({ path: new URL(`heading-${name}-${width}.png`, output).pathname,
          clip: { x: 0, y: top, width, height: Math.max(24, Math.min(height - top, box.height + 40)) } });
      }
      for (const row of headings.slice(1)) {
        assert.equal(row.fontSize, headings[0].fontSize, `Heading size differs on ${row.path}.`);
        assert.equal(row.lineHeight, headings[0].lineHeight, `Heading leading differs on ${row.path}.`);
        assert.equal(row.letterSpacing, headings[0].letterSpacing, `Heading tracking differs on ${row.path}.`);
        assert.ok(Math.abs(row.slashRel - headings[0].slashRel) <= .5,
          `Slash column shifted on ${row.path}: ${row.slashRel} vs ${headings[0].slashRel}.`);
      }

      await page.goto(new URL('/creative/tattoo-01', base).href, { waitUntil: 'networkidle' });
      await page.locator('[data-artwork-open]').first().click({ force: true });
      await page.locator('dialog.artwork-dialog[open]').waitFor();
      const viewer = await page.evaluate(() => {
        const dialog = document.querySelector('dialog.artwork-dialog');
        const nav = dialog.querySelector('.artwork-viewer-navigation');
        for (const button of nav.querySelectorAll('button')) button.hidden = false;
        const boxes = [...nav.querySelectorAll('button, .artwork-viewer-count')].map(node => {
          const rect = node.getBoundingClientRect();
          return { text: node.textContent.trim(), x: Math.round(rect.x), right: Math.round(rect.right), y: Math.round(rect.y), width: Math.round(rect.width) };
        });
        return { count: dialog.querySelector('.artwork-viewer-count').textContent.trim(), boxes,
          gap: getComputedStyle(nav).gap, scrim: getComputedStyle(dialog, '::after').backgroundImage,
          navZ: Number(getComputedStyle(nav).zIndex) };
      });
      assert.equal(viewer.boxes.length, 3);
      assert.ok(viewer.boxes[0].right <= viewer.boxes[1].x && viewer.boxes[1].right <= viewer.boxes[2].x,
        `Viewer arrows must flank the counter at ${width}px: ${JSON.stringify(viewer.boxes)}`);
      assert.match(viewer.scrim, /linear-gradient/, 'The viewer needs its bottom scrim.');
      assert.ok(viewer.navZ >= 1, 'Viewer navigation must paint above the scrim.');
      assert.match(viewer.count, /^\d{2}\/ \d{2}$/);
      await page.waitForTimeout(350);
      await page.screenshot({ path: new URL(`viewer-${width}.png`, output).pathname });
      await page.locator('.artwork-viewer-navigation').screenshot({ path: new URL(`viewer-nav-${width}.png`, output).pathname });
      assert.deepEqual(errors, []);
      report.profiles.push({ width, headings, viewer, errors, passed: true });
      console.log(`PASS batch 2 ${width}px: slash ${headings[0].slashRel}px on home/about/creative, viewer ${viewer.count} with flanking arrows and scrim.`);
    } catch (error) {
      report.failures.push({ width, error: error.stack, errors });
      await page.screenshot({ path: new URL(`failure-${width}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
