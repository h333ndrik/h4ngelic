import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../artifacts/master-foundation/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];

async function state(page) {
  return page.locator('[data-naavi]').evaluate(link => {
    const box = link.getBoundingClientRect();
    return { current: Number(link.dataset.chapter), total: Number(link.dataset.chapterTotal), href: link.getAttribute('href'), label: link.getAttribute('aria-label'),
      left: box.left, right: box.right, top: box.top, bottom: box.bottom, center: (box.left + box.right)/2,
      text: link.textContent.trim().replace(/\s+/g,' '), hover: link.hasAttribute('data-ui-interactive') };
  });
}
async function at(page, current, total) {
  await page.waitForFunction(({current,total}) => {
    const link = document.querySelector('[data-naavi]');
    return Number(link?.dataset.chapter) === current && Number(link?.dataset.chapterTotal) === total;
  }, { current, total });
}
async function restingAt(page, selector) {
  await page.waitForFunction(selector => {
    const target = document.querySelector(selector);
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const expected = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight,
      target.getBoundingClientRect().top + scrollY - margin));
    return Math.abs(scrollY - expected) < 3;
  }, selector);
}

try {
  for (const width of (process.env.H4_NAAVI_WIDTHS || '1440,390,320').split(',').map(Number)) for (const reduced of process.env.H4_NAAVI_REDUCED_ONLY ? [true] : [false,true]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.addInitScript(() => {
        window.__naaviGL = 0;
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type,...args) {
          if (/webgl/i.test(type)) window.__naaviGL++;
          return original.call(this,type,...args);
        };
      });
      await page.goto(`${base}/about`, { waitUntil:'networkidle' });
      await at(page,1,1);
      assert.equal(await page.evaluate(() => window.__naaviGL),0,'A cold About must never initialize WebGL.');
      assert.equal(await page.locator('[data-naavi]').count(),1);
      assert.equal(await page.locator('[data-global-index], .global-index, summary').count(),0);
      const about = await state(page);
      assert.match(about.label,/01 \/ 01, about/); assert.equal(about.href,'/'); assert.ok(about.hover);
      assert.ok(Math.abs(about.center-width/2)<1 && about.bottom<=844 && about.bottom>=824);
      await page.locator('[data-naavi]').focus(); await page.keyboard.press('Enter');
      await page.locator('html[data-page="home"]').waitFor(); await at(page,0,4);
      assert.equal(await page.locator('.masthead .edition,.hero .identity').count(),0);
      const sequence=[];
      for (const [current,selector] of [[1,'#selected-work'],[2,'#about-preview'],[3,'#contact'],[4,'#final-secret'],[0,'#home-hero']]) {
        await page.locator('[data-naavi]').click();
        await at(page,current,4); await restingAt(page,selector);
        const pose=await state(page); assert.ok(Math.abs(pose.center-width/2)<1 && Math.abs(pose.bottom-about.bottom)<1);
        sequence.push(pose);
      }
      // Reverse ordinary scroll must update the same component, without a click.
      await page.locator('#about-preview').evaluate(element => { document.activeElement?.blur(); element.scrollIntoView({behavior:'instant',block:'start'}); });
      await at(page,2,4);
      await page.locator('#contact').evaluate(element => { element.focus({preventScroll:true}); element.scrollIntoView({behavior:'instant',block:'start'}); });
      await at(page,3,4);
      const field = page.locator('#contact [data-inquiry-contact]');
      await field.evaluate(element => { const r=element.getBoundingClientRect(); scrollTo({top:scrollY+r.bottom-(innerHeight-40),behavior:'instant'}); element.focus({preventScroll:true}); });
      const fieldBottom = await field.evaluate(element => element.getBoundingClientRect().bottom);
      assert.ok(fieldBottom<=(await state(page)).top-3,'Focused contact fields stay above the fixed NAAVI dock.');
      await field.fill('@test_handle'); await page.keyboard.type('444');
      assert.equal(await page.locator('html').getAttribute('data-mode'),'normal','Typing never invokes a mode shortcut.');
      const fixed = await state(page); assert.ok(Math.abs(fixed.bottom-about.bottom)<1);

      await page.goto(`${base}/work`,{waitUntil:'networkidle'}); await at(page,1,3);
      const work=[];
      for (const [current,selector] of [[2,'#jewellery'],[3,'#more']]) {
        await page.locator('[data-naavi]').click(); await at(page,current,3); await restingAt(page,selector);
        work.push(await state(page));
      }
      assert.equal((await state(page)).href,'/');
      assert.equal(await page.locator('.work-subfilters').count(),0);
      await page.locator('[data-naavi]').click(); await page.locator('html[data-page="home"]').waitFor(); await at(page,0,4);
      assert.deepEqual(errors,[]);
      reports.push({width,reduced,about,sequence,work,fieldBottom,errors});
      console.log(`PASS NAAVI ${width}px reduced=${reduced}: Home00→04→00, Work01→03→Home, About01/01, scroll sync, fixed dock, focus/input and cold-interior safety.`);
    } finally { await context.close(); }
  }
  await writeFile(new URL(process.env.H4_NAAVI_REDUCED_ONLY ? 'naavi-focus.json' : 'naavi.json',output),JSON.stringify({checkedAt:new Date().toISOString(),reports},null,2));
} finally { await browser.close(); }
