import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_CROSS_LINKS_ARTIFACTS || 'artifacts/v312/V25'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const groups = ['tattoos', 'jewellery', 'more'];
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const round = value => Math.round(value * 100) / 100;
try {
  for (const profile of profiles) {
    console.log(`CHECK V25 cross-links ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 }, deviceScaleFactor: 1,
      isMobile: profile.width < 600, hasTouch: profile.width < 600, reducedMotion: profile.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); const errors = []; const pages = [];
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      for (const category of groups) {
        await page.goto(new URL(`/work/${category}`, base).href, { waitUntil: 'networkidle' });
        await page.locator('.rubric-cross-links').waitFor();
        await page.locator('.rubric-cross-links').scrollIntoViewIfNeeded(); await frames(page);
        const data = await page.locator('.rubric-cross-links').evaluate((nav, current) => {
          const nodes = [...nav.children];
          const rect = nav.getBoundingClientRect();
          return {
            tag: nav.tagName, label: nav.getAttribute('aria-label'), children: nodes.length,
            currentIndex: nodes.findIndex(node => node.classList.contains('rubric-cross-gap')),
            currentEmpty: nodes[current]?.tagName === 'SPAN' && !nodes[current].textContent.trim() && !nodes[current].hasAttribute('tabindex'),
            entries: nodes.map(node => ({ tag: node.tagName, text: node.textContent.replace(/\s+/g, ' ').trim(),
              href: node.getAttribute('href'), left: Math.round(node.getBoundingClientRect().left - rect.left),
              width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height,
              tableIndex: node.tabIndex })),
            box: { left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) },
            scrollWidth: nav.scrollWidth, clientWidth: nav.clientWidth,
            fontSize: getComputedStyle(nav).fontSize, lineHeight: getComputedStyle(nav).lineHeight,
          };
        }, groups.indexOf(category));
        assert.equal(data.tag, 'NAV');
        assert.equal(data.children, 3);
        assert.equal(data.currentIndex, groups.indexOf(category));
        assert.equal(data.currentEmpty, true, 'The current rubric slot stays empty.');
        const expected = groups.filter(group => group !== category);
        assert.deepEqual(data.entries.filter(entry => entry.tag === 'A').map(entry => entry.text), expected);
        assert.deepEqual(data.entries.filter(entry => entry.tag === 'A').map(entry => entry.href), expected.map(group => `/work/${group}`));
        assert.ok(data.scrollWidth <= data.clientWidth + 1, 'The fixed row never overflows the page at 320px.');
        for (const entry of data.entries.filter(entry => entry.tag === 'A')) {
          assert.ok(entry.tableIndex >= 0, 'Cross-links are keyboard focusable.');
          assert.ok(entry.height <= parseFloat(data.lineHeight) * 1.5 + 44, `Cross-link stays on one line: ${JSON.stringify(entry)}`);
        }
        const links = page.locator('.rubric-cross-links a');
        assert.equal(await links.count(), 2);
        await links.first().focus();
        assert.equal(await links.first().evaluate(link => link === document.activeElement), true, 'The first cross-link accepts keyboard focus.');
        await page.keyboard.press('Tab');
        assert.equal(await links.nth(1).evaluate(link => link === document.activeElement), true, 'Tab moves to the second cross-link in logical order.');
        const before = await links.first().evaluate(link => getComputedStyle(link.querySelector('.interaction-visual')).transform);
        if (!profile.reduced && profile.width >= 1000) {
          const box = await links.first().boundingBox();
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await frames(page); await page.waitForTimeout(350);
          const after = await links.first().evaluate(link => getComputedStyle(link.querySelector('.interaction-visual')).transform);
          assert.notEqual(after, before, 'Desktop cross-links receive the unified hover.');
          await page.mouse.move(1, 1); await frames(page);
        } else {
          assert.equal(before, 'none', 'Reduced motion and touch leave the cross-link at its instant rest state.');
        }
        pages.push({ category, ...data });
      }
      const heights = new Set(pages.map(entry => entry.box.height));
      const columns = pages.map(entry => entry.entries.map(node => node.left));
      assert.equal(heights.size, 1, 'All rubric pages use the same cross-link line height.');
      assert.ok(columns.every(row => JSON.stringify(row) === JSON.stringify(columns[0])), 'Left/middle/right columns stay fixed across pages.');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: new URL(`cross-links-${profile.width}-${profile.reduced}.png`, output).pathname });
      reports.push({ ...profile, pages, errors }); await save();
      console.log(`PASS V25 ${profile.width}px reduced=${profile.reduced}: two real cross-links, empty current slot, fixed columns/height, keyboard order, no wrap or overflow.`);
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors }); await save();
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
