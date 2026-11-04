import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

/**
 * A/B sind in der Rubrik verborgen, bleiben aber als Registry erhalten.
 * Erreichbar sind sie nur im Dev-Server ueber ?variant=a|b — dieser Test haelt
 * beides fest: der Dev-Weg funktioniert, und der Production-Build kennt ihn
 * nicht (siehe tests/mannequin-preview-browser.mjs).
 */
const evidence = new URL('../docs/validation/MANNEQUIN-C/', import.meta.url);
await mkdir(evidence, { recursive: true });

const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const open = async (path) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const section = document.querySelector('#model-3d');
    scrollTo({ top: Math.max(0, section.getBoundingClientRect().top + scrollY - 120), behavior: 'instant' });
  });
  await page.waitForFunction(() => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(300);
  return { context, page, errors, requests };
};

const results = [];
try {
  for (const [query, key] of [['?variant=a', 'A'], ['?variant=b', 'B']]) {
    const { context, page, errors, requests } = await open(`/work/tattoos${query}`);
    const preview = page.locator('[data-mannequin-preview]');
    assert.equal(await preview.getAttribute('data-mannequin-variant'), key, `?variant=${key.toLowerCase()} loads ${key}.`);
    const glbs = requests.filter((url) => /\/models\/mannequin-[a-z0-9.-]+\.glb$/.test(url));
    assert.equal(glbs.length, 1, 'Exactly one GLB request.');
    assert.match(glbs[0], new RegExp(`mannequin-female-${key.toLowerCase()}\\.glb$`));
    assert.equal(await page.locator('[data-mannequin-variant-option]').count(), 0, 'Still no visible switcher.');
    assert.equal(await page.locator('[data-mannequin-design-toggle]').isEnabled(), true, `${key} keeps the demo design.`);
    assert.equal(await page.locator('[data-mannequin-design-toggle]').getAttribute('aria-disabled'), 'false');
    assert.equal(await page.locator('[data-mannequin-design-hint]').isVisible(), false);
    if (key === 'B') {
      await page.locator('[data-mannequin-design-toggle]').click();
      await page.waitForFunction(() => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinDecal === 'applied', null, { timeout: 30000 });
      assert.equal(await page.locator('[data-mannequin-design-toggle]').getAttribute('aria-pressed'), 'true');
    }
    await page.locator('.mannequin-preview').screenshot({ path: fileURLToPath(new URL(`hidden-variant-${key.toLowerCase()}-1440.png`, evidence)) });
    assert.deepEqual(errors, [], `no console errors for ${key}`);
    results.push({ query, variant: key, glb: glbs[0], design: key === 'B' ? 'applied' : 'available', errors });
    await context.close();
  }

  // Ohne Parameter bleibt C die einzige Variante.
  const { context, page } = await open('/work/tattoos');
  assert.equal(await page.locator('[data-mannequin-preview]').getAttribute('data-mannequin-variant'), 'C');
  results.push({ query: '(none)', variant: 'C' });
  await context.close();

  await writeFile(new URL('hidden-variants.json', evidence), JSON.stringify({
    checkedAt: new Date().toISOString(),
    server: 'vite dev',
    note: 'A/B sind nur im Dev-Server ueber ?variant=a|b erreichbar, ohne Link und ohne Umschalter.',
    results,
    passed: true,
  }, null, 2) + '\n');
  console.log('PASS mannequin hidden variants (dev): A/B via ?variant=, no switcher, C bleibt Default.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
  await server.close();
}
