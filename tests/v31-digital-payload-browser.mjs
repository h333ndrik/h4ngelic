import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Compare two production snapshots through the same HTTP server implementation.
// Root serves the accepted V3.1 production snapshot separately from the F10
// production build. Report actual changes: larger nominal size may cost bytes.
const beforeURL = process.env.H4_BEFORE_URL || 'http://127.0.0.1:55384';
const afterURL = process.env.H4_AFTER_URL || 'http://127.0.0.1:55383';
const output = new URL(`../${process.env.H4_DIGITAL_PAYLOAD_ARTIFACTS || 'artifacts/v311/F10/payload'}/`, import.meta.url);
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
    const image = path === '/creative/green-black-original'
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
      assert.deepEqual(candidates, [320, 640, 960]);
      assert.ok(data.sourcePixelWidth >= data.width - 1, 'DPR1 preview is never displayed wider than its downloaded source.');
      assert.ok(data.sourcePixelWidth <= 960);
      assert.equal(data.loading, 'lazy');
      assert.equal(data.borderRadius, '4px', 'Digital uses the one shared photo radius.');
    }
    return { ...data, requests: transfers.filter(event => event.url), errors };
  } finally { await context.close(); }
}

try {
  for (const width of [1440, 390, 320]) {
    for (const path of ['/creative#digital-artworks', '/creative/green-black-original']) {
      console.log(`CHECK digital payload ${width}px ${path}`);
      const before = await measure(beforeURL, path, width, 'before');
      const after = await measure(afterURL, path, width, 'after');
      const ratio = after.width / before.width;
      const nominal = path === '/creative/green-black-original' ? Math.min((width-(width<600?44:70))*.6,720) : Math.min(width*.492,660);
      const expectedWidth = Math.min(nominal,(900-152)*.75/1.4);
      assert.ok(Math.abs(after.width-expectedWidth)<2, `60% original base plus explicit portrait height cap: expected ${expectedWidth}, observed ${after.width}.`);
      const alreadySmallestVariant = before.sourcePixelWidth === 320;
      // Size is now60% of the original base, not the superseded50% reduction.
      // Report larger/equal/smaller payloads without assuming a saving.
      const result = { width, path, before, after, widthRatio: ratio, nominalWidth:nominal, expectedWidth, heightCapped:nominal>expectedWidth, alreadySmallestVariant,
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
