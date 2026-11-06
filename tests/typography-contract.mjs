import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../docs/validation/STRUCT/contracts/', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const report = { checkedAt: new Date().toISOString(), base, build: '', profiles: [], distGrep: {}, failures: [] };

function metricsScript() {
  const baselineOffset = element => {
    const style = getComputedStyle(element);
    const range = document.createRange();
    range.selectNodeContents(element);
    const rect = range.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const measured = context.measureText('H');
    const glyphBox = measured.fontBoundingBoxAscent + measured.fontBoundingBoxDescent;
    return rect.top + (rect.height - glyphBox) / 2 + measured.fontBoundingBoxAscent - element.getBoundingClientRect().top;
  };
  return { baselineOffset };
}

// Browser-side metrics use only production CSS and native canvas text metrics.
async function measure(page, selector) {
  return page.locator(selector).evaluateAll(elements => {
    const baselineOffset = element => {
      const style = getComputedStyle(element);
      const range = document.createRange();
      range.selectNodeContents(element);
      const rect = range.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const measured = context.measureText('H');
      const glyphBox = measured.fontBoundingBoxAscent + measured.fontBoundingBoxDescent;
      return rect.top + (rect.height - glyphBox) / 2 + measured.fontBoundingBoxAscent - element.getBoundingClientRect().top;
    };
    return elements.map(element => {
      const visual = element.matches('h2, h3') ? element.querySelector(':scope > a, :scope > span') || element : element;
      const style = getComputedStyle(visual);
      return { id: element.id, text: element.textContent.trim().replace(/\s+/g, ' '),
        fontSize: style.fontSize, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing,
        fontWeight: style.fontWeight, baseline: baselineOffset(visual) };
    });
  });
}

function sameTypography(rows, label, { compareBaseline = true } = {}) {
  assert.ok(rows.length > 0, `${label} must expose at least one element.`);
  for (const row of rows.slice(1)) {
    assert.equal(row.fontSize, rows[0].fontSize, `${label} font-size differs for ${row.text}.`);
    assert.equal(row.lineHeight, rows[0].lineHeight, `${label} line-height differs for ${row.text}.`);
    assert.equal(row.letterSpacing, rows[0].letterSpacing, `${label} letter-spacing differs for ${row.text}.`);
    assert.equal(row.fontWeight, rows[0].fontWeight, `${label} font-weight differs for ${row.text}.`);
    if (compareBaseline) assert.ok(Math.abs(row.baseline - rows[0].baseline) <= .5,
      `${label} baseline differs by more than 0.5px for ${row.text}: ${row.baseline} vs ${rows[0].baseline}.`);
  }
  return rows;
}

function assertCounterFormats(values, pattern, label) {
  assert.ok(values.length > 0, `${label} must be present.`);
  for (const value of values) assert.match(value, pattern, `${label} has a non-canonical counter: ${JSON.stringify(value)}`);
  return values;
}

async function route(page, path) {
  await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
}

