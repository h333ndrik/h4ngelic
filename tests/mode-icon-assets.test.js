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

const previousViewports = {
  base: { width: '27.2', height: '40.8' },
  hover: { width: '28.832', height: '43.248' },
  pressed: { width: '26.112', height: '39.168' },
};

test('V3.1 reduces all cursor viewports exactly5% while retaining original symbol bytes and alternate alpha geometry', async () => {
  for (const state of ['base', 'hover', 'pressed']) {
    const original = await source(settings.cursor.normal[state]);
    const alternate = (await source(settings.cursor.other[state])).toString();
    const svg = original.toString();
    const root = svg.match(/^<svg[^>]*>/)[0];
    for (const attribute of ['width', 'height']) {
      const actual = Number(root.match(new RegExp(`${attribute}="([^"]+)"`))[1]);
      assert.ok(Math.abs(actual - Number(previousViewports[state][attribute]) * .95) < 1e-8,
        `${state} ${attribute} must decrease exactly5%.`);
    }
    const normalized = svg.replace(/^<svg[^>]*>/, tag => tag
      .replace(/\bwidth="[^"]+"/, `width="${previousViewports[state].width}"`)
      .replace(/\bheight="[^"]+"/, `height="${previousViewports[state].height}"`));
    assert.equal(createHash('sha256').update(normalized).digest('hex'), originalHashes[state],
      'Only the approved viewport dimensions may change; original supplied glyph bytes remain exact.');
    assert.deepEqual(geometry(alternate), geometry(original.toString()));
    assert.deepEqual(dimensions(alternate), dimensions(original.toString()));
    assert.equal((alternate.match(/fill-rule="evenodd"/g) || []).length, 1);
    assert.match(alternate, /stroke="#ffffff" stroke-width="43"/);
    assert.match(alternate, /href="data:image\/png;base64,/);
    assert.doesNotMatch(alternate, /href="https?:|<script|<filter/);
  }
});

test('alternate SVG pixels retain the alpha silhouette at native size and4× with bounded fractional-viewport rounding', async () => {
  for (const state of ['base', 'hover', 'pressed']) {
    const [normal, other] = await Promise.all([source(settings.cursor.normal[state]), source(settings.cursor.other[state])]);
    for (const density of [72, 288]) {
      const [left, right] = await Promise.all([normal, other].map(svg => sharp(svg, { density }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
      assert.deepEqual(left.info, right.info);
      let colored = 0, alphaRoundingPixels = 0;
      for (let index = 0; index < left.data.length; index += 4) {
        const alphaDifference = Math.abs(left.data[index + 3] - right.data[index + 3]);
        assert.ok(alphaDifference <= 1, 'No silhouette pixel may change by more than one alpha quantization level.');
        alphaRoundingPixels += alphaDifference > 0;
        if (Math.abs(left.data[index] - right.data[index]) + Math.abs(left.data[index + 1] - right.data[index + 1]) + Math.abs(left.data[index + 2] - right.data[index + 2]) > 30) colored++;
      }
      assert.ok(alphaRoundingPixels <= 2, 'The fractional5% viewport may round at most two edge pixels by one alpha level; paths/viewBox remain exact.');
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


test('cursor material masks remain exact when rasterized in the original logical viewport', async () => {
  for (const state of ['base', 'hover', 'pressed']) {
    const images = await Promise.all(['normal', 'other'].map(async mode => {
      const svg = (await source(settings.cursor[mode][state])).toString().replace(/^<svg[^>]*>/, tag => tag
        .replace(/\bwidth="[^"]+"/, `width="${previousViewports[state].width}"`)
        .replace(/\bheight="[^"]+"/, `height="${previousViewports[state].height}"`));
      return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    }));
    assert.deepEqual(images[0].info, images[1].info);
    for (let index = 3; index < images[0].data.length; index += 4) assert.equal(images[0].data[index], images[1].data[index]);
  }
});
