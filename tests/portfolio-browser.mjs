import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const artifacts = new URL('../artifacts/', import.meta.url);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const categories = ['tattoos', 'jewellery', 'paintings'];
const route = (path) => new URL(path, baseURL).href;

function errorsFor(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function readyHome(page) {
  await page.goto(route('/?test=1'), { waitUntil: 'networkidle' });
  await page.locator('#selected-work .category-strip .category-link').first().waitFor();
  await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
}

async function checkHorizontalCategories(page, width) {
  const section = page.locator('#selected-work');
  const links = section.locator('.category-strip .category-link');
  assert.equal(await links.count(), 3, 'Selected work must contain exactly three category links.');
  assert.equal(await section.locator('img, picture, video, canvas').count(), 0, 'Selected work must be purely typographic.');
  const rectangles = [];
  for (let index = 0; index < categories.length; index++) {
    const link = links.nth(index);
    assert.equal(await link.getAttribute('href'), `/work/${categories[index]}`);
    rectangles.push(await link.boundingBox());
  }
  assert.ok(rectangles.every(Boolean));
  assert.ok(Math.max(...rectangles.map((r) => r.y)) - Math.min(...rectangles.map((r) => r.y)) < 2, `Categories must share one horizontal row at ${width}px.`);
  assert.ok(rectangles[0].x < rectangles[1].x && rectangles[1].x < rectangles[2].x, 'Category order must be tattoos, jewellery, paintings.');
  assert.ok(Math.max(...rectangles.map((r) => r.width)) - Math.min(...rectangles.map((r) => r.width)) < 2, 'Categories must occupy equal columns.');
  const dimensions = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(dimensions.page <= dimensions.viewport + 1, `The page must not overflow horizontally at ${width}px.`);
  // Focusing the last link must bring it into its scroller rather than lose it
  // beyond the viewport on narrow screens. This is real keyboard traversal.
  await links.first().focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert.equal(await links.last().evaluate((element) => element === document.activeElement), true, 'All three categories must be keyboard reachable.');
  await links.last().scrollIntoViewIfNeeded();
  const finalLink = await links.last().boundingBox();
  assert.ok(finalLink.x < width && finalLink.x + finalLink.width > 0, 'The final category must remain reachable on narrow screens.');
}

async function assertFilter(page, category) {
  const expected = category || 'all';
  const active = page.locator('.work-filters .filter-link[aria-current="page"]');
  assert.equal(await active.count(), 1, 'Exactly one archive filter must be active.');
  assert.equal((await active.textContent()).trim(), expected);
  assert.equal(await page.locator('.archive-empty').textContent(), 'archive in progress.');
  assert.equal(await page.locator('.project-grid img').count(), 0, 'The empty archive must not invent artwork.');
  assert.equal(await page.locator('#logo-canvas').isVisible(), false, 'Interior pages must not render the homepage WebGL canvas.');
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await desktop.newPage();
  const desktopErrors = errorsFor(page);
  await readyHome(page);
  await checkHorizontalCategories(page, 1440);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.evaluate(() => document.activeElement?.blur());
  await page.screenshot({ path: new URL('homepage-full.png', artifacts).pathname, fullPage: true });

  const disabledContacts = page.locator('#contact .contact-link.is-unconfigured');
  assert.equal(await disabledContacts.count(), 4, 'Unconfigured contact destinations must remain honest placeholders.');
  assert.equal(await disabledContacts.locator('a[href]').count(), 0);
  for (const contact of await disabledContacts.all()) {
    assert.notEqual(await contact.evaluate((element) => element.tagName === 'A' && Boolean(element.getAttribute('href'))), true, 'No unconfigured contact may navigate to a fake destination.');
  }

  // Click every homepage category, including direct query reloads and back.
  for (const category of categories) {
    await readyHome(page);
    await page.locator(`#selected-work a[href="/work/${category}"]`).click();
    await page.waitForURL((url) => url.pathname === `/work/${category}`);
    await assertFilter(page, category);
    await page.reload({ waitUntil: 'networkidle' });
    await assertFilter(page, category);
    await page.goBack({ waitUntil: 'networkidle' });
    await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    // Inspect the live hero if the development hook is available. A canvas
    // restored from history must render again rather than keep a disposed GPU.
    if (await page.evaluate(() => Boolean(window.__H4_TEST__))) {
      const before = await page.evaluate(() => window.__H4_TEST__.snapshot().frameCount);
      await page.waitForFunction((frame) => window.__H4_TEST__.snapshot().frameCount > frame, before, { timeout: 10000 });
      assert.ok(await page.evaluate(() => window.__H4_TEST__.snapshot().frameCount) > before, 'Back navigation must restore a live homepage hero.');
    }
  }

  await page.goto(route('/work?category=tattoos'), { waitUntil: 'networkidle' });
  for (const category of ['jewellery', 'paintings', 'all']) {
    const href = category === 'all' ? '/work' : `/work/${category}`;
    await page.locator(`.work-filters a[href="${href}"]`).click();
    await page.waitForURL((url) => url.pathname === (category === 'all' ? '/work' : `/work/${category}`));
    await assertFilter(page, category === 'all' ? null : category);
  }
  await page.screenshot({ path: new URL('work.png', artifacts).pathname, fullPage: true });
  await page.goto(route('/work?category=unknown'), { waitUntil: 'networkidle' });
  await assertFilter(page, null);

  await page.goto(route('/about'), { waitUntil: 'networkidle' });
  await page.locator('.about-copy').waitFor();
  assert.ok(await page.locator('.about-copy').getByText('tattooing, jewellery, painting and everything in between.', { exact: true }).count());
  assert.ok(await page.locator('.about-copy').getByText('independent artist based in berlin.', { exact: true }).count());
  assert.equal(await page.locator('#logo-canvas').isVisible(), false);
  await page.screenshot({ path: new URL('about.png', artifacts).pathname, fullPage: true });
  await page.locator('.page-nav a[href="/#contact"]').click();
  await page.waitForURL((url) => url.pathname === '/' && url.hash === '#contact');
  await page.locator('#contact').waitFor();
  await page.waitForFunction(() => document.getElementById('contact').getBoundingClientRect().top < innerHeight);
  assert.ok(await page.evaluate(() => scrollY) > 0, 'Contact navigation from another page must scroll to the homepage contact section.');
  assert.deepEqual(desktopErrors, [], 'Portfolio navigation must not throw JavaScript or WebGL errors.');
  await desktop.close();
  console.log('PASS portfolio desktop: equal horizontal columns, keyboard access, real links, all filters, reload/back, about and contact.');

  // Interior routes start in a fresh context: no cached Three.js module can
  // hide an accidental eager import of the hero on a lightweight content page.
  const interior = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const interiorPage = await interior.newPage();
  const interiorErrors = errorsFor(interiorPage);
  const requests = [];
  interiorPage.on('request', (request) => requests.push(request.url()));
  await interiorPage.goto(route('/work?category=jewellery'), { waitUntil: 'networkidle' });
  await assertFilter(interiorPage, 'jewellery');
  await interiorPage.goto(route('/about'), { waitUntil: 'networkidle' });
  await interiorPage.locator('.about-copy').waitFor();
  assert.equal(requests.some((url) => /\/src\/main\.js(?:[?#]|$)|\/three(?:\/|\.js)|\/deps\/three\.js/.test(url)), false, 'Work/about must not load Three.js or the hero entry.');
  assert.deepEqual(interiorErrors, []);
  await interior.close();
  console.log('PASS content performance: work/about render without loading the 3D scene.');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const mobilePage = await mobile.newPage();
  const mobileErrors = errorsFor(mobilePage);
  await readyHome(mobilePage);
  await checkHorizontalCategories(mobilePage, 390);
  await mobilePage.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await mobilePage.evaluate(() => document.activeElement?.blur());
  await mobilePage.screenshot({ path: new URL('mobile-homepage-full.png', artifacts).pathname, fullPage: true });
  await mobilePage.setViewportSize({ width: 320, height: 740 });
  await checkHorizontalCategories(mobilePage, 320);
  await mobilePage.locator('#selected-work a[href="/work/paintings"]').click();
  await mobilePage.waitForURL((url) => url.pathname === '/work/paintings');
  await assertFilter(mobilePage, 'paintings');
  assert.ok(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await mobilePage.locator('.page-nav a[href="/#contact"]').click();
  await mobilePage.waitForURL((url) => url.hash === '#contact');
  await mobilePage.waitForFunction(() => document.getElementById('contact').getBoundingClientRect().top < innerHeight);
  assert.deepEqual(mobileErrors, []);
  await mobile.close();
  console.log('PASS portfolio mobile: horizontal categories at 390/320px, scrollable keyboard access, working filters/contact, no page overflow.');
  console.log(`Screenshots saved in ${artifacts.pathname}`);
} finally {
  await browser.close();
}
