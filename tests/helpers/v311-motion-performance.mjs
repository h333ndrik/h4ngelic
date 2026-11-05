import assert from 'node:assert/strict';

const probeKey = '__h4V311MotionPerformance';
const entranceSource = '/src/scroll-choreography.js';
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const percentile = (values, amount) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * amount) - 1)];
};

async function rest(page) {
  await page.evaluate(() => { window.__h4V311ScrollRest = { y: scrollY, at: performance.now() }; });
  await page.waitForFunction(() => {
    const state = window.__h4V311ScrollRest;
    if (Math.abs(state.y - scrollY) > .25) { state.y = scrollY; state.at = performance.now(); }
    return performance.now() - state.at >= 140;
  }, null, { timeout: 5000 });
  await frames(page);
}

async function pose(page, selector) {
  return page.locator(selector).first().evaluate(section => ({
    y: scrollY,
    documentHeight: document.documentElement.scrollHeight,
    nodes: [...section.querySelectorAll('.kinetic-heading-text, [data-motion-item], .category-link > .kinetic-item, .inquiry-enter')]
      .map((element, index) => {
        const style = getComputedStyle(element);
        const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
        return { index, name: element.id || element.dataset.motionItem || element.className,
          matrix: Array.from(matrix.toFloat64Array()), opacity: Number(style.opacity) };
      }),
  }));
}

async function install(page) {
  await page.evaluate(key => {
    window[key]?.dispose?.();
    const state = { active: false, startedAt: 0, stoppedAt: 0, previousFrame: null, frame: 0,
      intervals: [], longTasks: [], longAnimationFrames: [], nativeEvents: [], scrolls: [], observers: [] };
    const supported = PerformanceObserver.supportedEntryTypes || [];
    state.supportedEntryTypes = [...supported];
    const inWindow = entry => state.startedAt > 0 && entry.startTime >= state.startedAt
      && (!state.stoppedAt || entry.startTime <= state.stoppedAt);
    const readTasks = entries => {
      for (const entry of entries) if (inWindow(entry)) state.longTasks.push({ startTime: entry.startTime,
        duration: entry.duration, name: entry.name,
        attribution: [...(entry.attribution || [])].map(item => ({ name: item.name, containerType: item.containerType,
          containerSrc: (item.containerSrc || '').slice(0, 300) })) });
    };
    const readFrames = entries => {
      for (const entry of entries) if (inWindow(entry)) state.longAnimationFrames.push({
        startTime: entry.startTime, duration: entry.duration, blockingDuration: entry.blockingDuration,
        renderStart: entry.renderStart, styleAndLayoutStart: entry.styleAndLayoutStart,
        scripts: [...(entry.scripts || [])].map(script => ({
          sourceURL: (script.sourceURL || '').slice(0, 300), sourceFunctionName: script.sourceFunctionName || '',
          duration: script.duration, forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration,
          executionStart: script.executionStart, invoker: script.invoker || '', invokerType: script.invokerType || '',
        })),
      });
    };
    for (const [type, read] of [['longtask', readTasks], ['long-animation-frame', readFrames]]) {
      if (!supported.includes(type)) continue;
      const observer = new PerformanceObserver(list => read(list.getEntries()));
      observer.observe({ type });
      state.observers.push({ observer, read });
    }
    const tick = time => {
      if (!state.active) return;
      if (state.previousFrame !== null) state.intervals.push(time - state.previousFrame);
      state.previousFrame = time;
      state.frame = requestAnimationFrame(tick);
    };
    const native = event => {
      if (state.active) state.nativeEvents.push({ at: performance.now(), type: event.type,
        trusted: event.isTrusted, defaultPrevented: event.defaultPrevented,
        deltaX: event.deltaX ?? null, deltaY: event.deltaY ?? null, deltaMode: event.deltaMode ?? null });
    };
    const scroll = () => { if (state.active) state.scrolls.push({ at: performance.now(), x: scrollX, y: scrollY }); };
    // Window bubble listeners observe the final native event after the page's
    // handlers, without cancelling it or substituting synthetic scrolling.
    for (const type of ['wheel', 'touchstart', 'touchmove', 'touchend']) addEventListener(type, native, { passive: true });
    addEventListener('scroll', scroll, { passive: true });
    state.start = () => {
      state.startedAt = performance.now(); state.active = true; state.frame = requestAnimationFrame(tick);
    };
    state.stop = () => {
      state.stoppedAt = performance.now(); state.active = false; cancelAnimationFrame(state.frame);
      for (const { observer, read } of state.observers) read(observer.takeRecords());
      return { startedAt: state.startedAt, stoppedAt: state.stoppedAt,
        supportedEntryTypes: state.supportedEntryTypes, intervals: state.intervals,
        longTasks: state.longTasks, longAnimationFrames: state.longAnimationFrames,
        nativeEvents: state.nativeEvents, scrolls: state.scrolls };
    };
    state.dispose = () => {
      state.active = false; cancelAnimationFrame(state.frame);
      for (const { observer } of state.observers) observer.disconnect();
      for (const type of ['wheel', 'touchstart', 'touchmove', 'touchend']) removeEventListener(type, native);
      removeEventListener('scroll', scroll);
      delete window[key]; delete window.__h4V311ScrollRest;
    };
    window[key] = state;
  }, probeKey);
}

