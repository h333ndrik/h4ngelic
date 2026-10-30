import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Current UI contracts only. Navigation geometry, footer discovery, scrubbed
// motion, image-transfer measurements and soundtrack playback have separate
// suites. This suite never activates SMASH or submits a real inquiry.
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../artifacts/v31/ui/', import.meta.url);
await mkdir(output, { recursive: true });
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })))
  .filter(profile => !process.env.H4_UI_WIDTHS || process.env.H4_UI_WIDTHS.split(',').map(Number).includes(profile.width))
  .filter(profile => !process.env.H4_UI_REDUCED || profile.reduced === (process.env.H4_UI_REDUCED === 'true'));
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const close = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function settled(page) {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-mode-snapshot')
    && !document.documentElement.hasAttribute('data-xray-transition') && !document.documentElement.hasAttribute('data-memory-mosh-preparing'));
  await frames(page);
}

async function indexRoute(page, destination) {
  const menu = page.locator('[data-global-index]');
  if (!await menu.evaluate(element => element.open)) await menu.locator('summary').click();
  await menu.locator(`[data-index-page="${destination}"]`).click();
  await page.locator(`html[data-page="${destination === 'contact' ? 'home' : destination}"]`).waitFor();
  await settled(page);
  if (destination === 'contact') {
    await page.waitForFunction(() => document.querySelector('[data-naavi]')?.dataset.chapter === '3');
    await page.locator('.inquiry-field input[name="name"]').focus();
  } else if (destination === 'home') {
    await page.waitForFunction(() => scrollY < 2 && !document.querySelector('[data-controls]').inert);
  }
}

async function changeMode(page, destination) {
  await page.evaluate(() => document.activeElement?.blur());
  if (destination === 'xray') {
    await page.keyboard.down('4');
    await page.waitForTimeout(1100);
    await page.keyboard.up('4');
  } else await page.keyboard.type('333', { delay: 65 });
  await page.waitForFunction(mode => document.documentElement.dataset.mode === mode, destination, { timeout: 60000 });
  await settled(page);
}

async function radiusScope(page, selectors, expected) {
  const values = await page.evaluate(selectors => selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(element => ({
    selector, radius: getComputedStyle(element).borderRadius,
  }))), selectors);
  for (const selector of selectors) assert.ok(values.some(value => value.selector === selector), `Missing radius target ${selector}.`);
  for (const value of values) assert.equal(value.radius, `${expected}px`, `${value.selector} has the intended radius.`);
  return values;
}

async function coverage(page, selectors) {
  await page.waitForFunction(selectors => selectors.every(selector => {
    const elements = [...document.querySelectorAll(selector)];
    return elements.length && elements.every(element => element.hasAttribute('data-ui-interactive')
      && element.querySelector('.interaction-visual, .category-magnet'));
  }), selectors);
  return page.evaluate(selectors => selectors.map(selector => ({ selector, count: document.querySelectorAll(selector).length })), selectors);
}

async function hovered(page, selector, profile) {
  if (profile.width < 600) return null;
  const target = page.locator(selector).first();
  await target.hover();
  await page.waitForTimeout(profile.reduced ? 0 : 360);
  await settled(page);
  const state = await target.evaluate(element => {
    const visual = element.querySelector('.interaction-visual, .category-magnet');
    const style = getComputedStyle(visual), matrix = new DOMMatrixReadOnly(style.transform);
    return { filter: style.filter, scale: Math.hypot(matrix.m11, matrix.m12), duration: style.transitionDuration,
      preferred: Number(getComputedStyle(element).getPropertyValue('--ui-target-scale')) };
  });
  assert.ok(state.scale >= .999 && state.scale <= 1.0251, `Shared hover is bounded: ${selector}.`);
  if (profile.reduced) assert.ok(close(state.scale, 1, .0001), 'Reduced motion suppresses hover scaling.');
  else {
    assert.notEqual(state.filter, 'none', `The shared subtle glow is present on ${selector}.`);
    assert.ok(state.duration.split(',').every(value => close(parseFloat(value), .3, .001)), 'Shared hover timing is 300ms.');
  }
  return { selector, ...state };
}

