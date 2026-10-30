import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const artifacts = new URL('../artifacts/v3-work-motion/', import.meta.url);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const profiles = [{ width: 1440 }, { width: 768 }, { width: 390 }, { width: 320, reduced: true }];
const deadline = setTimeout(() => void browser.close(), 150000);
try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: 900 },
      hasTouch: profile.width < 600, isMobile: profile.width < 600,
      reducedMotion: profile.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await page.goto(new URL('/work', base).href, { waitUntil: 'networkidle' });
    const groups = page.locator('.work-group');
    assert.equal(await groups.count(), 3);
    const observations = [];
    for (const mode of profile.width === 390 ? ['normal', 'xray'] : ['normal']) {
      if (mode === 'xray') {
        await page.keyboard.down('4'); await page.waitForTimeout(1100); await page.keyboard.up('4');
        await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray');
        await page.waitForTimeout(1700);
      }
      for (let index = 0; index < 3; index++) {
        const group = groups.nth(index);
        assert.notEqual(await group.evaluate(element => getComputedStyle(element).position), 'sticky');
        const heading = group.locator('.work-group-heading');
        if (profile.reduced) {
          assert.equal(await heading.getAttribute('data-scroll-heading'), null);
          assert.equal(await heading.evaluate(element => getComputedStyle(element).opacity), '1');
          continue;
        }
        const origin = await heading.evaluate(element => element.getBoundingClientRect().top + scrollY - innerHeight * .68);
        const distance = 900 * (.68 - .10);
        const samples = [];
        for (const progress of [0, .15, .4, .7, 1]) {
          const destination = Math.max(0, origin + progress * distance);
          await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), destination);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          samples.push(await heading.evaluate(element => ({ x: parseFloat(element.style.getPropertyValue('--archive-heading-x')),
            opacity: Number(getComputedStyle(element).opacity), scrollY, height: element.offsetHeight })));
        }
        assert.ok(samples.every(sample => sample.x >= 0 && sample.x <= 36 && sample.opacity >= 0 && sample.opacity <= 1));
        assert.ok(samples.slice(1).every((sample, sampleIndex) => sample.x <= samples[sampleIndex].x + .002));
        assert.ok(samples.at(-1).x < .01 && samples.at(-1).opacity === 1, 'Each heading reaches its original position continuously.');
        assert.ok(samples.every(sample => sample.height === samples[0].height), 'Animation cannot change heading layout.');
        for (const sample of samples.toReversed()) {
          await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), sample.scrollY);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          assert.ok(Math.abs(await heading.evaluate(element => parseFloat(element.style.getPropertyValue('--archive-heading-x'))) - sample.x) < .002,
            'Reverse scrolling must reproduce the same position without a time or history dependency.');
        }
        await group.evaluate(element => element.focus({ preventScroll: true }));
        assert.equal(await heading.evaluate(element => parseFloat(element.style.getPropertyValue('--archive-heading-x'))), 0,
          'Direct group focus and anchors must immediately reveal their heading.');
        await group.evaluate(element => element.blur());
        observations.push({ mode, group: await group.getAttribute('data-work-group'), samples });
      }
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'The heading motion cannot widen the page.');
    assert.equal(requests.some(url => /\/src\/(main|physics)\.js|three(?:\.module|\.core)?\.js/.test(url)), false,
      'A cold Work route must not download the hero scene.');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: new URL(`work-${profile.width}.png`, artifacts).pathname });
    results.push({ ...profile, observations, errors });
    console.log(`PASS V3 Works motion ${profile.width}px${profile.reduced ? ' reduced' : ''}`);
    await context.close();
  }
  await writeFile(new URL('results.json', artifacts), JSON.stringify({ passed: true, results }, null, 2));
} finally { clearTimeout(deadline); await browser.close(); }
