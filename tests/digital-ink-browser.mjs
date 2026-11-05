// Legacy command name retained: Digital is an ordinary image, without ink reveal.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.H4_BASE_URL||'http://127.0.0.1:55173';
const output=process.env.H4_DIGITAL_ARTIFACTS||'artifacts/v311/F10/digital';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[], failures=[];
const profiles=[1440,390,320].flatMap(width=>[false,true].map(reduced=>({width,reduced})));
const settled=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const pose=element=>{ const r=element.getBoundingClientRect(),s=getComputedStyle(element);return {x:r.x,y:r.y,width:r.width,height:r.height,filter:s.filter,radius:s.borderRadius,objectFit:s.objectFit,transform:s.transform,visibility:s.visibility,source:element.currentSrc,srcset:element.srcset,sizes:element.sizes}; };
async function changeMode(page,world){
  if(await page.locator('html').getAttribute('data-mode')===world)return;
  await page.evaluate(()=>document.activeElement?.blur());
  if(world==='xray'){await page.keyboard.down('4');try{await page.waitForFunction(()=>document.documentElement.dataset.mode==='xray',null,{timeout:30000});}finally{await page.keyboard.up('4');}}
  else for(let i=0;i<3;i++)await page.keyboard.press('3');
  await page.waitForFunction(world=>document.documentElement.dataset.mode===world&&!document.documentElement.hasAttribute('data-mode-snapshot')&&!document.documentElement.hasAttribute('data-xray-transition'),world,{timeout:60000});
}
try{
 for(const profile of profiles){
  const page=await browser.newPage({viewport:{width:profile.width,height:844},deviceScaleFactor:1,isMobile:profile.width<600,hasTouch:profile.width<600,reducedMotion:profile.reduced?'reduce':'no-preference'});
  const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});page.on('request',request=>requests.push(new URL(request.url()).pathname));
  try{
   const worlds=[];
   for(const [route,selector,kind] of [['/work/digital-artworks','#digital-artworks','archive'],['/work/digital-artworks/green-black-original','.artwork-detail','detail']]){
    const routeRequestStart=requests.length;
    await page.goto(`${base}${route}?test=1`,{waitUntil:'networkidle'});
    const trigger=page.locator(`${selector} [data-inline-expand]`).first();
    await trigger.waitFor();
    assert.equal(await trigger.evaluate(element=>element.tagName),'BUTTON','Inline expand is a native button with Space/Enter activation.');
    const image=trigger.locator('img'),frame=trigger.locator('xpath=..');
    const fullSource=await image.getAttribute('data-full-src');
    assert.ok(fullSource,'The shared viewer retains its explicit high-resolution source.');
    const fullURL=new URL(fullSource,page.url()).href,fullPath=new URL(fullURL).pathname;
    const previewAttributes=await image.evaluate(element=>Object.fromEntries(['src','srcset','sizes'].map(name=>[name,element.getAttribute(name)])));
    await image.evaluate(image=>image.decode());
    assert.equal(await page.locator('[data-digital-ink],.digital-ink-canvas').count(),0,'Digital ink reveal remains retired.');
    for(const world of ['normal','xray']){
     await changeMode(page,world);
     await frame.evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));
     await page.mouse.move(profile.width-2,100);await page.waitForTimeout(profile.reduced?0:400);await settled(page);
     const before=await image.evaluate(pose), geometry=await frame.evaluate(element=>({width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height,base:getComputedStyle(element).getPropertyValue('--digital-base-width')}));
     assert.ok(before.source.includes('green-black-original')&&before.srcset.includes('960w')&&!before.srcset.includes('1440w'));
     if(world==='normal'){
      assert.ok(!before.source.includes('-1440.webp'),'Full source is not selected on cold resting load.');
      assert.ok(!requests.slice(routeRequestStart).includes(fullPath),'No full-resolution request precedes the first trusted expansion gesture on this route.');
     }
     assert.equal(before.objectFit,'contain');if(world==='normal')assert.equal(before.filter,'none');assert.equal(before.visibility,'visible');assert.equal(before.radius,'4px');
     const expectedBase=kind==='archive'?Math.min(profile.width*.492,660):Math.min((profile.width-(profile.width<600?44:70))*.6,720);
     const expected=Math.min(expectedBase,(844-152)*.75/1.4);
     assert.ok(Math.abs(before.width-expected)<2,JSON.stringify({kind,profile,before,expected,geometry}));
     const unchanged=await page.evaluate(()=>({y:scrollY,height:document.documentElement.scrollHeight,overflow:document.body.style.overflow}));
     await page.screenshot({path:`${output}/rest-${kind}-${profile.width}-${profile.reduced}-${world}.png`});
     // Observe the first real full-source request before issuing the trusted
     // click. Subsequent uses may resolve from the existing decoded/image cache.
     const firstFullRequest=!requests.includes(fullPath)?page.waitForRequest(request=>new URL(request.url()).pathname===fullPath):null;
     await trigger.click();
     if(firstFullRequest)await firstFullRequest;
     await page.waitForFunction(({element,fullURL})=>element.currentSrc===fullURL&&element.complete&&element.naturalWidth>0,
      {element:await image.elementHandle(),fullURL},{timeout:20000});
     await image.evaluate(element=>element.decode());
     await page.waitForFunction(element=>{
      const scaleOf=target=>{const value=getComputedStyle(target).transform,matrix=new DOMMatrixReadOnly(value==='none'?undefined:value);return Math.hypot(matrix.m11,matrix.m12);};
      const target=Number(getComputedStyle(element).getPropertyValue('--inline-view-scale'))||1;
      const visual=element.querySelector('.interaction-visual');
      return element.hasAttribute('data-inline-expanded')&&Math.abs(scaleOf(element)-target)<.001&&(!visual||Math.abs(scaleOf(visual)-1)<.001);
     },await trigger.elementHandle(),{timeout:15000});
     await settled(page);
     assert.equal(await trigger.getAttribute('aria-pressed'),'true');
     const expanded=await image.evaluate(pose),ratio=expanded.width/before.width;
     assert.equal(expanded.source,fullURL,'The decoded explicit full source is shown only after activation.');
     assert.ok(requests.includes(fullPath),'A real trusted expansion requested the supplied full source.');
     assert.ok(Math.abs(parseFloat(expanded.radius)*ratio-4)<.06,'Scale compensation retains an approximately4px physical corner in the expanded view.');
     assert.ok(ratio>=1.2,JSON.stringify({before,expanded,ratio}));assert.equal(expanded.filter,before.filter,'Inline mechanics do not alter the world’s image treatment.');
     assert.ok(expanded.x>=-1&&expanded.y>=-1&&expanded.x+expanded.width<=profile.width+1&&expanded.y+expanded.height<=845);
     assert.equal(await page.locator('dialog[open]').count(),0);assert.deepEqual(await page.evaluate(()=>({y:scrollY,height:document.documentElement.scrollHeight,overflow:document.body.style.overflow})),unchanged);
     await page.screenshot({path:`${output}/expanded-${kind}-${profile.width}-${profile.reduced}-${world}.png`});
     await trigger.click();
     assert.deepEqual(await image.evaluate(element=>Object.fromEntries(['src','srcset','sizes'].map(name=>[name,element.getAttribute(name)]))),previewAttributes,'Collapse restores every original source-selection attribute exactly.');
     // Compare resting geometry after leaving the legitimate shared hover,
     // rather than mistaking its1.025x feedback for a failed expansion restore.
     await page.mouse.move(profile.width-2,100);await page.evaluate(()=>document.activeElement?.blur());
     await page.waitForFunction(element=>{
      const scaleOf=target=>{const value=getComputedStyle(target).transform,matrix=new DOMMatrixReadOnly(value==='none'?undefined:value);return Math.hypot(matrix.m11,matrix.m12);};
      const visual=element.querySelector('.interaction-visual');
      return !element.hasAttribute('data-inline-expanded')&&Math.abs(scaleOf(element)-1)<.001&&(!visual||Math.abs(scaleOf(visual)-1)<.001);
     },await trigger.elementHandle(),{timeout:15000});
     await settled(page);
     assert.equal(await trigger.getAttribute('aria-pressed'),'false');const restored=await image.evaluate(pose);assert.ok(Math.abs(restored.width-before.width)<1);
     await trigger.focus();await page.keyboard.press('Enter');assert.equal(await trigger.getAttribute('aria-pressed'),'true');await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-pressed'),'false');
     await trigger.focus();await page.keyboard.press('Space');assert.equal(await trigger.getAttribute('aria-pressed'),'true');await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-pressed'),'false');
     await trigger.click();await page.mouse.click(profile.width-2,300);assert.equal(await trigger.getAttribute('aria-pressed'),'false');
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
     worlds.push({kind,world,before,geometry,expectedBase,expected,expanded,ratio,restored});
    }
   }
   assert.ok(!requests.some(path=>/\/src\/main\.js|\/three(?:\/|\.)|wordmark\.typeface/.test(path)),'Cold interior never downloads hero/Three.');
   assert.deepEqual(errors,[]);reports.push({profile,worlds,errors});console.log(`PASS Digital inline ${profile.width} reduced=${profile.reduced}`);
  }catch(error){failures.push({profile,error:error.stack,errors});throw error;}finally{await page.close();await writeFile(`${output}/results.json`,JSON.stringify({reports,failures},null,2));}
 }
}finally{await browser.close();}
