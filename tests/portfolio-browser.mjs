import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_PORTFOLIO_ARTIFACTS || 'artifacts/v311/F16/portfolio'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })))
  .filter(profile => !process.env.H4_PORTFOLIO_WIDTHS || process.env.H4_PORTFOLIO_WIDTHS.split(',').map(Number).includes(profile.width));
const groups = ['tattoos', 'jewellery', 'tools', 'more'];
const leaves = ['flashes', 'analog-photography', 'digital-artworks', 'paintings'];
const expectedCategories = {
  all: ['tattoos', 'flashes', 'jewellery', 'digital-artworks', 'analog-photography'],
  tattoos: ['tattoos', 'flashes'], jewellery: ['jewellery'], tools: [], more: ['digital-artworks', 'analog-photography'],
  flashes: ['flashes'], 'analog-photography': ['analog-photography'], 'digital-artworks': ['digital-artworks'], paintings: ['paintings'],
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const url = path => new URL(path, base).href;
async function settle(page) {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-mode-snapshot')
    && !document.documentElement.hasAttribute('data-xray-transition') && !document.documentElement.hasAttribute('data-memory-mosh-preparing'));
  await page.evaluate(() => document.activeElement?.blur()); await frames(page);
}
async function mode(page, target) {
  await page.evaluate(() => document.activeElement?.blur());
  if (target === 'xray') { await page.keyboard.down('4'); await page.waitForTimeout(1100); await page.keyboard.up('4'); }
  else await page.keyboard.type('333', { delay: 65 });
  await page.waitForFunction(expected => document.documentElement.dataset.mode === expected, target, { timeout: 60000 });
  await settle(page);
}
async function index(page, target, kind) {
  const menu = page.locator('[data-global-index]');
  if (!await menu.evaluate(element => element.open)) await menu.locator('summary').click();
  await menu.locator(`[data-index-page="${target}"]`).click();
  await page.locator(`html[data-page="${kind}"]`).waitFor(); await settle(page);
}
async function work(page, category = 'all') {
  await page.locator(`[data-connected-work][data-work-context="${category}"]`).waitFor();
  await settle(page);
  const actual = await page.locator('[data-archive-category]').evaluateAll(nodes => nodes.map(node => node.dataset.archiveCategory));
  assert.deepEqual(actual, expectedCategories[category], 'A category URL renders only its selected real group/leaf.');
  const expectedGroups = category === 'all' ? groups : groups.includes(category) ? [category] : [];
  assert.deepEqual(await page.locator('[data-work-group]').evaluateAll(nodes => nodes.map(node => node.dataset.workGroup)), expectedGroups);
  const rubric = groups.includes(category);
  assert.equal(await page.locator('.work-page .page-heading').innerText(), category === 'all' ? '01/ creative'
    : rubric ? (category === 'tattoos' ? 'on skin' : category) : category.replaceAll('-', ' ').toUpperCase());
  assert.equal(await page.locator('#contact, [data-inquiry-form]').count(), 0, 'Contact remains exclusively on Home.');
  assert.equal(await page.locator('#logo-canvas').isVisible(), false);
  const links = await page.locator('.work-filters a').evaluateAll(nodes => nodes.map(node => ({ href: node.getAttribute('href'), text: node.textContent.trim() })));
  assert.deepEqual(links, groups.map(id => ({ href: `/work/${id}`, text: id === 'tattoos' ? 'on skin' : id })));
  const group = groups.includes(category) ? category : ['digital-artworks', 'analog-photography'].includes(category) ? 'more' : category === 'flashes' ? 'tattoos' : null;
  const current = page.locator('.work-filters a[aria-current="page"]');
  assert.equal(await current.count(), group ? 1 : 0);
  if (group) assert.equal(await current.getAttribute('href'), `/work/${group}`);
  if (rubric) {
    assert.equal(await page.locator('.work-group-heading').count(), 0, 'Rubric pages do not retain a self-link header.');
    assert.equal(await page.locator('.work-page.is-rubric-page').count(), 1);
    const promoted = await page.locator('.portfolio-archive .rubric-category-heading').evaluateAll(nodes => nodes.map(node => ({
      id: node.id, text: node.textContent.trim(), links: node.querySelectorAll('a').length, arrows: node.querySelectorAll('.arrow').length })));
    assert.ok(promoted.every(heading => heading.id && heading.text && heading.links === 0 && heading.arrows === 0), JSON.stringify(promoted));
    const staticPose = await page.locator('.portfolio-archive .rubric-category-heading').evaluateAll(nodes => nodes.map(node => {
      const style = getComputedStyle(node);
      return { flag: node.hasAttribute('data-motion-static'), transform: style.transform, opacity: Number(style.opacity), size: style.fontSize };
    }));
    assert.ok(staticPose.every(pose => pose.flag && pose.transform === 'none' && pose.opacity === 1), JSON.stringify(staticPose));
    if (promoted.length) {
      const frontCategorySize = await page.evaluate(() => {
        const probe = document.createElement('a'); probe.className = 'category-link'; probe.style.cssText = 'position:absolute;visibility:hidden';
        document.body.append(probe); const size = getComputedStyle(probe).fontSize; probe.remove(); return size;
      });
      assert.ok(staticPose.every(pose => pose.size === frontCategorySize), JSON.stringify({ staticPose, frontCategorySize }));
    }
  }
  const photos = actual.includes('tattoos') ? 8 : 0, digital = actual.includes('digital-artworks') ? 1 : 0;
  assert.equal(await page.locator('.portfolio-archive .project-image img').count(), photos + digital);
  if (photos) {
    const sources = await page.locator('[data-horizontal-drift="tattoos"] img').evaluateAll(images => images.map(image => ({
      alt: image.alt, srcset: image.getAttribute('srcset'), width: image.getAttribute('width'), height: image.getAttribute('height') })));
    assert.equal(sources.length, 8);
    assert.ok(sources.every(image => image.alt && image.srcset && Number(image.width) > 0 && Number(image.height) > 0));
  }
  if (digital) assert.match(await page.locator('[data-archive-category="digital-artworks"] img').getAttribute('src'), /green-black-original/);
  const path = category === 'all' ? '/work' : `/work/${category}`;
  assert.equal(new URL(page.url()).pathname, path);
  assert.equal(new URL(page.url()).hash, '');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://h4ngelic.com${path}`);
  assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), `https://h4ngelic.com${path}`);
  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, width: innerWidth }));
  assert.ok(dimensions.document <= dimensions.width + 1, 'Category routes cannot widen the page.');
  const ids = await page.locator('#page-content [id]').evaluateAll(nodes => nodes.map(node => node.id));
  assert.equal(new Set(ids).size, ids.length, 'Route content has no duplicate IDs.');
  return { category, path, groups: expectedGroups, categories: actual, images: photos + digital, dimensions };
}
async function homepageCategories(page, width) {
  const section = page.locator('#selected-work'), links = section.locator('.category-link');
  assert.deepEqual(await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), groups.map(id => `/work/${id}`));
  assert.equal(await section.locator('img, picture, video, canvas').count(), 0);
  assert.equal(await section.locator('.category-sublinks').count(), 0);
  assert.equal(await page.locator('#selected-work-title .section-route-link').count(), 0);
  const title = selector => page.locator(selector).evaluate(element => element.textContent.replace(/\s+/g, ' ').trim());
  assert.equal(await title('#selected-work-title'), '01/ creative');
  assert.equal(await title('#about-preview-title'), '02/ more about');
  assert.equal(await title('#contact-title'), '03/ contact');
  const boxes = await links.evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width }; }));
  if (width > 600) {
    assert.ok(boxes.every(rect => Math.abs(rect.y - boxes[0].y) < 2), 'The Home category strip stays in one row on desktop.');
    assert.ok(boxes.every((rect, index) => index === 0 || rect.x > boxes[index - 1].x));
    assert.ok(boxes.every(rect => Math.abs(rect.width - boxes[0].width) < 2));
  } else {
    assert.ok(Math.abs(boxes[0].y - boxes[1].y) < 2 && Math.abs(boxes[2].y - boxes[3].y) < 2, 'Mobile uses two aligned rows.');
    assert.ok(boxes[2].y > boxes[0].y + 20 && Math.abs(boxes[0].x - boxes[2].x) < 2 && Math.abs(boxes[1].x - boxes[3].x) < 2, 'Both mobile rows share the slash-aligned columns.');
  }
  assert.ok(boxes.every(rect => Math.abs(rect.width - boxes[0].width) < 2));
  await links.first().focus();
  for (let index = 1; index < boxes.length; index += 1) await page.keyboard.press('Tab');
  assert.ok(await links.last().evaluate(element => element === document.activeElement));
  const last = await links.last().boundingBox();
  assert.ok(last.x < width && last.x + last.width > 0, 'MORE remains keyboard-reachable on narrow viewports.');
}
try {
  for (const profile of profiles) {
    console.log(`CHECK F16 category routes ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 }, deviceScaleFactor: 1,
      isMobile: profile.width < 600, hasTouch: profile.width < 600, reducedMotion: profile.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(), errors = [], requests = [], observations = [];
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => requests.push(request.url()));
    try {
      // Cold interior first: no cached hero/Three request can hide eager loading.
      await page.goto(url('/work/tattoos'), { waitUntil: 'networkidle' });
      observations.push(await work(page, 'tattoos'));
      for (const category of ['jewellery', 'more']) {
        await page.evaluate(() => { window.__portfolioPreviousNode = document.querySelector('[data-connected-work]'); });
        await page.locator(`.work-filters a[href="/work/${category}"]`).click();
        observations.push(await work(page, category));
        assert.equal(await page.evaluate(() => window.__portfolioPreviousNode === document.querySelector('[data-connected-work]')), false,
          'A different category mounts its own real page instead of retaining hidden tabs.');
        await page.reload({ waitUntil: 'networkidle' }); observations.push(await work(page, category));
      }
      await page.goBack({ waitUntil: 'networkidle' }); observations.push(await work(page, 'jewellery'));
      assert.ok(!requests.some(request => /\/src\/main\.js(?:[?#]|$)|\/assets\/main-[^/]+\.js|\/three(?:\/|\.js)|\/deps\/three\.js/.test(request)),
        'Cold Works categories and their internal routes never download Three.js or the hero entry.');
      assert.ok(!requests.some(request => /\.mp3(?:[?#]|$)/.test(request)), 'No soundtrack is fetched before a user plays it.');
      await mode(page, 'xray');
      for (const category of ['tattoos', 'more']) {
        await page.locator(`.work-filters a[href="/work/${category}"]`).click(); observations.push(await work(page, category));
        assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'The existing world survives real category page changes.');
      }
      await page.screenshot({ path: new URL(`more-${profile.width}-${profile.reduced}-4.png`, output).pathname });
      await mode(page, 'normal');
      const menu = page.locator('[data-global-index]');
      if (!await menu.evaluate(element => element.open)) await menu.locator('summary').click();
      assert.equal(await menu.locator('.index-static[data-index-page="creative"]').evaluate(element => element.textContent.replace(/\s+/g, ' ').trim()), '01/ creative');
      assert.equal(await menu.locator('.index-static[data-index-page="creative"]').evaluate(element => element.tabIndex >= 0), false);
      assert.equal(await menu.locator('a[href="/work"]').count(), 0);
      await menu.locator('[data-index-page="home"]').click();
      await page.locator('html[data-page="home"]').waitFor(); await settle(page);
      await homepageCategories(page, profile.width);
      await page.goto(url('/work'), { waitUntil: 'networkidle' });
      assert.equal(new URL(page.url()).pathname, '/work/tattoos');
      observations.push(await work(page, 'tattoos'));
      await page.goto(url('/'), { waitUntil: 'networkidle' }); await settle(page);
      for (const category of groups) {
        const target = page.locator(`#selected-work .category-link[href="/work/${category}"]`);
        await target.focus(); await page.keyboard.press('Enter'); observations.push(await work(page, category));
        await page.goBack({ waitUntil: 'networkidle' }); await page.locator('html[data-page="home"]').waitFor(); await settle(page);
      }
      for (const category of [...groups, ...leaves]) {
        await page.goto(url(`/work?category=${category}`), { waitUntil: 'networkidle' });
        observations.push(await work(page, category));
        await page.reload({ waitUntil: 'networkidle' }); observations.push(await work(page, category));
      }
      await page.goto(url('/about'), { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.about-paragraph').count(), 5);
      assert.equal(await page.locator('[data-inquiry-form]').count(), 0);
      assert.equal(await page.locator('.about-copy a[href="/#contact"]').count(), 1);
      await page.locator('.about-copy a[href="/#contact"]').click();
      await page.locator('html[data-page="home"]').waitFor(); await settle(page);
      await page.waitForFunction(() => document.querySelector('#contact').getBoundingClientRect().top < innerHeight);
      assert.equal(new URL(page.url()).pathname, '/'); assert.equal(new URL(page.url()).hash, '#contact');
      assert.equal(await page.locator('[data-inquiry-form]').count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      reports.push({ ...profile, observations, coldInteriorRequestsChecked: true, errors }); await save();
      console.log(`PASS F16 ${profile.width}px reduced=${profile.reduced}: real category pages, route-specific content/canonicals, reload/back, clickable Works, preserved About/Home Contact, both worlds.`);
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors });
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      await save(); throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
