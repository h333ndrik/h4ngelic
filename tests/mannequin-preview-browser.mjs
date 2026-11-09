import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createPreviewServer } from '../scripts/serve-preview.mjs';
import { mannequinVariant } from '../src/mannequin-preview-config.js';
import { artworks } from '../src/data/artworks.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const evidence = new URL('../docs/validation/MANNEQUIN-C/', import.meta.url);
await mkdir(evidence, { recursive: true });

const server = await createPreviewServer();
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const base = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const profiles = [{ width: 1440, height: 1000 }, { width: 390, height: 900 }, { width: 320, height: 900 }];
const mockupCount = artworks.filter((artwork) => artwork.published !== false && artwork.category === 'tattoos'
  && Array.isArray(artwork.images) && artwork.images.length).length;
const glbRequests = (requests) => requests.filter((url) => /\/models\/mannequin-[a-z0-9.-]+\.glb$/.test(url));

const trackPage = async (context) => {
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', (request) => requests.push(request.url()));
  await page.addInitScript(() => {
    window.__webglContexts = 0;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (/webgl/i.test(type) && getContext.call(this, type, ...args)) window.__webglContexts += 1;
      return getContext.call(this, type, ...args);
    };
  });
  return { page, errors, requests };
};

const scrollSectionTo = async (page, selector, top) => page.evaluate(([name, position]) => {
  const element = document.querySelector(name);
  scrollTo({ top: Math.max(0, element.getBoundingClientRect().top + scrollY - position), behavior: 'instant' });
}, [selector, top]);

const waitReady = (page) => page.waitForFunction(
  () => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'ready',
  null, { timeout: 60000 },
);

/** Liesst die Einfahrt-Pose der Modell-Section. */
const sectionPose = (page) => page.evaluate(() => {
  const section = document.querySelector('#model-3d');
  const style = getComputedStyle(section);
  const read = (name, fallback) => {
    const value = Number.parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    x: read('--entrance-x', 0),
    opacity: read('--entrance-opacity', 1),
    transform: style.transform,
    top: section.getBoundingClientRect().top,
  };
});

/**
 * Liesst die Pose des Frontpage-Elements "01 / creative": dort laeuft die
 * Einfahrt ueber die Rubrik-Links (--kinetic-x/--kinetic-opacity), waehrend der
 * Titel statisch bleibt.
 */
const homepagePose = (page) => page.evaluate(() => {
  const section = document.querySelector('#selected-work');
  const item = section.querySelector('.category-link .kinetic-item');
  const style = getComputedStyle(item);
  const read = (name, fallback) => {
    const value = Number.parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    x: read('--kinetic-x', 0),
    opacity: read('--kinetic-opacity', 1),
    top: section.getBoundingClientRect().top,
  };
});

