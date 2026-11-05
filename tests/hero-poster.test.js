import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('hero poster configuration is injected ahead of layout and application styles', async () => {
  const [html, config, vite, prerender, cursor] = await Promise.all([
    source('index.html'), source('src/data/heroPosterSettings.js'), source('vite.config.js'), source('scripts/prerender.mjs'),
    source('src/cursor.css'),
  ]);
  assert.match(config, /src: '\/assets\/wordmark-fallback\.svg'/);
  assert.match(config, /fadeDurationMs: 900/);
  assert.match(config, /desktop: '\/assets\/tattoo-texture\.webp'/);
  assert.match(config, /mobile: '\/assets\/tattoo-texture-640\.webp'/);
  assert.match(html, /__H4_HERO_POSTER_URL__/);
  assert.match(html, /translate3d\(0, calc\(-100% - 32px\), 0\)/);
  assert.match(html, /transition: transform 1100ms cubic-bezier\(\.16, 1, \.3, 1\)/);
  assert.doesNotMatch(html, /data-h4-cursor|data-cursor-preload|h4-custom-cursor/,
    'The native cursor needs no overlay markup, preload or runtime class.');
  assert.match(cursor, /--h4-cursor: url\('\/assets\/h4ngelic-cursor\.svg'\) 8 2, url\('\/assets\/h4ngelic-cursor\.png'\) 8 2, auto;/);
  assert.match(html, /data-hero-poster-critical/);
  assert.match(html, /id="hero-preloads"/);
  assert.match(html, /rel="modulepreload" href="\/src\/main\.js"/);
  assert.match(html, /wordmark\.typeface\.json" as="fetch"/);
  assert.match(html, /__H4_HERO_ARTWORK_DESKTOP__.*fetchpriority="high"/);
  assert.match(prerender, /route\.kind !== 'home'.*wordmark-fallback/s);
  assert.ok(html.indexOf('data-hero-poster-critical') < html.indexOf('<!--seo:start-->'));
  assert.match(vite, /name: 'h4ngelic-hero-poster'/);
  assert.match(vite, /replaceAll\('__H4_HERO_POSTER_URL__'/);
});

test('first-paint poster contains no literal wordmark text and remains available without WebGL', async () => {
  const [html, css] = await Promise.all([source('index.html'), source('src/style.css')]);
  assert.match(html, /<div id="fallback" class="fallback" data-hero-poster role="img" aria-label="h4ngelic wordmark"><\/div>/);
  assert.doesNotMatch(html, /id="fallback"[^>]*>h4ngelic<\/div>/);
  assert.match(css, /\.stage\.is-ready \.fallback \{ opacity: 0; \}/);
  assert.match(css, /\.stage\.is-poster-static \.fallback \{ opacity: 1; \}/);
  assert.doesNotMatch(css, /h4-custom-cursor/, 'The poster no longer keys off a cursor class.');
  assert.match(css, /background: #242424/);
});
