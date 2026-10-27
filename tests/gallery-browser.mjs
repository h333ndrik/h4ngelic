import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const artifacts = new URL('../artifacts/', import.meta.url);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});

async function fixture(page) {
  // Every connected Work context now includes the real Digital artwork and
  // its existing viewer. Start on About, which has no viewer, then mount this
  // isolated two-image fixture so the test never creates duplicate dialogs or
  // pretends the supplied reflection texture is a published tattoo project.
  await page.goto(new URL('/about', baseURL).href, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.artwork-dialog').count(), 0);
  await page.evaluate(async () => {
    const { renderArtworkPage } = await import('/src/pages.js');
    const { initGallery } = await import('/src/gallery.js');
    const { initImageReveals } = await import('/src/image-reveals.js');
    const archive = document.querySelector('#page-content');
    archive.innerHTML = renderArtworkPage({
      id: 'gallery-test-fixture', category: 'tattoos', title: 'test fixture',
      images: [
        { src: '/assets/tattoo-texture.webp', alt: 'provided artwork', caption: 'first view', width: 1024, height: 1448 },
        { src: '/assets/tattoo-texture.webp?detail=1', alt: 'provided artwork detail', caption: 'second view', width: 1024, height: 1448 },
      ],
    });
    const stopGallery = initGallery(archive);
    const stopReveals = initImageReveals(archive);
    window.__galleryCleanup = () => { stopReveals(); stopGallery(); };
  });
}

async function displayed(page, number) {
  await page.waitForFunction((index) => {
    const dialog = document.querySelector('.artwork-dialog');
    const image = dialog?.querySelector('.artwork-viewer-image');
    return dialog?.open && image?.complete && image.naturalWidth > 0
      && dialog.querySelector('.artwork-viewer-count').textContent === `${index} / 2`
      && dialog.querySelector('.artwork-viewer-status').textContent === `image ${index} of 2`
      && !dialog.querySelector('.artwork-viewer-stage').classList.contains('is-switching');
  }, number);
}

try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width > 600 ? 1000 : 844 },
      hasTouch: width <= 600,
      isMobile: width <= 600,
      reducedMotion: width === 320 ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await fixture(page);
    const opener = page.locator('[data-artwork-open]').first();
    const reserved = await opener.boundingBox();
    await page.locator('.project-image img').first().evaluate((image) => image.decode());
    const loaded = await opener.boundingBox();
    assert.ok(Math.abs(reserved.height - loaded.height) < 1, 'Loading artwork must preserve the reserved image height.');

    await opener.focus();
    assert.equal(Number(await opener.locator('img').evaluate((image) => getComputedStyle(image).opacity)), 1, 'Keyboard focus must make artwork fully visible.');
    const coverScale = await opener.evaluate((button) => {
      const value = getComputedStyle(button, '::after').transform;
      return value === 'none' ? 0 : new DOMMatrixReadOnly(value).m22;
    });
    assert.ok(Math.abs(coverScale) < .001, 'Keyboard focus must remove the image mask.');
    const original = await opener.boundingBox();
    const originalScroll = await page.evaluate(() => scrollY);
    await page.keyboard.press('Enter');
    if (width !== 320) {
      await page.waitForFunction(() => document.querySelector('[data-artwork-flight="opening"]'));
      const flight = await page.locator('[data-artwork-flight-copy]').evaluate(image => {
        const box = image.getBoundingClientRect();
        return { ratio: box.width / box.height, natural: image.naturalWidth / image.naturalHeight };
      });
      assert.ok(Math.abs(flight.ratio - flight.natural) < .005, 'The moving shared photograph must preserve its aspect ratio.');
    }
    await displayed(page, 1);
    const dialog = page.locator('.artwork-dialog');
    const box = await dialog.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `Modal must fit ${width}px viewport.`);
    const scrim = await dialog.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, backdrop: getComputedStyle(element, '::backdrop').backgroundColor, border: getComputedStyle(element).borderTopWidth }));
    assert.equal(scrim.background, 'rgba(0, 0, 0, 0)', 'The viewer must keep the surrounding website visible through its surface.');
    assert.equal(scrim.border, '0px', 'The enlarged photograph must not become a decorative bordered card.');
    assert.match(scrim.backdrop, /0\.38\)/, 'The page must remain visible beneath the restrained backdrop.');
    assert.equal(await page.locator('.artwork-viewer-caption').textContent(), 'first view');
    assert.equal(await opener.locator('img').evaluate(image => getComputedStyle(image).visibility), 'hidden', 'The original layout slot must remain without duplicating the enlarged photograph behind it.');
    assert.equal(await page.locator('.artwork-close').evaluate((button) => button === document.activeElement), true, 'Opening must focus the close control inside the native modal.');
    for (const button of await dialog.locator('button').all()) {
      const rect = await button.boundingBox();
      assert.ok(rect.width >= 44 && rect.height >= 44, 'Viewer controls must keep accessible touch targets.');
    }
    if (width === 320) {
      assert.equal(await dialog.evaluate((element) => getComputedStyle(element).transitionDuration), '0s', 'Reduced motion must remove the opening transition.');
    }
    await page.screenshot({ path: new URL(`gallery-${width}.png`, artifacts).pathname, fullPage: true });

    await page.locator('.artwork-next').click();
    await displayed(page, 2);
    assert.equal(await page.locator('.artwork-viewer-caption').textContent(), 'second view');
    assert.match(await page.locator('.artwork-viewer-image').getAttribute('src'), /detail=1$/);
    await page.evaluate(() => {
      document.querySelector('.artwork-previous').click();
      document.querySelector('.artwork-next').click();
    });
    await displayed(page, 2);
    assert.match(await page.locator('.artwork-viewer-image').getAttribute('src'), /detail=1$/, 'A late decode must not replace the latest requested image.');

    await page.keyboard.press('ArrowLeft');
    await displayed(page, 1);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.artwork-dialog').open);
    assert.equal(await opener.evaluate((button) => button === document.activeElement), true, 'Closing must restore focus to the original artwork.');
    assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'Closing must restore page scrolling.');
    assert.notEqual(await opener.locator('img').evaluate(image => getComputedStyle(image).visibility), 'hidden', 'Closing must restore the original photograph visibility.');
    const returned = await opener.boundingBox();
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(original[key] - returned[key]) < 1, 'Closing must return to the same original photograph location.');
    assert.ok(Math.abs(originalScroll - await page.evaluate(() => scrollY)) < 1, 'Closing must preserve the document scroll position.');

    await opener.click();
    await displayed(page, 1);
    await page.locator('.artwork-viewer-image').click();
    await page.waitForFunction(() => !document.querySelector('.artwork-dialog').open);
    assert.equal(await opener.evaluate(element => element === document.activeElement), true, 'Clicking the enlarged photograph again must close it and restore focus.');

    await opener.click();
    await displayed(page, 1);
    // The stage's letterboxing is visibly outside the photograph, even though
    // it is inside the transparent native dialog rectangle.
    await page.locator('.artwork-viewer-stage').evaluate(stage => stage.click());
    await page.waitForFunction(() => !document.querySelector('.artwork-dialog').open);

    await page.locator('[data-artwork-open]').last().click();
    await displayed(page, 2);
    await page.mouse.click(1, 1);
    await page.waitForFunction(() => !document.querySelector('.artwork-dialog').open);
    await page.evaluate(() => window.__galleryCleanup());
    assert.equal(await page.locator('.artwork-dialog').count(), 0, 'Route cleanup must remove the viewer.');
    assert.deepEqual(errors, []);
    console.log(`PASS gallery ${width}px: proportionate FLIP, transparent scrim, photo/outside/Escape closing, exact original geometry, reserved layout, accessible controls, rapid navigation and cleanup.`);
    await context.close();
  }
} finally {
  await browser.close();
}
