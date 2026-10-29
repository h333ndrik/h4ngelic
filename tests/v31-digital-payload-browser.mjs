import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Compare two production snapshots through the same HTTP server implementation.
// Root keeps the accepted V3 dist in /tmp/h4-v31-before-digital-dist, then serves
// it separately from the V3.1 build. No invented byte counts or DOM fixtures.
const beforeURL = process.env.H4_BEFORE_URL || 'http://127.0.0.1:55384';
const afterURL = process.env.H4_AFTER_URL || 'http://127.0.0.1:55383';
const output = new URL('../artifacts/v31/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [], failures = [];
const report = () => writeFile(new URL('digital-payload.json', output), JSON.stringify({ checkedAt: new Date().toISOString(),
  method: 'Fresh production contexts at DPR1; actual CDP encoded transfer lengths and Resource Timing body bytes; no viewer opening.',
  beforeURL, afterURL, results, failures }, null, 2));

async function measure(base, path, width, phase) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1,
    isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [], responses = new Map(), transfers = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  session.on('Network.responseReceived', event => responses.set(event.requestId, event.response.url));
  session.on('Network.loadingFinished', event => transfers.push({ url: responses.get(event.requestId), transferredBytes: event.encodedDataLength }));
  try {
    await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });
    const image = path.startsWith('/work/digital-artworks/')
      ? page.locator('.artwork-detail .project-image img').first()
      : page.locator('[data-archive-category="digital-artworks"] .project-image img').first();
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(async element => { if (!element.complete) await element.decode(); });
    await page.waitForFunction(() => [...document.images].some(image => /green-black-original/.test(image.currentSrc) && image.complete && image.naturalWidth));
    await page.waitForLoadState('networkidle');
    const data = await image.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const candidate = new URL(element.currentSrc).pathname;
      const resource = performance.getEntriesByType('resource').find(entry => entry.name === element.currentSrc);
      const resources = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
      return { width: rect.width, height: rect.height, candidate, sourcePixelWidth: Number(candidate.match(/-(\d+)\.webp$/)?.[1]),
        srcset: element.srcset, sizes: element.sizes, loading: element.loading,
        authoredWidth: element.getAttribute('width'), authoredHeight: element.getAttribute('height'),
        imageBodyBytes: resource?.encodedBodySize, imageTransferBytes: resource?.transferSize,
        routeBodyBytes: resources.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0),
        routeTransferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
        pageWidth: document.documentElement.scrollWidth, viewport: innerWidth,
        borderRadius: getComputedStyle(element).borderRadius };
    });
    assert.ok(data.imageBodyBytes > 0, 'The actual selected image must have transferred measurable bytes.');
    assert.ok(data.width > 0 && data.height > 0);
    assert.equal(data.authoredWidth, '1440'); assert.equal(data.authoredHeight, '1920');
    assert.ok(Math.abs(data.width / data.height - 1440 / 1920) < .002, 'Original artwork proportions remain exact.');
    assert.ok(data.pageWidth <= data.viewport + 1);
    assert.deepEqual(errors, []);
    if (phase === 'after') {
      const candidates = [...data.srcset.matchAll(/ (\d+)w(?:,|$)/g)].map(match => Number(match[1]));
      assert.deepEqual(candidates, [320, 640]);
      assert.ok(data.sourcePixelWidth >= data.width - 1, 'DPR1 preview is never displayed wider than its downloaded source.');
      assert.ok(data.sourcePixelWidth <= 640);
      assert.equal(data.loading, 'lazy');
      assert.equal(data.borderRadius, '0px', 'Digital photographs keep unrounded original edges.');
    }
    return { ...data, requests: transfers.filter(event => event.url), errors };
  } finally { await context.close(); }
}

try {
  for (const width of [1440, 390, 320]) {
    for (const path of ['/work#digital-artworks', '/work/digital-artworks/green-black-original']) {
      console.log(`CHECK digital payload ${width}px ${path}`);
      const before = await measure(beforeURL, path, width, 'before');
      const after = await measure(afterURL, path, width, 'after');
      const ratio = after.width / before.width;
      assert.ok(ratio >= .45 && ratio <= .55, `Digital artwork width should halve: observed ${before.width} → ${after.width}.`);
      assert.ok(after.imageBodyBytes < before.imageBodyBytes,
        `The actual initial image payload must fall: ${before.imageBodyBytes} → ${after.imageBodyBytes}.`);
      const result = { width, path, before, after, widthRatio: ratio,
        savedImageBodyBytes: before.imageBodyBytes - after.imageBodyBytes,
        savedImageBodyPercent: (1 - after.imageBodyBytes / before.imageBodyBytes) * 100,
        savedRouteTransferBytes: before.routeTransferBytes - after.routeTransferBytes };
      results.push(result);
      await report();
      console.log(`PASS digital ${width}px: ${Math.round(before.width)} → ${Math.round(after.width)}px; image ${before.imageBodyBytes} → ${after.imageBodyBytes} body bytes; route ${before.routeTransferBytes} → ${after.routeTransferBytes} transfer bytes.`);
    }
  }
} catch (error) {
  failures.push({ message: error.stack });
  throw error;
} finally { await report(); await browser.close(); }
