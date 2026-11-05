import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** B-F25 cross-link contract: four fixed positions, three links. The current
 * rubric is an invisible replica of its own label (word width plus arrow), so
 * the visible words keep the frontpage x positions on every rubric page. */
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_CROSS_LINKS_ARTIFACTS || 'docs/validation/B-F25-ROW-MECHANISM'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const groups = ['tattoos', 'jewellery', 'tools', 'more'];
const groupHref = id => `/creative/${id}`;
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const round = value => Math.round(value * 100) / 100;

async function settle(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForFunction(sel => {
    const item = document.querySelector(`${sel} .kinetic-item`);
    if (!item) return true;
    const transform = getComputedStyle(item).transform;
    return transform === 'none' || Math.abs(new DOMMatrixReadOnly(transform).m41) < .5;
  }, selector, { timeout: 5000 }).catch(() => {});
  await frames(page);
  await page.waitForTimeout(150);
}

const readRow = (page, selector) => page.evaluate((selector) => {
  const round = value => Math.round(value * 100) / 100;
  const row = document.querySelector(selector);
  const box = row.getBoundingClientRect();
  const insert = parseFloat(getComputedStyle(row).paddingLeft) || 0;
  const nodes = [...row.querySelectorAll('.row-item, .row-slot')];
  const labelBox = element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node, box = null;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      if (node.parentElement.closest('.arrow')) continue;
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      box = box ? { left: Math.min(box.left, r.left), right: Math.max(box.right, r.right) } : { left: r.left, right: r.right };
    }
    return box;
  };
  return {
    positions: nodes.length,
    links: nodes.filter(node => node.tagName === 'A').length,
    slots: nodes.filter(node => node.classList.contains('row-slot')).length,
    items: nodes.map(node => {
      const text = labelBox(node);
      const rect = node.getBoundingClientRect();
      return { tag: node.tagName, text: node.textContent.replace(/\s+/g, ' ').trim(), href: node.getAttribute('href'),
        slot: node.classList.contains('row-slot'), tabIndex: node.tabIndex,
        ariaHidden: node.getAttribute('aria-hidden'), visibility: getComputedStyle(node).visibility,
        pointerEvents: getComputedStyle(node).pointerEvents, width: round(rect.width),
        origin: text ? round(text.left - (box.left + insert)) : null };
    }),
    order: nodes.map(node => node.textContent.replace(/\s+/g, ' ').trim()),
    scrollWidth: row.scrollWidth, clientWidth: row.clientWidth,
    pageOverflow: document.documentElement.scrollWidth - innerWidth,
  };
}, selector);

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
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await settle(page, '.category-strip');
      const home = await readRow(page, '.category-strip');
      const frontpage = Object.fromEntries(home.items.map(item => [item.text, item.origin]));

      for (const category of groups) {
        await page.goto(new URL(groupHref(category), base).href, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
        await settle(page, '.rubric-cross-links');
        const nav = await readRow(page, '.rubric-cross-links');
        assert.equal(nav.positions, 4, 'Four positions in rubric order.');
        assert.equal(nav.links, 3, 'Exactly three links remain clickable.');
        assert.equal(nav.slots, 1, 'Exactly one slot marks the current rubric.');
        assert.deepEqual(nav.order, groups, 'The position order never changes between pages.');
        const slot = nav.items.find(item => item.slot);
        assert.equal(slot.tag, 'SPAN');
        assert.equal(slot.href, null, 'The slot has no destination.');
        assert.equal(slot.tabIndex, -1, 'The slot never enters the tab order.');
        assert.equal(slot.ariaHidden, 'true', 'The slot is hidden from assistive tech.');
        assert.equal(slot.visibility, 'hidden', 'The slot is invisible but keeps its width.');
        assert.equal(slot.pointerEvents, 'none', 'The slot has no pointer target.');
        assert.ok(slot.width > 20, `The slot keeps the word width (${slot.width}).`);
        assert.equal(nav.items.filter(item => item.slot).length, 1);
        assert.equal(nav.items[groups.indexOf(category)].slot, true, 'The slot sits on the current rubric.');
        const expected = groups.filter(group => group !== category);
        assert.deepEqual(nav.items.filter(item => !item.slot).map(item => item.href), expected.map(groupHref));
        assert.deepEqual(nav.items.filter(item => !item.slot).map(item => item.text), expected);
        for (const item of nav.items.filter(item => !item.slot)) {
          assert.ok(Math.abs(item.origin - frontpage[item.text]) <= 2,
            `"${item.text}" sits on the frontpage x position (${item.origin} vs ${frontpage[item.text]}).`);
        }
        assert.ok(Math.abs(slot.origin - frontpage[slot.text]) <= 2,
          `The slot keeps the position of "${slot.text}" (${slot.origin} vs ${frontpage[slot.text]}).`);
        assert.ok(nav.pageOverflow <= 1, 'The page never widens.');

        const links = page.locator('.rubric-cross-links a');
        assert.equal(await links.count(), 3);
        await links.first().focus();
        assert.equal(await links.first().evaluate(link => link === document.activeElement), true);
        await page.keyboard.press('Tab');
        assert.equal(await links.nth(1).evaluate(link => link === document.activeElement), true, 'Tab skips the slot.');
        await page.keyboard.press('Tab');
        assert.equal(await links.nth(2).evaluate(link => link === document.activeElement), true);
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
        pages.push({ category, ...nav });
      }
      const heights = new Set(pages.map(entry => entry.order.length));
      assert.equal(heights.size, 1, 'Every rubric page renders the same four positions.');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: new URL(`cross-links-${profile.width}-${profile.reduced}.png`, output).pathname });
      reports.push({ ...profile, pages, errors }); await save();
      console.log(`PASS V25 ${profile.width}px reduced=${profile.reduced}: four positions, three links, word-width slot, frontpage x positions, keyboard order.`);
    } catch (error) {
      failures.push({ ...profile, error: error.stack, errors }); await save();
      await page.screenshot({ path: new URL(`failure-${profile.width}-${profile.reduced}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
