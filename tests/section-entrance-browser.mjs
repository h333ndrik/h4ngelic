import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

/**
 * Stop-Assert fuer den frame-getriebenen Einfahrts-Loop (src/section-entrance.js).
 *
 * Auf /work/tattoos ist ein globaler rAF-Zaehler nicht zurechenbar: dort haelt
 * V3.1 `horizontal-drift` einen eigenen Frame-Loop. Dieser Test laedt deshalb
 * eine isolierte Harness-Seite, die ausschliesslich das Einfahrts-Modul
 * importiert. Jeder gezaehlte rAF-Call stammt damit nachweislich aus dem
 * Einfahrts-Loop.
 *
 * A: Section ausserhalb des Arm-Fensters  -> 0 rAF-Calls / 500 ms
 * B: Section im Arm-Fenster (ruhig)       -> rAF-Calls > 0 (frame-getrieben,
 *                                            nicht nur scroll-getrieben)
 * C: betreten, dann verlassen             -> Loop stoppt binnen 2 Frames
 * D: dispose (Unmount)                    -> 0 weitere rAF-Calls
 */
const evidence = new URL('../docs/validation/MANNEQUIN-C/', import.meta.url);
await mkdir(evidence, { recursive: true });

const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const executablePath = process.env.CHROMIUM_PATH
  || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });

/** Patcht rAF/cancelAnimationFrame vor dem Laden und zaehlt auf window. */
const instrument = () => {
  window.__rafCalls = 0;
  window.__cancelCalls = 0;
  const raf = window.requestAnimationFrame.bind(window);
  const cancel = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => {
    window.__rafCalls += 1;
    return raf(callback);
  };
  window.cancelAnimationFrame = (handle) => {
    window.__cancelCalls += 1;
    return cancel(handle);
  };
};

