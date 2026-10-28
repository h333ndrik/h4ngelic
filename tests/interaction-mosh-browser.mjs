import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

// Run against the development server: the app exposes its read-only lifecycle
// counters under ?test. Source pixels are never read by application JavaScript;
// the final test reads only a small browser screenshot of real Work typography.
const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const destination = new URL('../artifacts/interaction-mosh/', import.meta.url);
const profiles = (process.env.H4_MOSH_PROFILES || 'desktop,touch-390,touch-320,reduced,pixels').split(',');
const limitBytes = (Number(process.env.H4_MAX_RSS_MB) || 2048) * 1048576;
const report = { baseURL, profiles, maximumTreeRssBytes: 0, limitBytes, results: [], aborted: null };
await mkdir(destination, { recursive: true });
let browser;
let tree = [];
let sampling = false;
let frozenReadback = false;
let failure;

async function abort(message) {
  if (report.aborted) return;
  report.aborted = message;
  const force = setTimeout(() => {
    for (const entry of tree) if (entry.pid !== process.pid) try { process.kill(entry.pid, 'SIGKILL'); } catch {}
  }, 1000);
  force.unref();
  try { await browser?.close(); } catch {}
  clearTimeout(force);
}

async function sampleMemory() {
  if (sampling || report.aborted || !frozenReadback) return;
  sampling = true;
  try {
    const records = (await Promise.all((await readdir('/proc')).filter(name => /^\d+$/.test(name)).map(async name => {
      try {
        const value = await readFile(`/proc/${name}/status`, 'utf8');
        return { pid: Number(name), parent: Number(value.match(/^PPid:\s+(\d+)/m)?.[1]), rss: Number(value.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0) * 1024 };
      } catch { return null; }
    }))).filter(Boolean);
    const descendants = new Set([process.pid]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const entry of records) if (descendants.has(entry.parent) && !descendants.has(entry.pid)) {
        descendants.add(entry.pid); changed = true;
      }
    }
    tree = records.filter(entry => descendants.has(entry.pid));
    const rss = tree.reduce((total, entry) => total + entry.rss, 0);
    report.maximumTreeRssBytes = Math.max(report.maximumTreeRssBytes, rss);
    if (rss > limitBytes) await abort(`Frozen screenshot process-tree RSS exceeded ${limitBytes / 1048576}MiB.`);
  } finally { sampling = false; }
}

