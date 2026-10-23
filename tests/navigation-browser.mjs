import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const routeURL = (path) => new URL(path, baseURL).href;
const heroScript = (value) => {
  const path = new URL(value).pathname;
  return path === '/src/main.js' || /^\/assets\/main-[^/]+\.js$/.test(path);
};
const sceneAsset = (value) => /^\/(?:fonts\/wordmark\.typeface\.json|assets\/tattoo-texture(?:-640)?\.webp)$/.test(new URL(value).pathname);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function context(options = {}) {
  const result = await browser.newContext({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 1, ...options });
  await result.addInitScript(() => {
    const canvases = new WeakSet();
    window.__navigationProbe = { documentToken: `${performance.timeOrigin}:${Math.random()}`, contexts: 0, draws: 0, transitionCommits: [] };
    if (typeof document.startViewTransition === 'function') {
      const startViewTransition = document.startViewTransition.bind(document);
      document.startViewTransition = (update) => startViewTransition(async () => {
        await update();
        // The browser may take its new-page snapshot after this callback
        // resolves. Observe that boundary, rather than a later settled frame.
        window.__navigationProbe.transitionCommits.push({
          path: `${location.pathname}${location.hash}`,
          scroll: [scrollX, scrollY],
          focus: document.activeElement?.id || '',
        });
      });
    }
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const value = getContext.call(this, type, ...args);
      if (/^(webgl2?|experimental-webgl)$/.test(type) && value && !canvases.has(this)) {
        canvases.add(this); window.__navigationProbe.contexts++;
      }
      return value;
    };
    for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!type) continue;
      for (const method of ['drawArrays', 'drawElements']) {
        const original = type.prototype[method];
        type.prototype[method] = function (...args) {
          window.__navigationProbe.draws++;
          return original.apply(this, args);
        };
      }
    }
  });
  return result;
}

function track(page) {
  const requests = [];
  const errors = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  return { requests, errors };
}

const frames = (page, count = 3) => page.evaluate((remaining) => new Promise((resolve) => {
  function tick() { if (--remaining <= 0) resolve(); else requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
}), count);
const probe = (page) => page.evaluate(() => ({ ...window.__navigationProbe }));

async function pageKind(page, kind, path) {
  if (path) await page.waitForURL((url) => `${url.pathname}${url.hash}` === path);
  await page.waitForFunction((value) => document.documentElement.dataset.page === value, kind);
  await frames(page);
}

async function finishedTransition(page) {
  await page.evaluate(async () => {
    await Promise.allSettled(document.getAnimations().filter((animation) => animation.effect?.pseudoElement?.startsWith('::view-transition')).map((animation) => animation.finished));
  });
  await frames(page);
}

async function assertScenePaused(page) {
  await frames(page, 4);
  const before = await probe(page);
  await frames(page, 4);
  const after = await probe(page);
  assert.equal(after.draws, before.draws, 'An offscreen/hidden hero must issue no WebGL draw calls.');
}

async function assertSameDocument(page, token) {
  assert.equal((await probe(page)).documentToken, token, 'Enhanced navigation must retain the same document.');
}

async function assertTransitionCommit(page, path, top, focus) {
  const supported = await page.evaluate(() => typeof document.startViewTransition === 'function');
  if (!supported) return;
  await page.waitForFunction((value) => window.__navigationProbe.transitionCommits.at(-1)?.path === value, path);
  const snapshot = await page.evaluate(() => window.__navigationProbe.transitionCommits.at(-1));
  assert.ok(Math.abs(snapshot.scroll[1] - top) < 2, `The View Transition update for ${path} must restore scroll before its new-page snapshot: ${JSON.stringify(snapshot)}`);
  assert.equal(snapshot.focus, focus, `The View Transition update for ${path} must transfer focus before its new-page snapshot.`);
}

async function assertContactReadable(page) {
  assert.equal(await page.locator('#contact').evaluate((element) => element === document.activeElement), true, 'Returning to a Contact hash history entry must focus its section without changing the saved scroll position.');
  const states = await page.locator('#contact .kinetic-item').evaluateAll((items) => items.map((item) => {
    const style = getComputedStyle(item);
    return { x: new DOMMatrixReadOnly(style.transform).m41, opacity: Number(style.opacity) };
  }));
  assert.equal(states.length, 3);
  assert.ok(states.every(({ x, opacity }) => Math.abs(x) < .1 && opacity > .99), `All Contact labels must be readable immediately after history restoration: ${JSON.stringify(states)}`);
}

async function readyHero(page) {
  await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
  assert.equal((await probe(page)).contexts, 1, 'The hero must create exactly one canvas context.');
  assert.equal(await page.locator('#logo-canvas').count(), 1, 'Returning Home must not duplicate the canvas.');
}

async function waitForHeld(promise) {
  let timeout;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Home did not request its lazy hero module.')), 15000);
    })]);
  } finally { clearTimeout(timeout); }
}

