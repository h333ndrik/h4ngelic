import test from 'node:test';
import assert from 'node:assert/strict';
import { prerenderHTML } from '../scripts/prerender.mjs';
import { resolveRoute } from '../src/routes.js';

const shell = `<!doctype html><html lang="en" data-page="home"><head><!--seo:start--><!--seo:end--></head><body>
<main><!--hero:start--><section class="hero" hidden><h1>h4ngelic</h1></section><!--hero:end-->
<!--content:start--><div id="page-content"></div><!--content:end--></main>
<!--naavi:start--><!--naavi:end--></body></html>`;

test('static routes expose exactly one shared NAAVI with real next destinations before JavaScript', () => {
  const cases = [
    ['/', 'home', '0', '4', '/#selected-work'],
    ['/work', 'work', '1', '3', '/work#jewellery'],
    ['/work/more', 'work', '3', '3', '/'],
    ['/about', 'about', '1', '1', '/'],
    ['/contact', 'home', '0', '4', '/#selected-work'],
  ];
  for (const [path, kind, current, total, destination] of cases) {
    const html = prerenderHTML(shell, resolveRoute(path));
    assert.match(html, new RegExp(`<html[^>]+data-page="${kind}"`));
    assert.equal((html.match(/\bdata-page=/g) || []).length, 1);
    assert.equal((html.match(/\bdata-naavi\b/g) || []).length, 1);
    assert.doesNotMatch(anchorOnly(html), /details|summary/);
    const anchor = html.match(/<a[^>]+data-naavi[^>]*>/)?.[0];
    assert.ok(anchor);
    assert.match(anchor, new RegExp(`data-chapter="${current}"`));
    assert.match(anchor, new RegExp(`data-chapter-total="${total}"`));
    assert.ok(anchor.includes(`href="${destination}"`), `${path} leads to ${destination}`);
  }
});

const anchorOnly = html => html.match(/<a[^>]+data-naavi[^>]*>/)?.[0] || '';