async function formContract(page, profile) {
  const name = page.locator('.inquiry-field input[name="name"]');
  assert.equal(await name.getAttribute('placeholder'), 'max musterperson');
  await page.evaluate(() => document.activeElement?.blur());
  const fields = await page.locator('.inquiry-field').evaluateAll(labels => labels.map(label => {
    const field = label.querySelector('input,textarea'), caption = label.querySelector(':scope > span');
    const a = field.getBoundingClientRect(), b = caption.getBoundingClientRect(), s = getComputedStyle(field);
    return { name: field.name, width: a.width, height: a.height, top: a.top + scrollY,
      captionBottom: b.bottom + scrollY, surface: s.backgroundColor, radius: s.borderRadius,
      outline: s.outlineWidth, border: s.borderTopWidth, labelSurface: getComputedStyle(label).backgroundColor };
  }));
  assert.equal(fields.length, 3);
  for (const field of fields) {
    assert.equal(field.surface, 'rgb(48, 48, 51)');
    assert.equal(field.labelSurface, 'rgba(0, 0, 0, 0)', 'Only the input owns a painted field surface.');
    assert.equal(field.radius, '4px'); assert.equal(field.outline, '0px'); assert.equal(field.border, '1px');
    assert.ok(field.captionBottom <= field.top - 8, 'Each label remains clearly above its input.');
  }
  const focused = [];
  for (const field of fields) {
    const control = page.locator(`.inquiry-field [name="${field.name}"]`);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await control.focus();
    const geometry = await control.evaluate(element => {
      const r = element.getBoundingClientRect(), s = getComputedStyle(element);
      return { width: r.width, height: r.height, outline: s.outlineWidth, border: s.borderTopWidth,
        radius: s.borderRadius, pageHeight: document.documentElement.scrollHeight };
    });
    assert.ok(close(geometry.width, field.width, .1) && close(geometry.height, field.height, .1), 'Field focus never changes field dimensions.');
    assert.equal(geometry.pageHeight, height, 'Field focus never changes document height.');
    assert.equal(geometry.outline, '0px'); assert.equal(geometry.border, '1px'); assert.equal(geometry.radius, '4px');
    focused.push({ name: field.name, ...geometry });
  }
  await page.evaluate(() => document.activeElement?.blur());
  await page.locator('[data-global-index] summary').click();
  const panel = await page.locator('.global-index-links').evaluate(element => {
    const s = getComputedStyle(element);
    return { surface: s.backgroundColor, borderColor: s.borderTopColor, borderWidth: s.borderTopWidth, radius: s.borderRadius };
  });
  assert.equal(panel.surface, fields[0].surface); assert.equal(panel.borderColor, 'rgb(255, 255, 255)');
  assert.equal(panel.borderWidth, '1px'); assert.equal(panel.radius, '4px');
  const menuHover = await hovered(page, '[data-global-index] [data-index-page="home"]', profile);
  await page.keyboard.press('Escape');
  const targets = await coverage(page, ['[data-global-index] summary', '[data-global-index] a', '[data-naavi]',
    '.about-preview .text-link', '.footer-moshlab', '.footer-smash', '.footer-instagram', '.footer-location',
    '[data-visit-counter-hotspot]', '[data-inquiry-submit]', '[data-controls] button']);
  const surfaces = await radiusScope(page, ['.inquiry-field input', '.inquiry-field textarea', '.global-index-links',
    '[data-naavi]', '[data-other-side-hint]', '[data-visit-counter-hotspot]'], 4);
  await page.screenshot({ path: new URL(`form-${profile.width}-${profile.reduced}-${await page.locator('html').getAttribute('data-mode')}.png`, output).pathname });
  return { fields, focused, panel, targets, surfaces, menuHover };
}

