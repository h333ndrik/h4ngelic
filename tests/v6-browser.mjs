import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const out = new URL('../artifacts/v6/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
try {
  for (const width of [1440, 390, 320]) {
    console.log(`START V6 ${width}px`);
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], scripts = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
    await page.addInitScript(() => {
      window.__v6WebGL = 0; window.__v6URLs = new Set();
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        if (/webgl/i.test(type)) window.__v6WebGL++;
        return get.call(this, type, ...args);
      };
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = blob => { const url = create(blob); window.__v6URLs.add(url); return url; };
      URL.revokeObjectURL = url => { window.__v6URLs.delete(url); revoke(url); };
    });
    await page.goto(`${base}/contact`, { waitUntil: 'networkidle' });
    await page.locator('html[data-page="contact"][data-xray-ready]').waitFor();
    const index = page.locator('[data-global-index]');
    const summary = index.locator('summary');
    await summary.click();
    assert.deepEqual(await index.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/', '/work', '/about', '/contact']);
    assert.equal(await index.locator('[aria-current="page"]').getAttribute('data-index-page'), 'contact');
    await page.keyboard.press('Escape');
    assert.equal(await index.getAttribute('open'), null);
    assert.equal(await summary.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('[data-chapter-counter]').isVisible(), false);
    const form = page.locator('[data-inquiry-form]');
    await form.locator('[name=name]').fill('Browser fixture');
    await form.locator('[name=email]').fill('browser@example.test');
    await form.locator('[name=message]').fill('A test inquiry. No real mail is sent.');
    await form.locator('[name=message]').focus();
    await page.keyboard.down('4'); await page.waitForTimeout(1050); await page.keyboard.up('4');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal', 'Typing in a form must not switch realities.');
    await form.locator('[type=file]').setInputFiles({ name: 'forbidden.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
    assert.match(await form.locator('[data-inquiry-file-error]').innerText(), /jpg, png/);
    const original = await readFile(new URL('../public/images/digital-artworks/green-black-original.jpg', import.meta.url));
    await form.locator('[type=file]').setInputFiles([
      { name: 'reference.jpg', mimeType: 'image/jpeg', buffer: original },
      { name: 'reference.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% browser upload fixture\n%%EOF') },
    ]);
    assert.equal(await form.locator('.inquiry-file-row').count(), 2);
    assert.equal(await page.evaluate(() => window.__v6URLs.size), 1);
    await form.getByRole('button', { name: 'remove reference.jpg', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await form.locator('.inquiry-file-row').count(), 1);
    assert.equal(await page.evaluate(() => window.__v6URLs.size), 0);
    await page.route('**/api/inquiry', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'inquiry delivery is not configured yet.' }) }));
    await form.locator('[data-inquiry-submit]').click();
    await page.waitForFunction(() => document.querySelector('[data-inquiry-status]').dataset.state === 'error');
    assert.equal(await form.locator('[name=name]').inputValue(), 'Browser fixture');
    assert.equal(await form.locator('.inquiry-file-row').count(), 1);
    assert.match(await form.locator('[data-inquiry-status]').innerText(), /not configured/);
    await page.unroute('**/api/inquiry');
    await page.route('**/api/inquiry', route => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ accepted: true, id: 'browser-mock-only' }) }));
    await form.locator('[data-inquiry-submit]').click();
    await page.waitForFunction(() => document.querySelector('[data-inquiry-status]').dataset.state === 'success');
    assert.equal(await form.locator('[name=name]').inputValue(), '');
    assert.equal(await form.locator('.inquiry-file-row').count(), 0);
    await page.unroute('**/api/inquiry');

    await summary.click(); await index.locator('[data-index-page="work"]').click();
    await page.locator('[data-connected-work]').waitFor();
    assert.equal(await page.locator('[data-archive-category]').count(), 5);
    assert.equal(await page.locator('.archive-empty').count(), 4);
    await page.evaluate(() => { window.__v6WorkNode = document.querySelector('[data-connected-work]'); });
    await page.locator('.work-filters a[href="/work#more"]').click();
    await page.waitForURL('**/work#more');
    await page.waitForFunction(() => Math.abs(document.getElementById('more').getBoundingClientRect().top - 90) < 4);
    assert.equal(await page.evaluate(() => window.__v6WorkNode === document.querySelector('[data-connected-work]')), true);
    await page.locator('.work-subfilters a[href="/work#digital-artworks"]').click();
    await page.waitForURL('**/work#digital-artworks');
    const image = page.locator('[data-archive-category="digital-artworks"] .project-image img');
    await image.evaluate(node => node.decode());
    await image.click();
    const dialog = page.locator('dialog.artwork-dialog');
    await dialog.waitFor({ state: 'visible' });
    const scroll = await page.evaluate(() => scrollY);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => scrollY), scroll);
    await page.goBack();
    await page.waitForURL('**/work#more');
    assert.equal(await page.evaluate(() => window.__v6WorkNode === document.querySelector('[data-connected-work]')), true);
    await page.goto(`${base}/work/digital-artworks/green-black-original`, { waitUntil: 'networkidle' });
    await page.locator('a[href="/contact?artwork=green-black-original"]').click();
    await page.locator('html[data-page="contact"]').waitFor();
    assert.equal(await page.locator('[data-inquiry-artwork]').inputValue(), 'green-black-original');
    assert.equal(await page.locator('[data-inquiry-context]').isVisible(), true);
    assert.equal(await page.evaluate(() => window.__v6WebGL), 0);
    assert.ok(!scripts.some(url => /\/main\.js|three|GLTFLoader/.test(url)), 'Cold interior navigation never loads the hero or mannequin.');
    await page.locator('.brand-link').focus();
    await page.keyboard.down('4');
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray');
    await page.keyboard.up('4');
    await summary.click(); await index.locator('[data-index-page="about"]').click();
    await page.locator('html[data-page="about"]').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray');
    await page.keyboard.down('4');
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'normal');
    await page.keyboard.up('4');
    await page.locator('.brand-link').click();
    await page.locator('html[data-page="home"]').waitFor();
    await page.locator('#stage.is-ready, #stage.is-fallback').waitFor({ timeout: 60000 });
    await page.locator('[data-chapter-counter]:not([hidden])').waitFor();
    assert.equal(await page.locator('.identity').innerText(), 'mixed media');
    assert.equal(await page.locator('.category-link').count(), 3);
    assert.equal(await page.locator('.category-sublinks').count(), 0);
    assert.equal(await page.locator('[data-chapter-counter]').getAttribute('data-chapter-total'), '4');
    await page.locator('[data-chapter-counter]').click();
    await page.waitForFunction(() => document.querySelector('[data-chapter-counter]').dataset.chapter === '2');
    assert.equal(await index.isVisible(), false, 'Home retains its own navigation and does not show INDEX.');
    await page.evaluate(() => document.getElementById('contact').focus({ preventScroll: true }));
    await page.evaluate(() => document.getElementById('contact').scrollIntoView());
    await page.waitForFunction(() => document.querySelector('[data-chapter-counter]').dataset.chapter === '4');
    const layout = await page.evaluate(() => ({ width: innerWidth, doc: document.documentElement.scrollWidth,
      formOpacity: getComputedStyle(document.querySelector('.inquiry-enter')).opacity,
      chapter: document.querySelector('[data-chapter-counter]').dataset.chapter }));
    assert.equal(layout.doc, width, `No page overflow at ${width}px`);
    assert.equal(layout.formOpacity, '1');
    assert.equal(layout.chapter, '4');
    await page.screenshot({ path: new URL(`contact-${width}.png`, out).pathname, timeout: 60000 });
    assert.deepEqual(errors, []);
    reports.push({ width, reducedMotion: true, indexEntries: 4, realHomeChapters: 4, connectedArchives: 5,
      beforeHomeWebGL: 0, mockProviderOnly: true, uploadRemovalAndErrorRetry: true, artworkContext: true,
      holdToggleAndFormExclusion: true, workNodesRetained: true, layout, runtimeErrors: errors });
    console.log(`PASS V6 ${width}px`);
    await context.close();
  }
  await writeFile(new URL('browser-results.json', out), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2));
  console.log(JSON.stringify(reports));
} finally { await browser.close(); }