const results = [];
try {
  for (const { width, height } of profiles) {
    const context = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600,
    });
    const { page, errors, requests } = await trackPage(context);
    await page.goto(`${base}/creative/tattoos`, { waitUntil: 'networkidle' });

    const preview = page.locator('[data-mannequin-preview]');
    assert.equal(await preview.getAttribute('data-mannequin-state'), 'deferred');
    assert.equal(await preview.getAttribute('data-mannequin-variant'), 'C', 'C is the only visible variant.');
    assert.equal(await page.locator('[data-mannequin-variant-option]').count(), 0, 'There is no visible variant switcher.');
    assert.equal(await page.evaluate(() => window.__webglContexts), 0, 'Cold Work must not create a WebGL context.');
    assert.equal(glbRequests(requests).length, 0, 'Cold Work must not request a GLB.');
    assert.equal(requests.filter((url) => url.endsWith('/textures/designs/demo-mark.png')).length, 0);
    assert.ok(!requests.some((url) => /mannequin-preview-|three\.module|DracoLoader|KTX2Loader/.test(url)), 'The Three.js stack waits for visibility.');

    // Einfahrt: Startpose vor dem Viewport ist unsichtbar und eingerueckt.
    const startPose = await sectionPose(page);
    assert.ok(startPose.opacity < 0.05, `The section starts hidden (${startPose.opacity}).`);
    const expectedInset = Math.min(28, width * 0.045);
    assert.ok(Math.abs(startPose.x - expectedInset) < 0.5, `The section starts inset by ${expectedInset}px (got ${startPose.x}).`);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await scrollSectionTo(page, '#model-3d', 120);
    await waitReady(page);
    await page.waitForTimeout(250);
    assert.deepEqual(errors, [], `no console errors at ${width}px`);

    const glbs = glbRequests(requests);
    assert.equal(await page.evaluate(() => window.__webglContexts), 1, 'Exactly one WebGL context.');
    assert.equal(await page.locator('.mannequin-preview-canvas').count(), 1);
    assert.equal(glbs.length, 1, 'Exactly one GLB request for the visible variant.');
    assert.match(glbs[0], /mannequin-c\.[a-f0-9]+\.glb$/);
    assert.equal(glbs.filter((url) => /mannequin-female-[ab]\.glb$/.test(url)).length, 0, 'A/B stay unrequested in the production build.');
    assert.equal(await preview.getAttribute('data-mannequin-polygons'), '49838');
    assert.equal(await preview.getAttribute('data-mannequin-design'), 'unsupported');
    assert.match(await preview.getAttribute('data-mannequin-material'), /skincolor/);

    const layout = await page.evaluate(() => {
      const section = document.querySelector('#model-3d');
      const heading = section.querySelector('.archive-category-heading').getBoundingClientRect();
      const figure = section.querySelector('.mannequin-preview').getBoundingClientRect();
      const frame = section.querySelector('.mannequin-preview-frame').getBoundingClientRect();
      const canvas = section.querySelector('canvas').getBoundingClientRect();
      return {
        headingBottom: heading.bottom, figureTop: figure.top,
        frame: { left: frame.left, right: frame.right, width: frame.width },
        canvas: { left: canvas.left, right: canvas.right, width: canvas.width },
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    assert.ok(layout.headingBottom < layout.figureTop, 'The preview must not overlap its heading.');
    assert.ok(layout.frame.left >= 0 && layout.frame.right <= width + 1);
    assert.ok(Math.abs(layout.canvas.width - layout.frame.width) <= 1);
    assert.ok(layout.documentWidth <= width + 1, 'No horizontal overflow.');

    // Poster = echtes Renderer-Bild, gleiche Box wie der Canvas; der Rahmen
    // selbst malt keinen Hintergrund (Transparenz ist echt, kein CSS-Kasten).
    const presentation = await page.evaluate(() => {
      const frame = document.querySelector('.mannequin-preview-frame');
      const poster = frame.querySelector('.mannequin-preview-poster');
      const img = poster.querySelector('img');
      const canvas = frame.querySelector('canvas');
      const f = frame.getBoundingClientRect();
      const p = poster.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      const style = getComputedStyle(frame);
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const attrs = gl ? gl.getContextAttributes() : null;
      const clear = gl ? Array.from(gl.getParameter(gl.COLOR_CLEAR_VALUE)) : null;
      return {
        poster: { left: p.left, top: p.top, width: p.width, height: p.height },
        canvas: { left: c.left, top: c.top, width: c.width, height: c.height },
        frame: { width: f.width, height: f.height },
        backgroundImage: style.backgroundImage, backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow, borderWidth: style.borderTopWidth,
        source: (img.currentSrc || '').split('/').pop(), natural: [img.naturalWidth, img.naturalHeight],
        alpha: attrs?.alpha, clearAlpha: clear ? clear[3] : null,
      };
    });
    assert.equal(presentation.backgroundImage, 'none', 'The frame paints no CSS background.');
    assert.equal(presentation.backgroundColor, 'rgba(0, 0, 0, 0)', 'The frame stays transparent.');
    assert.equal(presentation.boxShadow, 'none');
    assert.equal(presentation.borderWidth, '0px');
    assert.equal(presentation.alpha, true, 'The WebGL context keeps an alpha channel.');
    assert.equal(presentation.clearAlpha, 0, 'The renderer clears with alpha 0.');
    // WebP zuerst, PNG als Fallback — beide sind echte Renderer-Bilder.
    assert.match(presentation.source, /mannequin-poster-(wide|tall)-[a-f0-9]{8}\.(webp|png)$/,
      'The poster is a real render, not the old inline SVG.');
    assert.equal(/\.webp$/.test(presentation.source), true,
      `Chromium nimmt die kleinere WebP-Variante (${presentation.source}).`);
    assert.equal(width < 600 ? /tall/.test(presentation.source) : /wide/.test(presentation.source), true,
      `The ${width < 600 ? 'portrait' : 'landscape'} poster matches the viewport.`);
    for (const edge of ['left', 'top', 'width', 'height']) {
      assert.ok(Math.abs(presentation.poster[edge] - presentation.canvas[edge]) <= 1,
        `Poster and canvas share the ${edge} (${presentation.poster[edge]} vs ${presentation.canvas[edge]}).`);
    }

    // Bedienhinweis und Zeigerform (M4i): einmal sichtbar, absolut positioniert
    // (kein Layout-Shift), nach der ersten Geste weg.
    const gesture = await page.evaluate(() => {
      const frame = document.querySelector('[data-mannequin-preview]');
      const hint = frame.querySelector('[data-mannequin-gesture]');
      const figure = frame.closest('.mannequin-preview');
      const style = getComputedStyle(hint);
      const before = figure.getBoundingClientRect().height;
      frame.dataset.mannequinHint = 'off';
      const withoutHint = figure.getBoundingClientRect().height;
      frame.dataset.mannequinHint = 'on';
      const withHint = figure.getBoundingClientRect().height;
      return {
        text: hint.textContent.trim(),
        attribute: frame.dataset.mannequinHint,
        cursor: getComputedStyle(frame).cursor,
        position: style.position,
        pointerEvents: style.pointerEvents,
        opacity: Number(style.opacity),
        ariaHidden: hint.getAttribute('aria-hidden'),
        before, withoutHint, withHint,
      };
    });
    assert.equal(gesture.text, 'drag to turn');
    assert.equal(gesture.attribute, 'on', 'Der Hinweis ist beim ersten Sichtbarwerden an.');
    // Zeigerform: auf feinen Zeigern gewinnt der globale h4-Cursor
    // (src/cursor.css, F18, !important); ohne Hover/feinen Zeiger greift die
    // lokale Regel und es bleibt bei grab/grabbing. Beides wird geprueft.
    if (width >= 600) {
      assert.match(gesture.cursor, /h4ngelic-cursor/, `Der Rahmen behaelt den h4-Cursor (${gesture.cursor}).`);
    } else {
      assert.equal(gesture.cursor, 'grab', `Ohne feinen Zeiger zeigt der Rahmen die Greifhand (${gesture.cursor}).`);
    }
    assert.equal(gesture.position, 'absolute', 'Der Hinweis liegt ueber dem Rahmen, nicht im Fluss.');
    assert.equal(gesture.pointerEvents, 'none', 'Der Hinweis blockiert keine Zeigerereignisse.');
    assert.equal(gesture.opacity, 1);
    assert.equal(gesture.ariaHidden, 'true', 'Der Hinweis bleibt fuer Screenreader unsichtbar (sr-only Hilfe deckt die Bedienung).');
    assert.ok(Math.abs(gesture.withHint - gesture.withoutHint) < 0.5 && Math.abs(gesture.before - gesture.withHint) < 0.5,
      `Der Hinweis verschiebt kein Layout (${gesture.withoutHint} / ${gesture.withHint}).`);

    // Erste Geste: Hinweis weg, Zeiger wird zur Faust, Winkel unveraendert.
    const afterFirstGesture = await page.evaluate(() => {
      const frame = document.querySelector('[data-mannequin-preview]');
      frame.setPointerCapture = () => {};
      frame.releasePointerCapture = () => {};
      const angleBefore = Number(frame.dataset.mannequinAngle);
      const box = frame.getBoundingClientRect();
      const options = { bubbles: true, pointerId: 31, isPrimary: true, pointerType: 'mouse', button: 0, buttons: 1, clientX: box.left + 20, clientY: box.top + 20 };
      frame.dispatchEvent(new PointerEvent('pointerdown', options));
      const cursorWhileDragging = getComputedStyle(frame).cursor;
      frame.dispatchEvent(new PointerEvent('pointerup', { ...options, buttons: 0 }));
      // Stub entfernen: die echten Gesten brauchen wieder Pointer-Capture,
      // sonst landet das Loslassen ausserhalb des Rahmens (schmale Viewports).
      delete frame.setPointerCapture;
      delete frame.releasePointerCapture;
      return {
        hint: frame.dataset.mannequinHint,
        opacity: Number(getComputedStyle(frame.querySelector('[data-mannequin-gesture]')).opacity),
        cursorWhileDragging,
        cursorAfter: getComputedStyle(frame).cursor,
        angleBefore,
        angleAfter: Number(frame.dataset.mannequinAngle),
      };
    });
    assert.equal(afterFirstGesture.hint, 'off', 'Die erste Geste blendet den Hinweis aus.');
    if (width >= 600) {
      assert.match(afterFirstGesture.cursorWhileDragging, /h4ngelic-cursor/,
        'Auch waehrend des Ziehens bleibt der eine h4-Cursor (F18, kein Wechsel).');
    } else {
      assert.equal(afterFirstGesture.cursorWhileDragging, 'grabbing',
        'Waehrend des Ziehens wird aus der Greifhand die Faust.');
    }
    assert.equal(afterFirstGesture.cursorAfter, gesture.cursor, 'Nach dem Loslassen gilt wieder die Ausgangsform.');
    assert.ok(Math.abs(afterFirstGesture.angleAfter - afterFirstGesture.angleBefore) < 0.02,
      'Ein Klick ohne Bewegung dreht das Modell nicht.');

    const designButton = page.locator('[data-mannequin-design-toggle]');
    assert.equal(await designButton.isEnabled(), false, 'C disables the demo design.');
    assert.equal(await designButton.getAttribute('aria-disabled'), 'true');
    assert.equal(await page.locator('[data-mannequin-design-hint]').isVisible(), true);
    assert.match(await page.locator('[data-mannequin-design-hint]').textContent(), /no decals/i);

    const file = `variant-c-${width}.png`;
    await page.locator('.mannequin-preview').screenshot({ path: fileURLToPath(new URL(file, evidence)) });

    // Reduced Motion: Section steht sofort, keine Auto-Rotation.
    assert.equal((await sectionPose(page)).opacity, 1);
    assert.equal((await sectionPose(page)).x, 0);
    await page.waitForTimeout(2200);
    assert.equal(Number(await preview.getAttribute('data-mannequin-angle')), mannequinVariant('C').initialYaw);

    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Auto-Rotation, Drag-Pause, Flick und Rueckkehr.
    const angle = async () => Number(await preview.getAttribute('data-mannequin-angle'));
    // M4g: Waehrend des Flicks darf keine Scene-Bounds mehr gebaut werden.
    const boundsBuilds = async () => Number(await preview.getAttribute('data-mannequin-bounds-builds'));
    const boundsBeforeFlick = await boundsBuilds();
    await page.waitForTimeout(2600);
    const angleAuto = await angle();
    assert.ok(angleAuto > mannequinVariant('C').initialYaw + 0.02, `Auto rotation must run (${angleAuto} rad).`);
    const box = await page.locator('.mannequin-preview-frame').boundingBox();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    const angleHeldA = await angle();
    await page.waitForTimeout(500);
    const angleHeldB = await angle();
    assert.ok(Math.abs(angleHeldB - angleHeldA) < 0.02, `Rotation pauses while dragging (${angleHeldA} -> ${angleHeldB}).`);
    // Flick = Loslassen waehrend der Bewegung. Seit M4g zaehlt nur das letzte
    // 70-ms-Fenster; deshalb wird direkt nach der Bewegung losgelassen (vorher
    // lagen zwei Frames zum Ablesen des Winkels dazwischen).
    await page.mouse.move(centerX + 240, centerY, { steps: 6 });
    await page.mouse.up();
    // Der Winkel steht erst nach dem naechsten Frame im DOM; im Headless-
    // Renderer dauert ein Frame gut 70 ms.
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    assert.ok(Math.abs(await angle() - angleHeldB) > 0.1, 'Dragging rotates the model.');
    assert.equal(await preview.getAttribute('data-mannequin-flicks'), '1',
      `A strong flick triggers the documented fallback animation (peak ${await preview.getAttribute('data-mannequin-peak')}).`);
    await page.waitForFunction(
      () => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinShoot === 'playing',
      null, { timeout: 4000 });
    await page.waitForFunction(
      () => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinShoot === 'idle',
      null, { timeout: 8000 });
    assert.equal(await preview.getAttribute('data-mannequin-shoot'), 'idle', 'The model returns into the viewport.');
    assert.equal(await boundsBuilds(), boundsBeforeFlick,
      `Der Flick baut keine neuen Scene-Bounds (${boundsBeforeFlick} -> ${await boundsBuilds()}).`);

    const figureCount = await page.locator('figure.project-image').count();
    assert.ok(figureCount >= mockupCount, `The tattoo mockups stay mounted (${figureCount} >= ${mockupCount}).`);
    assert.deepEqual(errors, [], `no console errors after interactions at ${width}px`);

    results.push({
      width, height, variant: 'C', glbRequests: glbs.length,
      switcherButtons: 0, screenshot: file, autoAngle: angleAuto, mockups: figureCount, errors,
    });
    await context.close();
  }

  // Barrierefreiheit: Semantik, Fokusring, Tastaturdrehung.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page, errors } = await trackPage(context);
    await page.goto(`${base}/creative/tattoos`, { waitUntil: 'networkidle' });
    await scrollSectionTo(page, '#model-3d', 120);
    await waitReady(page);
    await page.waitForTimeout(250);

    const semantics = await page.evaluate(() => {
      const frame = document.querySelector('[data-mannequin-preview]');
      const help = document.getElementById('mannequin-viewer-help');
      const canvas = frame.querySelector('canvas');
      const helpStyle = help ? getComputedStyle(help) : null;
      return {
        role: frame.getAttribute('role'),
        label: frame.getAttribute('aria-label'),
        describedBy: frame.getAttribute('aria-describedby'),
        shortcuts: frame.getAttribute('aria-keyshortcuts'),
        tabIndex: frame.tabIndex,
        help: help?.textContent.trim() || '',
        helpPosition: helpStyle?.position || '',
        helpWidth: helpStyle?.width || '',
        canvasHidden: canvas?.getAttribute('aria-hidden'),
        liveInsideImage: document.querySelectorAll('[data-mannequin-preview] [role="status"], [data-mannequin-preview] [aria-live]').length,
        statusOutsideImage: Boolean(document.querySelector('.mannequin-preview > [data-mannequin-status][role="status"]')),
      };
    });
    assert.equal(semantics.role, 'img');
    assert.match(semantics.label, /arrow keys/i, 'The label names the keyboard control.');
    assert.equal(semantics.describedBy, 'mannequin-viewer-help');
    assert.match(semantics.shortcuts || '', /ArrowLeft ArrowRight/);
    assert.equal(semantics.tabIndex, 0, 'The viewer is reachable with Tab.');
    assert.match(semantics.help, /15 degree steps/);
    assert.equal(semantics.helpPosition, 'absolute', 'The help text is sr-only.');
    assert.equal(semantics.helpWidth, '1px');
    assert.equal(semantics.canvasHidden, 'true', 'The canvas stays decorative.');
    assert.equal(semantics.liveInsideImage, 0, 'No live region inside role="img" (presentational children).');
    assert.ok(semantics.statusOutsideImage, 'The status region lives outside the image role.');

    // Tab-Reihenfolge: das Element davor fokussieren, ein Tab landet im Viewer.
    const tabTarget = await page.evaluate(() => {
      const frame = document.querySelector('[data-mannequin-preview]');
      const focusable = [...document.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')];
      const index = focusable.indexOf(frame);
      focusable[index - 1]?.focus();
      return { index, previous: focusable[index - 1]?.tagName || null };
    });
    assert.ok(tabTarget.index > 0, 'The viewer has a predecessor in the tab order.');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.matches('[data-mannequin-preview]')), true,
      'Tab reaches the 3D viewer.');

    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('[data-mannequin-preview]'));
      return { outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth), color: style.outlineColor };
    });
    assert.notEqual(ring.outlineStyle, 'none', 'The keyboard focus ring is visible.');
    assert.ok(ring.outlineWidth >= 2, `Focus ring width ${ring.outlineWidth}px.`);

    const angle = async () => Number(await page.locator('[data-mannequin-preview]').getAttribute('data-mannequin-angle'));

    // Pfeiltaste rechts: ein Druck = ~15 Grad.
    const beforeStep = await angle();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(40);
    const afterStep = await angle();
    assert.ok(afterStep - beforeStep > 0.2 && afterStep - beforeStep < 0.4,
      `ArrowRight turns about 15 degrees (${(afterStep - beforeStep).toFixed(3)} rad).`);

    // Gehaltene Taste dreht kontinuierlich weiter.
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(300);
    const whileHeld = await angle();
    await page.keyboard.up('ArrowRight');
    assert.ok(whileHeld - afterStep > 0.08, `Holding the key keeps turning (${(whileHeld - afterStep).toFixed(3)} rad).`);

    // Home setzt auf initialYaw (C = 0) zurueck.
    await page.keyboard.press('Home');
    await page.waitForTimeout(40);
    assert.equal(await angle(), mannequinVariant('C').initialYaw, 'Home resets to the documented initial yaw.');

    // preventDefault nur im fokussierten Viewer.
    const prevented = await page.evaluate(() => {
      const frame = document.querySelector('[data-mannequin-preview]');
      frame.focus();
      const focused = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      frame.dispatchEvent(focused);
      frame.blur();
      const unfocused = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      frame.dispatchEvent(unfocused);
      return { focused: focused.defaultPrevented, unfocused: unfocused.defaultPrevented };
    });
    assert.equal(prevented.focused, true, 'A focused viewer swallows the arrow key.');
    assert.equal(prevented.unfocused, false, 'An unfocused viewer leaves scrolling alone.');

    // Escape bricht einen laufenden Flick ab. Ob der Peak ueber 2,4 rad/s
    // kommt, haengt am Event-Timing des Headless-Chromium; deshalb echte
    // Pointer-Gesten mit wachsender Distanz, bis der Flick wirklich greift.
    const viewer = page.locator('[data-mannequin-preview]');
    const flickCount = async () => Number((await viewer.getAttribute('data-mannequin-flicks')) || 0);
    const box = await page.locator('.mannequin-preview-frame').boundingBox();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const flicksBefore = await flickCount();
    for (const [distance, steps] of [[260, 5], [420, 4], [560, 3]]) {
      if (await flickCount() > flicksBefore) break;
      await page.mouse.move(centerX - distance / 2, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX + distance / 2, centerY, { steps });
      await page.mouse.up();
      await page.waitForTimeout(80);
    }
    assert.ok(await flickCount() > flicksBefore,
      `Die Geste muss einen Flick ausloesen (Peak ${await viewer.getAttribute('data-mannequin-peak')}).`);
    // Der Shoot-Zustand wird erst im naechsten Frame gesetzt; im Headless-
    // Renderer dauert ein Frame nach der Geste gut 150 ms.
    await page.waitForFunction(
      () => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinShoot === 'playing',
      null, { timeout: 3000 });
    await viewer.focus();
    assert.equal(await viewer.getAttribute('data-mannequin-shoot'), 'playing', 'Der Flick laeuft beim Druecken von Escape noch.');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-mannequin-preview]').getAttribute('data-mannequin-shoot'), 'idle',
      'Escape cancels the running flick.');
    assert.match(await page.locator('[data-mannequin-preview]').getAttribute('data-mannequin-keyboard'), /escape/);

    // Hover darf den Container nicht verschieben (kein Ausschlag).
    const hover = await page.evaluate(async () => {
      const v = document.querySelector('[data-mannequin-preview]');
      const canvas = v.querySelector('canvas');
      const section = document.querySelector('#model-3d');
      const sample = (ms) => new Promise((resolve) => {
        const out = [];
        const start = performance.now();
        const step = () => {
          const now = performance.now();
          const rect = canvas.getBoundingClientRect();
          out.push({ left: rect.left, width: rect.width,
            entranceX: getComputedStyle(section).getPropertyValue('--entrance-x').trim() });
          if (now - start < ms) requestAnimationFrame(step); else resolve(out);
        };
        requestAnimationFrame(step);
      });
      return sample(400);
    });
    const hoverBox = await page.locator('.mannequin-preview-frame').boundingBox();
    await page.mouse.move(hoverBox.x + hoverBox.width / 2, hoverBox.y + hoverBox.height / 2);
    const hovered = await page.evaluate(async () => {
      const v = document.querySelector('[data-mannequin-preview]');
      const canvas = v.querySelector('canvas');
      const section = document.querySelector('#model-3d');
      return await new Promise((resolve) => {
        const out = [];
        const start = performance.now();
        const step = () => {
          const now = performance.now();
          const rect = canvas.getBoundingClientRect();
          out.push({ left: rect.left, width: rect.width,
            entranceX: getComputedStyle(section).getPropertyValue('--entrance-x').trim() });
          if (now - start < 700) requestAnimationFrame(step); else resolve(out);
        };
        requestAnimationFrame(step);
      });
    });
    const lateral = (list) => Math.max(...list.map((entry) => entry.left)) - Math.min(...list.map((entry) => entry.left));
    assert.ok(lateral([...hover, ...hovered]) <= 1, `Hover must not move the viewer (${lateral([...hover, ...hovered]).toFixed(3)} px).`);
    assert.equal(new Set([...hover, ...hovered].map((entry) => entry.entranceX)).size, 1,
      'Hover never touches the entrance transform.');
    // Ausgangszeiger weg und Rotation stoppen, damit der Reduced-Motion-Test
    // mit ruhender Figur startet.
    await page.mouse.move(5, 5);
    await page.keyboard.press('Home');
    await page.waitForTimeout(80);

    // Reduced Motion: Tastatur dreht weiter, Auto-Rotation bleibt aus.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(120);
    const reducedBefore = await angle();
    await page.keyboard.press('ArrowLeft');
    const reducedAfter = await angle();
    assert.ok(Math.abs(reducedAfter - reducedBefore) > 0.2, 'Keyboard turning survives reduced motion.');
    await page.waitForTimeout(2200);
    assert.ok(Math.abs((await angle()) - reducedAfter) < 0.02, 'Reduced motion keeps the auto rotation off.');

    assert.deepEqual(errors, [], 'no console errors in the accessibility checks');
    results.push({ accessibility: { role: semantics.role, tabIndex: semantics.tabIndex, stepRadians: Number((afterStep - beforeStep).toFixed(3)), prevented } });
    await context.close();
  }

  // Uebergang: Poster bleibt deckend, bis der erste Modell-Frame gemalt ist.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page, errors } = await trackPage(context);
    await page.goto(`${base}/creative/tattoos`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      window.__presentation = [];
      const tick = () => {
        const v = document.querySelector('[data-mannequin-preview]');
        if (v) {
          const poster = v.querySelector('.mannequin-preview-poster');
          window.__presentation.push({ state: v.dataset.mannequinState,
            renders: Number(v.dataset.mannequinRenders || 0),
            poster: poster ? Number(getComputedStyle(poster).opacity) : null });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await scrollSectionTo(page, '#model-3d', 120);
    await waitReady(page);
    await page.waitForFunction(
      () => Number(getComputedStyle(document.querySelector('.mannequin-preview-poster')).opacity) <= 0.01,
      null, { timeout: 8000 });
    const samples = await page.evaluate(() => window.__presentation);
    const fading = samples.filter((sample) => sample.poster !== null && sample.poster < 0.99);
    assert.ok(fading.length > 0, 'The poster actually fades into the model.');
    for (const sample of fading) {
      assert.equal(sample.state, 'ready', 'No intermediate state: the poster only fades once the model exists.');
      assert.ok(sample.renders >= 1, 'A rendered frame exists before the poster fades.');
    }
    assert.deepEqual(errors, [], 'no console errors during the transition');
    results.push({ transition: { samples: samples.length, fading: fading.length } });
    await context.close();
  }

  // Einfahrt identisch zur Frontpage: bei gleicher Section-Position im Viewport
  // muss die Modell-Section dieselbe Pose zeigen wie die Rubrik-Links von
  // "01 / creative".
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page, errors } = await trackPage(context);
    const targets = [240, 340, 460, 580, 660];
    const sampleAt = async (path, selector, read, target, { waitForModel = false } = {}) => {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      if (waitForModel) {
        await page.evaluate(() => {
          const section = document.querySelector('#model-3d');
          scrollTo({ top: Math.max(0, section.getBoundingClientRect().top + scrollY - 120), behavior: 'instant' });
        });
        await waitReady(page);
        await page.waitForTimeout(250);
      }
      await page.evaluate(([name, top]) => {
        const section = document.querySelector(name);
        scrollTo({ top: Math.max(0, section.getBoundingClientRect().top + scrollY - top), behavior: 'instant' });
      }, [selector, target]);
      // Der Pose-Loop laeuft frameweise; im Headless-Software-Renderer dauert
      // ein Frame gut 200 ms. Deshalb zwei echte Frames abwarten statt einer
      // festen Zeit, sonst wird eine veraltete Pose gelesen.
      await page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      await page.waitForTimeout(120);
      return read(page);
    };
    const home = [];
    for (const target of targets) home.push(await sampleAt('/', '#selected-work', homepagePose, target));
    const model = [];
    for (const target of targets) model.push(await sampleAt('/creative/tattoos', '#model-3d', sectionPose, target, { waitForModel: true }));
    let compared = 0;
    for (let index = 0; index < targets.length; index += 1) {
      const expected = home[index];
      const actual = model[index];
      if (Math.abs(expected.top - targets[index]) > 3 || Math.abs(actual.top - targets[index]) > 3) continue;
      compared += 1;
      assert.ok(Math.abs(actual.x - expected.x) <= 0.6,
        `Entrance x must match the frontpage curve at top ${targets[index]}px (${actual.x} vs ${expected.x}).`);
      assert.ok(Math.abs(actual.opacity - expected.opacity) <= 0.02,
        `Entrance opacity must match the frontpage curve at top ${targets[index]}px (${actual.opacity} vs ${expected.opacity}).`);
    }
    assert.ok(compared >= 3, `At least three scroll positions must be comparable (got ${compared}).`);
    assert.ok(model.some((entry) => entry.opacity > 0 && entry.opacity < 1), 'The entrance must pass through a visible intermediate state.');
    assert.deepEqual(errors, []);
    results.push({ entrance: { compared, model: model.map((entry) => ({ top: Math.round(entry.top), x: entry.x, opacity: Number(entry.opacity.toFixed(3)) })) } });
    await context.close();
  }

  // Kein WebGL: Poster bleibt, kein Canvas.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page } = await trackPage(context);
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (/webgl/i.test(type)) return null;
        return getContext.call(this, type, ...args);
      };
    });
    await page.goto(`${base}/creative/tattoos`, { waitUntil: 'networkidle' });
    await scrollSectionTo(page, '#model-3d', 120);
    await page.waitForFunction(() => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'failed', null, { timeout: 30000 });
    const fallback = await page.locator('[data-mannequin-preview]').evaluate((node) => ({
      webgl: node.dataset.mannequinWebgl,
      poster: getComputedStyle(node.querySelector('.mannequin-preview-poster')).opacity,
      canvases: document.querySelectorAll('.mannequin-preview-canvas').length,
    }));
    assert.equal(fallback.webgl, 'unavailable');
    assert.equal(fallback.canvases, 0);
    assert.ok(Number(fallback.poster) > 0, 'The poster remains the fallback.');
    await page.locator('.mannequin-preview').screenshot({ path: fileURLToPath(new URL('fallback-poster-1440.png', evidence)) });
    results.push({ noWebgl: fallback });
    await context.close();
  }

  // Leak-Probe: 5 Route-Wechsel (Mount/Unmount) mit erneutem Laden.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page, errors } = await trackPage(context);
    await page.goto(`${base}/creative/tattoos`, { waitUntil: 'networkidle' });
    await scrollSectionTo(page, '#model-3d', 120);
    await waitReady(page);
    for (let cycle = 0; cycle < 5; cycle += 1) {
      await page.evaluate(() => { history.pushState({}, '', '/about'); dispatchEvent(new PopStateEvent('popstate')); });
      await page.waitForFunction(() => !document.querySelector('[data-mannequin-preview]'), null, { timeout: 30000 });
      await page.evaluate(() => { history.pushState({}, '', '/creative/tattoos'); dispatchEvent(new PopStateEvent('popstate')); });
      await page.waitForFunction(() => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'deferred', null, { timeout: 30000 });
      await scrollSectionTo(page, '#model-3d', 120);
      await waitReady(page);
    }
    await page.waitForTimeout(400);
    const leaked = await page.evaluate(() => ({
      canvases: document.querySelectorAll('.mannequin-preview-canvas').length,
      contexts: window.__webglContexts,
    }));
    assert.equal(leaked.canvases, 1, 'Exactly one canvas survives the cycles.');
    assert.ok(leaked.contexts <= 6, `WebGL contexts must not grow unbounded (${leaked.contexts} for 5 mounts).`);
    assert.deepEqual(errors, [], 'No console errors during the leak probe.');
    results.push({ leak: { mounts: 5, ...leaked } });
    await context.close();
  }

  // Der Viewer bleibt in der Tattoo-Rubrik.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page } = await trackPage(context);
    for (const route of ['/creative/jewellery', '/creative/digital-artworks', '/creative/tools/m4shlab']) {
      const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      assert.ok(response.status() === 200 || response.status() === 404);
      assert.equal(await page.locator('[data-mannequin-preview]').count(), 0, `${route} must not mount the mannequin viewer.`);
    }
    results.push({ isolation: ['/creative/jewellery', '/creative/digital-artworks', '/creative/tools/m4shlab'] });
    await context.close();
  }

  // ?variant=a|b ist Production tot: keine A/B-Anfrage, C bleibt sichtbar.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const { page, requests } = await trackPage(context);
    await page.goto(`${base}/creative/tattoos?variant=b`, { waitUntil: 'networkidle' });
    await scrollSectionTo(page, '#model-3d', 120);
    await waitReady(page);
    assert.equal(await page.locator('[data-mannequin-preview]').getAttribute('data-mannequin-variant'), 'C');
    assert.equal(glbRequests(requests).filter((url) => /mannequin-female-[ab]\.glb$/.test(url)).length, 0);
    results.push({ variantQueryInProduction: 'ignored' });
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