try {
  // Direct interior loads must not fetch or initialize the hero. A production
  // prerender carries its markup inside an inert template; dev uses a hidden hero.
  const direct = await context();
  try {
    const page = await direct.newPage();
    const { requests, errors } = track(page);
    await page.goto(routeURL('/work'), { waitUntil: 'domcontentloaded' });
    await pageKind(page, 'work', '/work');
    const token = (await probe(page)).documentToken;
    const template = await page.locator('#hero-template').count();
    if (template) assert.equal(await page.locator('.hero, #logo-canvas').count(), 0, 'Prerendered interior hero markup must stay inert.');
    assert.equal((await probe(page)).contexts, 0);
    assert.deepEqual(requests.filter((url) => heroScript(url) || sceneAsset(url)), [], 'Direct Work must not download the 3D module, font or artwork texture.');
    await page.locator('.brand-link').click();
    await pageKind(page, 'home', '/');
    await readyHero(page);
    await assertSameDocument(page, token);
    if (template) assert.equal(await page.locator('#hero-template').count(), 0, 'The inert template is consumed exactly once.');
    await page.locator('.hero-nav a[href="/work"]').click();
    await pageKind(page, 'work', '/work');
    await finishedTransition(page);
    await assertScenePaused(page);
    await page.locator('.brand-link').click();
    await pageKind(page, 'home', '/');
    await readyHero(page);
    await assertSameDocument(page, token);
    assert.deepEqual(errors, []);
    console.log(`PASS navigation: direct Work stays free of WebGL; Home ${template ? 'clones its inert template' : 'reveals its existing development hero'} once and reuses the scene.`);
  } finally { await direct.close(); }

  // Hold the module after Home has requested it, then leave before evaluation.
  // This deterministically exercises the import race without a guessed delay.
  const raced = await context();
  let release;
  try {
    const page = await raced.newPage();
    const { requests, errors } = track(page);
    let markHeld;
    const held = new Promise((resolve) => { markHeld = resolve; });
    await page.route((url) => heroScript(url.href), async (interception) => {
      const response = await interception.fetch();
      const barrier = new Promise((resume) => { release = resume; });
      markHeld(interception.request().url());
      await barrier;
      await interception.fulfill({ response });
    });
    await page.goto(routeURL('/?test=1'), { waitUntil: 'domcontentloaded' });
    const moduleURL = await waitForHeld(held);
    const token = (await probe(page)).documentToken;
    await page.locator('.hero-nav a[href="/work"]').click();
    await pageKind(page, 'work', '/work');
    await assertSameDocument(page, token);
    release();
    // Resolving this import proves that the held module has actually evaluated.
    await page.evaluate((url) => import(url).then(() => true), moduleURL);
    await frames(page, 4);
    assert.equal((await probe(page)).contexts, 0, 'A module delivered after leaving Home must defer WebGL initialization.');
    assert.deepEqual(requests.filter(sceneAsset), [], 'Deferred initialization must not fetch the font or reflection texture on Work.');
    await page.locator('.brand-link').click();
    await pageKind(page, 'home', '/');
    await readyHero(page);
    assert.equal(requests.filter(heroScript).length, 1, 'Returning Home must use the already imported module.');
    await page.locator('.hero-nav a[href="/about"]').click();
    await pageKind(page, 'about', '/about');
    await finishedTransition(page);
    await assertScenePaused(page);
    assert.deepEqual(errors, []);
    console.log('PASS navigation race: a delayed Home import creates no context/assets on Work, initializes on return and stops drawing on About.');
  } finally {
    release?.();
    await raced.close();
  }

  const historyContext = await context();
  try {
    const page = await historyContext.newPage();
    const { errors } = track(page);
    await page.goto(routeURL('/work'), { waitUntil: 'domcontentloaded' });
    await pageKind(page, 'work', '/work');
    const token = (await probe(page)).documentToken;
    // Give an empty real archive a deterministic scroll range without adding
    // fake artwork or changing repository content. The style survives SPA renders.
    await page.addStyleTag({ content: '.page-shell { min-height: 2200px !important; }' });
    async function scroll(top) {
      await page.evaluate((value) => scrollTo({ top: value, behavior: 'instant' }), top);
      await frames(page);
      assert.ok(Math.abs(await page.evaluate(() => scrollY) - top) < 2);
    }
    async function activate(path, kind) {
      // Activating an ordinary anchor programmatically preserves the outgoing
      // scroll position; locator.click would first scroll its header into view.
      await page.locator(`.page-nav a[href="${path}"]`).evaluate((link) => link.click());
      await pageKind(page, kind, path);
      await page.waitForFunction(() => scrollY < 2);
      await finishedTransition(page);
      assert.equal(await page.locator('#page-content').evaluate((element) => element === document.activeElement), true, 'Page navigation must move keyboard focus into new content.');
      await assertTransitionCommit(page, path, 0, 'page-content');
    }
    await scroll(340);
    await activate('/about', 'about');
    await scroll(620);
    await activate('/work', 'work');
    await scroll(930);
    for (const [direction, path, kind, top] of [
      ['back', '/about', 'about', 620], ['back', '/work', 'work', 340],
      ['forward', '/about', 'about', 620], ['forward', '/work', 'work', 930],
    ]) {
      if (direction === 'back') await page.goBack(); else await page.goForward();
      await pageKind(page, kind, path);
      await page.waitForFunction((value) => Math.abs(scrollY - value) < 2, top);
      await finishedTransition(page);
      await assertSameDocument(page, token);
      await assertTransitionCommit(page, path, top, 'page-content');
    }

    // Contact is readable through a focus override even at the beginning of
    // its scroll timeline. Returning through history must retain that focus,
    // rather than restoring the position with all three labels offscreen.
    await page.locator('.page-nav a[href="/#contact"]').evaluate((link) => link.click());
    await pageKind(page, 'home', '/#contact');
    await finishedTransition(page);
    await assertContactReadable(page);
    const contactStart = await page.evaluate(() => scrollY);
    await assertTransitionCommit(page, '/#contact', contactStart, 'contact');
    await scroll(contactStart + 80);
    const contactSaved = await page.evaluate(() => scrollY);
    await page.goBack();
    await pageKind(page, 'work', '/work');
    await page.waitForFunction(() => Math.abs(scrollY - 930) < 2);
    await finishedTransition(page);
    await assertSameDocument(page, token);
    await assertTransitionCommit(page, '/work', 930, 'page-content');
    await page.goForward();
    await pageKind(page, 'home', '/#contact');
    await page.waitForFunction((top) => Math.abs(scrollY - top) < 2, contactSaved);
    await finishedTransition(page);
    await assertSameDocument(page, token);
    await assertContactReadable(page);
    await assertTransitionCommit(page, '/#contact', contactSaved, 'contact');
    assert.deepEqual(errors, []);
    console.log('PASS navigation history: distinct scroll positions, Contact focus/readability on Back/Forward and restoration before View Transition snapshots.');
  } finally { await historyContext.close(); }

  // Feature detection must preserve real URL navigation on a small viewport.
  const fallback = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await fallback.addInitScript(() => { Object.defineProperty(document, 'startViewTransition', { value: undefined, configurable: true }); });
    const page = await fallback.newPage();
    const { requests, errors } = track(page);
    await page.goto(routeURL('/work'), { waitUntil: 'domcontentloaded' });
    await pageKind(page, 'work', '/work');
    const token = (await probe(page)).documentToken;
    await page.locator('.page-nav a[href="/about"]').tap();
    await pageKind(page, 'about', '/about');
    await assertSameDocument(page, token);
    assert.match(await page.title(), /about/);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://h4ngelic.com/about');
    assert.equal(await page.locator('#page-content').evaluate((element) => element === document.activeElement), true);
    await page.goBack();
    await pageKind(page, 'work', '/work');
    assert.equal((await probe(page)).contexts, 0);
    assert.deepEqual(requests.filter((url) => heroScript(url) || sceneAsset(url)), []);
    assert.deepEqual(errors, []);
    console.log('PASS navigation fallback: 390px touch navigation, metadata, history and focus work without the View Transition API or 3D initialization.');
  } finally { await fallback.close(); }
} finally {
  await browser.close();
}