async function createPage(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 1, ...options });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    const probe = window.__interactionBrowser = {
      token: `${performance.timeOrigin}:${Math.random()}`, contexts: { twoD: 0, webGL: 0 }, readbacks: 0,
      starts: [], impulses: [], modes: [], clicks: [], pagechanges: 0, actions: 0,
    };
    const seen = new WeakSet();
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      const context = getContext.call(this, type, ...args);
      if (context && !seen.has(context)) {
        seen.add(context);
        if (type === '2d') probe.contexts.twoD++;
        if (/webgl/.test(type)) probe.contexts.webGL++;
      }
      return context;
    };
    const getImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
      probe.readbacks++; return getImageData.apply(this, args);
    };
    if (typeof document.startViewTransition === 'function') {
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = update => {
        const record = { kind: document.documentElement.dataset.moshKind || null,
          duration: parseFloat(document.documentElement.style.getPropertyValue('--mode-snapshot-duration')) || 0,
          sourcePage: document.documentElement.dataset.page, sourceMode: document.documentElement.dataset.mode,
          sourceHeading: document.querySelector('.page-heading')?.textContent.trim(), sourceScrollY: scrollY,
          calls: 0, started: performance.now() };
        probe.starts.push(record);
        const transition = start(async () => {
          record.calls++;
          await (typeof update === 'function' ? update() : update.update());
          record.commit = { page: document.documentElement.dataset.page, mode: document.documentElement.dataset.mode,
            path: location.pathname, hash: location.hash, scrollY, focus: document.activeElement?.id,
            contactTop: document.querySelector('#contact')?.getBoundingClientRect().top };
        });
        transition.finished.then(() => { record.elapsed = performance.now() - record.started; }, () => {});
        return transition;
      };
    }
    document.addEventListener('h4:moshimpulse', event => {
      const { target, ...detail } = event.detail;
      probe.impulses.push({ ...detail, target: target.id || target.getAttribute('href') || target.tagName });
    });
    document.addEventListener('h4:modechange', event => probe.modes.push({ ...event.detail, time: performance.now() }));
    document.addEventListener('h4:pagechange', () => probe.pagechanges++);
    document.addEventListener('click', event => probe.clicks.push({
      target: event.target.closest?.('button, a, input')?.id || event.target.tagName,
      trusted: event.isTrusted, defaultPrevented: event.defaultPrevented,
      kind: document.documentElement.dataset.moshKind || null, actions: probe.actions,
    }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto(new URL('/work?test=1', baseURL).href, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForFunction(() => window.__H4_INTERACTION_MOSH__ && document.documentElement.dataset.mode === 'normal');
  await page.evaluate(() => document.fonts.ready);
  return { page, context, errors, requests };
}

const state = page => page.evaluate(() => ({ ...window.__interactionBrowser,
  interaction: window.__H4_INTERACTION_MOSH__.snapshot(), corruption: window.__H4_CORRUPTION__?.snapshot(),
  mode: document.documentElement.dataset.mode, flag: document.documentElement.dataset.modeSnapshot,
  kind: document.documentElement.dataset.moshKind, overflow: document.documentElement.scrollWidth > innerWidth + 1,
  scrollY, focused: document.hasFocus(), nativeActive: Boolean(document.activeViewTransition),
}));

async function idle(page, { pixels = false } = {}) {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-mode-snapshot')
    && !document.getAnimations().some(animation => animation.effect?.pseudoElement?.startsWith('::view-transition-')));
  if (pixels) await page.waitForFunction(() => {
    const value = window.__H4_CORRUPTION__?.snapshot();
    return !value || !value.queued && value.regions === 0 && value.pendingImpulses === 0;
  }, null, { timeout: 8000 });
}

async function enter(page, { reduced = false } = {}) {
  const before = await state(page);
  const started = await page.evaluate(() => performance.now());
  await page.keyboard.down('4');
  try {
    await page.waitForTimeout(780);
    assert.equal((await state(page)).mode, 'normal', 'Entry requires a continuous one-second hold.');
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray', null, { timeout: 5000 });
  } finally { await page.keyboard.up('4'); }
  await idle(page, { pixels: !reduced });
  const after = await state(page);
  assert.ok(after.modes.at(-1).time - started >= 990);
  const captures = after.starts.slice(before.starts.length);
  assert.deepEqual(captures.map(value => value.kind), reduced ? [] : ['mode']);
  if (!reduced) {
    assert.equal(captures[0].calls, 1);
    assert.equal(captures[0].commit.mode, 'xray');
    assert.equal(after.modes.at(-1).captured, true);
  }
  return after;
}

async function fixtures(page) {
  await page.evaluate(() => {
    const host = document.createElement('div'); host.id = 'mosh-controls';
    host.style.cssText = 'position:fixed;left:20px;bottom:16px;z-index:90;display:flex;gap:6px;max-width:calc(100vw - 40px);flex-wrap:wrap;font:12px sans-serif';
    host.innerHTML = '<button id="mosh-action" type="button">pixel action</button><input id="mosh-input" aria-label="editing guard" style="width:30px"><button id="mosh-protected" type="button" data-other-side-hint data-corruption-protected>protected</button><button id="mosh-mute" type="button" data-mode-mute>sound</button><a id="mosh-external" href="https://example.com/" target="_blank" rel="external">external</a>';
    host.querySelector('#mosh-action').addEventListener('click', () => window.__interactionBrowser.actions++);
    host.querySelector('#mosh-external').addEventListener('click', event => {
      window.__interactionBrowser.externalDefaultPrevented = event.defaultPrevented;
      // The fixture records the controller's semantics, then keeps this test in
      // its document instead of making an unrelated external network request.
      event.preventDefault();
    });
    document.body.append(host);
  });
}

async function pointAt(locator) {
  const box = await locator.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, 'A physical input target must have visible bounds.');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function hoverAt(page, locator) {
  const point = await pointAt(locator);
  await page.mouse.move(point.x, point.y);
}

async function clickAt(page, locator) {
  const point = await pointAt(locator);
  await page.mouse.click(point.x, point.y);
}

async function desktop() {
  const { page, context, errors, requests } = await createPage();
  try {
    await fixtures(page);
    await hoverAt(page, page.locator('.page-nav a[href="/about"]'));
    await page.locator('#mosh-action').focus();
    await page.locator('#mosh-action').evaluate(element => element.click());
    await page.mouse.move(1, 1);
    await page.waitForTimeout(400);
    const normal = await state(page);
    assert.equal(normal.interaction.events.sequence, 0);
    assert.equal(normal.interaction.events.geometryReads, 0);
    assert.equal(normal.interaction.events.observing, false);
    assert.deepEqual(normal.contexts, { twoD: 0, webGL: 0 });
    assert.equal(normal.starts.length, 0);
    await page.locator('#mosh-action').evaluate(element => element.blur());
    const entered = await enter(page);
    assert.ok(entered.corruption?.active, 'Other Side must initialize the actual Canvas renderer.');

    const beforeHover = await state(page);
    await hoverAt(page, page.locator('.page-nav a[href="/about"]'));
    await page.waitForFunction(() => document.documentElement.dataset.moshKind === 'hover');
    const hover = await state(page);
    assert.equal(hover.starts.length, beforeHover.starts.length, 'A local hover must never freeze the document with a native capture.');
    assert.ok(hover.interaction.transitions.current.duration >= 240 && hover.interaction.transitions.current.duration <= 480);
    assert.equal(hover.interaction.transitions.current.kind, 'hover');
    assert.equal(hover.interaction.transitions.current.native, false);
    assert.ok(hover.interaction.transitions.current.strength > 0 && hover.interaction.transitions.current.strength < .7);
    assert.equal(hover.interaction.events.emitted.hover, beforeHover.interaction.events.emitted.hover + 1);
    assert.equal(hover.overflow, false);
    await idle(page);
    const hoverDone = await state(page);
    assert.equal(hoverDone.interaction.transitions.active, false);
    assert.equal(hoverDone.interaction.transitions.last.kind, 'hover');
    assert.equal(hoverDone.interaction.transitions.last.native, false);
    await page.waitForTimeout(700);
    assert.equal((await state(page)).interaction.transitions.interactions, hoverDone.interaction.transitions.interactions, 'A stationary pointer must not retrigger local effects.');
    await page.mouse.move(1, 1);
    await page.waitForTimeout(90);
    await hoverAt(page, page.locator('.page-nav a[href="/about"]'));
    await page.waitForFunction(count => window.__H4_INTERACTION_MOSH__.snapshot().transitions.interactions === count + 1, hoverDone.interaction.transitions.interactions);
    await idle(page);
    console.log('PASS desktop hover: one stationary gesture settles; a real leave and reentry captures again.');

    // Keyboard focus keeps its gentle Canvas impulse without claiming another
    // native page capture. A click on the same working button is stronger.
    await page.waitForTimeout(90);
    const beforeFocus = await state(page);
    await page.locator('#mosh-action').focus();
    const focused = await state(page);
    assert.equal(focused.interaction.events.emitted.focus, beforeFocus.interaction.events.emitted.focus + 1);
    assert.equal(focused.starts.length, beforeFocus.starts.length);
    assert.ok(focused.corruption.receivedImpulses > beforeFocus.corruption.receivedImpulses);
    await page.waitForTimeout(90);
    await hoverAt(page, page.locator('#mosh-action'));
    await page.waitForFunction(() => document.documentElement.dataset.moshKind === 'hover');
    const beforeClick = await state(page);
    assert.equal(beforeClick.kind, 'hover');
    // Click immediately while the local hover is still preparing/painting.
    // Waiting for idle here would conceal native pre-ready hit-test freezes.
    await clickAt(page, page.locator('#mosh-action'));
    await page.waitForFunction(() => document.documentElement.dataset.moshKind === 'click');
    const clicked = await state(page);
    assert.equal(clicked.actions, normal.actions + 1, 'The original button action must still execute once.');
    assert.equal(clicked.starts.length, beforeClick.starts.length);
    assert.ok(clicked.interaction.transitions.current.duration >= 240 && clicked.interaction.transitions.current.duration <= 480);
    assert.ok(clicked.interaction.transitions.current.strength > hover.interaction.transitions.current.strength);
    assert.equal(clicked.interaction.transitions.current.native, false);
    assert.deepEqual(clicked.clicks.at(-1), { target: 'mosh-action', trusted: true, defaultPrevented: false, kind: 'click', actions: clicked.actions });
    await clickAt(page, page.locator('#mosh-action'));
    const repeated = await state(page);
    assert.equal(repeated.actions, clicked.actions + 1, 'A repeated trusted click while the effect is active must execute exactly once.');
    assert.equal(repeated.clicks.at(-1).target, 'mosh-action');
    assert.equal(repeated.clicks.at(-1).trusted, true);
    assert.equal(repeated.clicks.at(-1).defaultPrevented, false);
    assert.equal(repeated.starts.length, beforeClick.starts.length);
    await idle(page);

    const beforeModified = await state(page);
    await page.keyboard.down('Control');
    try { await clickAt(page, page.locator('#mosh-action')); } finally { await page.keyboard.up('Control'); }
    const modified = await state(page);
    assert.equal(modified.interaction.events.sequence, beforeModified.interaction.events.sequence);
    assert.equal(modified.starts.length, beforeModified.starts.length);
    assert.equal(modified.actions, beforeModified.actions + 1);
    const beforeGuards = await state(page);
    await page.evaluate(() => {
      for (const id of ['mosh-input', 'mosh-protected', 'mosh-mute']) {
        const target = document.getElementById(id);
        target.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse', clientX: 25, clientY: innerHeight - 25 }));
        target.focus(); target.click();
      }
    });
    const guards = await state(page);
    assert.equal(guards.interaction.events.sequence, beforeGuards.interaction.events.sequence);
    assert.equal(guards.starts.length, beforeGuards.starts.length);
    await page.waitForTimeout(90);
    const beforeExternal = await state(page);
    await page.locator('#mosh-external').evaluate(element => element.click());
    const external = await state(page);
    assert.equal(external.starts.length, beforeExternal.starts.length);
    assert.equal(external.externalDefaultPrevented, false);

    // Give the real empty Work archive a scroll range without adding artwork.
    // Calling the actual anchor avoids Playwright scrolling its header into
    // view before navigation saves the current position.
    await page.addStyleTag({ content: '.page-shell { min-height: 1200px !important; }' });
    await page.evaluate(() => { document.getElementById('mosh-controls').remove(); scrollTo({ top: 240, behavior: 'instant' }); });
    await idle(page);
    const beforeNav = await state(page);
    await page.locator('.page-nav a[href="/about"]').evaluate(element => element.click());
    await page.waitForFunction(() => document.documentElement.dataset.page === 'about');
    await idle(page);
    const navigated = await state(page);
    const captures = navigated.starts.slice(beforeNav.starts.length);
    assert.deepEqual(captures.map(value => value.kind), ['navigation'], 'An anchor click gets one navigation capture, with no competing click capture.');
    assert.equal(captures[0].sourceHeading, 'work');
    assert.equal(captures[0].sourceScrollY, 240);
    assert.equal(captures[0].sourceMode, 'xray');
    assert.equal(captures[0].calls, 1);
    assert.equal(captures[0].commit.page, 'about');
    assert.equal(captures[0].commit.scrollY, 0);
    assert.equal(captures[0].commit.focus, 'page-content');
    assert.equal(navigated.mode, 'xray');
    assert.equal(navigated.token, normal.token);
    await page.goBack();
    await page.waitForFunction(() => document.documentElement.dataset.page === 'work' && scrollY === 240);
    await idle(page);
    await page.goForward();
    await page.waitForFunction(() => document.documentElement.dataset.page === 'about' && scrollY === 0);
    await idle(page);
    await page.locator('.page-nav a[href="/#contact"]').evaluate(element => element.click());
    await page.waitForFunction(() => document.documentElement.dataset.page === 'home' && location.hash === '#contact');
    await idle(page);
    const contact = await state(page);
    assert.equal(contact.starts.at(-1).kind, 'navigation');
    assert.ok(Math.abs(contact.starts.at(-1).commit.contactTop) <= 1, 'Contact scroll/focus belongs inside the captured navigation commit.');
    assert.equal(contact.starts.at(-1).commit.focus, 'contact');
    assert.equal(contact.mode, 'xray');
    assert.equal(contact.token, normal.token);
    const hint = page.locator('[data-other-side-hint]');
    await hint.scrollIntoViewIfNeeded();
    await page.mouse.move(1, 1);
    await idle(page, { pixels: true });
    const beforeHint = await state(page);
    await hoverAt(page, hint);
    const protectedHint = await hint.evaluate(element => ({
      text: element.textContent.trim(), color: getComputedStyle(element).color,
      opacity: Number(getComputedStyle(element.querySelector('[data-secret-message]')).opacity),
      filter: getComputedStyle(document.documentElement, '::view-transition-new(h4-mode-instruction)').filter,
    }));
    const afterHint = await state(page);
    assert.equal(afterHint.interaction.events.sequence, beforeHint.interaction.events.sequence);
    assert.equal(afterHint.starts.length, beforeHint.starts.length);
    assert.equal(protectedHint.text, 'PRESS 3 THREE TIMES TO REVERSE.');
    assert.equal(protectedHint.color, 'rgb(255, 255, 255)');
    assert.equal(protectedHint.opacity, 1);
    assert.equal(protectedHint.filter, 'none');
    assert.equal(afterHint.overflow, false);
    assert.equal(afterHint.contexts.webGL, 0, 'Work/About/anchored Contact must not initialize the offscreen 3D hero.');
    assert.ok(!requests.includes('/src/main.js'), 'Interior tests must not fetch the hero module.');
    const beforeReverse = await state(page);
    for (let count = 0; count < 3; count++) await page.keyboard.press('3');
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'normal');
    await idle(page);
    const reversed = await state(page);
    assert.deepEqual(reversed.starts.slice(beforeReverse.starts.length).map(value => value.kind), ['mode']);
    assert.equal(reversed.interaction.events.active, false);
    assert.equal(reversed.corruption.regions, 0);
    assert.deepEqual(errors, []);
    report.results.push({ profile: 'desktop', normal, hover, clicked, navigation: captures[0], contact: contact.starts.at(-1), protectedHint, reversed, errors });
    console.log('PASS desktop: Normal stays idle; Other Side hover/focus/click, exclusions, one navigation capture, history, Contact and released 333 recover.');
  } catch (error) {
    report.lastObservation = { profile: 'desktop', state: await state(page).catch(() => null), errors, requests };
    throw error;
  } finally { await context.close(); }
}

