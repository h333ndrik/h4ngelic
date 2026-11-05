import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55203';
const output = new URL('../docs/validation/NAAVI/', import.meta.url);
await mkdir(output, { recursive: true });
const shell = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const shellAnchor = shell.match(/<a[^>]+data-naavi[^>]*>[\s\S]*?<\/a>/)?.[0] || '';
assert.match(shellAnchor, />00<\/span><\/span><span class="chapter-total"[^>]*>\/ 04<\/span>/, 'The pre-hydration shell uses the same no-space-before-slash format.');
assert.doesNotMatch(shellAnchor, /00<\/span><\/span><span class="chapter-total"[^>]*>\s+\/ 04/);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const elementText = value => value;
const report = { build: '', shell: shellAnchor.replace(/\s+/g, ' ').trim(), chapters: [], passed: false };
try {
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.build);
  report.build = await page.locator('html').getAttribute('data-build');
  for (const [index, id] of ['home-hero', 'selected-work', 'about-preview', 'contact'].entries()) {
    await page.evaluate(id => {
      const target = document.getElementById(id);
      scrollTo({ top: target ? target.getBoundingClientRect().top + scrollY : 0, behavior: 'instant' });
    }, id);
    await page.waitForFunction(index => Number(document.querySelector('[data-naavi]').dataset.chapter) === index, index, { timeout: 5000 });
    const state = await page.locator('[data-naavi]').evaluate(element => ({
      text: element.textContent.replace(/\s+/g, ' ').trim(), label: element.getAttribute('aria-label'),
      current: Number(element.dataset.chapter), total: Number(element.dataset.chapterTotal)
    }));
    assert.equal(state.text, `${String(index).padStart(2, '0')}/ 04`, `Chapter ${index} must render NN/ NN without a pre-slash space.`);
    assert.doesNotMatch(elementText(state.text), /\s\/\s/);
    assert.match(state.label, new RegExp(`NAAVI: ${String(index).padStart(2, '0')}/ 04,`));
    report.chapters.push({ index, id, state });
  }
  // B-F6: the end reveal is the fourth chapter, so the counter reaches 04/ 04
  // while the INDEX keeps its four destinations.
  await page.evaluate(() => {
    const target = document.querySelector('[data-end-reveal]');
    scrollTo({ top: target.getBoundingClientRect().top + scrollY, behavior: 'instant' });
  });
  await page.waitForFunction(() => Number(document.querySelector('[data-naavi]').dataset.chapter) === 4, null, { timeout: 5000 });
  const final = await page.locator('[data-naavi]').evaluate(element => ({
    text: element.textContent.replace(/\s+/g, ' ').trim(), label: element.getAttribute('aria-label'),
    current: Number(element.dataset.chapter), total: Number(element.dataset.chapterTotal),
  }));
  assert.equal(final.text, '04/ 04', 'The other side closes the counter at 04/ 04.');
  assert.equal(final.total, 4);
  assert.match(final.label, /^NAAVI: 04\/ 04, the other side\. go to home$/);
  assert.deepEqual(await page.locator('[data-global-index] [data-index-page]').evaluateAll(nodes => nodes.map(node => node.textContent.replace(/\s+/g, ' ').trim())),
    ['00/ home', '01/ creative', '02/ about', '03/ contact']);
  report.chapters.push({ index: 4, id: 'other-side', state: final });
  await page.screenshot({ path: new URL('naavi-final-secret-1440.png', output).pathname });
  report.passed = true;
  console.log(`PASS NAAVI ${report.build}: shell, four Home chapters and 04/ 04 at the other side render NN/ NN.`);
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