try {
  for (const profile of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: 1,
      reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({ count: 5, lastSeen: Date.now() })));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await route(page, '/');
      const build = await page.locator('html').getAttribute('data-build');
      assert.ok(build, 'The page must expose data-build.');
      report.build ||= build;

      const headings = sameTypography(await measure(page, '.content-section .kinetic-heading'), `${profile.width}px home headings`);
      assert.deepEqual(headings.map(row => row.text.replace(/^\d{2}\/ /, '')), ['creative', 'about', 'contact']);
      for (const heading of headings) assert.match(heading.text, /^\d{2}\/ /, `Home heading lacks R2 numbering: ${heading.text}`);

      const rubrics = sameTypography(await measure(page, '#selected-work .category-link .interaction-visual'), `${profile.width}px rubric labels`);
      assert.deepEqual(rubrics.map(row => row.text), ['tattoos', 'jewellery', 'tools', 'more']);

      // B-F5: every numbered display heading uses one scale, so the slash sits
      // on the same column on the home exhibition and its own subpages.
      const slashColumn = path => async () => {
        await route(page, path);
        return page.locator('.kinetic-heading-text, .numbered-heading').first().evaluate(element => {
          const style = getComputedStyle(element);
          const range = document.createRange();
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
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
        });
      };
      const slashRows = [];
      for (const path of ['/', '/about', '/creative']) slashRows.push(await slashColumn(path)());
      for (const row of slashRows.slice(1)) {
        assert.equal(row.fontSize, slashRows[0].fontSize, `Numbered heading size differs on ${row.text}.`);
        assert.equal(row.lineHeight, slashRows[0].lineHeight, `Numbered heading leading differs on ${row.text}.`);
        assert.equal(row.letterSpacing, slashRows[0].letterSpacing, `Numbered heading tracking differs on ${row.text}.`);
        assert.ok(Math.abs(row.slashRel - slashRows[0].slashRel) <= .5,
          `Slash column shifted on ${row.text}: ${row.slashRel} vs ${slashRows[0].slashRel}.`);
      }

      await route(page, '/');
      await page.locator('[data-floating-brand]').hover();
      await page.waitForTimeout(240);
      const headerRows = await page.locator('[data-floating-brand], .returning-visitor-line, [data-global-index] > summary').evaluateAll(elements => elements.map(element => {
        const box = element.getBoundingClientRect();
        return { text: element.textContent.trim(), center: box.top + box.height / 2, height: box.height };
      }));
      assert.equal(headerRows.length, 3);
      assert.ok(headerRows.every(row => row.height > 0 && Math.abs(row.center - headerRows[0].center) <= 2),
        `Header rows must share a baseline at ${profile.width}px: ${JSON.stringify(headerRows)}`);

      const indexNumbers = assertCounterFormats(await page.locator('[data-global-index] .index-number').allTextContents(), /^\d{2}\/$/, 'INDEX numbers');
      const indexLabels = await page.locator('[data-global-index] [data-index-page]').evaluateAll(elements => elements.map(element => element.textContent.trim().replace(/\s+/g, ' ')));
      assert.deepEqual(indexLabels, ['00/ home', '01/ creative', '02/ about', '03/ contact']);
      assertCounterFormats(await page.locator('[data-naavi]').evaluateAll(elements => elements.map(element => element.textContent.trim().replace(/\s+/g, ' '))), /^\d{2}\/ \d{2}$/, 'NAAVI');
      assert.match(await page.locator('[data-naavi]').getAttribute('aria-label'), /^NAAVI: \d{2}\/ \d{2}, /);
      assertCounterFormats([await page.locator('[data-visit-number]').textContent()], /^visit \d{4,}$/, 'Footer visit counter');

      await route(page, '/creative');
      assertCounterFormats(await page.locator('[data-naavi]').evaluateAll(elements => elements.map(element => element.textContent.trim().replace(/\s+/g, ' '))), /^\d{2}\/ \d{2}$/, 'Creative NAAVI');
      const driftCounts = assertCounterFormats(await page.locator('[data-drift-count]').allTextContents(), /^\d{2}\/ \d{2}$/, 'Carousel counters');
      assert.ok(driftCounts.includes('01/ 08'), `The eight-photo carousel must expose 01/ 08: ${driftCounts}`);
      const childHeadings = sameTypography(await measure(page, '.archive-category-heading'), `${profile.width}px secondary headings`, { compareBaseline: false });

      await route(page, '/creative/tattoos');
      const next = page.locator('[data-horizontal-drift="tattoos"] [data-drift-next]');
      for (let index = 0; index < 6; index++) await next.click();
      await page.waitForFunction(() => document.querySelector('[data-horizontal-drift="tattoos"] [data-drift-count]')?.textContent.trim() === '07/ 08');
      const seventh = (await page.locator('[data-horizontal-drift="tattoos"] [data-drift-count]').textContent()).trim();
      assert.equal(seventh, '07/ 08');

      await route(page, '/creative/tattoo-01');
      assertCounterFormats([await page.locator('[data-naavi]').textContent()].map(text => text.trim().replace(/\s+/g, ' ')), /^\d{2}\/ \d{2}$/, 'Artwork NAAVI');
      await page.locator('[data-artwork-open]').first().click();
      await page.locator('dialog.artwork-dialog[open]').waitFor();
      const viewerCount = (await page.locator('.artwork-viewer-count').textContent()).trim();
      assert.match(viewerCount, /^\d{2}\/ \d{2}$/, `Viewer count is not NN/ NN: ${viewerCount}`);
      const viewerNav = await page.locator('.artwork-viewer-navigation').evaluate(element => {
        for (const button of element.querySelectorAll('button')) button.hidden = false;
        const boxes = [...element.querySelectorAll('button, .artwork-viewer-count')].map(node => node.getBoundingClientRect());
        return boxes.map(box => ({ left: box.left, right: box.right, top: box.top, bottom: box.bottom }));
      });
      assert.equal(viewerNav.length, 3);
      assert.ok(viewerNav[0].right <= viewerNav[1].left && viewerNav[1].right <= viewerNav[2].left,
        'Viewer arrows must flank the counter without overlap.');
      const viewerScrim = await page.locator('dialog.artwork-dialog').evaluate(dialog => ({
        scrim: getComputedStyle(dialog, '::after').backgroundImage,
        navZ: Number(getComputedStyle(dialog.querySelector('.artwork-viewer-navigation')).zIndex) }));
      assert.match(viewerScrim.scrim, /linear-gradient/, 'The viewer needs a bottom scrim so its controls never read over page copy.');
      assert.ok(viewerScrim.navZ >= 1, 'The viewer navigation must paint above the scrim.');

      report.profiles.push({ ...profile, build, headings, rubrics, slashRows, childHeadings, headerRows, indexNumbers, indexLabels, driftCounts, seventh, viewerCount, viewerScrim, errors });
      assert.deepEqual(errors, []);
      console.log(`PASS typography ${profile.width}px: equal section/rubric metrics, shared slash column ${slashRows[0].slashRel}px, header baseline, NN/ labels and counters, flanking viewer arrows with scrim.`);
    } finally { await context.close(); }
  }

  // Text-only dist scan. HTML tags and attributes are removed so image ratios
  // and CSS math cannot masquerade as visible counters.
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) await walk(child);
      else files.push(child);
    }
  }
  await walk(dist);
  const bad = [];
  for (const file of files.filter(entry => entry.pathname.endsWith('.html'))) {
    const html = await readFile(file, 'utf8');
    const text = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
    for (const match of text.matchAll(/\b\d{1,2} \/ \d{1,2}\b/g)) bad.push({ file: file.pathname, value: match[0] });
  }
  const js = (await Promise.all(files.filter(entry => entry.pathname.endsWith('.js'))
    .map(async entry => ({ file: entry.pathname, text: await readFile(entry, 'utf8') }))));
  for (const asset of js) {
    // Only complete string/template literals are counters. A substring match
    // would also flag CSS division (`.75 / 1.4`) and GLSL constants (1.0 / 6.0).
    for (const match of asset.text.matchAll(/['"`](\d{1,2} \/ \d{1,2})['"`]/g)) bad.push({ file: asset.file, value: match[1] });
  }
  report.distGrep = { files: files.length, bad };
  assert.deepEqual(bad, [], `Emitted bundles still contain spaced numeric slash counters: ${JSON.stringify(bad.slice(0, 10))}`);
  await writeFile(new URL('typography.json', output), JSON.stringify(report, null, 2) + '\n');
  console.log(`PASS typography dist-grep: ${files.length} emitted files, no \`\\d / \\d\` visible counter remains.`);
} catch (error) {
  report.failures.push({ error: error.stack });
  await writeFile(new URL('typography.json', output), JSON.stringify(report, null, 2) + '\n');
  throw error;
} finally {
  await browser.close();
}
