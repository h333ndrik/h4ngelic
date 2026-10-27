import test from 'node:test';
import assert from 'node:assert/strict';
import { prerenderHTML } from '../scripts/prerender.mjs';
import { resolveRoute } from '../src/routes.js';

const shell = `<!doctype html><html lang="en" data-page="home"><head><!--seo:start--><!--seo:end--></head><body>
<details data-global-index><summary>INDEX +</summary><nav><a href="/work">work</a></nav></details>
<main><!--hero:start--><section class="hero" hidden><h1>h4ngelic</h1></section><!--hero:end-->
<!--content:start--><div id="page-content"></div><!--content:end--></main></body></html>`;

test('static route state hides Home INDEX before JavaScript without hiding interior navigation', () => {
  for (const [path, kind] of [['/', 'home'], ['/work', 'work'], ['/about', 'about'], ['/contact', 'contact']]) {
    const html = prerenderHTML(shell, resolveRoute(path));
    assert.match(html, new RegExp(`<html[^>]+data-page="${kind}"`));
    assert.equal((html.match(/\bdata-page=/g) || []).length, 1);
    assert.match(html, /<details data-global-index>/, 'Interior navigation remains in semantic source.');
  }
});
