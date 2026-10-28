import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const out = new URL('../artifacts/website-completion/about/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function geometry(page) {
  return page.locator('#about-preview').evaluate(section => {
    const box = selector => {
      const element = section.querySelector(selector), style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
      return { left: rect.left, right: rect.right, x: matrix.m41, opacity: Number(style.opacity), textAlign: style.textAlign };
    };
    return { heading: box('.kinetic-heading'), copy: box('.about-preview-copy'), link: box('.text-link'),
      state: section.dataset.motionState, documentWidth: document.documentElement.scrollWidth, width: innerWidth };
  });
}

function aligned(layout, width) {
  const edge = width <= 700 ? 22 : 35;
  assert.ok(Math.abs(layout.heading.left - edge) < 1, 'The heading keeps the shared editorial gutter.');
  const inset = Math.max(12, Math.min(48, width * .03));
  assert.ok(Math.abs(layout.copy.left - layout.heading.left - inset) < 1, 'About copy has the approved small editorial inset.');
  assert.ok(Math.abs(layout.link.left - layout.copy.left) < 1, 'MORE ABOUT shares the flowing paragraph’s left edge.');
  assert.equal(layout.copy.textAlign, 'left');
  assert.ok(layout.copy.right <= width + 1 && layout.link.right <= width + 1);
  assert.ok(layout.documentWidth <= width + 1, 'The About entrance must not widen the website.');
  for (const item of [layout.copy, layout.link]) assert.ok(Math.abs(item.x) < .1 && item.opacity > .99);
}

try {
  for (const width of [1440, 390, 320]) for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 },
      deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      // A real deep link must expose the copy immediately, without playing
      // the approach just because the ordinary scroll timeline starts earlier.
      await page.goto(new URL('/#about-preview', base).href, { waitUntil: 'networkidle' });
      await page.locator('#about-preview .about-preview-copy').waitFor();
      await frames(page);
      assert.equal(await page.locator('.about-preview-copy').textContent(), 'mixed media. ink, metal and everything in between.');
      const direct = await geometry(page); aligned(direct, width);
      assert.ok(reduced || direct.state === 'focus', 'Direct links bypass the scrolling entrance.');
      const samples = [];
      if (!reduced) {
        const range = await page.locator('#about-preview').evaluate(async section => {
          const { motionSettings } = await import('/src/data/motionSettings.js');
          const top = section.getBoundingClientRect().top + scrollY;
          return { start: top - innerHeight * motionSettings.about.approach, end: top - innerHeight * motionSettings.about.finish };
        });
        const poseAt = async progress => {
          await page.evaluate(top => { document.activeElement?.blur(); scrollTo({ top, behavior: 'instant' }); }, range.start + (range.end - range.start) * progress);
          await frames(page);
          return geometry(page);
        };
        const before = await poseAt(0);
        assert.ok(before.copy.opacity < .01 && before.link.opacity < .01);
        assert.ok(before.copy.x > 0 && before.copy.x <= 36.1);
        const middle = await poseAt(.5);
        assert.ok(middle.copy.x < before.copy.x && middle.link.x > middle.copy.x, 'The copy leads the link through the shared fly-in.');
        const settled = await poseAt(1); aligned(settled, width);
        const reversed = await poseAt(.5);
        for (const key of ['copy', 'link']) {
          assert.ok(Math.abs(reversed[key].x - middle[key].x) < .1);
          assert.ok(Math.abs(reversed[key].opacity - middle[key].opacity) < .01);
        }
        await frames(page);
        const stopped = await geometry(page);
        assert.ok(Math.abs(stopped.copy.x - reversed.copy.x) < .1, 'About does no motion work while scrolling is stopped.');
        samples.push(before, middle, settled, reversed);
        await poseAt(1);
      }
      await page.screenshot({ path: new URL(`about-${width}-${reduced ? 'reduced' : 'motion'}.png`, out).pathname });
      assert.deepEqual(errors, []);
      reports.push({ width, reduced, direct, samples, errors });
      console.log(`PASS About ${width}px reduce=${reduced}: shared modest inset, immediate deep link, bounded reversible entrance, readable copy and no overflow.`);
    } finally { await context.close(); }
  }
  await writeFile(new URL('results.json', out), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2));
} finally { await browser.close(); }
