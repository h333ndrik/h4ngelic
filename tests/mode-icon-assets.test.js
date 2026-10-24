import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { modeIconSettings as settings } from '../src/data/modeIconSettings.js';

const source = path => readFile(new URL(`../public${path}`, import.meta.url));
const geometry = svg => [...svg.matchAll(/<path d="([^"]+)"/g)].map(match => match[1]);
const dimensions = svg => svg.match(/<svg[^>]+>/)[0].match(/(?:width|height|viewBox)="[^"]+"/g);
const originalHashes = {
  base: 'd4bc319b7806804deea01cb616c03dc419aa7c3b2bd48ea644a9c03937c15d1b',
  hover: '1bbe1f72c4ac97aa74c100566ebe72e5f6979f3bb106b7552cddb0a22a95205e',
  pressed: '33e9fbc08561183352cf35b9c4ca46ee1fff3a760a2df0004ab56c83bf7ee3e3',
};

test('normal cursor assets remain byte-identical; alternate material retains every original path and dimension', async () => {
  for (const state of ['base', 'hover', 'pressed']) {
    const original = await source(settings.cursor.normal[state]);
    const alternate = (await source(settings.cursor.other[state])).toString();
    assert.equal(createHash('sha256').update(original).digest('hex'), originalHashes[state]);
    assert.deepEqual(geometry(alternate), geometry(original.toString()));
    assert.deepEqual(dimensions(alternate), dimensions(original.toString()));
    assert.equal((alternate.match(/fill-rule="evenodd"/g) || []).length, 1);
    assert.match(alternate, /stroke="#ffffff" stroke-width="43"/);
    assert.match(alternate, /href="data:image\/png;base64,/);
    assert.doesNotMatch(alternate, /href="https?:|<script|<filter/);
  }
});

test('alternate SVG pixels preserve the exact alpha mask at native size and 4×', async () => {
  for (const state of ['base', 'hover', 'pressed']) {
    const [normal, other] = await Promise.all([source(settings.cursor.normal[state]), source(settings.cursor.other[state])]);
    for (const density of [72, 288]) {
      const [left, right] = await Promise.all([normal, other].map(svg => sharp(svg, { density }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
      assert.deepEqual(left.info, right.info);
      let colored = 0;
      for (let index = 0; index < left.data.length; index += 4) {
        assert.equal(left.data[index + 3], right.data[index + 3], 'Outline, holes and antialiased perimeter must remain pixel-identical.');
        if (Math.abs(left.data[index] - right.data[index]) + Math.abs(left.data[index + 1] - right.data[index + 1]) + Math.abs(left.data[index + 2] - right.data[index + 2]) > 30) colored++;
      }
      assert.ok(colored > 30, 'The material must visibly change actual interior pixels.');
    }
  }
});

test('16/32px favicons are transparent, recognizable and share an exact mode-independent silhouette', async () => {
  for (const size of [16, 32]) {
    const [left, right] = await Promise.all(['normal', 'other'].map(async mode => {
      const file = await source(settings.favicon[mode][size]);
      assert.ok(file.length < 2048);
      return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    }));
    assert.equal(left.info.width, size); assert.equal(left.info.height, size);
    let visible = 0, changed = 0;
    for (let index = 0; index < left.data.length; index += 4) {
      assert.equal(left.data[index + 3], right.data[index + 3]);
      if (left.data[index + 3] > 0) visible++;
      if (Math.abs(left.data[index] - right.data[index]) + Math.abs(left.data[index + 1] - right.data[index + 1]) + Math.abs(left.data[index + 2] - right.data[index + 2]) > 30) changed++;
    }
    assert.ok(visible > size && visible < size * size * .8);
    assert.ok(changed > 5);
  }
});
