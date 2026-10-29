import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const out = new URL('../artifacts/v31-footer/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const box = r => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height });
async function settled(page) {
  await page.waitForFunction(() => {
    const old = window.__v31FooterRest;
    if (!old || Math.abs(old.y - scrollY) > .25) window.__v31FooterRest = { y: scrollY, at: performance.now() };
    return performance.now() - window.__v31FooterRest.at > 120;
  });
}
async function geometry(page) {
  return page.locator('[data-footer-row]').evaluate(row => {
    const rect = el => { const r = el.getBoundingClientRect(); return { left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height }; };
    return { row:rect(row), left:rect(row.querySelector('.footer-left')), right:rect(row.querySelector('.footer-details')),
      naavi:rect(document.querySelector('[data-naavi]')), width:innerWidth, documentWidth:document.documentElement.scrollWidth,
      pageHeight:document.documentElement.scrollHeight, footerPosition:getComputedStyle(row.closest('footer')).position,
      rightOverflow:row.querySelector('.footer-details').scrollWidth-row.querySelector('.footer-details').clientWidth,
      leftOverflow:row.querySelector('.footer-left').scrollWidth-row.querySelector('.footer-left').clientWidth };
  });
}
async function counterVisible(page, visible) {
  await page.waitForFunction(expected => {
    const opacity = Number(getComputedStyle(document.querySelector('[data-visit-number]')).opacity);
    return expected ? opacity > .2 : opacity < .01;
  }, visible);
}
async function mode(page, target) {
  await page.evaluate(() => document.activeElement?.blur());
  if (target === 'xray') { await page.keyboard.down('4'); await page.waitForTimeout(1050); await page.keyboard.up('4'); }
  else await page.keyboard.type('333', { delay:65 });
  await page.waitForFunction(expected => document.documentElement.dataset.mode === expected
    && !document.documentElement.hasAttribute('data-mode-snapshot') && !document.documentElement.hasAttribute('data-xray-transition'), target, { timeout:30000 });
}
try {
  for (const { width, reduced } of [{width:1440,reduced:false},{width:390,reduced:false},{width:320,reduced:false},{width:320,reduced:true}]) {
    console.log(`CHECK V3.1 footer ${width}px reduced=${reduced}`);
    const context = await browser.newContext({ viewport:{width,height:844}, deviceScaleFactor:1,
      isMobile:width<600, hasTouch:width<600, reducedMotion:reduced?'reduce':'no-preference' });
    await context.addInitScript(() => {
      if (!sessionStorage.getItem('footer-v31-seeded')) {
        localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({count:12,lastSeen:Date.now()}));
        localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({muted:true,volume:.2}));
        sessionStorage.setItem('footer-v31-seeded','1');
      }
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.setDefaultTimeout(15000);
    try {
      await page.goto(new URL('/#final-secret',base).href,{waitUntil:'networkidle'});
      await page.evaluate(() => scrollTo({ top:document.documentElement.scrollHeight, behavior:'instant' }));
      await settled(page);
      assert.equal(await page.locator('[data-visit-message]').count(),0,'All seven phrase-stage nodes are retired.');
      const count = page.locator('[data-visit-number]'), visit = page.locator('[data-visit-counter-hotspot]');
      assert.equal(await count.textContent(),'VISIT 0012');
      assert.equal(await visit.getAttribute('aria-describedby'),'footer-visit-count');
      assert.equal(await count.evaluate(el=>el.closest('.footer-details')!==null),true,'The counter belongs to the right cluster.');
      assert.equal(await page.locator('.footer-moshlab').getAttribute('href'),'#');
      assert.equal(await page.locator('.footer-moshlab .arrow').count(),1);
      assert.equal(await page.locator('.footer-smash .arrow').count(),1);
      assert.equal(await page.locator('.footer-instagram .arrow').count(),1);
      const parity = await page.locator('.footer-details').evaluate(el => {
        const keys=['fontFamily','fontSize','fontWeight','letterSpacing','lineHeight','color'];
        const read = selector => {const s=getComputedStyle(el.querySelector(selector));return Object.fromEntries(keys.map(key=>[key,s[key]]));};
        return {smash:read('.footer-smash'),instagram:read('.footer-instagram')};
      });
      assert.deepEqual(parity.smash,parity.instagram,'SMASH and Instagram have identical type and colour.');
      const normal = await geometry(page);
      assert.equal(normal.footerPosition,'static','The footer remains in ordinary page flow.');
      assert.ok(normal.documentWidth<=width+1,'Local footer scrolling must never widen the page.');
      assert.ok(Math.abs(normal.naavi.top+normal.naavi.height/2-normal.row.top-normal.row.height/2)<2,'NAAVI aligns with the footer row.');
      assert.ok(!overlap(normal.left,normal.naavi)&&!overlap(normal.right,normal.naavi),'The reserved middle keeps NAAVI clear.');
      await page.mouse.move(width/2,100);
      await page.evaluate(() => document.activeElement?.blur());
      await counterVisible(page,false);
      const beforeReveal = await geometry(page);
      // Native focus must reveal and horizontally expose each interactive item.
      for (const selector of ['.footer-moshlab','[data-visit-counter-hotspot]','.footer-smash','.footer-instagram']) {
        const target=page.locator(selector);
        if(await target.isDisabled())continue;
        await target.focus();
        const r=await target.boundingBox();
        const port=await target.evaluate(el=>{const r=el.closest('.footer-left,.footer-details').getBoundingClientRect();return {left:r.left,right:r.right};});
        assert.ok(r.x>=port.left-1&&r.x+r.width<=port.right+1,`${selector} remains keyboard-reachable inside its local scrollport.`);
      }
      await visit.focus();
      await counterVisible(page,true);
      const afterReveal=await geometry(page);
      assert.equal(afterReveal.pageHeight,beforeReveal.pageHeight,'Revealing the count does not alter page height.');
      assert.deepEqual(afterReveal.row,beforeReveal.row,'Revealing the count does not reflow the footer.');
      assert.equal(await count.textContent(),'VISIT 0012');
      const hintFont=await page.evaluate(()=>{
        const a=getComputedStyle(document.querySelector('[data-other-side-hint]'));
        const b=getComputedStyle(document.querySelector('[data-visit-counter-hotspot]'));
        return {hint:[a.fontFamily,a.fontSize,a.fontWeight,a.letterSpacing],count:[b.fontFamily,b.fontSize,b.fontWeight,b.letterSpacing]};
      });
      assert.deepEqual(hintFont.count,hintFont.hint,'Counter reveal uses the established mode-hint typography.');
      await page.evaluate(()=>document.activeElement?.blur());
      await page.mouse.move(width/2,100);
      await counterVisible(page,false);
      if(width<600)await visit.tap();else await visit.hover();
      await counterVisible(page,true);
      const beforePlaceholder={url:page.url(),y:await page.evaluate(()=>scrollY)};
      await page.locator('.footer-moshlab').click();
      assert.equal(page.url(),beforePlaceholder.url,'The explicit placeholder invents no destination.');
      assert.ok(Math.abs(await page.evaluate(()=>scrollY)-beforePlaceholder.y)<2,'Placeholder activation does not jump to page top.');
      await page.screenshot({path:new URL(`normal-${width}-${reduced}.png`,out).pathname});
      await mode(page,'xray');
      await page.evaluate(() => scrollTo({ top:document.documentElement.scrollHeight, behavior:'instant' }));
      await settled(page);
      if(width<600)await visit.tap();else await visit.focus();
      await counterVisible(page,true);
      const other=await geometry(page);
      assert.ok(other.documentWidth<=width+1);
      assert.ok(Math.abs(other.naavi.top+other.naavi.height/2-other.row.top-other.row.height/2)<2);
      assert.ok(!overlap(other.left,other.naavi)&&!overlap(other.right,other.naavi));
      assert.equal(await count.textContent(),'VISIT 0012');
      await page.screenshot({path:new URL(`other-${width}-${reduced}.png`,out).pathname});
      await mode(page,'normal');
      await page.locator('[data-global-index] summary').click();
      await page.locator('[data-global-index] [data-index-page="work"]').click();
      await page.locator('html[data-page="work"]').waitFor();
      // Work mounts optional carousel enhancements before h4:pagechange
      // refreshes the newly rendered footer. data-page alone is not route completion.
      await page.waitForFunction(() => document.querySelector('[data-visit-number]')?.textContent === 'VISIT 0012');
      assert.equal(await count.textContent(),'VISIT 0012','Internal route changes do not increment personal visits.');
      assert.equal(await page.locator('[data-visit-message]').count(),0);
      assert.deepEqual(errors,[]);
      results.push({width,reduced,normal,other,parity,hintFont,errors});
      console.log(`PASS V3.1 footer ${width}px reduced=${reduced}`);
    } finally { await context.close(); }
  }
} finally {
  await writeFile(new URL('results.json',out),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
  await browser.close();
}