/**
 * Run only after the caller's route/mode setup has completed, with no concurrent
 * browser suite/build. It performs real native down/up wheel or touch gestures,
 * records performance separately from preparation/screenshots, then returns to
 * the exact initial scroll coordinate and checks the actual rendered pose.
 *
 * Whole-page/GPU-related long tasks are recorded, never silently rejected or
 * attributed to the entrance. LoAF source-URL attribution identifies the scroll
 * module when supported. Missing attribution is reported as unavailable, not0ms.
 * Mechanical failures throw with `error.motionPerformance` containing the report.
 */
export async function measureEntrancePerformance(page, { selector, profile = {}, label = selector } = {}) {
  assert.ok(selector, 'A real entrance section selector is required.');
  const section = page.locator(selector).first();
  await section.waitFor({ state: 'attached' });
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-mode-snapshot')
    && !document.documentElement.hasAttribute('data-xray-transition')
    && !document.documentElement.hasAttribute('data-memory-mosh-preparing'));
  await page.evaluate(async () => { document.activeElement?.blur(); await document.fonts.ready; });
  await page.waitForLoadState('networkidle');
  const geometry = await section.evaluate(element => {
    const top = element.getBoundingClientRect().top + scrollY;
    const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    return { top, viewportHeight: innerHeight, viewportWidth: innerWidth,
      layoutWidth: document.documentElement.clientWidth, maximum,
      lower: Math.max(0, Math.min(maximum, top - innerHeight * .72)),
      upper: Math.max(0, Math.min(maximum, top - innerHeight * .06)) };
  });
  assert.ok(geometry.upper - geometry.lower > 40, `${label}: the real document must expose a native vertical entrance range.`);
  await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), geometry.lower);
  await rest(page);
  // Preparing an upper section can expose the lazy hero for the first time.
  // Keep its import/font/reflection work outside the performance bracket.
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => { await document.fonts.ready; });
  await rest(page);
  const initial = await pose(page, selector);
  assert.ok(initial.nodes.length, `${label}: no existing entrance visuals were found.`);
  const touch = Number(profile.width || geometry.viewportWidth) < 600;
  const browserName = page.context().browser()?.browserType().name();
  assert.ok(!touch || browserName === 'chromium', 'Native touch performance probing requires Chromium CDP; do not substitute synthetic DOM events.');
  const input = touch ? await page.context().newCDPSession(page) : null;
  const gestures = [];
  let capture = null, failure = null;
  await install(page);
  try {
    await page.mouse.move(Math.max(2, geometry.layoutWidth - 8), geometry.viewportHeight * .5);
    await page.evaluate(key => window[key].start(), probeKey);
    for (const direction of [1, -1]) {
      const before = await page.evaluate(() => ({ y: scrollY, at: performance.now(), maximum: document.documentElement.scrollHeight - innerHeight }));
      const available = direction > 0 ? before.maximum - before.y : before.y;
      const requested = Math.min(geometry.upper - geometry.lower + 48, available);
      assert.ok(requested > 24, `${label}: native ${direction > 0 ? 'down' : 'up'} gesture needs real remaining scroll range.`);
      if (touch) {
        const span = Math.min(geometry.viewportHeight * .48, requested);
        const x = Math.max(2, geometry.layoutWidth - 8);
        const y = direction > 0 ? geometry.viewportHeight * .78 : geometry.viewportHeight * .22;
        await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let step = 1; step <= 10; step++) {
          // Ease the finite human input toward rest to reduce residual fling;
          // this is test input delivery, never a site animation or idle loop.
          const progress = 1 - (1 - step / 10) ** 2;
          await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - direction * span * progress }] });
          await page.waitForTimeout(25);
        }
        await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        for (let step = 0; step < 4; step++) {
          await page.mouse.wheel(0, direction * requested / 4);
          await page.waitForTimeout(35);
        }
      }
      await page.waitForFunction(({ y, direction }) => (scrollY - y) * direction > 12,
        { y: before.y, direction }, { timeout: 3000 });
      await rest(page);
      const after = await page.evaluate(() => ({ y: scrollY, at: performance.now() }));
      gestures.push({ direction, requestedPixels: requested, before, after,
        actualPixels: after.y - before.y, elapsedMs: after.at - before.at });
    }
  } catch (error) { failure = error; }
  finally {
    if (input) {
      await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
      await input.detach();
    }
    // Flush observer delivery before ending the timed window; no screenshot,
    // network operation or style/pose inspection occurs inside that window.
    await frames(page);
    capture = await page.evaluate(key => window[key].stop(), probeKey);
    await page.evaluate(key => window[key].dispose(), probeKey);
  }
  await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), initial.y);
  await rest(page);
  const returned = await pose(page, selector);
  const sourceScripts = capture.longAnimationFrames.flatMap(frame => frame.scripts)
    .filter(script => script.sourceURL.includes(entranceSource));
  const hasAttributableFrames = capture.longAnimationFrames.some(frame => frame.scripts.some(script => script.sourceURL));
  const sourceModuleObserved = await page.evaluate(source => performance.getEntriesByType('resource')
    .some(entry => entry.name.includes(source)), entranceSource);
  const attributionAvailable = sourceModuleObserved && capture.supportedEntryTypes.includes('long-animation-frame')
    && (!capture.longAnimationFrames.length || hasAttributableFrames);
  for (const gesture of gestures) {
    const event = capture.nativeEvents.find(event => event.at >= gesture.before.at && event.at <= gesture.after.at);
    const movement = capture.scrolls.find(sample => sample.at >= gesture.before.at
      && sample.at <= gesture.after.at && (sample.y - gesture.before.y) * gesture.direction > 1);
    gesture.firstInputDeliveryDelayMs = event ? event.at - gesture.before.at : null;
    gesture.firstScrollAfterInputMs = event && movement ? movement.at - event.at : null;
  }
  const report = { label, selector, profile, mode: await page.locator('html').getAttribute('data-mode'),
    input: touch ? 'native-cdp-touch' : 'native-wheel', geometry, gestures, initial, returned,
    windowDurationMs: capture.stoppedAt - capture.startedAt,
    raf: { count: capture.intervals.length, p95Ms: percentile(capture.intervals, .95),
      maximumMs: capture.intervals.length ? Math.max(...capture.intervals) : null },
    longTasks: { supported: capture.supportedEntryTypes.includes('longtask'), count: capture.longTasks.length,
      totalDurationMs: capture.longTasks.reduce((sum, task) => sum + task.duration, 0),
      maximumDurationMs: capture.longTasks.length ? Math.max(...capture.longTasks.map(task => task.duration)) : 0,
      entries: capture.longTasks },
    longAnimationFrames: capture.longAnimationFrames,
    entranceAttribution: { available: attributionAvailable, source: entranceSource, sourceModuleObserved,
      method: 'Long Animation Frame script sourceURL; whole-page long tasks remain separately recorded',
      scope: 'Only scripts observed in long animation frames; zero observed scripts does not mean all entrance callbacks cost zero milliseconds.',
      observedScripts: sourceScripts.length,
      totalScriptDurationMs: attributionAvailable ? sourceScripts.reduce((sum, script) => sum + script.duration, 0) : null,
      maximumScriptDurationMs: attributionAvailable ? sourceScripts.length ? Math.max(...sourceScripts.map(script => script.duration)) : 0 : null,
      forcedStyleAndLayoutDurationMs: attributionAvailable ? sourceScripts.reduce((sum, script) => sum + (script.forcedStyleAndLayoutDuration || 0), 0) : null,
      scripts: sourceScripts },
    nativeEvents: capture.nativeEvents, scrolls: capture.scrolls,
  };
  try {
    if (failure) throw failure;
    assert.equal(gestures.length, 2, `${label}: both native scroll directions must complete.`);
    assert.ok(gestures.every(gesture => gesture.actualPixels * gesture.direction > 12), `${label}: native scrolling must make forward and reverse progress.`);
    const delivered = capture.nativeEvents.filter(event => touch ? event.type === 'touchmove' : event.type === 'wheel');
    assert.ok(delivered.length > 0 && delivered.every(event => event.trusted && !event.defaultPrevented),
      `${label}: the page must not cancel the native vertical input or replace it with synthetic events.`);
    assert.equal(returned.documentHeight, initial.documentHeight, `${label}: native scrolling/reversal must not change the document height.`);
    assert.ok(Math.abs(returned.y - initial.y) <= .25, `${label}: the exact starting scroll coordinate is restored after measurement.`);
    assert.equal(returned.nodes.length, initial.nodes.length, `${label}: scrolling must not remount entrance content.`);
    for (let index = 0; index < initial.nodes.length; index++) {
      assert.ok(Math.abs(initial.nodes[index].opacity - returned.nodes[index].opacity) < .002
        && initial.nodes[index].matrix.every((value, part) => Math.abs(value - returned.nodes[index].matrix[part]) < .002),
      `${label}: returning to the same scroll coordinate restores the exact rendered pose.`);
      if (profile.reduced) assert.ok(initial.nodes[index].opacity === 1
        && initial.nodes[index].matrix[12] === 0 && initial.nodes[index].matrix[13] === 0,
      `${label}: reduced motion remains static and readable.`);
    }
  } catch (error) { error.motionPerformance = report; throw error; }
  return report;
}
