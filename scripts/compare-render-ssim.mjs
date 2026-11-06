#!/usr/bin/env node
/**
 * SSIM-Vergleich zweier Renderings — Entscheidungsgrundlage fuer die Frage
 * "reicht 1024 fuer die gebackene Albedo?".
 *
 * Kein neues Paket: sharp ist bereits Dev-Abhaengigkeit, die SSIM-Rechnung
 * selbst ist Standard (Gauss-Fenster 11x11, sigma 1.5, K1 .01, K2 .03,
 * L = 255) und hier ausgeschrieben.
 *
 * Aufruf:
 *   node scripts/compare-render-ssim.mjs <a.png> <b.png>
 * Ausgabe: JSON auf stdout.
 */
import sharp from 'sharp';

const WINDOW = 11;
const SIGMA = 1.5;
const K1 = 0.01;
const K2 = 0.03;
const L = 255;

const [first, second] = process.argv.slice(2);
if (!first || !second) {
  console.error('Aufruf: node scripts/compare-render-ssim.mjs <a.png> <b.png>');
  process.exit(2);
}

const load = async (path) => {
  const { data, info } = await sharp(path).removeAlpha().toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};

const [a, b] = await Promise.all([load(first), load(second)]);
if (a.width !== b.width || a.height !== b.height) {
  throw new Error(`Bildgroessen unterscheiden sich: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
}

const { width, height } = a;
const count = width * height;
const kernel = Array.from({ length: WINDOW }, (_, index) => {
  const x = index - (WINDOW - 1) / 2;
  return Math.exp(-(x * x) / (2 * SIGMA * SIGMA));
});
const kernelSum = kernel.reduce((sum, value) => sum + value, 0);
const normalized = kernel.map((value) => value / kernelSum);

/** Separierbarer Gauss-Filter: erst horizontal, dann vertikal. */
const blur = (source) => {
  const horizontal = new Float64Array(count);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = 0; k < WINDOW; k += 1) {
        const sampleX = Math.min(width - 1, Math.max(0, x + k - (WINDOW - 1) / 2));
        sum += source[y * width + sampleX] * normalized[k];
      }
      horizontal[y * width + x] = sum;
    }
  }
  const vertical = new Float64Array(count);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = 0; k < WINDOW; k += 1) {
        const sampleY = Math.min(height - 1, Math.max(0, y + k - (WINDOW - 1) / 2));
        sum += horizontal[sampleY * width + x] * normalized[k];
      }
      vertical[y * width + x] = sum;
    }
  }
  return vertical;
};

const aValues = new Float64Array(count);
const bValues = new Float64Array(count);
const aSquare = new Float64Array(count);
const bSquare = new Float64Array(count);
const ab = new Float64Array(count);
let absolute = 0;
let squared = 0;
for (let index = 0; index < count; index += 1) {
  const av = a.data[index];
  const bv = b.data[index];
  aValues[index] = av;
  bValues[index] = bv;
  aSquare[index] = av * av;
  bSquare[index] = bv * bv;
  ab[index] = av * bv;
  absolute = Math.max(absolute, Math.abs(av - bv));
  squared += (av - bv) ** 2;
}

const muA = blur(aValues);
const muB = blur(bValues);
const muASquare = blur(aSquare);
const muBSquare = blur(bSquare);
const muAB = blur(ab);

const c1 = (K1 * L) ** 2;
const c2 = (K2 * L) ** 2;
let total = 0;
for (let index = 0; index < count; index += 1) {
  const varianceA = muASquare[index] - muA[index] ** 2;
  const varianceB = muBSquare[index] - muB[index] ** 2;
  const covariance = muAB[index] - muA[index] * muB[index];
  const numerator = (2 * muA[index] * muB[index] + c1) * (2 * covariance + c2);
  const denominator = (muA[index] ** 2 + muB[index] ** 2 + c1) * (varianceA + varianceB + c2);
  total += numerator / denominator;
}

const mse = squared / count;
console.log(JSON.stringify({
  first,
  second,
  size: { width, height },
  ssim: Number((total / count).toFixed(6)),
  psnrDb: mse === 0 ? null : Number((10 * Math.log10((L * L) / mse)).toFixed(3)),
  maxAbsDiff: absolute,
}, null, 2));
