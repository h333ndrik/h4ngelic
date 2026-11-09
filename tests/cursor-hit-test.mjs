import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { CURSOR_TOKENS, cursorSpec, matchesContract } from './helpers/cursor-contract.mjs';
import { installCursorCascadeProbe, guaranteeRule, GUARANTEE_RULE } from './helpers/cursor-cascade.mjs';

/** Every point of the page must resolve to a real h4 cursor *image* whose
 * winning rule is one of the guarantee layers. A bare `auto`/`pointer` is a
 * failure: that is exactly the silent fallback the user saw. */
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_CURSOR_HIT_ARTIFACTS || 'artifacts/v312/cursor-native'}/`, import.meta.url);
const reportName = process.env.H4_CURSOR_HIT_REPORT_NAME || 'hit-results.json';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, build: '', spec: cursorSpec, profiles: [], touch: null, pseudo: null,
  assets: null, pressed: null, states: null, hybrid: null, xray: null, failures: [] };
const save = () => writeFile(new URL(reportName, output), JSON.stringify(report, null, 2) + '\n');

async function seed(context) {
  await context.addInitScript(installCursorCascadeProbe);
  await context.addInitScript(() => {
    localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({ count: 5, lastSeen: Date.now() }));
    localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .2 }));
  });
}

const describe = sample => `${sample.tag.toLowerCase()}${sample.id ? `#${sample.id}` : ''}${sample.className ? `.${sample.className.trim().replace(/\s+/g, '.')}` : ''} @${Math.round(sample.x)},${Math.round(sample.y)}`;

async function pointAt(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const stack = document.elementsFromPoint(x, y);
    const top = stack.find(element => getComputedStyle(element).pointerEvents !== 'none') || document.documentElement;
    const style = getComputedStyle(top);
    const winner = window.__h4CursorCascade?.winners(top)[0] || null;
    return { x, y, cursor: style.cursor, tag: top.tagName, id: top.id,
      className: String(top.className?.baseVal ?? top.className ?? ''),
      winner: winner ? { selector: winner.selector, value: winner.value, important: winner.important, spec: winner.spec, href: winner.href } : null,
      stack: stack.slice(0, 6).map(element => ({ tag: element.tagName, id: element.id,
        className: String(element.className?.baseVal ?? element.className ?? ''), pointerEvents: getComputedStyle(element).pointerEvents,
        cursor: getComputedStyle(element).cursor })) };
  }, { x, y });
}

/** Keyword-only values are rejected here, not just corrected in the message. */
function failure(sample, mode) {
  if (!/url\(/.test(sample.cursor)) return `bare keyword "${sample.cursor}" (no cursor image)`;
  if (!matchesContract(sample.cursor, { mode, spec: cursorSpec })) return `cursor image outside the token contract: ${sample.cursor}`;
  if (!guaranteeRule(sample.winner)) return `foreign rule wins: ${sample.winner ? `${sample.winner.selector} (important=${sample.winner.important})` : 'no rule found'}`;
  return null;
}

async function checkPoint(page, { label, x, y, mode = 'normal', offenders, counts, requireGuarantee = true }) {
  await page.mouse.move(x, y);
  const sample = await pointAt(page, x, y);
  counts.points += 1;
  if (!label.includes(':')) counts.regions[label] = (counts.regions[label] || 0) + 1;
  counts.cursors[sample.cursor] = (counts.cursors[sample.cursor] || 0) + 1;
  const problem = requireGuarantee ? failure(sample, mode) : null;
  if (problem) offenders.push({ label, problem, ...sample, top: describe(sample) });
  return sample;
}

async function scanViewport(page, { label, width, height, mode, offenders, counts, step = 24 }) {
  for (let y = step / 2; y < height; y += step) {
    for (let x = step / 2; x < width; x += step) {
      await checkPoint(page, { label: `${label}:${x}:${y}`, x, y, mode, offenders, counts });
    }
  }
}

async function centerPoint(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, 'The targeted cursor region must have a real painted box.');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function slashPoint(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('[data-naavi]');
    const walker = document.createTreeWalker(nav, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const index = node.textContent.indexOf('/');
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index); range.setEnd(node, index + 1);
      const box = range.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }
    return null;
  });
}

async function regionSweep(page, { regions, list, mode, offenders, counts }) {
  for (const [label, selector] of list) {
    const locator = page.locator(selector).first();
    if (!await locator.count()) continue;
    const { x, y } = await centerPoint(locator);
    // The point must really sit inside the region. A stale box or an
    // off-screen section would otherwise hit `html`, which also carries a
    // guarantee rule — the classic way a region test passes without testing
    // the region.
    const inside = await page.evaluate(({ selector, x, y }) => {
      const region = document.querySelector(selector);
      const element = document.elementFromPoint(x, y);
      if (!region || !element) return false;
      if (element.closest(selector)) return true;
      // Quiet regions (the VISIT counter, the rubric arrows) take no pointer
      // events; the hit must then be one of their ancestors, never `html`.
      return getComputedStyle(region).pointerEvents === 'none'
        && element !== document.documentElement && element.contains(region);
    }, { selector, x, y });
    assert.ok(inside, `${label} @${Math.round(x)},${Math.round(y)}: the cursor sample must land inside ${selector}.`);
    regions.push({ label, selector, sample: await checkPoint(page, { label, x, y, mode, offenders, counts }) });
  }
}

async function targetContracts(page, { mode, offenders, counts }) {
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(250);
  const regions = [];
  await regionSweep(page, { regions, mode, offenders, counts, list: [
    ['footer-copyright', '.footer-left .footer-brand'],
    ['footer-brand', '.footer-brand'],
    ['footer-visit', '[data-visit-count]'],
    ['footer-instagram', '.footer-instagram'],
    ['footer-location', '.footer-location'],
    ['naavi-container', '[data-naavi]'],
    ['naavi-digit', '[data-naavi] .chapter-digit'],
    ['naavi-total', '[data-naavi] .chapter-total'],
  ] });
  const slash = await slashPoint(page);
  assert.ok(slash, 'NAAVI exposes the literal slash glyph.');
  const slashSample = await checkPoint(page, { label: 'naavi-slash', ...slash, mode, offenders, counts });
  regions.push({ label: 'naavi-slash', sample: slashSample });
  // B-F19 (09.11.): the user reported a cursor change exactly over NAAVI. The
  // token contract alone cannot catch it (two tokens may share the image but
  // differ in the fallback). Assert byte equality with a plain, non-interactive
  // region instead: same image, same hotspot, same final keyword.
  const quiet = regions.find(entry => entry.label === 'footer-location')?.sample;
  assert.ok(quiet, 'The footer location provides a non-interactive reference point.');
  for (const label of ['naavi-container', 'naavi-digit', 'naavi-total', 'naavi-slash']) {
    const sample = regions.find(entry => entry.label === label)?.sample;
    if (!sample) continue;
    assert.equal(sample.cursor, quiet.cursor,
      `${label} must render byte-identical to a non-interactive element (${sample.cursor} vs ${quiet.cursor})`);
  }
  const naaviAudit = await page.locator('[data-naavi]').evaluate(element => [element, ...element.querySelectorAll('*')].map(node => {
    const style = getComputedStyle(node);
    return { tag: node.tagName.toLowerCase(), className: String(node.className?.baseVal ?? node.className ?? ''),
      ariaHidden: node.getAttribute('aria-hidden'), pointerEvents: style.pointerEvents, cursor: style.cursor };
  }));

  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(150);
  const index = page.locator('[data-global-index]');
  if (!await index.evaluate(element => element.open)) await index.locator('summary').click();
  await page.waitForFunction(() => document.querySelector('[data-global-index]')?.open === true);
  for (const link of await index.locator('[data-index-page]:is(a)').all()) {
    const name = await link.getAttribute('data-index-page');
    const { x, y } = await centerPoint(link);
    regions.push({ label: `index-${name}`, sample: await checkPoint(page, { label: `index-${name}`, x, y, mode, offenders, counts }) });
  }
  await page.keyboard.press('Escape');

  await regionSweep(page, { regions, mode, offenders, counts, list: [
    ['tool-bar', '[data-controls] button'],
    ['rubric-link', '.category-link'],
    ['rubric-arrow', '.category-link .arrow'],
  ] });

  const hit = await page.evaluate(() => {
    const point = window.__H4_TEST__?.hitPoint?.();
    if (point) return point;
    const box = document.querySelector('#logo-canvas').getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  await page.mouse.move(hit.x, hit.y);
  await page.mouse.down();
  const drag = [];
  const viewport = page.viewportSize();
  try {
    drag.push(await checkPoint(page, { label: 'canvas-drag-start', x: hit.x, y: hit.y, mode, offenders, counts }));
    for (let step = 1; step <= 4; step += 1) {
      const x = Math.min(viewport.width - 12, hit.x + step * 24);
      const y = Math.min(viewport.height - 12, hit.y - step * 8);
      drag.push(await checkPoint(page, { label: `canvas-drag-${step}`, x, y, mode, offenders, counts }));
    }
  } finally { await page.mouse.up(); }

  await page.evaluate(() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'instant' }));
  await page.waitForTimeout(200);
  const form = [];
  for (const selector of ['[data-inquiry-form] input[name="name"]', '[data-inquiry-form] input[name="email"]',
    '[data-inquiry-form] textarea[name="message"]', '[data-inquiry-form] input[type="file"]', '[data-inquiry-submit]']) {
    const locator = page.locator(selector).first();
    if (!await locator.count() || !await locator.isVisible()) continue;
    const { x, y } = await centerPoint(locator);
    form.push({ label: selector, sample: await checkPoint(page, { label: selector, x, y, mode, offenders, counts }) });
  }
  assert.equal(form.length, 5, 'The inquiry form field contract covers all visible controls.');

  // The rubric bar only exists on a work route; it is a mandatory region and
  // used to be covered by the viewport scan of a page that has no bar at all.
  await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
  await regionSweep(page, { regions, mode, offenders, counts, list: [
    ['work-filters', '.work-filters'],
    ['work-filter-current', '.work-filters .filter-link[aria-current="page"]'],
    ['work-filter-link', '.work-filters .filter-link:not([aria-current])'],
    ['cross-link', '.rubric-cross-links a'],
  ] });
  await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
  await page.waitForTimeout(250);

  const trigger = page.locator('[data-artwork-open]').first();
  let dialog = null;
  if (await trigger.count()) {
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const viewer = page.locator('.artwork-dialog[open]');
    await viewer.waitFor({ timeout: 15000 });
    const stage = await centerPoint(page.locator('.artwork-dialog[open] .artwork-viewer-stage'));
    dialog = await checkPoint(page, { label: 'artwork-dialog', ...stage, mode, offenders, counts });
    const previous = await centerPoint(page.locator('.artwork-dialog[open] .artwork-previous'));
    const next = await centerPoint(page.locator('.artwork-dialog[open] .artwork-next'));
    regions.push({ label: 'viewer-previous', sample: await checkPoint(page, { label: 'viewer-previous', ...previous, mode, offenders, counts }) });
    regions.push({ label: 'viewer-next', sample: await checkPoint(page, { label: 'viewer-next', ...next, mode, offenders, counts }) });
    await page.keyboard.press('Escape');
    await viewer.waitFor({ state: 'detached' }).catch(() => {});
  }
  return { regions, drag, naaviAudit, form, dialog };
}

async function assetProbe(page) {
  const urls = [];
  for (const token of Object.values(CURSOR_TOKENS)) {
    for (const image of [token.svg.path, token.png.path]) if (!urls.includes(image)) urls.push(image);
  }
  return page.evaluate(async urls => Promise.all(urls.map(async url => {
    const response = await fetch(url).catch(() => null);
    if (!response?.ok) return { url, status: response?.status || 0, ok: false, width: 0, height: 0 };
    const blob = await response.blob();
    // Image + decode() handles SVG and PNG alike; createImageBitmap() rejects SVG.
    const objectURL = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = objectURL;
      await image.decode();
      return { url, status: response.status, ok: image.naturalWidth > 0 && image.naturalHeight > 0,
        width: image.naturalWidth, height: image.naturalHeight, type: blob.type };
    } catch (error) {
      return { url, status: response.status, ok: false, width: 0, height: 0, type: blob.type, error: String(error) };
    } finally { URL.revokeObjectURL(objectURL); }
  })), urls);
}

async function pressedProbe(page) {
  const target = page.locator('[data-naavi]').first();
  const { x, y } = await centerPoint(target);
  await page.mouse.move(x, y);
  const rest = await pointAt(page, x, y);
  await page.mouse.down();
  const pressed = await pointAt(page, x, y);
  await page.mouse.up();
  return { x, y, rest: rest.cursor, pressed: pressed.cursor, winner: pressed.winner };
}

async function stateProbe(page) {
  const target = page.locator('[data-naavi]').first();
  const { x, y } = await centerPoint(target);
  await page.mouse.move(x, y);
  await page.mouse.down();
  const pressedEl = await target.evaluate(element => ({ cursor: getComputedStyle(element).cursor,
    winner: window.__h4CursorCascade.winners(element)[0] || null }));
  await page.mouse.move(2, 2);
  await page.mouse.up();
  return { pressedElement: { cursor: pressedEl.cursor, winner: pressedEl.winner ? pressedEl.winner.selector : null } };
}

async function pseudoProbe(page) {
  return page.evaluate(() => ['.arrow', '[data-outline-arrow]', '.category-link .interaction-visual', '.skip-link'].flatMap(selector => {
    const element = document.querySelector(selector);
    if (!element) return [];
    const style = getComputedStyle(element, '::before');
    if (!style.content || style.content === 'none') return [];
    return [{ selector, cursor: style.cursor, winner: window.__h4CursorCascade.winners(element)[0] || null }];
  }));
}

async function browserPage(viewport, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion });
  await seed(context);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
  await page.locator('#stage.is-ready').waitFor({ timeout: 60000 }).catch(() => {});
  assert.equal(await page.locator('html').evaluate(element => matchMedia('(any-hover: hover) and (any-pointer: fine)').matches), true,
    'The desktop profile must advertise a fine pointer.');
  assert.equal(await page.locator('[data-h4-cursor]').count(), 0, 'The native strategy owns the pointer: no overlay element may exist.');
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  return { context, page, errors };
}

try {
  const profiles = [
    { width: 1440, height: 900, reducedMotion: 'no-preference' },
    { width: 390, height: 844, reducedMotion: 'no-preference' },
    { width: 320, height: 844, reducedMotion: 'no-preference' },
    { width: 1440, height: 900, reducedMotion: 'reduce' },
    { width: 390, height: 844, reducedMotion: 'reduce' },
    { width: 320, height: 844, reducedMotion: 'reduce' },
  ];
  for (const profile of profiles) {
    const label = `${profile.width}x${profile.height}${profile.reducedMotion === 'reduce' ? ' reduce' : ''}`;
    console.log(`CHECK native cursor hit map ${label}`);
    const { context, page, errors } = await browserPage(profile, profile.reducedMotion);
    const offenders = [], counts = { points: 0, cursors: {}, regions: {}, winners: {} };
    try {
      report.build ||= await page.locator('html').getAttribute('data-build');
      if (!report.assets) {
        report.assets = await assetProbe(page);
        for (const asset of report.assets) {
          assert.equal(asset.status, 200, `Cursor asset must answer 200: ${JSON.stringify(asset)}`);
          assert.equal(asset.ok, true, `Cursor asset must decode: ${JSON.stringify(asset)}`);
          assert.ok(asset.width <= 32 && asset.height <= 32, `Cursor asset must fit 32 CSS px: ${JSON.stringify(asset)}`);
        }
        report.pressed = await pressedProbe(page);
        assert.match(report.pressed.rest, /h4ngelic-cursor\.svg["']?\)\s+8\s+2/, 'The resting cursor uses the base silhouette.');
        assert.match(report.pressed.pressed, /h4ngelic-cursor-pressed\.svg["']?\)\s+8\s+2/, 'Pressing swaps in the pre-scaled silhouette.');
        assert.ok(guaranteeRule(report.pressed.winner), `The pressed state must win through a guarantee rule: ${JSON.stringify(report.pressed.winner)}`);
        report.states = await stateProbe(page);
        assert.match(report.states.pressedElement.cursor, /h4ngelic-cursor-pressed\.svg["']?\)\s+8\s+2/,
          ':active on a link returns the pressed sprite.');
        report.pseudo = await pseudoProbe(page);
        for (const item of report.pseudo) {
          assert.ok(matchesContract(item.cursor, { mode: 'normal', spec: cursorSpec }), `Pseudo-element keeps the logo cursor: ${item.selector} ${item.cursor}`);
          assert.ok(guaranteeRule(item.winner), `Pseudo-element must inherit a guarantee rule: ${item.selector}`);
        }
      }
      await page.mouse.move(profile.width / 2, 40);
      await scanViewport(page, { label: 'top', width: profile.width, height: profile.height, mode: 'normal', offenders, counts });
      await page.screenshot({ path: new URL(`top-${profile.width}${profile.reducedMotion === 'reduce' ? '-reduce' : ''}.png`, output).pathname });
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(250);
      await scanViewport(page, { label: 'footer', width: profile.width, height: profile.height, mode: 'normal', offenders, counts });
      const targets = await targetContracts(page, { mode: 'normal', offenders, counts });
      for (const region of targets.regions) {
        const winner = region.sample.winner;
        counts.winners[region.label] = winner ? winner.selector : 'none';
      }
      await page.screenshot({ path: new URL(`regions-${profile.width}${profile.reducedMotion === 'reduce' ? '-reduce' : ''}.png`, output).pathname });
      assert.deepEqual(offenders, [], `${label}: every point resolves to a guarantee-layer h4 cursor: ${JSON.stringify(offenders.slice(0, 5), null, 1)}`);
      assert.deepEqual(errors, []);
      report.profiles.push({ ...profile, points: counts.points, cursors: counts.cursors, winners: counts.winners, offenders: [], targets, errors, passed: true });
      console.log(`  ok ${label}: ${counts.points} points, ${Object.keys(counts.cursors).length} distinct cursor values.`);
    } catch (error) {
      report.failures.push({ ...profile, offenders: offenders.slice(0, 20), counts, error: error.stack });
      await page.screenshot({ path: new URL(`failure-${profile.width}${profile.reducedMotion === 'reduce' ? '-reduce' : ''}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); await save(); }
  }

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await seed(touchContext);
  const touchPage = await touchContext.newPage();
  await touchPage.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  await touchPage.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
  const touch = await touchPage.locator('body').evaluate(body => ({ capability: matchMedia('(any-hover: hover) and (any-pointer: fine)').matches,
    body: getComputedStyle(body).cursor, link: getComputedStyle(document.querySelector('[data-naavi]')).cursor,
    overlay: Boolean(document.querySelector('[data-h4-cursor]')) }));
  assert.equal(touch.capability, false, 'The touch profile must not advertise a fine pointer.');
  assert.equal(touch.overlay, false, 'No overlay exists on touch either.');
  for (const value of [touch.body, touch.link]) assert.doesNotMatch(value, /h4ngelic-cursor/, 'Touch keeps the system cursor.');
  report.touch = touch;
  await touchPage.screenshot({ path: new URL('touch-390.png', output).pathname });
  await touchContext.close();
  await save();

  const hybrid = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, hasTouch: true });
  await seed(hybrid);
  const hybridPage = await hybrid.newPage();
  await hybridPage.goto(new URL('/', base).href, { waitUntil: 'domcontentloaded' });
  await hybridPage.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
  report.hybrid = await hybridPage.locator('body').evaluate(body => ({ fine: matchMedia('(any-pointer: fine)').matches,
    anyFine: matchMedia('(any-hover: hover) and (any-pointer: fine)').matches, body: getComputedStyle(body).cursor }));
  if (report.hybrid.anyFine) assert.match(report.hybrid.body, /h4ngelic-cursor/, 'A hybrid device with a mouse keeps the logo cursor.');
  else assert.doesNotMatch(report.hybrid.body, /h4ngelic-cursor/, 'Without a fine pointer the logo cursor stays off.');
  await hybrid.close();
  await save();

  const { context, page, errors } = await browserPage({ width: 1440, height: 900 });
  try {
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.down('4');
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray', null, { timeout: 60000 });
    await page.keyboard.up('4');
    const mode = { mode: await page.locator('html').getAttribute('data-mode'), cursor: await page.locator('html').getAttribute('data-cursor') };
    assert.deepEqual(mode, { mode: 'xray', cursor: 'xray' });
    const offenders = [], counts = { points: 0, cursors: {}, regions: {}, winners: {} };
    await scanViewport(page, { label: 'xray', width: 1440, height: 900, mode: 'xray', offenders, counts });
    const naavi = await centerPoint(page.locator('[data-naavi]'));
    const sample = await checkPoint(page, { label: 'xray-naavi', ...naavi, mode: 'xray', offenders, counts });
    await page.mouse.down();
    const pressed = await page.evaluate(() => {
      const element = document.querySelector('[data-naavi]');
      return { cursor: getComputedStyle(element).cursor, winner: window.__h4CursorCascade.winners(element)[0] || null };
    });
    await page.mouse.move(2, 2);
    await page.mouse.up();
    assert.match(pressed.cursor, /h4ngelic-cursor-other-pressed-r09\.svg["']?\)\s+8\s+2/, 'The xray pressed state keeps its own sprite.');
    assert.ok(guaranteeRule(pressed.winner), 'The xray pressed state wins through a guarantee rule.');
    assert.deepEqual(offenders, [], `The xray mode keeps its own cursor everywhere: ${JSON.stringify(offenders.slice(0, 8))}`);
    assert.deepEqual(errors, []);
    report.xray = { ...mode, points: counts.points, cursors: counts.cursors, naavi: sample, pressed, offenders: [], passed: true };
    await page.screenshot({ path: new URL('xray-1440.png', output).pathname });
  } catch (error) {
    report.failures.push({ xray: true, error: error.stack });
    await page.screenshot({ path: new URL('failure-xray.png', output).pathname }).catch(() => {});
    throw error;
  } finally { await context.close(); await save(); }

  console.log(`PASS native cursor hit map: ${report.profiles.map(item => `${item.width}${item.reducedMotion === 'reduce' ? 'r' : ''} ${item.points}`).join(', ')}; xray ${report.xray.points}; zero foreign cursors, keyword-only values rejected.`);
} catch (error) {
  await save();
  throw error;
} finally { await browser.close(); }