async function imageContract(page, profile) {
  const section = page.locator('[data-horizontal-drift="tattoos"]');
  const photos = section.locator('[data-drift-item]');
  assert.equal(await photos.count(), 8, 'All eight supplied photographs appear in On Skin.');
  const first = photos.first().locator('[data-artwork-open]');
  const image = first.locator('img');
  await first.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
  await image.evaluate(async element => { if (!element.complete) await element.decode(); });
  await page.mouse.move(profile.width - 2, 100);
  await page.waitForTimeout(profile.reduced ? 0 : 360); await settled(page);
  const state = () => section.evaluate(element => {
    const button = element.querySelector('[data-artwork-open]'), image = button.querySelector('img');
    const b = button.getBoundingClientRect(), p = image.getBoundingClientRect();
    return { left: element.querySelector('.drift-viewport').scrollLeft, y: scrollY, height: document.documentElement.scrollHeight,
      buttonWidth: b.width, imageWidth: p.width, imageHeight: p.height,
      order: [...element.querySelectorAll('[data-drift-item]')].map(item => item.dataset.projectUrl) };
  });
  const before = await state();
  await first.click();
  await page.waitForTimeout(profile.reduced ? 0 : 360); await settled(page);
  const enlarged = await state();
  assert.equal(await first.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('dialog[open]').count(), 0, 'Carousel enlargement never opens a modal.');
  const ratio = enlarged.imageWidth / before.imageWidth;
  assert.ok(ratio >= 1.08 && ratio <= 1.12, `The actual photograph grows in place within the approved range (${ratio}).`);
  assert.ok(close(enlarged.left, before.left) && close(enlarged.y, before.y), 'Inline enlargement retains both scroll axes.');
  assert.equal(enlarged.height, before.height); assert.deepEqual(enlarged.order, before.order);
  await first.click();
  await page.mouse.move(profile.width - 2, 100);
  await page.waitForTimeout(profile.reduced ? 0 : 360); await settled(page);
  const restored = await state();
  assert.equal(await first.getAttribute('aria-pressed'), 'false');
  assert.ok(close(restored.imageWidth, before.imageWidth) && close(restored.imageHeight, before.imageHeight));
  assert.ok(close(restored.left, before.left) && close(restored.y, before.y));
  const photoRadii = await radiusScope(page, ['[data-horizontal-drift="tattoos"] .artwork-open',
    '[data-horizontal-drift="tattoos"] img', '#digital-artworks .artwork-open', '#digital-artworks img'], 0);
  await coverage(page, ['[data-horizontal-drift="tattoos"] .artwork-open']);
  const imageHover = await hovered(page, '[data-horizontal-drift="tattoos"] [data-artwork-open]', profile);
  await page.locator('#digital-artworks [data-artwork-open]').first().click();
  await page.locator('.artwork-dialog[open].is-open').waitFor();
  await settled(page);
  const viewerRadii = await radiusScope(page, ['.artwork-dialog', '.artwork-dialog button'], 4);
  const viewerPhoto = await radiusScope(page, ['.artwork-viewer-stage img'], 0);
  await page.locator('.artwork-close').click();
  await page.waitForFunction(() => !document.querySelector('.artwork-dialog')?.open);
  await page.screenshot({ path: new URL(`images-${profile.width}-${profile.reduced}-${await page.locator('html').getAttribute('data-mode')}.png`, output).pathname });
  return { before, enlarged, restored, ratio, photoRadii, viewerRadii, viewerPhoto, imageHover };
}

