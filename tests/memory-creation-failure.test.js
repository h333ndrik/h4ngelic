import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Load the production adapter without its browser-only stylesheet import.
let source = (await readFile(new URL('../src/corruption.js', import.meta.url), 'utf8'))
  .replace(/^import ['"]\.\/corruption\.css['"];?\s*/m, '');
for (const path of ['./data/corruptionSettings.js', './ambient-film.js', './data/livingDecaySettings.js']) {
  source = source.replace(JSON.stringify(path), JSON.stringify(new URL(`../src/${path.slice(2)}`, import.meta.url).href))
    .replace(`'${path}'`, JSON.stringify(new URL(`../src/${path.slice(2)}`, import.meta.url).href));
}
const { createCorruption } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('unavailable Canvas2D leaves no background, listeners or full-size buffers on repeated activation attempts', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const backgrounds = new Set(), canvases = [];
  let listeners = 0;
  const navigator = { hardwareConcurrency: 8, deviceMemory: 8 };
  const view = { navigator, innerWidth: 390, innerHeight: 844,
    matchMedia: () => ({ matches: false, addEventListener() { listeners++; } }),
  };
  const doc = { defaultView: view,
    addEventListener() { listeners++; },
    body: { prepend(element) { backgrounds.add(element); } },
    createElement(tag) {
      const element = { style: {}, dataset: {}, width: 300, height: 150,
        setAttribute() {}, getContext: () => null,
        remove() { backgrounds.delete(this); },
      };
      if (tag === 'canvas') canvases.push(element);
      return element;
    },
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      await assert.rejects(createCorruption({ image: { naturalWidth: 896, naturalHeight: 1344 } }), /Canvas 2D is unavailable/);
      assert.equal(backgrounds.size, 0, 'A failed renderer must remove its already-created DOM container.');
      assert.equal(listeners, 0, 'A failed context must not subscribe a half-created renderer.');
    }
    assert.equal(canvases.length, 6);
    assert.ok(canvases.every(canvas => canvas.width === 1 && canvas.height === 1));
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});