async function touch(width, reduced = false) {
  const { page, context, errors } = await createPage({ viewport: { width, height: 700 }, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  try {
    await fixtures(page);
    await enter(page, { reduced });
    const before = await state(page);
    await page.locator('#mosh-action').evaluate(target => target.dispatchEvent(new PointerEvent('pointerover', {
      bubbles: true, pointerType: 'touch', isPrimary: true, clientX: 35, clientY: innerHeight - 25,
    })));
    assert.equal((await state(page)).interaction.events.emitted.hover, before.interaction.events.emitted.hover);
    const point = await pointAt(page.locator('#mosh-action'));
    await page.touchscreen.tap(point.x, point.y);
    if (!reduced) await page.waitForFunction(() => document.documentElement.dataset.moshKind === 'click');
    const during = await state(page);
    assert.equal(during.actions, 1);
    assert.deepEqual(during.starts.slice(before.starts.length), [], 'Touch clicks keep native document capture reserved for actual navigation/mode changes.');
    if (reduced) {
      assert.equal(during.interaction.events.sequence, 0);
      assert.equal(during.corruption?.regions || 0, 0);
      assert.equal(during.interaction.events.observing, false);
    } else {
      assert.equal(during.interaction.events.emitted.click, before.interaction.events.emitted.click + 1);
      assert.equal(during.interaction.events.emitted.hover, 0);
      assert.ok(during.interaction.transitions.current.duration >= 240 && during.interaction.transitions.current.duration <= 480);
    }
    await idle(page, { pixels: !reduced });
    const settled = await state(page);
    assert.equal(settled.overflow, false);
    assert.equal(settled.contexts.webGL, 0);
    assert.equal(settled.interaction.transitions.active, false);
    assert.deepEqual(errors, []);
    report.results.push({ profile: reduced ? 'reduced' : `touch-${width}`, during, settled, errors });
    console.log(`PASS ${reduced ? 'reduced motion' : `touch ${width}`}: no hover, ${reduced ? 'no native capture or interaction impulses' : 'valid click capture'}, recovery and no overflow.`);
  } finally { await context.close(); }
}

async function pixelProof() {
  const { page, context, errors } = await createPage({ viewport: { width: 390, height: 600 } });
  let deadline;
  try {
    deadline = setTimeout(() => void abort('20-second bounded local pixel-proof deadline.'), 20000);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(450);
    await page.locator('.page-heading').evaluate(heading => {
      const visual = document.createElement('span'); visual.id = 'local-pixel-visual'; visual.style.display = 'block';
      while (heading.firstChild) visual.append(heading.firstChild);
      heading.append(visual);
    });
    await page.clock.install({ time: new Date('2026-10-25T10:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-25T10:00:01Z'));
    const geometry = await page.locator('.page-heading').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        clip: { x: 0, y: Math.max(0, Math.floor(rect.top) - 35), width: innerWidth, height: Math.ceil(rect.height) + 110 } };
    });
    const original = await page.screenshot({ clip: geometry.clip, path: new URL('local-original.png', destination).pathname, timeout: 4000 });
    await page.evaluate(async rect => {
      const { createModeSnapshotTransition } = await import('/src/mode-snapshot.js');
      const controller = createModeSnapshotTransition({ settings: { colorStrength: 0, channelOffsetPx: 0 } });
      const probe = window.__localPixelProbe = { controller, calls: [] };
      probe.handle = controller.run(detail => probe.calls.push(detail), { mode: 'xray', kind: 'hover', rect,
        target: document.querySelector('.page-heading'), element: document.querySelector('#local-pixel-visual'),
        duration: 360, strength: .7, variant: 1947, dx: 52, dy: 5 });
      await probe.handle.ready;
    }, geometry.rect);
    await page.clock.runFor(180);
    // Pause the browser's live animation clock only for this compact structural
    // readback. The integrated gestures above all completed in real time.
    frozenReadback = true;
    await sampleMemory();
    const displaced = await page.screenshot({ clip: geometry.clip, path: new URL('local-displaced.png', destination).pathname, timeout: 4000 });
    const metadata = await page.evaluate(() => ({
      calls: window.__localPixelProbe.calls, snapshot: window.__localPixelProbe.controller.snapshot(),
      source: document.querySelector('.mode-snapshot-definitions [data-snapshot-displacement][scale]:not([scale="0"])')?.getAttribute('in'),
      mask: [...document.querySelectorAll('.mode-snapshot-definitions [data-snapshot-mask]')].find(element => element.hasAttribute('href'))?.getAttribute('href'),
      filter: getComputedStyle(document.querySelector('#local-pixel-visual')).filter,
      parentFilter: document.querySelector('.page-heading').style.filter,
      nativeCount: window.__localPixelProbe.controller.snapshot().nativeCount,
      readbacks: window.__interactionBrowser.readbacks, mode: document.documentElement.dataset.mode,
    }));
    await page.evaluate(async () => { window.__localPixelProbe.controller.skip(); await window.__localPixelProbe.handle.finished; });
    const restored = await page.screenshot({ clip: geometry.clip, path: new URL('local-restored.png', destination).pathname, timeout: 4000 });
    const [before, after, recovered] = await Promise.all([original, displaced, restored].map(value => sharp(value).removeAlpha().raw().toBuffer()));
    const pixels = { brightBefore: 0, brightAfter: 0, movedBrightInside: 0, changedInside: 0, outsidePixels: 0, changedOutside: 0, unexpectedChroma: 0 };
    for (let y = 0; y < geometry.clip.height; y++) for (let x = 0; x < geometry.clip.width; x++) {
      const offset = (y * geometry.clip.width + x) * 3;
      const beforeBright = before[offset] > 150 && before[offset + 1] > 150 && before[offset + 2] > 150;
      const afterBright = after[offset] > 150 && after[offset + 1] > 150 && after[offset + 2] > 150;
      const px = x + geometry.clip.x, py = y + geometry.clip.y;
      // SVG's composited filter edge can cover one adjacent device pixel
      // (observed as a one-level channel change). Include that raster fringe;
      // the tens of thousands of pixels beyond it must stay byte-identical.
      const inside = px >= Math.floor(geometry.rect.left) - 1 && px < Math.ceil(geometry.rect.left + geometry.rect.width) + 1
        && py >= Math.floor(geometry.rect.top) - 1 && py < Math.ceil(geometry.rect.top + geometry.rect.height) + 1;
      const changed = before[offset] !== after[offset] || before[offset + 1] !== after[offset + 1] || before[offset + 2] !== after[offset + 2];
      if (inside) {
        if (beforeBright) pixels.brightBefore++;
        if (afterBright) pixels.brightAfter++;
        if (afterBright && !beforeBright) pixels.movedBrightInside++;
        if (changed) pixels.changedInside++;
        if (Math.abs(after[offset] - after[offset + 1]) > 12 || Math.abs(after[offset + 1] - after[offset + 2]) > 12) pixels.unexpectedChroma++;
      } else { pixels.outsidePixels++; if (changed) pixels.changedOutside++; }
    }
    report.lastObservation = { profile: 'pixels', ...geometry, metadata, pixels };
    assert.deepEqual(metadata.calls.map(value => value.captured), [false]);
    assert.equal(metadata.snapshot.current.kind, 'hover');
    assert.equal(metadata.source, 'SourceGraphic');
    assert.match(metadata.filter, /h4-mode-snapshot/);
    assert.equal(metadata.nativeCount, 0);
    assert.equal(metadata.parentFilter, '');
    assert.match(decodeURIComponent(metadata.mask), /<rect /);
    assert.equal(metadata.readbacks, 0, 'Local source pixels are sampled by SVG without JavaScript bitmap readbacks.');
    assert.equal(metadata.mode, 'normal', 'The isolated proof samples static real Work, without enabling film or Three.');
    assert.ok(pixels.brightBefore > 500 && pixels.brightAfter > 300, 'Actual bright Work glyph information must survive displacement.');
    assert.ok(pixels.movedBrightInside > 80 && pixels.changedInside > 300, `Real bright glyph pixels must move inside the local mask: ${JSON.stringify(pixels)}`);
    assert.ok(pixels.outsidePixels > 20000);
    assert.equal(pixels.changedOutside, 0, 'Every screenshot pixel outside the local mask must remain byte-identical.');
    assert.ok(pixels.unexpectedChroma < 20, 'A visible colored UV map cannot satisfy the source-pixel proof.');
    assert.deepEqual(recovered, before, 'Live Work pixels restore exactly after the local effect.');
    await page.evaluate(() => window.__localPixelProbe.controller.dispose());
    assert.deepEqual(errors, []);
    report.results.push({ profile: 'pixels', ...geometry, metadata, pixels, errors });
    console.log('PASS actual local pixels: real grayscale glyphs move inside the mask; outside bytes and restored page remain identical.');
  } finally { clearTimeout(deadline); frozenReadback = false; await context.close(); }
}

const monitor = setInterval(() => void sampleMemory().catch(error => abort(error.message)), 100);
const suiteDeadline = setTimeout(() => void abort('150-second bounded interaction browser suite deadline.'), 150000);
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  if (profiles.includes('desktop')) await desktop();
  if (profiles.includes('touch-390')) await touch(390);
  if (profiles.includes('touch-320')) await touch(320);
  if (profiles.includes('reduced')) await touch(390, true);
  if (profiles.includes('pixels')) await pixelProof();
  report.passed = true;
} catch (error) { failure = error; report.failure = error.stack || error.message; }
finally {
  clearInterval(monitor); clearTimeout(suiteDeadline);
  try { await browser?.close(); } catch {}
  report.finishedAt = new Date().toISOString();
  await writeFile(new URL('results.json', destination), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ passed: report.passed || false, profiles: report.results.map(value => value.profile), maximumTreeRssBytes: report.maximumTreeRssBytes, aborted: report.aborted, failure: report.failure || null }, null, 2));
if (failure || report.aborted) process.exitCode = 1;