// Bundle-Nachweis: kein LICENSE-NOTE-String und kein docs-Ordner im Build.
{
  const dist = join(root, 'dist');
  // Weder Lizenz-/Herkunftsnotizen noch der Bezugsplattform-Name gehoeren in
  // das ausgelieferte Bundle — weder als Datei noch als String.
  const forbidden = ['LICENSE-NOTE', 'sketchfab', 'CREDITS'];
  const hits = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { await walk(path); continue; }
      const name = entry.name.toLowerCase();
      const named = forbidden.find((term) => name.includes(term.toLowerCase()));
      if (named) { hits.push(`${path} (Dateiname: ${named})`); continue; }
      if (!/\.(js|css|html|json|txt|xml|map|md|webmanifest)$/.test(entry.name)) continue;
      const content = (await readFile(path, 'utf8')).toLowerCase();
      const found = forbidden.find((term) => content.includes(term.toLowerCase()));
      if (found) hits.push(`${path} (Inhalt: ${found})`);
    }
  };
  await walk(dist);
  assert.deepEqual(hits, [], 'The built output must not mention LICENSE-NOTE, sketchfab or CREDITS.');
  assert.equal(existsSync(join(dist, 'docs')), false, 'Validation docs are never bundled.');
  assert.equal(existsSync(join(dist, 'CREDITS.md')), false, 'CREDITS.md stays outside the bundle.');
  // A/B sind dev-only: ihre Asset-Namen duerfen im Production-Bundle nicht stehen.
  const hiddenVariantHits = [];
  const scanHidden = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { await scanHidden(path); continue; }
      if (!/\.(js|css|html|json|txt|xml|map|md|webmanifest)$/.test(entry.name)) continue;
      if (/mannequin-female-[ab]\.glb/.test(await readFile(path, 'utf8'))) hiddenVariantHits.push(path);
    }
  };
  await scanHidden(dist);
  assert.deepEqual(hiddenVariantHits, [], 'Hidden A/B assets must not be referenced by the production build.');
  results.push({ bundle: { forbidden, hits: hits.length, docsBundled: false, creditsBundled: false } });
}

await writeFile(new URL('requests.json', evidence), JSON.stringify({
  checkedAt: new Date().toISOString(),
  route: '/creative/tattoos',
  source: 'production preview build',
  profiles,
  visibleVariant: mannequinVariant('C').model,
  hiddenVariants: ['A', 'B'],
  results,
  passed: true,
}, null, 2) + '\n');
console.log(`PASS mannequin preview: ${profiles.length} viewports, nur C sichtbar, Einfahrt identisch zur Frontpage, reduced motion, no-WebGL, Leak-Probe, Bundle ohne LICENSE-NOTE.`);
