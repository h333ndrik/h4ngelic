import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const out = new URL('../artifacts/v71/', import.meta.url); await mkdir(out,{recursive:true});
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
try {
 for (const profile of [{width:1000,reduced:false},{width:390,reduced:false},{width:320,reduced:false},{width:390,reduced:true}]) {
  const {width,reduced}=profile; console.log(`START memory ${width} reduce=${reduced}`);
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,isMobile:width<600,hasTouch:width<600,reducedMotion:reduced?'reduce':'no-preference'});
  const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.__memoryProbe={frames:[],canvases:[],webgl:0,initial:null};
   const make=document.createElement.bind(document);
   document.createElement=function(tag,...args){const node=make(tag,...args);if(String(tag).toLowerCase()==='canvas')window.__memoryProbe.canvases.push(node);return node;};
   const get=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){if(/webgl/i.test(type))window.__memoryProbe.webgl++;return get.call(this,type,...args);};
   const put=CanvasRenderingContext2D.prototype.putImageData;
   CanvasRenderingContext2D.prototype.putImageData=function(data,...args){if(this.canvas.matches('[data-corruption-ambient]'))window.__memoryProbe.initial=new Uint8ClampedArray(data.data);return put.call(this,data,...args);};
   const record=phase=>{const node=document.querySelector('[data-corruption-ambient]');if(node?.width){window.__memoryProbe.frames.push({phase,width:node.width,height:node.height,pixels:node.getContext('2d').getImageData(0,0,node.width,node.height).data,frame:node.dataset.ambientFrame});if(window.__memoryProbe.frames.length>8)window.__memoryProbe.frames.shift();}};
   document.addEventListener('h4:memoryhandoff',e=>record(e.detail.phase));
   if(document.startViewTransition){const start=document.startViewTransition.bind(document);document.startViewTransition=update=>start(async()=>{await update();record('destination');});}
  });
  await page.goto(`${base}/about?test=1`,{waitUntil:'networkidle'});
  await page.mouse.click(12,350); await page.waitForFunction(()=>document.querySelectorAll('[data-ink-mark]').length>0);
  await page.keyboard.down('4');
  await page.waitForFunction(()=>document.documentElement.dataset.mode==='xray'&&!document.documentElement.hasAttribute('data-mode-snapshot')&&!document.documentElement.hasAttribute('data-xray-transition'),null,{timeout:60000});
  await page.keyboard.up('4');
  const handoff=await page.evaluate(()=>{
   const p=window.__memoryProbe,first=p.frames.find(f=>f.phase==='prepared'),dest=p.frames.find(f=>f.phase==='destination'),last=p.frames.find(f=>f.phase==='released');
   const equal=(a,b)=>Boolean(a&&b&&a.pixels.length===b.pixels.length&&a.pixels.every((v,i)=>v===b.pixels[i]));
   let initialChanged=0;if(p.initial?.length===first?.pixels.length)for(let i=0;i<p.initial.length;i+=4)if([0,1,2].some(c=>p.initial[i+c]!==first.pixels[i+c]))initialChanged++;
   return {phases:p.frames.map(f=>f.phase),samePreparedAndReleased:equal(first,last),sameDestination:dest?equal(first,dest):null,
    initialChanged,pixels:first?.width*first?.height,liveBitmaps:p.canvases.filter(n=>n.width>1&&n.height>1).length,
    ink:document.querySelectorAll('[data-ink-mark]').length,background:getComputedStyle(document.querySelector('.corruption-background')).backgroundImage,
    opacity:getComputedStyle(document.querySelector('.corruption-background')).opacity,distress:getComputedStyle(document.querySelector('.xray-distress')).display,
    snapshot:window.__H4_CORRUPTION__.snapshot()};
  });
  assert.ok(handoff.samePreparedAndReleased,'Native final background and retained memory must be the exact same bitmap.');
  if(!reduced) assert.equal(handoff.sameDestination,true,'Native destination captures the same frozen memory.');
  assert.ok(handoff.initialChanged>handoff.pixels*.7,'The first memory must already be aggressively damaged.');
  assert.equal(handoff.liveBitmaps,2);assert.equal(handoff.ink,0);assert.equal(handoff.background,'none');assert.equal(handoff.opacity,'1');assert.equal(handoff.distress,'none');
  assert.equal(handoff.snapshot.ambient.recoverySource,'history');assert.equal(handoff.snapshot.ambient.cleanSourceRetained,false);
  const snap=()=>page.evaluate(()=>window.__H4_CORRUPTION__.snapshot());
  const before=await snap();
  if(!reduced){
   for(let i=0;i<14;i++){await page.mouse.move(30+i%4*width/5,300+i%3*70,{steps:2});await page.mouse.click(12,340+i%3*70);}
   for(const dy of[180,-180,140,-140]){await page.mouse.wheel(0,dy);await page.waitForTimeout(70);}
   await page.waitForTimeout(300);
   assert.equal(await page.locator('[data-ink-mark]').count(),0);
   const after=await snap();assert.ok(after.ambient.consumedInputs>before.ambient.consumedInputs);assert.ok(after.ambient.memory.byKind.click>0);assert.ok(after.ambient.memory.byKind.cursor>0);assert.ok(after.ambient.memory.byKind.scroll>0);
   await page.evaluate(()=>{const n=document.querySelector('[data-corruption-ambient]');window.__memoryBeforeIdle=n.getContext('2d').getImageData(0,0,n.width,n.height).data;});
   await page.waitForTimeout(15000);
   const idlePixels=await page.evaluate(()=>{const n=document.querySelector('[data-corruption-ambient]'),b=n.getContext('2d').getImageData(0,0,n.width,n.height).data,a=window.__memoryBeforeIdle;let changed=0;for(let i=0;i<a.length;i+=4)if([0,1,2].some(c=>a[i+c]!==b[i+c]))changed++;return changed;});
   assert.ok(idlePixels>100,'Idle evolves the same damaged output.');handoff.idleChangedPixels=idlePixels;
  }else{await page.waitForTimeout(400);assert.equal((await snap()).ambient.frames,before.ambient.frames);assert.equal((await snap()).ambient.queued,false);}
  const stable=await snap();
  // Exercise a same-document interior route through the existing ordinary
  // Work anchor. NAAVI's visible Home destination intentionally enters the
  // hero; this isolated cold-interior memory check must not visit Home.
  await page.locator('[data-global-index] summary').click();
  await page.locator('[data-global-index] a[href="/work"]').click();
  await page.locator('html[data-page="work"]').waitFor();
  await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-mode-snapshot'));
  const navigated=await snap();assert.equal(navigated.ambient.seed,stable.ambient.seed);assert.equal(navigated.ambient.sourceInitializations,1);
  await page.setViewportSize({width:width===1000?850:width+10,height:780});
  await page.waitForFunction(()=>window.__H4_CORRUPTION__.snapshot().ambient.resizeCopies>0);const resized=await snap();assert.equal(resized.ambient.sourceInitializations,1);assert.equal(resized.ambient.seed,stable.ambient.seed);assert.ok(resized.ambient.resizeCopies>0);
  await page.screenshot({path:new URL(`memory-${width}-${reduced?'reduced':'active'}.png`,out).pathname,timeout:60000});
  await page.keyboard.type('333',{delay:65});await page.waitForFunction(()=>document.documentElement.dataset.mode==='normal'&&!document.documentElement.hasAttribute('data-mode-snapshot')&&!document.documentElement.hasAttribute('data-xray-transition'),null,{timeout:60000});
  assert.equal((await snap()).ambient.queued,false);
  await page.keyboard.down('4');await page.waitForFunction(()=>document.documentElement.dataset.mode==='xray'&&!document.documentElement.hasAttribute('data-mode-snapshot')&&!document.documentElement.hasAttribute('data-xray-transition'),null,{timeout:60000});await page.keyboard.up('4');
  const reentered=await snap();assert.notEqual(reentered.ambient.seed,stable.ambient.seed);assert.equal(reentered.ambient.sourceInitializations,2);
  const resources=await page.evaluate(()=>({webgl:window.__memoryProbe.webgl,bitmaps:window.__memoryProbe.canvases.filter(n=>n.width>1&&n.height>1).length,regions:document.querySelectorAll('.corruption-region').length,localFilters:document.querySelectorAll('[style*="h4-mode-snapshot"]').length}));
  assert.equal(resources.webgl,0);assert.equal(resources.bitmaps,2);assert.equal(resources.regions,0);assert.deepEqual(errors,[]);
  reports.push({width,reduced,handoff,stable:stable.ambient,navigated:navigated.ambient,resized:resized.ambient,reentered:reentered.ambient,resources,errors});
  console.log(`PASS memory ${width} reduce=${reduced}`);await context.close();
 }
 await writeFile(new URL('memory-browser-results.json',out),JSON.stringify({checkedAt:new Date().toISOString(),method:'Actual pixel byte equality at prepared/native destination/released boundaries; no browser-owned full-page readback claim.',reports},null,2));
}finally{await browser.close();}
