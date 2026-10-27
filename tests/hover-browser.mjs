import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const route = (path = '/') => new URL(path, baseURL).href;

async function settle(page, selector = '#selected-work') {
  const section = page.locator(selector);
  await section.evaluate((element) => {
    document.activeElement?.blur();
    scrollTo({ top: element.getBoundingClientRect().top + scrollY + parseFloat(element.style.getPropertyValue('--motion-run') || '0'), behavior: 'instant' });
  });
  await page.waitForFunction((element) => !element.dataset.motionState || element.dataset.motionState === 'settled', await section.elementHandle());
}

async function sample(target) {
  return target.evaluate((element) => {
    const visual = element.querySelector('.interaction-visual');
    const style = getComputedStyle(visual);
    const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
    const rect = element.getBoundingClientRect();
    return { scale: Math.hypot(matrix.m11, matrix.m12), glow: style.filter, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(route(), { waitUntil: 'networkidle' });
  await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
  if (await page.locator('#pause-control').getAttribute('aria-pressed') === 'false') await page.locator('#pause-control').click();

  await settle(page);
  const link = page.locator('#selected-work .category-link').first();
  await page.mouse.move(1, 1);
  const before = await sample(link);
  await link.hover();
  await page.waitForFunction((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element.querySelector('.interaction-visual')).transform);
    return matrix.m11 >= 1.19;
  }, await link.elementHandle());
  await page.waitForTimeout(300);
  const hovered = await sample(link);
  assert.ok(hovered.scale >= 1.19 && hovered.scale <= 1.205, 'A roomy category should visibly magnify to 120%.');
  assert.notEqual(hovered.glow, 'none', 'Normal hover must produce a strong localized luminous treatment.');
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[key] - hovered[key]) < .25, 'Magnification must not move or resize the real link target.');
  await page.mouse.move(1, 1);
  await page.waitForTimeout(380);
  const arrow = await link.evaluate((element) => {
    const visual = element.querySelector('.interaction-visual');
    const label = visual.querySelector('.category-magnet > span') || visual.querySelector('span');
    const icon = visual.querySelector('.arrow');
    const text = label.getBoundingClientRect();
    const image = icon.getBoundingClientRect();
    return { gap: image.left - text.right, ratio: image.width / parseFloat(getComputedStyle(icon).fontSize), stroke: parseFloat(getComputedStyle(icon, '::before').height) };
  });
  assert.ok(arrow.gap >= 7 && arrow.gap <= 18.1, 'The arrow must sit close to its own word rather than at the column edge.');
  assert.ok(Math.abs(arrow.ratio - .72) < .01);
  assert.ok(Math.abs(arrow.stroke - 1.25) < .1);
  assert.ok(Number(await page.locator('.about-preview .text-link').evaluate((element) => parseFloat(getComputedStyle(element).fontSize))) >= 30, 'More About needs a prominent readable size.');

  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  const speed = page.locator('#speed-control');
  const speedBefore = await speed.boundingBox();
  await speed.hover();
  await page.waitForFunction((element) => {
    const visual = element.querySelector('.interaction-visual');
    return visual && new DOMMatrixReadOnly(getComputedStyle(visual).transform).m11 >= 1.21;
  }, await speed.elementHandle());
  assert.ok((await sample(speed)).scale >= 1.21, 'Compact controls should use the full 122% label scale.');
  for (let index = 0; index < 3; index++) {
    await speed.click();
    await page.waitForFunction((element) => element.querySelectorAll(':scope > .interaction-visual').length === 1, await speed.elementHandle());
  }
  assert.equal(await speed.locator('.interaction-visual .interaction-visual').count(), 0, 'Text updates must not nest enhancement wrappers.');
  const speedAfter = await speed.boundingBox();
  assert.ok(Math.abs(speedBefore.height - speedAfter.height) < .25, 'Control label updates must retain the control height.');
  const secret = page.locator('[data-visitor-hotspot]');
  await secret.hover();
  assert.equal(await secret.getAttribute('data-ui-interactive'), null, 'Secret discovery must not gain a conventional glow or magnification.');

  await page.keyboard.down('4');
  await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray', null, { timeout: 15000 });
  await page.keyboard.up('4');
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-xray-transition'));
  await settle(page);
  await link.hover();
  await page.waitForTimeout(300);
  assert.notEqual((await sample(link)).glow, hovered.glow, 'The Other Side uses the stronger multi-color luminous response.');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction((element) => getComputedStyle(element.querySelector('.interaction-visual')).transform === 'none', await link.elementHandle());
  await link.focus();
  assert.equal((await sample(link)).scale, 1);
  assert.notEqual(await link.evaluate((element) => getComputedStyle(element).outlineStyle), 'none', 'Keyboard focus must remain visibly identifiable.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await settle(page);
    for (const target of await page.locator('#selected-work .category-link').all()) {
      await target.hover();
      await page.waitForTimeout(300);
      assert.ok((await sample(target)).scale <= 1.205, 'Small columns must cap the preferred enlargement.');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Hover must not create page overflow at ${width}px.`);
    }
  }
  assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS hover desktop: strong localized glow, 120/122% inner scale, stable targets, arrow geometry/gaps, live control labels, secrets excluded, Other Side response, reduced motion and 390/320px containment.');

  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const touchPage = await touch.newPage();
  await touchPage.goto(route('/about'), { waitUntil: 'networkidle' });
  await touchPage.locator('[data-global-index] > summary').tap();
  const navigation = touchPage.locator('[data-index-page="work"]');
  await navigation.focus();
  assert.equal((await sample(navigation)).scale, 1, 'Touch profiles must not retain mouse hover magnification.');
  assert.equal((await sample(navigation)).glow, 'none');
  await touch.close();
  console.log('PASS hover touch: no sticky mouse scale/glow, native focus and navigation retained.');
} finally { await browser.close(); }