const openHarness = async (options = {}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(instrument);
  await page.goto(`${base}/tests/fixtures/section-entrance.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  // Erste IntersectionObserver-Meldung abwarten, sonst ist "armed" noch offen.
  await page.waitForTimeout(300);
  return { context, page, errors };
};

const frameCount = (page) => page.evaluate(() => window.__rafCalls);

/**
 * Zaehlt rAF-Calls in einem ruhigen Fenster (keine Scroll-/Resize-Events).
 * Ein negativer Wert koennte nur von einem Reload stammen — der wuerde den
 * Zaehler zuruecksetzen und die Messung still verfaelschen.
 */
const sampleFrames = async (page, milliseconds) => {
  const before = await frameCount(page);
  await page.waitForTimeout(milliseconds);
  const delta = (await frameCount(page)) - before;
  assert.ok(delta >= 0, `rAF-Zaehler ist waehrend der Messung zurueckgesprungen (${delta}) — Seite neu geladen?`);
  return delta;
};

/** Wartet exakt n Frames (2 Rendering-Schritte). */
const waitFrames = (page, count) => page.evaluate((frames) => new Promise((resolve) => {
  let remaining = frames;
  const step = () => { remaining -= 1; if (remaining <= 0) resolve(); else requestAnimationFrame(step); };
  requestAnimationFrame(step);
}), count);

const pose = (page) => page.evaluate(() => {
  const style = getComputedStyle(document.querySelector('#probe'));
  const read = (name, fallback) => {
    const value = Number.parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return { x: read('--entrance-x', 0), opacity: read('--entrance-opacity', 1) };
});

const scrollToSectionTop = (page, top) => page.evaluate((position) => {
  const element = document.querySelector('#probe');
  scrollTo({ top: Math.max(0, element.getBoundingClientRect().top + scrollY - position), behavior: 'instant' });
}, top);

const results = {};
try {
  const { context, page, errors } = await openHarness();
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);

  // A — ausserhalb des Arm-Fensters (Section-Top 2600 px, Fenster 15 % von 844 px).
  assert.equal(await page.evaluate(() => scrollY), 0);
  const outsideTop = await page.evaluate(() => Math.round(document.querySelector('#probe').getBoundingClientRect().top));
  assert.ok(outsideTop > 844 * 1.15, `Die Section muss ausserhalb des Arm-Fensters liegen (Top ${outsideTop}px).`);
  await sampleFrames(page, 250); // einschwingen
  const idleFrames = await sampleFrames(page, 500);
  assert.equal(idleFrames, 0, `Ausserhalb des Arm-Fensters darf kein Frame-Loop laufen (${idleFrames} rAF-Calls/500 ms).`);
  const startPose = await pose(page);
  assert.ok(startPose.opacity < 0.05, `Die Startpose bleibt gesetzt (opacity ${startPose.opacity}).`);
  results.outside = { sectionTop: outsideTop, rafPer500ms: idleFrames, pose: startPose };

  // B — im Arm-Fenster und ruhig: der Loop laeuft weiter (frame-getrieben).
  await scrollToSectionTop(page, 200);
  await page.waitForTimeout(300);
  const visibleFrames = await sampleFrames(page, 500);
  assert.ok(visibleFrames > 0, `Im Arm-Fenster muss der Loop laufen (${visibleFrames} rAF-Calls/500 ms).`);
  const settledPose = await pose(page);
  // Section-Top 200 px liegt mitten in der Einfahrt: die Pose ist weder Start
  // noch Ende. Genau daran ist zu sehen, dass der Loop wirklich rechnet.
  assert.ok(settledPose.opacity > 0.5 && settledPose.opacity < 1,
    `Die Section steht mitten in der Einfahrt (opacity ${settledPose.opacity}).`);
  assert.ok(settledPose.x > 0 && settledPose.x < 390 * 0.045, `Die Section ist noch eingerueckt (x ${settledPose.x}).`);
  results.visible = { rafPer500ms: visibleFrames, pose: settledPose };

  // C — betreten, dann verlassen: Loop stoppt binnen 2 Frames.
  await scrollToSectionTop(page, 400);
  await page.waitForTimeout(200);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await waitFrames(page, 2);
  const cancelledOnExit = await page.evaluate(() => window.__cancelCalls);
  assert.ok(cancelledOnExit > 0, 'Der Exit-Trigger muss cancelAnimationFrame benutzen, nicht nur ein Flag.');
  const frozenPose = await pose(page);
  const exitFrames = await sampleFrames(page, 500);
  assert.equal(exitFrames, 0, `Nach dem Verlassen muss der Loop binnen 2 Frames stehen (${exitFrames} rAF-Calls/500 ms).`);
  assert.deepEqual(await pose(page), frozenPose, 'Die letzte Pose bleibt unveraendert stehen.');
  results.exit = { cancelCalls: cancelledOnExit, rafPer500ms: exitFrames, frozenPose };

  // D — Unmount: dispose beendet Loop und Listener endgueltig.
  await scrollToSectionTop(page, 200);
  await page.waitForTimeout(300);
  assert.ok(await sampleFrames(page, 400) > 0, 'Vor dem Unmount laeuft der Loop.');
  const cancelsBeforeDispose = await page.evaluate(() => window.__cancelCalls);
  await page.evaluate(() => { window.__dispose(); });
  const afterDispose = await sampleFrames(page, 500);
  assert.equal(afterDispose, 0, `Nach dispose darf kein Frame mehr laufen (${afterDispose} rAF-Calls/500 ms).`);
  assert.ok(await page.evaluate(() => window.__cancelCalls) > cancelsBeforeDispose, 'dispose raeumt den ausstehenden Frame ab.');
  await scrollToSectionTop(page, 0);
  await page.waitForTimeout(200);
  assert.equal(await sampleFrames(page, 400), 0, 'Nach dispose reaktiviert auch Scrollen den Loop nicht.');
  results.dispose = { rafPer500ms: afterDispose };
  assert.equal(await page.evaluate(() => performance.timeOrigin), timeOrigin,
    'Der Harness darf waehrend der Messung nicht neu laden.');
  assert.deepEqual(errors, [], 'Der Loop darf keine Konsolenfehler erzeugen.');
  await context.close();

  // Reduced Motion: Endpose sofort, kein Loop.
  {
    const reduced = await openHarness({ reducedMotion: 'reduce' });
    await scrollToSectionTop(reduced.page, 200);
    await reduced.page.waitForTimeout(300);
    const frames = await sampleFrames(reduced.page, 500);
    assert.equal(frames, 0, `Reduced Motion darf keinen Loop starten (${frames} rAF-Calls/500 ms).`);
    const reducedPose = await pose(reduced.page);
    assert.equal(reducedPose.opacity, 1);
    assert.equal(reducedPose.x, 0);
    assert.deepEqual(reduced.errors, []);
    results.reducedMotion = { rafPer500ms: frames, pose: reducedPose };
    await reduced.context.close();
  }
} finally {
  await browser.close();
  await server.close();
}

await writeFile(new URL('section-entrance-stop.json', evidence), `${JSON.stringify({
  checkedAt: new Date().toISOString(),
  harness: 'tests/fixtures/section-entrance.html (nur src/section-entrance.js)',
  viewport: { width: 390, height: 844 },
  armMargin: '15% 0px',
  results,
  passed: true,
}, null, 2)}\n`);
console.log(`PASS section entrance stop: ausserhalb 0 rAF, im Fenster frame-getrieben, Exit binnen 2 Frames, dispose sauber, reduced motion ohne Loop (${JSON.stringify({
  idle: results.outside.rafPer500ms, visible: results.visible.rafPer500ms, exit: results.exit.rafPer500ms, dispose: results.dispose.rafPer500ms,
})}).`);