async function heroContract(page, profile) {
  await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('[data-controls]').inert && Number(getComputedStyle(document.querySelector('[data-controls]')).opacity) > .99);
  await coverage(page, ['[data-controls] button', '.hero-nav a']);
  const inspect = element => {
    const s = getComputedStyle(element);
    return { border: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
      outline: s.outlineWidth, radius: s.borderRadius, focus: element.matches(':focus-visible'), underline: s.textDecorationLine,
      shadow: s.boxShadow };
  };
  const controls = [];
  for (const button of await page.locator('[data-controls] button').all()) {
    const label = await button.getAttribute('aria-label');
    const resting = await button.evaluate(inspect);
    if (profile.width >= 600) await button.hover();
    await button.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    const focused = await button.evaluate(inspect);
    for (const state of [resting, focused]) {
      assert.deepEqual(state.border, ['0px', '0px', '0px', '0px']); assert.equal(state.outline, '0px'); assert.equal(state.radius, '4px');
    }
    assert.equal(focused.focus, true, 'Hero control keyboard focus is observable.');
    assert.ok(focused.underline.includes('underline'), 'Borderless hero controls retain their subtle keyboard underline.');
    controls.push({ label, resting, focused });
  }
  const speed = page.locator('#speed-control');
  await speed.hover(); await page.mouse.down();
  const pressed = await speed.evaluate(inspect);
  await page.mouse.up();
  assert.deepEqual(pressed.border, ['0px', '0px', '0px', '0px']); assert.equal(pressed.outline, '0px');
  const arrow = page.locator('[data-sound-volume-toggle]');
  await arrow.click();
  const popup = page.locator('[data-sound-volume-popup]'); await popup.waitFor({ state: 'visible' });
  const popupStyle = await popup.evaluate(inspect);
  assert.deepEqual(popupStyle.border, ['0px', '0px', '0px', '0px']); assert.equal(popupStyle.outline, '0px'); assert.equal(popupStyle.radius, '4px');
  const range = page.locator('[data-sound-volume]');
  await arrow.focus(); await page.keyboard.press('Tab');
  const rangeFocus = await range.evaluate(inspect);
  assert.equal(rangeFocus.focus, true, 'The range is reached through keyboard navigation.');
  assert.equal(rangeFocus.outline, '0px'); assert.notEqual(rangeFocus.shadow, 'none', 'Range focus uses a subtle underline rather than a white box.');
  await page.keyboard.press('Escape');
  const hover = await hovered(page, '.hero-nav a', profile);
  const unrounded = await radiusScope(page, ['#logo-canvas', '.stage'], 0);
  if (await page.locator('[data-corruption-ambient]').count()) await radiusScope(page, ['[data-corruption-ambient]'], 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: new URL(`hero-${profile.width}-${profile.reduced}-${await page.locator('html').getAttribute('data-mode')}.png`, output).pathname });
  return { controls, pressed, popupStyle, rangeFocus, hover, unrounded };
}

try {
  for (const profile of profiles) {
    console.log(`CHECK V3.1 UI ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 }, deviceScaleFactor: 1,
      isMobile: profile.width < 600, hasTouch: profile.width < 600, reducedMotion: profile.reduced ? 'reduce' : 'no-preference' });
    await context.addInitScript(() => localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .25 })));
    const page = await context.newPage(), errors = [], audioRequests = [];
    page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (/\.mp3(?:\?|$)/.test(request.url())) audioRequests.push(request.url()); });
    try {
      await page.goto(new URL('/#contact', base).href, { waitUntil: 'networkidle' });
      const tokens = await page.evaluate(() => {
        const s = getComputedStyle(document.documentElement);
        return Object.fromEntries(['--radius-soft', '--surface-input', '--ui-hover-scale', '--ui-image-scale', '--ui-hover-duration', '--ui-hover-easing'].map(key => [key, s.getPropertyValue(key).trim()]));
      });
      assert.equal(tokens['--radius-soft'], '4px'); assert.equal(tokens['--ui-hover-scale'], '1.025');
      assert.equal(tokens['--ui-image-scale'], '1.025'); assert.equal(tokens['--ui-hover-duration'], '300ms');
      const worlds = [];
      for (const world of ['normal', 'xray']) {
        if (world === 'xray') await changeMode(page, world);
        await indexRoute(page, 'contact');
        const form = await formContract(page, profile);
        await indexRoute(page, 'work');
        const images = await imageContract(page, profile);
        await indexRoute(page, 'home');
        const hero = await heroContract(page, profile);
        if (!profile.reduced && profile.width >= 600) {
          assert.equal(form.menuHover.filter, hero.hover.filter, 'INDEX and hero links use the identical shared glow.');
          assert.equal(images.imageHover.filter, hero.hover.filter, 'Photographs use the same restrained glow family.');
        }
        assert.deepEqual(audioRequests, [], 'Rendering, hovering, volume UI and reality switches never fetch the track before SMASH activation.');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        worlds.push({ world, form, images, hero });
      }
      await changeMode(page, 'normal');
      assert.deepEqual(errors, []);
      reports.push({ ...profile, tokens, worlds, audioRequests, errors });
      console.log(`PASS V3.1 UI ${profile.width}px reduced=${profile.reduced}: shared interaction family, form, real-photo enlargement, borderless controls and radius scope in both modes.`);
      await save();
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors, audioRequests, url: page.url() });
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      await save(); throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
