import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Row typology contract (B-F25).
 *
 * Every row of repeated links carries exactly one type — A distributed,
 * B chips, C cluster — and consumes only that type's tokens. The manifest names
 * the rows; this suite proves the geometry, the slot contract and the absence
 * of the old cross-type coupling. Assertions are deliberately two-sided: a row
 * in the DOM without a manifest entry is a finding, and so is a manifest entry
 * without a row. */
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const manifest = JSON.parse(await readFile(new URL('./rows.manifest.json', import.meta.url), 'utf8'));
const output = new URL(`../${process.env.H4_ROW_ARTIFACTS || 'docs/validation/B-F25-ROW-MECHANISM'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), base, build: '', profiles: [], coupling: [], failures: [] };
const save = () => writeFile(new URL('row-geometry.json', output), JSON.stringify(report, null, 2) + '\n');
const rowsFor = route => manifest.rows.filter(row => row.pages === 'all' || row.pages.includes(route));
const round = value => Math.round(value * 100) / 100;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const measureRow = (page, row) => page.evaluate(({ row }) => {
  const box = document.querySelector(row.container);
  if (!box) return { id: row.id, missing: true };
  const rectOf = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const textRect = element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const rects = [];
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      if (node.parentElement?.closest('.arrow, .sr-only')) continue;
      range.selectNodeContents(node);
      rects.push(range.getBoundingClientRect());
    }
    if (!rects.length) return null;
    return { left: Math.min(...rects.map(r => r.left)), right: Math.max(...rects.map(r => r.right)),
      top: Math.min(...rects.map(r => r.top)), bottom: Math.max(...rects.map(r => r.bottom)) };
  };
  const style = getComputedStyle(box);
  const boxRect = rectOf(box);
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingRight = parseFloat(style.paddingRight) || 0;
  const nodes = [...box.querySelectorAll('.row-item, .row-slot')];
  const brand = document.querySelector('[data-floating-brand] .brand-link') || document.querySelector('[data-floating-brand]');
  const brandText = brand ? textRect(brand) : null;
  const naavi = document.querySelector('[data-naavi]');
  const items = nodes.map(node => {
    const itemStyle = getComputedStyle(node);
    const rect = rectOf(node);
    const textBox = textRect(node);
    return {
      tag: node.tagName.toLowerCase(),
      label: (node.textContent || '').replace(/\s+/g, ' ').trim(),
      slot: node.classList.contains('row-slot'),
      href: node.getAttribute('href'),
      tabIndex: node.tabIndex,
      ariaHidden: node.getAttribute('aria-hidden'),
      rect, textBox,
      origin: textBox ? textBox.left - (boxRect.left + paddingLeft) : null,
      marginInline: `${itemStyle.marginInlineStart} ${itemStyle.marginInlineEnd}`,
      height: rect.height,
      minHeight: itemStyle.minHeight,
      cursor: itemStyle.cursor,
      pointerEvents: itemStyle.pointerEvents,
      visibility: itemStyle.visibility,
      textDecoration: itemStyle.textDecorationLine,
      display: itemStyle.display,
    };
  });
  // Lines are grouped by their box top: the row may wrap on small screens.
  const lines = [];
  for (const item of items) {
    const line = lines.find(entry => Math.abs(entry.top - item.rect.top) <= 2);
    if (line) line.items.push(item); else lines.push({ top: item.rect.top, items: [item] });
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.rect.left - b.rect.left);
    line.gaps = line.items.slice(1).map((item, index) => item.textBox.left - line.items[index].rect.right);
    line.baselines = line.items.map(item => item.textBox?.bottom ?? null).filter(value => value !== null);
  }
  return {
    id: row.id, type: row.type, domType: box.dataset.row, page: location.pathname,
    box: { ...boxRect, paddingLeft, paddingRight }, rowCursor: style.cursor,
    display: style.display, justifyContent: style.justifyContent, alignItems: style.alignItems,
    columnGap: parseFloat(style.columnGap) || 0, lineHeight: style.lineHeight,
    maxWidth: parseFloat(style.maxWidth) || null,
    clientWidth: box.clientWidth, scrollWidth: box.scrollWidth,
    pageOverflow: document.documentElement.scrollWidth - innerWidth,
    brandText, naaviLeft: naavi ? naavi.getBoundingClientRect().left : null,
    slotMode: box.dataset.slotMode || null,
    items: items.map(({ textBox, rect, ...rest }) => ({ ...rest, rectLeft: rect.left, rectRight: rect.right,
      textLeft: textBox?.left ?? null, textRight: textBox?.right ?? null, textBottom: textBox?.bottom ?? null })),
    lines: lines.map(line => ({ top: line.top, items: line.items, order: line.items.map(item => item.label),
      gaps: line.gaps, baselineSpread: Math.max(...line.baselines) - Math.min(...line.baselines),
      left: line.items[0].rect.left, right: line.items[line.items.length - 1].rect.right })),
    visibleLinks: items.filter(item => item.tag === 'a').length,
    visibleWords: items.filter(item => !item.slot && item.label).length,
  };
}, { row });

async function settleRow(page, container) {
  const target = page.locator(container);
  if (!(await target.count())) return;
  await target.scrollIntoViewIfNeeded();
  await page.waitForFunction(selector => {
    const item = document.querySelector(`${selector} .kinetic-item`);
    if (!item) return true;
    const transform = getComputedStyle(item).transform;
    if (transform === 'none') return true;
    return Math.abs(new DOMMatrixReadOnly(transform).m41) < .5;
  }, container, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(120);
}

function assertNoOverflow(row, label, { scrollport = false } = {}) {
  // Type B is a designed scrollport: it may scroll inside its own reservation.
  // Every row type must leave the document itself at its viewport width.
  if (!scrollport) {
    assert.ok(row.scrollWidth <= row.clientWidth + 1, `${label}: no horizontal row overflow (${row.scrollWidth} > ${row.clientWidth}).`);
  } else {
    assert.ok(row.scrollWidth >= row.clientWidth, `${label}: the scrollport keeps its full content width.`);
  }
  assert.ok(row.pageOverflow <= 1, `${label}: the page never widens (${row.pageOverflow}px).`);
}

function assertManifestCounts(row, source, label) {
  assert.equal(row.items.length, source.positions, `${label}: ${source.positions} positions expected, got ${row.items.length}.`);
  assert.equal(row.visibleLinks, source.links, `${label}: ${source.links} links expected, got ${row.visibleLinks}.`);
}

function assertTypeA(row, source, label, env) {
  assert.equal(row.display, 'flex', `${label}: a distributed row is a flex line (${row.display}).`);
  assert.equal(row.justifyContent, 'space-between', `${label}: distributed rows stretch between both insets.`);
  assert.equal(row.alignItems, 'baseline', `${label}: distributed positions share one baseline.`);
  assertManifestCounts(row, source, label);
  assertNoOverflow(row, label);
  if (source.slotMode && source.slotMode !== 'none') assert.equal(row.slotMode, source.slotMode,
    `${label}: the row declares its slot mode (${row.slotMode}).`);
  const slots = row.items.filter(item => item.slot).length;
  const expectedSlots = source.slots || 0;
  assert.equal(slots, expectedSlots, `${label}: ${expectedSlots} slot(s) expected, got ${slots}.`);
  // 21: space-between is only allowed when positions == links + allowed slots.
  if (row.justifyContent === 'space-between') {
    assert.equal(row.items.length, row.visibleLinks + slots,
      `${label}: distribution needs exactly the declared positions (${row.items.length} != ${row.visibleLinks} + ${slots}).`);
  }
  const expectedLines = source.expectLines?.[String(env.width)];
  if (expectedLines) assert.equal(row.lines.length, expectedLines, `${label}: ${expectedLines} line(s) expected, got ${row.lines.length}.`);
  assert.ok(Math.abs(row.box.paddingLeft - env.tokens.rowInset) <= 2,
    `${label}: the row inset is --row-inset (${row.box.paddingLeft} vs ${env.tokens.rowInset}).`);
  assert.ok(Math.abs(row.box.paddingRight - env.tokens.rowInset) <= 2,
    `${label}: the right inset mirrors the left one (${row.box.paddingRight}).`);
  for (const line of row.lines) {
    assert.ok(line.baselineSpread <= 1, `${label}: baseline spread ${round(line.baselineSpread)}px (${JSON.stringify(line.order)}).`);
    if (line.gaps.length) {
      const spread = Math.max(...line.gaps) - Math.min(...line.gaps);
      assert.ok(spread <= 2, `${label}: visible gaps differ by ${round(spread)}px (${JSON.stringify(line.gaps.map(round))}).`);
      for (const gap of line.gaps) assert.ok(gap >= env.tokens.rowGapMin - 1,
        `${label}: gap ${round(gap)}px falls under --row-gap-min ${env.tokens.rowGapMin}px.`);
    }
    const first = line.items[0];
    assert.ok(Math.abs(first.textBox.left - (row.box.left + row.box.paddingLeft)) <= 2,
      `${label}: the first position starts on --row-inset (${round(first.textBox.left - row.box.left)} vs ${row.box.paddingLeft}).`);
    const last = line.items[line.items.length - 1];
    // The distance from the last word to the row edge, not to the inner edge:
    // the row stretches into the right inset by design.
    const rightFree = row.box.right - last.rect.right;
    assert.ok(rightFree >= -1, `${label}: the last position stays inside the row (${round(rightFree)}px).`);
    assert.ok(rightFree >= .6 * row.box.paddingLeft,
      `${label}: right margin ${round(rightFree)}px must be at least 60% of the left inset ${row.box.paddingLeft}px.`);
  }
  for (const item of row.items) {
    assert.equal(item.marginInline, '0px 0px', `${label}: positions carry no local margin (${item.label}: ${item.marginInline}).`);
    if (item.slot) {
      // 10: the slot is an image, not a control.
      assert.equal(item.tag, 'span', `${label}: the slot is a span.`);
      assert.equal(item.href, null, `${label}: the slot has no href.`);
      assert.equal(item.tabIndex, -1, `${label}: the slot is not focusable.`);
      assert.equal(item.ariaHidden, 'true', `${label}: the slot is hidden from assistive tech.`);
      assert.equal(item.visibility, 'hidden', `${label}: the slot is invisible but keeps its box.`);
      assert.equal(item.pointerEvents, 'none', `${label}: the slot has no pointer target.`);
      assert.equal(item.cursor, row.rowCursor, `${label}: the slot never changes the cursor.`);
      if (source.slotMode === 'width') assert.ok(item.rectRight - item.rectLeft > 1, `${label}: the slot keeps its word width.`);
    } else {
      assert.notEqual(item.href, null, `${label}: every visible position is a link (${item.label}).`);
    }
  }
  // 9: the visible words sit on the frontpage x positions of the same labels.
  if (source.id === 'rubric-cross-links' && env.frontpage) {
    for (const item of row.items) {
      const reference = env.frontpage[item.label];
      assert.ok(reference, `${label}: "${item.label}" exists on the frontpage.`);
      const delta = Math.min(Math.abs(item.origin - reference.origin), Math.abs(item.rectLeft - reference.left));
      assert.ok(delta <= 2, `${label}: "${item.label}" x ${round(item.origin)} must match the frontpage ${round(reference.origin)} (${round(delta)}px).`);
    }
  }
}

function assertTypeB(row, source, label, env) {
  assert.equal(row.display, 'flex', `${label}: the filter row is a flex line.`);
  assert.equal(row.alignItems, 'baseline', `${label}: chips align on one baseline.`);
  assert.ok(Math.abs(row.columnGap - env.tokens.chipsGap) <= .5, `${label}: column-gap ${row.columnGap} must be --chips-gap ${env.tokens.chipsGap}.`);
  assertManifestCounts(row, source, label);
  assertNoOverflow(row, label, { scrollport: true });
  assert.ok(row.brandText, `${label}: the wordmark baseline anchor exists.`);
  const brandBottom = row.brandText.bottom;
  for (const item of row.items) {
    assert.ok(Math.abs(item.textBottom - brandBottom) <= 1,
      `${label}: "${item.label}" baseline ${round(item.textBottom)} drifts from the wordmark ${round(brandBottom)}.`);
    assert.ok(item.height >= env.tokens.chipsTargetMin - .5,
      `${label}: "${item.label}" keeps a ${env.tokens.chipsTargetMin}px target (${round(item.height)}).`);
    assert.equal(item.marginInline, '0px 0px', `${label}: chips carry no local margin.`);
  }
  const active = row.items.filter(item => item.textDecoration.includes('underline'));
  assert.ok(active.length <= 1, `${label}: at most one chip is marked as current.`);
  const others = row.items.filter(item => !active.includes(item));
  if (active.length && others.length) {
    const reference = Math.max(...others.map(item => item.height));
    assert.ok(Math.abs(active[0].height - reference) <= 1,
      `${label}: the underline must not add height (${round(active[0].height)} vs ${round(reference)}).`);
  }
  // 15: the NAAVI reservation is the measured brand-to-INDEX gap. The row stays
  // inside it, so the floating counter never sits on top of a chip.
  assert.ok(row.maxWidth && row.maxWidth <= env.width - 100,
    `${label}: the chips keep their header reservation (max-width ${row.maxWidth}).`);
  assert.ok(row.box.width <= row.maxWidth + 1,
    `${label}: the chips stay inside the reservation (${round(row.box.width)} > ${round(row.maxWidth)}).`);
}

function assertTypeC(row, source, label, env) {
  assert.equal(row.display, 'flex', `${label}: the cluster is a flex group.`);
  assert.equal(row.alignItems, 'center', `${label}: cluster items stay centred.`);
  assert.ok(Math.abs(row.columnGap - env.tokens.clusterGap) <= .5, `${label}: column-gap ${row.columnGap} must be --cluster-gap ${env.tokens.clusterGap}.`);
  assertManifestCounts(row, source, label);
  for (const item of row.items) {
    assert.ok(item.height >= env.tokens.clusterTargetMin - .5,
      `${label}: "${item.label}" keeps a ${env.tokens.clusterTargetMin}px target (${round(item.height)}).`);
  }
}

function assertRow(row, source, label, env) {
  assert.equal(row.missing, undefined, `${label}: the registered row must exist.`);
  assert.equal(row.type, source.type, `${label}: the row declares its type (${row.type}).`);
  assert.equal(manifest.typeNames[source.type], row.domType, `${label}: the DOM carries the type name.`);
  if (source.type === 'A') assertTypeA(row, source, label, env);
  else if (source.type === 'B') assertTypeB(row, source, label, env);
  else assertTypeC(row, source, label, env);
}

// Custom properties resolve lazily: a clamp() token only becomes pixels when a
// real property consumes it. One hidden probe resolves the token itself, so the
// assertions compare the declaration against the token, not against itself.
const readTokens = page => page.evaluate(() => {
  const resolve = (property, name) => {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;${property}:var(${name})`;
    document.body.append(probe);
    const value = property === 'width' ? probe.getBoundingClientRect().width : probe.getBoundingClientRect().height;
    probe.remove();
    return value;
  };
  return {
    rowGapMin: resolve('width', '--row-gap-min'),
    rowInset: resolve('width', '--row-inset'),
    chipsGap: resolve('width', '--chips-gap'),
    chipsTargetMin: resolve('height', '--chips-target-min'),
    clusterGap: resolve('width', '--cluster-gap'),
    clusterTargetMin: resolve('height', '--cluster-target-min'),
  };
});

