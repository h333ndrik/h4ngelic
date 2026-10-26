import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
// Browser-only module response: the supplied reflection texture exercises the
// unchanged jewellery route presentation without publishing it as an artwork.
// Tattoo spatial archive behavior is verified by horizontal-drift-browser.mjs.
const project = {
  id: 'transition-browser-fixture', category: 'jewellery', title: 'transition fixture',
  images: [
    { src: '/assets/tattoo-texture.webp', alt: 'provided texture first view', width: 1024, height: 1448 },
    { src: '/assets/tattoo-texture.webp?view=2', alt: 'provided texture second view', width: 1024, height: 1448 },
  ],
};
const detailPath = `/work/jewellery/${project.id}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });

async function setup(options = {}, disableViewTransitions = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options });
  await context.route('**/src/data/artworks.js*', (request) => request.fulfill({
    contentType: 'application/javascript', body: `export const artworks = ${JSON.stringify([project])};`,
  }));
  await context.addInitScript(({ disableViewTransitions }) => {
    window.__artworkProbe = { token: Math.random(), commits: [], calls: 0 };
    if (disableViewTransitions) Object.defineProperty(document, 'startViewTransition', { value: undefined, configurable: true });
    if (!document.startViewTransition) return;
    const start = document.startViewTransition.bind(document);
    const named = () => {
      const image = [...document.images].find((item) => item.style.viewTransitionName === 'h4-artwork');
      if (!image) return null;
      const rect = image.getBoundingClientRect();
      return { index: image.dataset.artworkImage, ratio: rect.width / rect.height, width: rect.width, height: rect.height };
    };
    document.startViewTransition = (update) => {
      const oldImage = named();
      window.__artworkProbe.calls++;
      const transition = start(async () => {
        await update();
        window.__artworkProbe.commits.push({ oldImage, newImage: named(), path: location.pathname, hash: location.hash, scroll: scrollY });
      });
      window.__artworkProbe.transition = transition;
      return transition;
    };
  }, { disableViewTransitions });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(new URL('/work/jewellery', baseURL).href, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-artwork-link]').count(), 2, 'The temporary module fixture must reach the real archive renderer.');
  return { context, page, errors };
}

async function settled(page, kind) {
  await page.waitForFunction((value) => document.documentElement.dataset.page === value, kind);
  await page.evaluate(async () => {
    await window.__artworkProbe.transition?.finished.catch(() => {});
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function clean(page) {
  assert.equal(await page.locator('[data-artwork-flight-copy]').count(), 0, 'Finished/canceled flights must remove their decorative image.');
  const named = await page.locator('img').evaluateAll((images) => images.filter((image) => image.style.viewTransitionName === 'h4-artwork').length);
  assert.equal(named, 0, 'Finished/canceled route transitions must restore every image name.');
  const hidden = await page.locator('.project-image img, .artwork-viewer-image').evaluateAll((images) => images.filter((image) => image.style.visibility === 'hidden').length);
  assert.equal(hidden, 0, 'Finished/canceled flights must restore the original images.');
}

try {
  for (const variant of ['desktop', 'mobile', 'reduced', 'fallback']) {
    const mobile = variant === 'mobile';
    const { context, page, errors } = await setup({
      ...(mobile ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : {}),
      reducedMotion: variant === 'reduced' ? 'reduce' : 'no-preference',
    }, variant === 'fallback');
    try {
      const token = await page.evaluate(() => window.__artworkProbe.token);
      const source = page.locator('[data-artwork-link]').nth(1);
      await source.scrollIntoViewIfNeeded();
      await source.focus();
      await source.locator('img').evaluate((image) => image.decode());
      const originalScroll = await page.evaluate(() => scrollY);
      if (mobile) await source.tap(); else await source.press('Enter');
      await settled(page, 'artwork');
      assert.equal(new URL(page.url()).pathname, detailPath);
      assert.equal(new URL(page.url()).hash, '#image-2');
      assert.equal(await page.locator('#image-2').evaluate((figure) => figure === document.activeElement), true, 'The selected detail photograph must receive keyboard focus.');
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://h4ngelic.com${detailPath}`);
      if (variant === 'desktop' || mobile) {
        const commit = await page.evaluate(() => window.__artworkProbe.commits.at(-1));
        assert.equal(commit.oldImage?.index, '1', 'The clicked photograph must be the shared old element.');
        assert.equal(commit.newImage?.index, '1', 'The matching detail photograph must be the shared new element.');
        assert.ok(Math.abs(commit.oldImage.ratio - commit.newImage.ratio) < .005, 'Shared images must preserve their proportions.');
      } else assert.equal(await page.evaluate(() => window.__artworkProbe.calls), 0, 'Reduced motion and unsupported APIs must use immediate real URL navigation.');
      await clean(page);

      await page.goBack();
      await settled(page, 'work');
      assert.ok(Math.abs(await page.evaluate(() => scrollY) - originalScroll) < 2, 'Back must restore the original gallery scroll position.');
      assert.equal(await page.locator('[data-artwork-link]').nth(1).evaluate((link) => link === document.activeElement), true, 'Back must focus the corresponding gallery photograph.');
      await clean(page);
      await page.goForward();
      await settled(page, 'artwork');
      if (variant === 'desktop' || mobile) {
        const commit = await page.evaluate(() => window.__artworkProbe.commits.at(-1));
        assert.equal(commit.oldImage?.index, '1', 'Forward must honor the image fragment even without a click trigger.');
        assert.equal(commit.newImage?.index, '1');
      }
      await page.locator('#image-2 [data-artwork-open]').click();
      await page.waitForFunction(() => document.querySelector('.artwork-viewer-status')?.textContent === 'image 2 of 2');
      const imageRatio = await page.locator('.artwork-viewer-image').evaluate((image) => {
        const rect = image.getBoundingClientRect(); return Math.abs(rect.width / rect.height - image.naturalWidth / image.naturalHeight);
      });
      assert.ok(imageRatio < .005, 'The enlarged photograph itself must retain its natural aspect ratio.');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.artwork-dialog').open);
      await clean(page);
      assert.equal(await page.evaluate(() => window.__artworkProbe.token), token, 'URL navigation must retain the same document.');
      assert.deepEqual(errors, []);
      console.log(`PASS artwork transitions ${variant}: canonical photograph URLs, matching image snapshots, Back/Forward focus and scroll, proportionate viewer and cleanup.`);
    } finally { await context.close(); }
  }

  const { context, page, errors } = await setup();
  try {
    await page.locator('[data-artwork-link]').first().click();
    await settled(page, 'artwork');
    const trigger = page.locator('[data-artwork-open]').first();
    await trigger.focus();
    await trigger.click();
    await page.waitForFunction(() => document.querySelector('[data-artwork-flight="opening"]'));
    const flightRatio = await page.locator('[data-artwork-flight-copy]').evaluate((image) => {
      const rect = image.getBoundingClientRect(); return Math.abs(rect.width / rect.height - image.naturalWidth / image.naturalHeight);
    });
    assert.ok(flightRatio < .005, 'The moving photograph must preserve its proportions during expansion.');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.artwork-dialog').open);
    await clean(page);
    await trigger.click();
    await page.waitForFunction(() => document.querySelector('[data-artwork-flight="opening"]'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('[data-artwork-flight-copy]'));
    await clean(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // Back while the viewer is open captures its tightly fitted photograph;
    // route cleanup must remove the modal and restore body scrolling.
    await page.goBack();
    await settled(page, 'work');
    await clean(page);
    assert.equal(await page.locator('.artwork-dialog').count(), 0);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    await page.evaluate(() => {
      document.querySelector('[data-artwork-link]').click();
      document.querySelector('.page-nav a[href="/about"]').click();
    });
    await settled(page, 'about');
    await clean(page);
    assert.deepEqual(errors, []);
    console.log('PASS artwork interruption: close during expansion, reduced-motion change, Back from viewer, rapid route replacement and full cleanup.');
  } finally { await context.close(); }
} finally { await browser.close(); }
