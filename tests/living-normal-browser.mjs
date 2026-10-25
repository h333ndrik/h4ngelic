import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { assertNormalTheme } from './helpers/normal-theme.mjs';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const output = new URL('../artifacts/living-normal/', import.meta.url);
const selected = (process.env.H4_NORMAL_PROFILES || 'desktop,touch-390,touch-320').split(',');
const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 1000 } },
  { name: 'touch-390', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  { name: 'touch-320', viewport: { width: 320, height: 720 }, hasTouch: true, isMobile: true },
].filter(({ name }) => selected.includes(name));
assert.ok(profiles.length, 'Select at least one known Normal Side profile.');
await mkdir(output, { recursive: true });
const reports = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const route = path => new URL(path, baseURL).href;
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function settled(page) {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-mode-snapshot')
    && !document.documentElement.hasAttribute('data-xray-transition')
    && !document.activeViewTransition
    && !document.getAnimations().some(animation => animation.effect?.pseudoElement?.startsWith('::view-transition')),
  null, { timeout: 15000 });
  await frames(page);
}

async function mode(page, expected) {
  await page.waitForFunction(value => document.documentElement.hasAttribute('data-xray-ready')
    && document.documentElement.dataset.mode === value, expected, { timeout: 15000 });
  await settled(page);
  assert.equal(await page.locator('html').getAttribute('data-mode'), expected, 'The settled mode must retain the requested state.');
}

async function scrollSection(page, selector, boundary = false) {
  await page.locator(selector).evaluate((section, atBoundary) => {
    const box = section.getBoundingClientRect();
    const top = scrollY + box.top;
    scrollTo({ top: atBoundary ? top - innerHeight / 2 : top + Math.max(0, (box.height - innerHeight) / 2), behavior: 'instant' });
  }, boundary);
  await frames(page);
}

function samplePatch(data, info, x, y) {
  const mean = [0, 0, 0];
  for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
    const offset = ((y + dy) * info.width + x + dx) * info.channels;
    for (let channel = 0; channel < 3; channel++) mean[channel] += data[offset + channel] / 16;
  }
  return mean;
}

async function captureNormal(page, name, profile, baseline) {
  await mode(page, 'normal');
  await assertNormalTheme(page);
  const geometry = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: innerHeight, scrollY,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    effects: [...document.querySelectorAll('.xray-distress,.corruption-background,[data-corruption-region]')].map(element => {
      const style = getComputedStyle(element);
      return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0;
    }),
  }));
  assert.equal(geometry.overflow, false, `${profile}/${name}: Normal Side must not overflow horizontally.`);
  assert.ok(geometry.effects.every(Boolean), `${profile}/${name}: Other Side material must be hidden after restoration.`);
  const screenshot = await page.screenshot({ path: new URL(`${profile}-${name}.png`, output).pathname, timeout: 15000 });
  const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = [2, .25, .5, .75, geometry.height - 6].map(value => value < 1 ? Math.floor(geometry.height * value) : value);
  const samples = rows.flatMap(y => [2, geometry.width - 6].map(x => {
    const rgb = samplePatch(data, info, x, y);
    const expected = 40 - 8 * (y + 2) / geometry.height;
    assert.ok(rgb.every(value => Math.abs(value - expected) <= 1.1),
      `${profile}/${name}: (${x}, ${y}) must contain the continuous grey gradient; expected ${expected.toFixed(2)}, got ${rgb}.`);
    assert.ok(Math.max(...rgb) - Math.min(...rgb) <= .25, `${profile}/${name}: Normal Side background must remain neutral grey.`);
    return { x, y, rgb };
  }));
  if (baseline) for (let index = 0; index < samples.length; index++) {
    assert.ok(samples[index].rgb.every((value, channel) => Math.abs(value - baseline[index].rgb[channel]) <= .25),
      `${profile}/${name}: scrolling, navigation and reversal must preserve viewport-anchored background pixels.`);
  }
  return { name, scrollY: geometry.scrollY, samples };
}

async function navigate(page, selector, path, kind) {
  await page.locator(selector).click();
  await page.waitForURL(url => url.pathname === path);
  await page.waitForFunction(expected => document.documentElement.dataset.page === expected, kind);
  await settled(page);
}

try {
  for (const { name, ...options } of profiles) {
    console.log(`START Normal ${name}`);
    const context = await browser.newContext({ deviceScaleFactor: 1, ...options });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(route('/?test=1'), { waitUntil: 'networkidle' });
      await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
      await page.locator('[data-scroll-choreography]').waitFor();
      await mode(page, 'normal');
      if (await page.locator('#pause-control').getAttribute('aria-pressed') === 'false') await page.locator('#pause-control').click();
      await page.evaluate(() => document.activeElement?.blur());
      assert.equal(await page.locator('.corruption-background,[data-corruption-region]').count(), 0,
        'Fresh Normal browsing must not initialize Other Side rendering surfaces.');

      const captures = [];
      captures.push(await captureNormal(page, 'home-hero', name));
      const baseline = captures[0].samples;
      for (const [label, selector, boundary] of [
        ['home-hero-work-boundary', '#selected-work', true],
        ['home-work-pinned', '#selected-work', false],
        ['home-about-pinned', '.about-preview', false],
        ['home-contact-pinned', '#contact', false],
      ]) {
        await scrollSection(page, selector, boundary);
        captures.push(await captureNormal(page, label, name, baseline));
      }
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      captures.push(await captureNormal(page, 'home-footer', name, baseline));

      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await frames(page);
      await navigate(page, '.hero-nav a[href="/work"]', '/work', 'work');
      captures.push(await captureNormal(page, 'work', name, baseline));
      await page.keyboard.down('4');
      try { await mode(page, 'xray'); } finally { await page.keyboard.up('4'); }
      assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).backgroundImage), 'none',
        'The Normal gradient is disabled while The Other Side is active.');
      await navigate(page, '.page-nav a[href="/about"]', '/about', 'about');
      assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).backgroundImage), 'none',
        'Other Side navigation must not restore the Normal gradient early.');
      for (let press = 0; press < 3; press++) await page.keyboard.press('3');
      await mode(page, 'normal');
      captures.push(await captureNormal(page, 'about-restored-333', name, baseline));
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      captures.push(await captureNormal(page, 'about-footer', name, baseline));
      await navigate(page, '.brand-link', '/', 'home');
      await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
      captures.push(await captureNormal(page, 'home-restored-333', name, baseline));
      assert.deepEqual(errors, [], `${name}: no browser runtime errors.`);
      reports.push({ profile: name, viewport: options.viewport, captures, errors });
      console.log(`PASS Normal ${name}: ${captures.length} real-pixel captures, transparent hero, pinned sections, Work/About navigation and 4/333 restoration.`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(new URL('results.json', output), `${JSON.stringify({ testedAt: new Date().toISOString(), baseURL, reports }, null, 2)}\n`);
}
