import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Broad integration contract for V3's changed persistent UI. Carousel/upload
// details have dedicated suites; this checks the actual shared route lifecycle.
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../artifacts/smart-continuation-v3/', import.meta.url);
await mkdir(output, { recursive: true });
const allProfiles = [
  { width: 1440, reduced: false }, { width: 800, reduced: true },
  { width: 390, reduced: false }, { width: 320, reduced: true },
];
const profiles = process.env.H4_V3_WIDTHS
  ? allProfiles.filter(profile => process.env.H4_V3_WIDTHS.split(',').map(Number).includes(profile.width)) : allProfiles;
const reports = [], failures = [];
const overlap = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const save = () => writeFile(new URL('smart-v3.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
async function chapter(page, current, total) {
  await page.waitForFunction(({current,total}) => {
    const link = document.querySelector('[data-naavi]');
    return Number(link?.dataset.chapter) === current && Number(link?.dataset.chapterTotal) === total;
  }, { current, total });
}
async function geometry(page) {
  return page.evaluate(() => {
    const rect = element => { const r=element.getBoundingClientRect(); return { left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height }; };
    const selectors = { brand:'[data-floating-brand]', index:'[data-global-index] summary', naavi:'[data-naavi]' };
    const boxes = Object.fromEntries(Object.entries(selectors).map(([name,selector]) => [name,rect(document.querySelector(selector))]));
    return { ...boxes, width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,
      blends: Object.fromEntries(Object.entries(selectors).map(([name,selector]) => [name,getComputedStyle(document.querySelector(selector)).mixBlendMode])) };
  });
}
async function openIndex(page) {
  const menu=page.locator('[data-global-index]');
  if (!await menu.evaluate(el=>el.open)) await menu.locator('summary').click();
  await page.waitForFunction(()=>document.querySelector('[data-global-index]')?.open === true);
  return menu;
}
async function switchMode(page, next, reduced) {
  await page.evaluate(() => document.activeElement?.blur());
  const started=Date.now();
  if(next==='xray') { await page.keyboard.down('4'); await page.waitForTimeout(1100); await page.keyboard.up('4'); }
  else { for (let n=0;n<3;n++) { await page.keyboard.press('3'); await page.waitForTimeout(80); } }
  await page.waitForFunction(mode=>document.documentElement.dataset.mode===mode,next,{timeout:45000});
  await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-mode-snapshot')&&!document.documentElement.hasAttribute('data-memory-mosh-preparing'),null,{timeout:45000});
  const result=await page.evaluate(mode=>({ mode, event:window.__v3ModeEvents.filter(event=>event.mode===mode).at(-1),
    width:document.documentElement.scrollWidth, viewport:innerWidth, modeFlag:document.documentElement.dataset.mode }),next);
  assert.equal(result.modeFlag,next);
  assert.ok(result.width<=result.viewport+1,'Reality switching must not change page width.');
  assert.ok(result.event,'A real keyboard switch must dispatch the existing mode event.');
  if(!reduced && result.event.captured) assert.equal(result.event.duration,1400,'Captured transitions use the approved 1.4-second target in both directions.');
  return {...result,observedGestureToCleanupMs:Date.now()-started};
}

try {
  for(const profile of profiles) {
    console.log(`CHECK V3 ${profile.width}px reduced=${profile.reduced}`);
    const context=await browser.newContext({viewport:{width:profile.width,height:844},deviceScaleFactor:1,
      isMobile:profile.width<600,hasTouch:profile.width<600,reducedMotion:profile.reduced?'reduce':'no-preference'});
    const page=await context.newPage(), errors=[], requested=[];
    page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(30000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>requested.push(new URL(request.url()).pathname));
    await page.addInitScript(() => {
      // The local personal memory deliberately starts at stage3. This is a
      // private test record, never a public visitor statistic.
      if(!sessionStorage.getItem('h4-v3-seeded')) {
        localStorage.setItem('h4ngelic.visits.v1',JSON.stringify({count:3,lastSeen:Date.now()}));
        localStorage.setItem('h4ngelic.audio.v1',JSON.stringify({muted:true,volume:.37}));
        sessionStorage.setItem('h4-v3-seeded','1');
      }
      window.__v3GL=0; window.__v3Audio=0; window.__v3ModeEvents=[];
      const context=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args) {
        if(/webgl/i.test(type)) window.__v3GL++;
        return context.call(this,type,...args);
      };
      if(window.AudioContext) window.AudioContext=new Proxy(window.AudioContext,{construct(target,args,newTarget) {
        window.__v3Audio++; return Reflect.construct(target,args,newTarget);
      }});
      document.addEventListener('h4:modechange',event=>window.__v3ModeEvents.push({...event.detail,at:performance.now()}));
    });
    try {
      await page.goto(new URL('/work',base).href,{waitUntil:'networkidle'});
      await chapter(page,1,3);
      assert.equal(await page.locator('[data-inquiry-form]').count(),0,'Work cannot mount a second contact form.');
      assert.equal(await page.locator('[data-global-index]').count(),1);
      assert.equal(await page.locator('[data-naavi]').count(),1);
      assert.equal(await page.locator('[data-floating-brand]').count(),1);
      const coldWork=await page.evaluate(()=>({gl:window.__v3GL,audio:window.__v3Audio}));
      assert.equal(coldWork.gl,0); assert.equal(coldWork.audio,0,'No audio is initialized simply by loading an interior page.');
      assert.ok(!requested.some(path=>/\/src\/main\.js$|\/three(?:[/.]|$)/i.test(path)),'A cold Work route cannot download the Three.js scene.');
      const workGeometry=await geometry(page);
      assert.ok(workGeometry.pageWidth<=profile.width+1);
      assert.ok(Math.abs((workGeometry.naavi.left+workGeometry.naavi.right)/2-profile.width/2)<1);
      for(const name of ['brand','index','naavi']) {
        const box=workGeometry[name]; assert.ok(box.left>=0&&box.right<=profile.width+1&&box.top>=0&&box.bottom<=844);
        assert.ok(box.height>=44,`${name} retains a touch-sized hit area.`);
      }
      assert.ok(!overlap(workGeometry.brand,workGeometry.index));
      await page.screenshot({path:new URL(`v3-work-${profile.width}.png`,output).pathname});
      const summary=page.locator('[data-global-index] summary');
      await summary.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(()=>document.querySelector('[data-global-index]')?.open);
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('[data-global-index]')?.open);
      assert.equal(await summary.evaluate(el=>el===document.activeElement),true,'Escape returns focus to the INDEX trigger.');
      await openIndex(page);
      if(profile.width<600) await page.touchscreen.tap(Math.round(profile.width/2),400);
      else await page.mouse.click(Math.round(profile.width/2),400);
      await page.waitForFunction(()=>!document.querySelector('[data-global-index]')?.open);
      let menu=await openIndex(page);
      await menu.locator('[data-index-page="about"]').click();
      await page.locator('html[data-page="about"]').waitFor(); await chapter(page,1,1);
      assert.equal(await menu.evaluate(el=>el.open),false,'Choosing a destination closes INDEX.');
      assert.equal(await page.locator('[data-inquiry-form]').count(),0,'More About has no separate contact form.');
      assert.equal(await page.evaluate(()=>window.__v3GL),0);
      menu=await openIndex(page);
      assert.equal(await menu.locator('[data-index-page="contact"]').getAttribute('href'),'/#contact');
      await menu.locator('[data-index-page="contact"]').click();
      await page.locator('html[data-page="home"]').waitFor(); await chapter(page,3,4);
      await page.waitForFunction(()=>{ const target=document.getElementById('contact'); const margin=parseFloat(getComputedStyle(target).scrollMarginTop)||0; const expected=Math.max(0,Math.min(document.documentElement.scrollHeight-innerHeight,target.getBoundingClientRect().top+scrollY-margin)); return Math.abs(scrollY-expected)<3; });
      assert.equal(new URL(page.url()).pathname,'/'); assert.equal(new URL(page.url()).hash,'#contact');
      assert.equal(await page.locator('[data-inquiry-form]').count(),1);
      assert.equal(await page.evaluate(()=>window.__v3GL),0,'Cross-page Contact does not initialize a hero outside the viewport.');
      assert.equal(await page.locator('#reveal-control').count(),0,'Only the obsolete Reveal UI is removed.');
      const crossContact=await geometry(page);
      await page.screenshot({path:new URL(`v3-contact-${profile.width}.png`,output).pathname});
      await page.goBack(); await page.locator('html[data-page="about"]').waitFor(); await chapter(page,1,1);
      await page.goForward(); await page.locator('html[data-page="home"]').waitFor(); await chapter(page,3,4);
      assert.equal(await page.locator('[data-inquiry-form]').count(),1,'History traversal retains exactly one form.');
      await page.goto(new URL('/contact?artwork=green-black-original',base).href,{waitUntil:'networkidle'});
      await chapter(page,3,4);
      assert.equal(new URL(page.url()).pathname,'/'); assert.equal(new URL(page.url()).hash,'#contact');
      assert.equal(new URL(page.url()).searchParams.get('artwork'),'green-black-original');
      assert.equal(await page.locator('[data-inquiry-artwork]').inputValue(),'green-black-original');
      assert.equal(await page.evaluate(()=>window.__v3GL),0);

      // The original final-area logo remains intact, and private local visitor
      // memory survives real internal routes without page-view increments.
      const counter=page.locator('[data-artist-footer] [data-visit-number]');
      assert.equal(await counter.textContent(),'visit 3');
      await page.locator('[data-artist-footer]').scrollIntoViewIfNeeded();
      await page.evaluate(()=>document.activeElement?.blur());
      if(profile.width>=600) await page.mouse.move(profile.width/2,100);
      const phrase=page.locator('[data-artist-footer] [data-visit-message]');
      assert.equal(await phrase.textContent(),'we’re practically friends now.');
      assert.equal(await phrase.evaluate(el=>getComputedStyle(el).opacity),'0','The memory phrase does not stay permanently visible.');
      const foot=await page.locator('[data-artist-footer]').evaluate(el=>{
        const box=target=>{const r=target.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
        return {brand:box(el.querySelector('.footer-brand')),visit:box(el.querySelector('[data-visit-counter-hotspot]')),
          details:box(el.querySelector('.footer-details')),naavi:box(document.querySelector('[data-naavi]')),
          width:document.documentElement.scrollWidth, smashDisabled:el.querySelector('[data-smash]').disabled,
          links:[...el.querySelector('.footer-details').children].map(child=>child.textContent.trim())};
      });
      assert.ok(foot.visit.left-foot.brand.right>=18,'Copyright and the lowercase count have deliberate breathing room.');
      assert.ok(!overlap(foot.brand,foot.visit)); assert.ok(!overlap(foot.visit,foot.details));
      assert.ok(!overlap(foot.brand,foot.naavi)&&!overlap(foot.visit,foot.naavi)&&!overlap(foot.details,foot.naavi),'Footer elements clear the fixed NAAVI.');
      assert.equal(foot.smashDisabled,true,'Missing approved private audio stays unavailable rather than faking playback.');
      assert.deepEqual(foot.links,['smash','instagram','berlin, de']);
      const visitButton=page.locator('[data-visit-counter-hotspot]');
      if(profile.width<600) await visitButton.tap(); else { await visitButton.focus(); await page.keyboard.press('Enter'); }
      await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('[data-artist-footer] [data-visit-message]')).opacity)>.2);
      assert.equal(await counter.textContent(),'visit 3');
      const phraseBounds=await phrase.evaluate(async el=>{
        const {visitorMessages}=await import('/src/data/easterSettings.js');
        const original=el.textContent;
        const boxes=visitorMessages.map(text=>{el.textContent=text;const r=el.getBoundingClientRect();return {text,left:r.left,right:r.right};});
        el.textContent=original;return boxes;
      });
      assert.ok(phraseBounds.every(box=>box.left>=0&&box.right<=profile.width+1),'Every personal greeting must fit within the viewport.');
      const footerAlignment=await page.locator('.footer-details').evaluate(el=>[...el.children].map(child=>{const r=child.getBoundingClientRect();return {center:r.top+r.height/2,height:r.height};}));
      assert.ok(Math.max(...footerAlignment.map(b=>b.center))-Math.min(...footerAlignment.map(b=>b.center))<2,'Footer links share one visual baseline.');
      await page.screenshot({path:new URL(`v3-footer-${profile.width}.png`,output).pathname});

      // Sound UI is available on Home. Jump directly back to the hero through
      // the actual floating brand to exercise its route destination too.
      await page.locator('[data-floating-brand]').click();
      await chapter(page,0,4);
      await page.waitForFunction(()=>scrollY<2);
      await page.locator('[data-sound-control]').waitFor();
      assert.equal(await page.locator('[data-mode-mute]').textContent(),'sound off');
      assert.equal(await page.locator('[data-sound-volume]').inputValue(),'37');
      assert.equal(await page.evaluate(()=>window.__v3Audio),0,'Hero loading alone does not autoplay or prime audio.');
      const arrow=page.locator('[data-sound-volume-toggle]');
      await arrow.focus(); await page.keyboard.press('Enter');
      const slider=page.locator('[data-sound-volume]');
      await slider.waitFor({state:'visible'});
      assert.equal(await slider.evaluate(el=>el===document.activeElement),true,'Keyboard opening focuses the range control.');
      await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
      assert.equal(await slider.inputValue(),'1');
      const soundGeometry=await page.locator('[data-sound-control]').evaluate(el=>{
        const b=el.getBoundingClientRect(),p=el.querySelector('[data-sound-volume-popup]').getBoundingClientRect();
        return {button:{left:b.left,right:b.right,top:b.top,bottom:b.bottom},popup:{left:p.left,right:p.right,top:p.top,bottom:p.bottom}};
      });
      assert.ok(soundGeometry.popup.bottom<=soundGeometry.button.top,'Volume opens above SOUND.');
      assert.ok(soundGeometry.popup.left>=0&&soundGeometry.popup.right<=profile.width);
      await page.keyboard.press('Escape');
      assert.equal(await arrow.getAttribute('aria-expanded'),'false');
      await arrow.click();
      if(profile.width<600) await page.touchscreen.tap(Math.round(profile.width/2),100); else await page.mouse.click(profile.width/2,100);
      assert.equal(await arrow.getAttribute('aria-expanded'),'false');
      await page.locator('[data-mode-mute]').click();
      await page.waitForFunction(()=>document.querySelector('[data-mode-mute]')?.textContent==='sound on');
      const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem('h4ngelic.audio.v1')));
      assert.equal(persisted.muted,false); assert.equal(persisted.volume,.01);
      await page.reload({waitUntil:'networkidle'}); await chapter(page,0,4);
      assert.equal(await page.locator('[data-mode-mute]').textContent(),'sound on');
      assert.equal(await page.locator('[data-sound-volume]').inputValue(),'1');
      assert.equal(await page.evaluate(()=>window.__v3Audio),0,'Persisted unmuted preference still does not autoplay.');
      const homeGeometry=await geometry(page);
      const controls=await page.locator('.hero .controls').evaluate(el=>{
        const b=el.getBoundingClientRect(),nav=document.querySelector('.hero-nav').getBoundingClientRect();
        const box=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom});
        return {box:box(b),nav:box(nav),labels:[...el.querySelectorAll('button')].map(button=>button.textContent.trim()),
          buttons:[...el.querySelectorAll('button')].map(button=>{const r=button.getBoundingClientRect();return {...box(r),height:r.height};})};
      });
      assert.ok(!overlap(controls.box,controls.nav)&&!overlap(controls.box,homeGeometry.naavi)&&!overlap(controls.nav,homeGeometry.naavi));
      assert.ok(controls.buttons.every(button=>button.height>=44&&button.left>=0&&button.right<=profile.width));
      assert.ok(!controls.labels.some(label=>/reveal/i.test(label)));
      await page.screenshot({path:new URL(`v3-home-${profile.width}.png`,output).pathname});
      // Keep actual cue playback muted during visual testing; this state also
      // must survive both reality switches.
      await page.locator('[data-mode-mute]').click();
      await page.locator('[data-floating-brand]').focus();
      const entry=await switchMode(page,'xray',profile.reduced);
      const otherGeometry=await geometry(page);
      assert.ok(!overlap(otherGeometry.brand,otherGeometry.index));
      await openIndex(page);
      await page.waitForTimeout(profile.reduced?0:300);
      await page.screenshot({path:new URL(`v3-other-side-index-${profile.width}.png`,output).pathname});
      await page.keyboard.press('Escape');
      const exit=await switchMode(page,'normal',profile.reduced);
      assert.equal(await page.locator('[data-mode-mute]').textContent(),'sound off');
      assert.deepEqual(errors,[]);
      reports.push({...profile,coldWork,workGeometry,crossContact,foot,soundGeometry,homeGeometry,controls,otherGeometry,entry,exit,persisted,errors});
      console.log(`PASS V3 ${profile.width}px: INDEX/NAAVI, Home contact/history, local memory, sound popup/persistence, both realities.`);
      await save();
    } catch(error) {
      failures.push({...profile,error:error.stack,errors,url:page.url()});
      await page.screenshot({path:new URL(`v3-failure-${profile.width}.png`,output).pathname}).catch(()=>{});
      await save(); throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