async function setToken(page, name, value) {
  await page.evaluate(({ name, value }) => document.documentElement.style.setProperty(name, value), { name, value });
  await page.waitForTimeout(120);
}

// Positions are recorded relative to the row itself: a scroll-anchor change
// must not read as a geometry change when a token is edited.
const snapshot = (page, selectors) => page.evaluate((list) => Object.fromEntries(list.map(selector => {
  const box = document.querySelector(selector);
  if (!box) return [selector, null];
  const anchor = box.getBoundingClientRect();
  return [selector, [...box.querySelectorAll('.row-item')].map(item => {
    const r = item.getBoundingClientRect();
    return [Math.round((r.left - anchor.left) * 10) / 10, Math.round((r.top - anchor.top) * 10) / 10, Math.round(r.width * 10) / 10];
  })];
})), selectors);

const sameSnapshot = (before, after, selectors, label) => {
  for (const selector of selectors) {
    assert.deepEqual(after[selector], before[selector], `${label}: ${selector} must not move.`);
  }
};

try {
  for (const viewport of manifest.viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const results = [];
    try {
      // Frontpage reference: the same labels define the x positions everywhere.
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      report.build ||= await page.locator('html').getAttribute('data-build');
      await settleRow(page, '.category-strip');
      const tokens = await readTokens(page);
      const env = { width: viewport.width, tokens, frontpage: null };
      const home = await measureRow(page, manifest.rows.find(row => row.id === 'home-strip'));
      assertRow(home, manifest.rows.find(row => row.id === 'home-strip'), `home-strip @${viewport.width}`, env);
      env.frontpage = Object.fromEntries(home.items.filter(item => !item.slot)
        .map(item => [item.label, { origin: item.origin, left: item.rectLeft, width: item.rectRight - item.rectLeft }]));
      results.push({ ...home, manifestCheck: true });

      // Manifest in both directions: every [data-row] on a page is declared.
      for (const route of ['/', '/creative', '/creative/tattoos', '/creative/tools/m4shlab', '/about']) {
        if (route !== '/') {
          await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
          await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
        }
        const declared = rowsFor(route).map(row => row.id).sort();
        const rendered = await page.evaluate(() => [...document.querySelectorAll('[data-row]')]
          .map(node => ({ id: node.dataset.rowId, type: node.dataset.row })).sort((a, b) => a.id.localeCompare(b.id)));
        assert.deepEqual(rendered.map(row => row.id), declared,
          `${route} @${viewport.width}: the DOM rows and the manifest must match both ways.`);
        for (const row of rendered) {
          const source = manifest.rows.find(entry => entry.id === row.id);
          assert.equal(row.type, manifest.typeNames[source.type], `${route} @${viewport.width}: ${row.id} declares type ${source.type}.`);
        }
        if (route !== '/') {
          const routeEnv = { ...env, tokens: await readTokens(page) };
          for (const source of rowsFor(route)) {
            await settleRow(page, source.container);
            const measured = await measureRow(page, source);
            assertRow(measured, source, `${source.id} @${viewport.width}`, routeEnv);
            results.push(measured);
          }
        }
      }

      // 18/19/20: token and slot-mode changes never cross the type boundary.
      await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await settleRow(page, '.rubric-cross-links');
      const rowSelectors = ['.work-filters', '.footer-left', '.footer-details'];
      const crossBefore = await snapshot(page, ['.rubric-cross-links', ...rowSelectors]);
      await setToken(page, '--chips-gap', '80px');
      const chipsMoved = await snapshot(page, ['.rubric-cross-links', ...rowSelectors]);
      sameSnapshot(crossBefore, chipsMoved, ['.rubric-cross-links', '.footer-left', '.footer-details'], 'chips token leak');
      const chipsGap = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-row="chips"]')).columnGap));
      assert.equal(chipsGap, 80, 'The chips row is the only consumer of --chips-gap.');
      await page.evaluate(() => document.documentElement.style.removeProperty('--chips-gap'));
      await page.waitForTimeout(120);

      const beforeRowToken = await snapshot(page, ['.work-filters', '.footer-left', '.footer-details']);
      await setToken(page, '--row-gap-min', '180px');
      sameSnapshot(beforeRowToken, await snapshot(page, ['.work-filters', '.footer-left', '.footer-details']),
        ['.work-filters', '.footer-left', '.footer-details'], 'row token leak');
      const rowGapNow = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-row="distributed"]')).columnGap));
      assert.equal(rowGapNow, 180, 'Only Type A consumes --row-gap-min.');
      await page.evaluate(() => document.documentElement.style.removeProperty('--row-gap-min'));
      await page.waitForTimeout(120);

      const slotBefore = await page.evaluate(() => {
        const slot = document.querySelector('.rubric-cross-links .row-slot');
        const row = document.querySelector('.rubric-cross-links');
        return { width: slot.getBoundingClientRect().width, links: row.querySelectorAll('.row-item').length };
      });
      const otherRows = await snapshot(page, ['.work-filters', '.footer-left', '.footer-details']);
      await page.evaluate(() => document.querySelector('.rubric-cross-links').dataset.slotMode = 'collapse');
      await page.waitForTimeout(150);
      const slotAfter = await page.evaluate(() => {
        const slot = document.querySelector('.rubric-cross-links .row-slot');
        const row = document.querySelector('.rubric-cross-links');
        return { width: slot.getBoundingClientRect().width, links: row.querySelectorAll('.row-item').length };
      });
      assert.ok(Math.abs(slotAfter.width) <= 1, `collapse mode sets the slot width to 0 (${slotAfter.width}).`);
      assert.ok(slotBefore.width > 20, `width mode keeps the slot word box (${slotBefore.width}).`);
      assert.equal(slotAfter.links, 3, 'collapse mode keeps the three links.');
      sameSnapshot(otherRows, await snapshot(page, ['.work-filters', '.footer-left', '.footer-details']),
        ['.work-filters', '.footer-left', '.footer-details'], 'slot mode leak');
      await page.evaluate(() => document.querySelector('.rubric-cross-links').dataset.slotMode = 'width');
      await page.waitForTimeout(150);

      // 10: a click on the slot position never navigates — the slot is not a
      // control, only a hole in the row.
      const slotBox = await page.locator('.rubric-cross-links .row-slot').boundingBox();
      const probeX = slotBox.x + slotBox.width / 2;
      const probeY = slotBox.y + slotBox.height / 2;
      const hit = await page.evaluate(({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return { tag: element?.tagName || null, link: Boolean(element?.closest('a')) };
      }, { x: probeX, y: probeY });
      assert.equal(hit.link, false, `The slot position has no link under the pointer (${JSON.stringify(hit)}).`);
      const urlBefore = page.url();
      await page.mouse.click(probeX, probeY);
      await page.waitForTimeout(120);
      assert.equal(page.url(), urlBefore, 'Clicking the slot position never navigates.');

      assert.deepEqual(errors, [], 'No runtime errors while measuring rows.');
      report.coupling.push({ ...viewport, passed: true, slotWidth: round(slotBefore.width), collapseWidth: round(slotAfter.width) });
      report.profiles.push({ ...viewport, passed: true, rows: results.map(row => ({ id: row.id, type: row.type, lines: row.lines.length,
        gaps: row.lines.flatMap(line => line.gaps.map(round)), baselineSpread: Math.max(...row.lines.map(line => round(line.baselineSpread))) })) });
      console.log(`PASS rows ${viewport.width}px: ${results.map(row => `${row.id}×${row.lines.length}`).join(', ')}`);
    } catch (error) {
      report.failures.push({ ...viewport, error: error.stack });
      throw error;
    } finally { await context.close(); await save(); }
  }

  // Wide screens: only the two distributed rows, so the battery stays fast.
  for (const viewport of manifest.wideViewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await settleRow(page, '.category-strip');
      const tokens = await readTokens(page);
      const env = { width: viewport.width, tokens, frontpage: null };
      const home = await measureRow(page, manifest.rows.find(row => row.id === 'home-strip'));
      assertRow(home, manifest.rows.find(row => row.id === 'home-strip'), `home-strip @${viewport.width}`, env);
      env.frontpage = Object.fromEntries(home.items.map(item => [item.label, { origin: item.origin, left: item.rectLeft, width: item.rectRight - item.rectLeft }]));
      await page.goto(new URL('/creative/jewellery', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      await settleRow(page, '.rubric-cross-links');
      const cross = await measureRow(page, manifest.rows.find(row => row.id === 'rubric-cross-links'));
      assertRow(cross, manifest.rows.find(row => row.id === 'rubric-cross-links'), `rubric-cross-links @${viewport.width}`, env);
      report.profiles.push({ ...viewport, wide: true, passed: true, rows: [home, cross].map(row => ({ id: row.id, gaps: row.lines.flatMap(line => line.gaps.map(round)) })) });
      console.log(`PASS rows ${viewport.width}px: distributed rows match the frontpage x positions.`);
    } finally { await context.close(); await save(); }
  }

  // Forced font fallback: the geometry is structure, so it must survive the
  // brand font being unavailable.
  const fallback = manifest.fontFallbackViewport;
  const context = await browser.newContext({ viewport: fallback, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await context.route('**/*.{woff,woff2,ttf,otf,json}', route => route.abort());
  try {
    for (const route of ['/', '/creative', '/creative/tattoos']) {
      await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
      const tokens = await readTokens(page);
      const env = { width: fallback.width, tokens, frontpage: null };
      for (const source of rowsFor(route)) {
        await settleRow(page, source.container);
        const measured = await measureRow(page, source);
        assertRow(measured, source, `${source.id} @${fallback.width}px fallback`, env);
      }
    }
    report.fontFallback = { ...fallback, passed: true };
    console.log(`PASS rows with forced font fallback at ${fallback.width}px.`);
  } catch (error) {
    report.failures.push({ fontFallback: true, error: error.stack });
    throw error;
  } finally { await context.close(); await save(); }

  console.log(`PASS row typology: ${report.profiles.length} viewports, ${manifest.rows.length} registered rows, ${report.build}.`);
} catch (error) {
  await save();
  throw error;
} finally { await browser.close(); }
