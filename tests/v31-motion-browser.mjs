import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { measureEntrancePerformance } from './helpers/v311-motion-performance.mjs';
import { aboutSectionProgress, sampleAboutItem } from '../src/data/motionSettings.js';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_MOTION_ARTIFACTS || 'artifacts/v31-motion'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })))
  .filter(profile => !process.env.H4_MOTION_WIDTHS || process.env.H4_MOTION_WIDTHS.split(',').map(Number).includes(profile.width));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const close = (a, b) => Math.abs(a - b) < .002;
async function move(page, y) { await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), Math.max(0, y)); await frames(page); }
async function settle(page) {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-mode-snapshot')
    && !document.documentElement.hasAttribute('data-xray-transition') && !document.documentElement.hasAttribute('data-memory-mosh-preparing'));
  await page.evaluate(() => document.activeElement?.blur());
  await frames(page);
}
async function indexLink(page, name, kind) {
  // INDEX now exposes only the approved 00–03 route set. Work remains a real
  // hero-nav destination; other calls continue through their INDEX entry.
  if (name === 'work') {
    await page.locator('.hero-nav a[href="/creative"]').click();
    await page.waitForFunction(() => location.pathname === '/creative');
  } else {
    const menu = page.locator('[data-global-index]');
    if (!await menu.evaluate(element => element.open)) await menu.locator('summary').click();
    await menu.locator(`[data-index-page="${name}"]`).click();
  }
  await page.locator(`html[data-page="${kind}"]`).waitFor();
  await settle(page);
}
async function mode(page, target) {
  await page.evaluate(() => document.activeElement?.blur());
  if (target === 'xray') {
    await page.keyboard.down('4'); await page.waitForTimeout(1100); await page.keyboard.up('4');
  } else for (let n = 0; n < 3; n++) await page.keyboard.press('3');
  await page.waitForFunction(expected => document.documentElement.dataset.mode === expected, target, { timeout: 60000 });
  await settle(page);
}
const sectionState = (page, id) => page.locator(`#${id}`).evaluate(section => {
  const pose = element => {
    const style = getComputedStyle(element), matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
    return { x: matrix.m41, y: matrix.m42, rotation: Math.atan2(matrix.m12, matrix.m11), opacity: Number(style.opacity) };
  };
  return { y: scrollY, height: document.documentElement.scrollHeight,
    heading: pose(section.querySelector('.kinetic-heading-text')),
    items: [...section.querySelectorAll('[data-scroll-item], .kinetic-item[data-motion-item], .category-link > .kinetic-item, .inquiry-enter')].map(pose) };
});
async function homeEntrances(page, profile, world) {
  const records = [];
  for (const id of ['selected-work', 'about-preview', 'contact']) {
    const geometry = await page.locator(`#${id}`).evaluate(element => ({
      top: element.getBoundingClientRect().top + scrollY,
      height: innerHeight, pin: element.hasAttribute('data-motion-pin'),
      run: element.style.getPropertyValue('--motion-run'),
      position: getComputedStyle(element.querySelector(':scope > .section-pin')).position,
    }));
    assert.ok(!geometry.pin && geometry.run === '' && geometry.position !== 'sticky', 'Editorial entrances reserve no pinned scroll interval.');
    const origin = geometry.top - geometry.height * .68;
    const distance = geometry.height * (.68 - .10);
    const samples = [];
    for (const progress of [0, .2, .5, .8, 1]) {
      await move(page, origin + progress * distance);
      const sample = await sectionState(page, id);
      assert.ok(sample.items.length > 0, `${id} must expose its existing calm content.`);
      for (const item of sample.items) {
        assert.ok(item.x >= 0 && item.x <= 36.001 && close(item.y, 0) && close(item.rotation, 0));
        assert.ok(item.opacity >= 0 && item.opacity <= 1);
        assert.ok(close(item.x, sample.items[0].x) && close(item.opacity, sample.items[0].opacity), 'The whole content strip arrives simultaneously.');
      }
      assert.ok(close(sample.heading.x, sample.items[0].x) && close(sample.heading.y, 0));
      assert.ok(close(sample.heading.opacity, sample.items[0].opacity), 'Section title and content share the exact same sampler pose.');
      const expected = profile.reduced ? { x: 0, opacity: 1 }
        : sampleAboutItem(aboutSectionProgress(sample.y, geometry.top, geometry.height), id === 'contact' ? 'copy' : 'link', profile.width);
      assert.ok(sample.items.every(item => close(item.x, expected.x) && close(item.opacity, expected.opacity)),
        `${id} uses the exact MORE ABOUT sampler, progress, easing and parameters.`);
      if (profile.reduced) assert.ok(sample.items.every(item => item.x === 0 && item.opacity === 1));
      samples.push(sample);
    }
    assert.ok(samples.every(sample => sample.height === samples[0].height), 'Scroll-driven transforms never change document height.');
    assert.ok(samples.at(-1).items.every(item => close(item.x, 0) && item.opacity === 1));
    for (const expected of samples.toReversed()) {
      await move(page, expected.y);
      const actual = await sectionState(page, id);
      for (let n = 0; n < actual.items.length; n++) {
        assert.ok(close(actual.items[n].x, expected.items[n].x) && close(actual.items[n].opacity, expected.items[n].opacity), 'Reverse scroll restores the same exact content pose.');
      }
    }
    if (id === 'contact' && !profile.reduced) {
      await page.locator('#contact').evaluate(element => {
        element.setAttribute('tabindex', '-1');
        element.focus({ preventScroll: true });
      });
      await move(page, samples[1].y);
      const anchorFocused = await sectionState(page, id);
      assert.ok(close(anchorFocused.items[0].x, samples[1].items[0].x)
        && close(anchorFocused.items[0].opacity, samples[1].items[0].opacity),
      'A route anchor focused on the section cannot disable reverse scrub.');
      await page.evaluate(() => document.activeElement?.blur());
    }
    const performance = await measureEntrancePerformance(page, { selector: `#${id}`, profile, label: `${world} ${id}` });
    records.push({ world, id, samples, performance });
  }
  assert.equal(await page.locator('[data-inquiry-reveal], .motion-echo').count(), 0, 'Retired one-shot and kinetic echo systems stay absent.');
  const field = page.locator('[data-inquiry-contact]');
  await field.evaluate(element => element.focus({ preventScroll: true }));
  await frames(page);
  assert.ok((await sectionState(page, 'contact')).items.every(item => item.x === 0 && item.opacity === 1), 'Keyboard focus exposes the whole form immediately.');
  await field.evaluate(element => element.blur());
  return records;
}
async function archiveEntrances(page, profile, world) {
  const firstPaint = await page.locator('.rubric-category-heading[data-motion-static]').evaluateAll(headings => headings.map(heading => {
    const visual = heading.querySelector(':scope > a, :scope > .archive-scroll-label') || heading;
    const style = getComputedStyle(visual), transform = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
    return { id: heading.id, static: heading.hasAttribute('data-motion-static'),
      enhanced: heading.hasAttribute('data-scroll-heading'), opacity: Number(getComputedStyle(heading).opacity),
      x: transform.m41, y: transform.m42,
      inlineX: heading.style.getPropertyValue('--archive-heading-x'), inlineOpacity: heading.style.getPropertyValue('--archive-heading-opacity') };
  }));
  assert.ok(firstPaint.length >= 1, 'The rubric child label is present immediately after arrival.');
  for (const heading of firstPaint) assert.ok(heading.static && !heading.enhanced && heading.opacity === 1
    && heading.x === 0 && heading.y === 0 && heading.inlineX === '' && heading.inlineOpacity === '',
  `${heading.id} keeps its final CSS first-paint pose without entrance enhancement.`);
  // content-visibility:auto reserves an intrinsic slot until a group is first
  // rendered. Prime every group once so the motion samples measure animation,
  // not the browser's one-time intrinsic-size correction.
  for (const group of await page.locator('.work-group').all()) {
    await group.scrollIntoViewIfNeeded();
    await frames(page);
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await frames(page);
  const result = [];
  for (const group of await page.locator('.work-group').all()) {
    const origin = await group.locator('.work-group-heading, .archive-category-heading').first().evaluate(element => element.getBoundingClientRect().top + scrollY - innerHeight * .68);
    const observations = [];
    for (const progress of [0, .2, .5, .8, 1]) {
      await move(page, origin + progress * 844 * (.68 - .10) + (progress === 1 ? 2 : 0));
      const sample = await group.evaluate(element => ({
        y: scrollY, documentHeight: document.documentElement.scrollHeight,
        poses: [...element.querySelectorAll('.work-group-heading, .archive-category-heading')].map(heading => {
          const visual = heading.querySelector(':scope > a, :scope > .archive-scroll-label') || heading;
          const style = getComputedStyle(visual), matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
          return { text: heading.textContent.trim(), static: heading.hasAttribute('data-motion-static'), x: matrix.m41, y: matrix.m42,
            rotation: Math.atan2(matrix.m12, matrix.m11), opacity: Number(getComputedStyle(heading).opacity) };
        }),
      }));
      for (const pose of sample.poses) {
        assert.ok(pose.x >= 0 && pose.x <= 36.001 && close(pose.y, 0) && close(pose.rotation, 0));
        const animated = sample.poses.find(item => !item.static);
        if (!pose.static && animated) assert.ok(close(pose.x, animated.x) && close(pose.opacity, animated.opacity), 'Animated labels share their unchanged group timeline.');
        if (pose.static || profile.reduced) assert.ok(pose.x === 0 && pose.opacity === 1);
      }
      observations.push(sample);
    }
    assert.ok(observations.at(-1).poses.every(pose => Math.abs(pose.x) < .05 && pose.opacity > .998), `Final archive poses settle exactly: ${JSON.stringify(observations.at(-1).poses)}`);
    assert.ok(observations.every(sample => sample.documentHeight === observations[0].documentHeight));
    for (const expected of observations.toReversed()) {
      await move(page, expected.y);
      const actual = await group.locator('.work-group-heading, .archive-category-heading').first().evaluate(element => parseFloat(element.style.getPropertyValue('--archive-heading-x')) || 0);
      assert.ok(close(actual, expected.poses[0].x), `Archive reversal ${await group.getAttribute('data-work-group')} y=${expected.y}: ${actual} versus ${expected.poses[0].x}`);
    }
    result.push({ world, group: await group.getAttribute('data-work-group'), observations });
  }
  return result;
}
async function heroBar(page, profile, world) {
  await page.evaluate(() => document.activeElement?.blur());
  const samples = [];
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await frames(page);
  const initial = await page.locator('.hero').evaluate(element => {
    const hero = element.getBoundingClientRect();
    const controls = element.querySelector('.controls').getBoundingClientRect();
    const navigation = element.querySelector('.hero-nav').getBoundingClientRect();
    return { heroBottom: hero.bottom, documentHeight: document.documentElement.scrollHeight,
      controlsTop: controls.top, navigationTop: navigation.top };
  });
  for (const progress of [0, .2, .4, .6, .8, 1]) {
    await move(page, initial.heroBottom * progress);
    const sample = await page.locator('.hero').evaluate(element => {
      const style = bar => getComputedStyle(bar);
      return { y: scrollY, height: document.documentElement.scrollHeight, state: element.dataset.heroBarState || null,
        bars: [element.querySelector('.controls'), element.querySelector('.hero-nav')].map(bar => ({
          top: bar.getBoundingClientRect().top, transform: style(bar).transform, opacity: Number(style(bar).opacity),
          position: style(bar).position, inert: bar.inert })) };
    });
    assert.ok(sample.bars.every(bar => bar.position !== 'fixed' && bar.transform === 'none' && bar.opacity === 1 && !bar.inert));
    assert.equal(sample.state, null, 'No legacy hero-bar hide state remains.');
    assert.ok(close(sample.bars[0].top, initial.controlsTop - sample.y, 1));
    assert.ok(close(sample.bars[1].top, initial.navigationTop - sample.y, 1));
    assert.equal(sample.height, initial.documentHeight);
    samples.push(sample);
  }
  return { world, samples };
}
try {
  for (const profile of profiles) {
    console.log(`CHECK V3.1 motion ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 }, reducedMotion: profile.reduced ? 'reduce' : 'no-preference',
      isMobile: profile.width < 600, hasTouch: profile.width < 600, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(new URL('/?test=1#contact', base).href, { waitUntil: 'networkidle' });
      await settle(page);
      const normalHome = await homeEntrances(page, profile, 'normal');
      await indexLink(page, 'work', 'work');
      const normalWork = await archiveEntrances(page, profile, 'normal');
      await mode(page, 'xray');
      const otherWork = await archiveEntrances(page, profile, 'xray');
      await indexLink(page, 'contact', 'home');
      const otherHome = await homeEntrances(page, profile, 'xray');
      const otherBar = await heroBar(page, profile, 'xray');
      await mode(page, 'normal');
      const normalBar = await heroBar(page, profile, 'normal');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      reports.push({ ...profile, normalHome, normalWork, otherWork, otherHome, otherBar, normalBar, errors });
      await page.screenshot({ path: new URL(`home-${profile.width}-${profile.reduced ? 'reduced' : 'normal'}.png`, output).pathname });
      await save();
      console.log(`PASS V3.1 motion ${profile.width}px reduced=${profile.reduced}: exact MORE ABOUT section pipeline, no pinning, measured native reversal, static top labels, both-mode lower-hero control fade.`);
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors, motionPerformance: error.motionPerformance || null });
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      await save(); throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
