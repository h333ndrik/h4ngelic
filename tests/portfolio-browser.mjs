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
const categories = ['tattoos', 'jewellery', 'more'];
const leaves = ['tattoos', 'flashes', 'jewellery', 'analog-photography', 'digital-artworks', 'paintings'];
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
    assert.equal(await link.getAttribute('href'), `/work#${categories[index]}`);
    rectangles.push(await link.boundingBox());
  }
  assert.ok(rectangles.every(Boolean));
  assert.ok(Math.max(...rectangles.map((r) => r.y)) - Math.min(...rectangles.map((r) => r.y)) < 2, `Categories must share one horizontal row at ${width}px.`);
  assert.ok(rectangles[0].x < rectangles[1].x && rectangles[1].x < rectangles[2].x, 'Main rubric order must be tattoos, jewellery, more.');
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
  assert.equal(await section.locator('.category-sublinks').count(), 0, 'V6 keeps subcategories inside Work, not under the frontpage rubrics.');
}

async function assertConnectedWork(page, category) {
  const expected = category || 'all';
  await page.locator('[data-connected-work]').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.work-filters a[aria-current="location"]').length === 1);
  const active = page.locator('.work-filters a[aria-current="location"]');
  assert.equal(await active.count(), 1, 'Exactly one connected Work location must be active.');
  assert.ok(['all', 'tattoos', 'jewellery', 'more'].includes((await active.textContent()).trim()));
  const expectedEmpty = expected === 'paintings' ? 5 : 4;
  assert.deepEqual(await page.locator('.archive-empty').allTextContents(), Array(expectedEmpty).fill('archive in progress.'));
  assert.deepEqual(await page.locator('[data-archive-category]').evaluateAll(nodes => nodes.map(node => node.dataset.archiveCategory)),
    ['tattoos', 'flashes', 'jewellery', 'analog-photography', 'digital-artworks', ...(expected === 'paintings' ? ['paintings'] : [])]);
  assert.equal(await page.locator('.portfolio-archive img').count(), 1,
    'The one original stays mounted in every connected context; empty leaves never invent artwork.');
  const original = page.locator('.digital-ink-open img');
  assert.equal(await original.getAttribute('width'), '1440');
  assert.equal(await original.getAttribute('height'), '1920');
  assert.match(await original.getAttribute('src'), /green-black-original/);
  assert.equal(await page.locator('[data-project-url="/work/digital-artworks/green-black-original"]').count(), 1);
  assert.equal(await page.locator('.work-page .page-heading').innerText(), 'work');
  const duplicateIDs = await page.locator('[data-connected-work] [id]').evaluateAll(nodes => {
    const ids = nodes.map(node => node.id); return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  assert.deepEqual(duplicateIDs, []);
  if (expected !== 'all') {
    const target = await page.locator(`#${expected}`).boundingBox();
    assert.ok(target && target.y < page.viewportSize().height && target.y + target.height > 0,
      `Direct Work location ${expected} must be visible without a full entrance sequence.`);
  }
  assert.equal(await page.locator('#logo-canvas').isVisible(), false, 'Interior pages must not render the homepage WebGL canvas.');
}

async function indexNavigate(page, name, { touch = false } = {}) {
  const index = page.locator('[data-global-index]');
  if (!await index.evaluate(element => element.open)) {
    if (touch) await index.locator('summary').tap(); else await index.locator('summary').click();
  }
  const link = index.locator(`[data-index-page="${name}"]`);
  if (touch) await link.tap(); else await link.click();
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

  assert.equal(await page.locator('#contact [data-inquiry-form]').count(), 1);
  assert.equal(await page.locator('#contact .contact-link').count(), 0, 'The custom inquiry form replaces the old link collection.');
  assert.equal(await page.locator('.footer-instagram').getAttribute('href'), 'https://www.instagram.com/h4ngelic/');

  // Click every homepage category, including direct query reloads and back.
  for (const category of categories) {
    await readyHome(page);
    await page.locator(`#selected-work .category-link[href="/work#${category}"]`).click();
    await page.waitForURL((url) => url.pathname === '/work' && url.hash === `#${category}`);
    await assertConnectedWork(page, category);
    await page.reload({ waitUntil: 'networkidle' });
    await assertConnectedWork(page, category);
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
  for (const category of ['jewellery', 'more', 'all']) {
    const href = category === 'all' ? '/work' : `/work#${category}`;
    await page.evaluate(() => { window.__portfolioWorkNode = document.querySelector('[data-connected-work]'); });
    await page.locator(`.work-filters a[href="${href}"]`).click();
    await page.waitForURL((url) => url.pathname === '/work' && url.hash === (category === 'all' ? '' : `#${category}`));
    await assertConnectedWork(page, category === 'all' ? null : category);
    assert.equal(await page.evaluate(() => window.__portfolioWorkNode === document.querySelector('[data-connected-work]')), true,
      'Section navigation must retain the same mounted Work document.');
  }
  await page.screenshot({ path: new URL('work.png', artifacts).pathname, fullPage: true });
  await page.goto(route('/work?category=unknown'), { waitUntil: 'networkidle' });
  await assertConnectedWork(page, null);
  // Every actual leaf remains directly addressable, including old painting
  // bookmarks. Subcategories are not silently collapsed into their parent.
  for (const category of leaves) {
    await page.goto(route(`/work?category=${category}`), { waitUntil: 'networkidle' });
    await page.waitForURL((url) => url.pathname === `/work/${category}`);
    await assertConnectedWork(page, category);
  }

  await page.goto(route('/about'), { waitUntil: 'networkidle' });
  await page.locator('.about-copy').waitFor();
  assert.ok(await page.locator('.about-copy').getByText("hi, i'm hendrik.", { exact: true }).count());
  assert.equal(await page.locator('.about-paragraph').count(), 5);
  assert.ok(await page.locator('.about-copy').getByText('independent artist based in berlin.', { exact: true }).count());
  assert.equal(await page.locator('#logo-canvas').isVisible(), false);
  await page.screenshot({ path: new URL('about.png', artifacts).pathname, fullPage: true });
  await indexNavigate(page, 'contact');
  await page.waitForURL((url) => url.pathname === '/contact');
  await page.locator('#contact').waitFor();
  await page.waitForFunction(() => document.getElementById('contact').getBoundingClientRect().top < innerHeight);
  assert.equal(await page.locator('#contact [data-inquiry-form]').count(), 1);
  assert.ok(await page.evaluate(() => scrollY) < 2, 'Dedicated Contact navigation must reveal the form immediately.');
  assert.deepEqual(desktopErrors, [], 'Portfolio navigation must not throw JavaScript or WebGL errors.');
  await desktop.close();
  console.log('PASS portfolio desktop: equal horizontal columns, keyboard access, connected Work anchors and legacy URLs, preserved nodes, reload/back, approved About and inquiry Contact.');

  // Interior routes start in a fresh context: no cached Three.js module can
  // hide an accidental eager import of the hero on a lightweight content page.
  const interior = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const interiorPage = await interior.newPage();
  const interiorErrors = errorsFor(interiorPage);
  const requests = [];
  interiorPage.on('request', (request) => requests.push(request.url()));
  await interiorPage.goto(route('/work?category=jewellery'), { waitUntil: 'networkidle' });
  await assertConnectedWork(interiorPage, 'jewellery');
  await interiorPage.goto(route('/about'), { waitUntil: 'networkidle' });
  await interiorPage.locator('.about-copy').waitFor();
  await interiorPage.goto(route('/contact'), { waitUntil: 'networkidle' });
  await interiorPage.locator('[data-inquiry-form]').waitFor();
  assert.equal(requests.some((url) => /\/src\/main\.js(?:[?#]|$)|\/assets\/main-[^/]+\.js|\/three(?:\/|\.js)|\/deps\/three\.js/.test(url)), false, 'Work/about/contact must not load Three.js or the hero entry.');
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
  await mobilePage.locator('#selected-work .category-link[href="/work#more"]').tap();
  await mobilePage.waitForURL((url) => url.pathname === '/work' && url.hash === '#more');
  await assertConnectedWork(mobilePage, 'more');
  await mobilePage.locator('.work-subfilters a[href="/work#digital-artworks"]').tap();
  await mobilePage.waitForURL((url) => url.pathname === '/work' && url.hash === '#digital-artworks');
  await assertConnectedWork(mobilePage, 'digital-artworks');
  assert.ok(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await indexNavigate(mobilePage, 'contact', { touch: true });
  await mobilePage.waitForURL((url) => url.pathname === '/contact');
  await mobilePage.waitForFunction(() => document.getElementById('contact').getBoundingClientRect().top < innerHeight);
  assert.deepEqual(mobileErrors, []);
  await mobile.close();
  assert.equal(await mobilePage.locator('[data-inquiry-form]').count(), 1);
  console.log('PASS portfolio mobile: horizontal categories at 390/320px, scrollable keyboard access, connected anchor jumps and INDEX Contact, no page overflow.');
  console.log(`Screenshots saved in ${artifacts.pathname}`);
} finally {
  await browser.close();
}
