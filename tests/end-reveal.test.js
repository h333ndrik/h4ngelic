import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sampleEndReveal } from '../src/data/endRevealSettings.js';
import { renderFooter } from '../src/footer.js';

test('end mark is absent until the final section enters the last viewport', () => {
  for (const top of [8000, 1500, 1000, 900]) {
    assert.equal(sampleEndReveal({ top, height: 820, viewportHeight: 1000 }).opacity, 0);
  }
  assert.ok(sampleEndReveal({ top: 600, height: 820, viewportHeight: 1000 }).opacity > 0);
  assert.equal(sampleEndReveal({ top: 100, height: 820, viewportHeight: 1000 }).opacity, 1);
});

test('scroll reveal progresses smoothly and reverses without exceeding its bounds', () => {
  let previous = 0;
  for (let top = 900; top >= 0; top -= 10) {
    const sample = sampleEndReveal({ top, height: 820, viewportHeight: 1000 });
    assert.ok(sample.opacity >= previous && sample.opacity <= 1);
    assert.ok(sample.shift >= 0 && sample.shift <= 48);
    assert.ok(sample.scale >= .96 && sample.scale <= 1);
    previous = sample.opacity;
  }
  assert.equal(sampleEndReveal({ top: 900, height: 820, viewportHeight: 1000 }).opacity, 0);
});

test('reduced motion retains the local reveal without spatial animation', () => {
  assert.equal(sampleEndReveal({ top: 1100, height: 820, viewportHeight: 1000, reduced: true }).opacity, 0);
  assert.equal(sampleEndReveal({ top: 800, height: 820, viewportHeight: 1000, reduced: true }).opacity, 0);
  const sample = sampleEndReveal({ top: 400, height: 820, viewportHeight: 1000, reduced: true });
  assert.equal(sample.opacity, 1);
  assert.equal(sample.shift, 0);
  assert.equal(sample.scale, 1);
  assert.equal(sampleEndReveal({ top: -900, height: 820, viewportHeight: 1000, reduced: true }).opacity, 0);
});

test('invalid layout cannot make an early mark visible', () => {
  for (const patch of [{ top: NaN }, { height: 0 }, { viewportHeight: 0 }]) {
    assert.equal(sampleEndReveal({ top: 0, height: 800, viewportHeight: 1000, ...patch }).opacity, 0);
  }
});

test('exact existing monogram is decorative, homepage-only, behind the original CTA', async () => {
  const html = renderFooter({ home: true, otherSideEnabled: true });
  assert.match(html, /data-end-reveal/);
  assert.match(html, /class="end-reveal-mark" aria-hidden="true"/);
  assert.ok(html.indexOf('end-reveal-mark') < html.indexOf('data-other-side-hint'));
  assert.match(html, /data-mode-hold/);
  assert.doesNotMatch(renderFooter(), /end-reveal/);
  const css = await readFile(new URL('../src/end-reveal.css', import.meta.url), 'utf8');
  assert.match(css, /mask: url\('\/assets\/h4-monogram\.svg'\)/);
  assert.doesNotMatch(css, /position:\s*fixed/);
  assert.match(css, /html\[data-mode='xray'\] \.end-reveal-material::before\s*\{\s*background-image: url\('\/assets\/living-decay-material\.webp'\)/);
  const original = await readFile(new URL('../public/assets/h4ngelic-cursor.svg', import.meta.url), 'utf8');
  const monogram = await readFile(new URL('../public/assets/h4-monogram.svg', import.meta.url), 'utf8');
  const originalFillPath = [...original.matchAll(/<path[^>]*d="([^"]+)"[^>]*>/g)].find(([tag]) => tag.includes('fill="#000000"'))[1];
  assert.equal(monogram.match(/<path[^>]*d="([^"]+)"/)[1], originalFillPath, 'Large mark reuses exact existing geometry, without redrawing or simplifying.');
  assert.match(monogram, /fill-rule="evenodd"/);
  assert.doesNotMatch(monogram, /stroke=/, 'The custom cursor outline is not part of the brand silhouette.');
});

test('queued observer and animation callbacks cannot revive a disposed final section', async () => {
  // Load the actual controller, omitting only its browser stylesheet import.
  const source = (await readFile(new URL('../src/end-reveal.js', import.meta.url), 'utf8'))
    .replace(/^import '\.\/end-reveal\.css';\s*/m, '')
    .replace("'./data/endRevealSettings.js'", JSON.stringify(new URL('../src/data/endRevealSettings.js', import.meta.url).href));
  const { initEndReveal } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const observers = [], frames = new Map(), attributes = new Set(), styles = new Map();
  let requests = 0;
  const view = Object.assign(new EventTarget(), {
    scrollY: 0, innerHeight: 1000,
    matchMedia: () => Object.assign(new EventTarget(), { matches: false }),
    requestAnimationFrame(callback) { frames.set(++requests, callback); return requests; },
    cancelAnimationFrame(id) { frames.delete(id); },
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
  });
  const doc = Object.assign(new EventTarget(), { defaultView: view, hidden: false });
  const section = {
    ownerDocument: doc, dataset: {},
    style: { setProperty: (name, value) => styles.set(name, value), removeProperty: name => styles.delete(name) },
    getBoundingClientRect: () => ({ top: 1400, height: 820 }),
    toggleAttribute(name, present) { if (present) attributes.add(name); else attributes.delete(name); },
    removeAttribute(name) {
      attributes.delete(name);
      delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())];
    },
  };
  const stop = initEndReveal({ querySelector: () => section, nodeType: 1 });
  observers[0].callback([{ isIntersecting: true }]);
  assert.equal(attributes.has('data-end-reveal-active'), true);
  const queuedFrame = [...frames.values()][0];
  stop();
  assert.ok(observers.every(observer => observer.disconnected));
  assert.equal(frames.size, 0);
  const count = requests;
  // Browser observer delivery may already be queued when disconnect executes.
  observers[0].callback([{ isIntersecting: true }]);
  observers[0].callback([{ isIntersecting: false, boundingClientRect: { top: 1400 } }]);
  observers[1].callback();
  queuedFrame();
  assert.equal(requests, count);
  assert.equal(attributes.size, 0);
  assert.equal(styles.size, 0);
  assert.deepEqual(section.dataset, {});
});
