import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_STATIC_TITLES_ARTIFACTS || 'artifacts/v312/V23'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const visual = locator => locator.evaluate(element => {
  const text = element.querySelector('.kinetic-heading-text');
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(text);
  return { scale: style.scale, transform: style.transform, filter: style.filter,
    width: Math.round(box.width * 100) / 100, height: Math.round(box.height * 100) / 100,
    cursor: getComputedStyle(element).cursor };
});
try {
  for (const profile of profiles) {
    console.log(`CHECK V23 static titles ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 }, deviceScaleFactor: 1,
      isMobile: profile.width < 600, hasTouch: profile.width < 600, reducedMotion: profile.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); const errors = [];
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.locator('#selected-work-title').waitFor();
      const expected = ['01/ creative', '02/ about', '03/ contact'];
      const headings = page.locator('.content-section .kinetic-heading');
      assert.deepEqual(await headings.evaluateAll(nodes => nodes.map(node => node.textContent.replace(/\s+/g, ' ').trim())), expected, 'Offscreen content-visibility sections retain their static title text.');
      assert.equal(await headings.locator('a').count(), 0, 'Static section titles are not links.');
      assert.equal(await headings.evaluateAll(nodes => nodes.some(node => node.hasAttribute('tabindex'))), false, 'Static titles are not focusable.');
      const observations = [];
      for (const heading of await headings.all()) {
        await heading.scrollIntoViewIfNeeded(); await frames(page);
        const before = await visual(heading);
        const box = await heading.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await frames(page);
        await page.waitForTimeout(400);
        const after = await visual(heading);
        assert.deepEqual(after, before, `Static title changed under the pointer at ${profile.width}px: ${await heading.innerText()}`);
        await page.mouse.move(1, 1); await frames(page);
        observations.push({ text: (await heading.innerText()).replace(/\s+/g, ' ').trim(), before, after });
      }
      const category = page.locator('#selected-work .category-link').first();
      await category.scrollIntoViewIfNeeded(); await frames(page);
      const categoryVisual = () => category.evaluate(element => { const style = getComputedStyle(element.querySelector('.interaction-visual') || element);
        return { transform: style.transform, filter: style.filter }; });
      const categoryBefore = await categoryVisual();
      const categoryBox = await category.boundingBox();
      await page.mouse.move(categoryBox.x + categoryBox.width / 2, categoryBox.y + categoryBox.height / 2); await frames(page);
      await page.waitForTimeout(350);
      const categoryAfter = await categoryVisual();
      if (!profile.reduced && profile.width >= 1000) assert.ok(categoryAfter.transform !== categoryBefore.transform || categoryAfter.filter !== categoryBefore.filter,
        'Rubric links retain the unified hover.');
      else assert.equal(categoryAfter.transform, categoryBefore.transform, 'Coarse pointers and reduced motion keep the transform instant/static.');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: new URL(`titles-${profile.width}-${profile.reduced}.png`, output).pathname });
      reports.push({ ...profile, observations, categoryHover: { before: categoryBefore, after: categoryAfter }, errors }); await save();
      console.log(`PASS V23 ${profile.width}px reduced=${profile.reduced}: three static titles unchanged under hover, no links or tab stops, unified rubric hover preserved where applicable.`);
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors }); await save();
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
