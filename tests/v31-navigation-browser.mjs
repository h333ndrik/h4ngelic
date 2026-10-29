import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../artifacts/v31-navigation/', import.meta.url);
await mkdir(output, { recursive: true });
const profiles = [{ width:1440, reduced:false },{ width:390, reduced:false },{ width:320, reduced:false },{ width:320, reduced:true }]
  .filter(profile => !process.env.H4_NAV_WIDTHS || process.env.H4_NAV_WIDTHS.split(',').map(Number).includes(profile.width));
const browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json',output),JSON.stringify({ checkedAt:new Date().toISOString(),reports,failures },null,2));
const overlap = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function settle(page) {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-mode-snapshot')
    && !document.documentElement.hasAttribute('data-xray-transition') && !document.documentElement.hasAttribute('data-memory-mosh-preparing'));
  await page.evaluate(() => document.activeElement?.blur()); await frames(page);
}
async function mode(page,target) {
  await page.evaluate(() => document.activeElement?.blur());
  if(target==='xray') { await page.keyboard.down('4'); await page.waitForTimeout(1100); await page.keyboard.up('4'); }
  else await page.keyboard.type('333',{delay:65});
  await page.waitForFunction(expected => document.documentElement.dataset.mode===expected,target,{timeout:60000});
  await settle(page);
}
async function geometry(page) {
  return page.evaluate(() => {
    const box = selector => {const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const size = selector => getComputedStyle(document.querySelector(selector)).fontSize;
    return {brand:box('[data-floating-brand]'),index:box('[data-global-index] summary'),filters:box('.work-filters'),naavi:box('[data-naavi]'),
      width:innerWidth,documentWidth:document.documentElement.scrollWidth,
      headingSize:size('.work-page .page-heading'),filterSize:size('.work-filters .filter-link'),subheadSize:size('.archive-category-heading')};
  });
}
async function indexContract(page,profile,world) {
  const menu=page.locator('[data-global-index]'),summary=menu.locator('summary');
  const scroll=await page.evaluate(()=>scrollY);
  await summary.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const menu=document.querySelector('[data-global-index]');return menu.open&&menu.querySelector('summary').getAttribute('aria-expanded')==='true';});
  const data=await menu.evaluate(el => {
    const panel=el.querySelector('.global-index-links'),s=getComputedStyle(panel),r=panel.getBoundingClientRect();
    return {numbers:[...el.querySelectorAll('.index-number')].map(el=>el.textContent.trim()),
      targets:[...el.querySelectorAll('a')].map(a=>a.getAttribute('href')),labels:[...el.querySelectorAll('a')].map(a=>a.textContent.trim().replace(/\s+/g,' ')),
      panel:{left:r.left,right:r.right,bottom:r.bottom},surface:s.backgroundColor,border:s.borderTopColor,borderWidth:s.borderTopWidth,radius:s.borderRadius,
      expanded:el.querySelector('summary').getAttribute('aria-expanded')};
  });
  assert.deepEqual(data.numbers,['00 /','01 /','02 /','03 /','04 /']);
  assert.deepEqual(data.targets,['/','/work','/about','/#contact','/#final-secret']);
  assert.equal(data.expanded,'true');assert.equal(data.surface,'rgb(48, 48, 51)');assert.equal(data.border,'rgb(255, 255, 255)');
  assert.equal(data.borderWidth,'1px');assert.equal(data.radius,'4px');
  assert.ok(data.panel.left>=0 && data.panel.right<=profile.width+1 && data.panel.bottom<=844);
  await page.keyboard.press('Tab');
  assert.equal(await menu.locator('a').first().evaluate(el=>el===document.activeElement),true);
  assert.ok(await menu.locator('a').first().evaluate(el=>getComputedStyle(el).outlineStyle!=='none'),'INDEX destination has a visible keyboard focus indicator.');
  await page.keyboard.press('Escape');
  assert.equal(await menu.evaluate(el=>el.open),false);
  assert.equal(await summary.evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.evaluate(()=>scrollY),scroll,'Opening/closing the native INDEX never shifts document flow.');
  if(!profile.reduced) await page.waitForTimeout(300);
  return {world,...data};
}
async function workChrome(page,profile,world) {
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await frames(page);
  const g=await geometry(page);
  assert.ok(g.documentWidth<=profile.width+1,'The connected Work strip cannot enlarge the whole page.');
  assert.ok(g.filters.left>=g.brand.right+10 && g.filters.right<=g.index.left-10,'Work categories occupy the row between brand and INDEX.');
  assert.ok(Math.abs(g.filters.top-g.brand.top)<1 && g.filters.height>=44);
  assert.ok(!overlap(g.brand,g.filters)&&!overlap(g.index,g.filters));
  assert.deepEqual(await page.locator('.work-filters a').allTextContents(),['tattoos','jewellery','more']);
  const typography=await page.evaluate(()=>{
    const h=document.createElement('h2');h.className='kinetic-heading';h.style.cssText='position:absolute;visibility:hidden;pointer-events:none';document.body.append(h);
    const heading=getComputedStyle(h).fontSize;h.remove();
    const a=document.createElement('a');a.className='text-link';a.style.cssText='position:absolute;visibility:hidden';
    const about=document.createElement('div');about.className='about-preview';about.append(a);document.body.append(about);
    const secondary=getComputedStyle(a).fontSize;about.remove();
    return {heading,secondary};
  });
  assert.equal(g.headingSize,typography.heading,'Work page and Home numbered heading use the same display scale.');
  assert.equal(g.subheadSize,typography.secondary,'Sub-rubric labels match MORE ABOUT.');
  for(const link of await page.locator('.work-filters a').all()) {
    await link.evaluate(el=>el.focus()); await frames(page);
    const visible=await link.evaluate(el=>{const r=el.getBoundingClientRect(),v=el.parentElement.getBoundingClientRect();return r.left>=v.left-1&&r.right<=v.right+1&&r.height>=44;});
    assert.ok(visible,'Every compact category remains reachable by native keyboard scroll inside the local strip.');
  }
  await page.evaluate(()=>document.activeElement?.blur());
  if(profile.width>=600) {
    const naavi=page.locator('[data-naavi]');await naavi.hover();
    const cursors=await naavi.evaluate(el=>({outer:getComputedStyle(el).cursor,digit:getComputedStyle(el.querySelector('.chapter-digit')).cursor,total:getComputedStyle(el.querySelector('.chapter-total')).cursor}));
    const expected=world==='xray'?'h4ngelic-cursor-other-hover-r09.svg':'h4ngelic-cursor-hover.svg';
    for(const value of Object.values(cursors)) assert.ok(value.includes(expected),'NAAVI and its slash use the primary interactive h4 cursor.');
    await page.mouse.move(1,1);
  }
  await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await frames(page);
  const footer=await page.locator('[data-footer-row]').evaluate(row=>{
    const r=row.getBoundingClientRect(),n=document.querySelector('[data-naavi]').getBoundingClientRect();
    return {footerCentre:r.top+r.height/2,naaviCentre:n.top+n.height/2,docked:document.querySelector('[data-naavi]').hasAttribute('data-naavi-footer-docked'),
      documentHeight:document.documentElement.scrollHeight,documentWidth:document.documentElement.scrollWidth};
  });
  assert.ok(Math.abs(footer.footerCentre-footer.naaviCentre)<1,'Footer and fixed NAAVI share one baseline without extra document height.');
  assert.ok(footer.documentWidth<=profile.width+1);
  return {world,geometry:g,typography,footer};
}
async function contrastContract(page,world) {
  // A controlled visible display heading exercises actual cached measurement
  // and all NAAVI characters together. It is an in-test geometry fixture only.
  await page.evaluate(()=>{
    const nav=document.querySelector('[data-naavi]').getBoundingClientRect();
    const existing=[...document.querySelectorAll('.kinetic-heading,.page-heading,.work-group-heading>a,.archive-category-heading>a,.about-preview-copy,.category-link .interaction-visual')]
      .filter(element=>parseFloat(getComputedStyle(element).fontSize)>=32)
      .map(element=>{const r=element.getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY};});
    const maximum=Math.max(0,document.documentElement.scrollHeight-innerHeight-200);
    const safeTop=Array.from({length:31},(_,n)=>n*80).find(top=>top<=maximum&&!existing.some(rect=>rect.top<top+nav.bottom&&rect.bottom>top+nav.top));
    if(safeTop===undefined) throw new Error('The contrast fixture needs a viewport row without unrelated display headings.');
    scrollTo({top:safeTop,behavior:'instant'});
    const h=document.createElement('h2');h.className='page-heading kinetic-heading';h.id='v31-contrast-probe';
    h.innerHTML='<span class="kinetic-heading-text">display</span>';h.style.cssText=`position:absolute;left:${innerWidth/2-120}px;top:${scrollY+nav.top-20}px;width:240px;height:84px;margin:0;font-size:72px;color:#fff;opacity:1;pointer-events:none`;
    const parent=document.createElement('div');parent.id='v31-contrast-parent';parent.append(h);
    const measure=h.getBoundingClientRect.bind(h);window.__v31ContrastGeometryReads=0;
    h.getBoundingClientRect=()=>{window.__v31ContrastGeometryReads++;return measure();};
    document.querySelector('#page-content').append(parent);document.dispatchEvent(new CustomEvent('h4:pagechange'));
  });await frames(page);
  const display=await page.locator('[data-naavi]').evaluate(el=>({contrast:el.hasAttribute('data-naavi-display-contrast'),blend:getComputedStyle(el).mixBlendMode,
    digit:getComputedStyle(el.querySelector('.chapter-digit')).color,total:getComputedStyle(el.querySelector('.chapter-total')).color}));
  assert.equal(display.contrast,true);assert.equal(display.blend,'difference');assert.equal(display.digit,display.total,'Slash and digits share one colour and compositing parent.');
  const visibility=[];
  for(const source of ['heading','child','parent']) {
    for(const opacity of ['0','1']) {
      const beforeReads=await page.evaluate(()=>window.__v31ContrastGeometryReads);
      await page.evaluate(({source,opacity})=>{
        document.querySelector(source==='heading'?'#v31-contrast-probe':source==='child'?'#v31-contrast-probe .kinetic-heading-text':'#v31-contrast-parent').style.opacity=opacity;
        dispatchEvent(new Event('scroll'));
      },{source,opacity});await frames(page);
      const state=await page.locator('[data-naavi]').evaluate(el=>({contrast:el.hasAttribute('data-naavi-display-contrast'),blend:getComputedStyle(el).mixBlendMode,reads:window.__v31ContrastGeometryReads}));
      assert.equal(state.contrast,opacity==='1','Fully faded display text and its faded ancestors must immediately release difference blending.');
      assert.equal(state.blend,opacity==='1'?'difference':'normal');
      assert.equal(state.reads,beforeReads,'Changing only opacity reuses cached heading geometry on the scroll path.');
      visibility.push({source,opacity,...state});
    }
  }
  await page.evaluate(()=>{
    const h=document.querySelector('#v31-contrast-probe');const p=document.createElement('div');p.id='v31-quiet-probe';p.className='inquiry';
    p.style.cssText=h.style.cssText+';font-size:14px';p.textContent='small inquiry field label';document.querySelector('#page-content').append(p);
    document.dispatchEvent(new CustomEvent('h4:pagechange'));
  });await frames(page);
  const quiet=await page.locator('[data-naavi]').evaluate(el=>({contrast:el.hasAttribute('data-naavi-display-contrast'),blend:getComputedStyle(el).mixBlendMode}));
  assert.equal(quiet.contrast,false);assert.equal(quiet.blend,'normal','Inquiry content takes priority over nearby display type.');
  await page.evaluate(()=>{document.querySelector('#v31-quiet-probe')?.remove();document.querySelector('#v31-contrast-parent')?.remove();document.dispatchEvent(new CustomEvent('h4:pagechange'));});
  return {world,display,visibility,quiet};
}
try {
  for(const profile of profiles) {
    console.log(`CHECK V3.1 navigation ${profile.width}px reduced=${profile.reduced}`);
    const context=await browser.newContext({viewport:{width:profile.width,height:844},deviceScaleFactor:1,isMobile:profile.width<600,hasTouch:profile.width<600,reducedMotion:profile.reduced?'reduce':'no-preference'});
    const page=await context.newPage(),errors=[],requests=[];page.setDefaultTimeout(15000);
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(new URL(r.url()).pathname));
    await page.addInitScript(()=>{localStorage.setItem('h4ngelic.audio.v1',JSON.stringify({muted:true,volume:.2}));window.__v31GL=0;const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(/webgl/i.test(type))window.__v31GL++;return get.call(this,type,...args);};});
    try {
      await page.goto(new URL('/work',base).href,{waitUntil:'networkidle'});await settle(page);
      const normals=await indexContract(page,profile,'normal');const workNormal=await workChrome(page,profile,'normal');const contrastNormal=await contrastContract(page,'normal');
      assert.equal(await page.evaluate(()=>window.__v31GL),0,'Cold Work does not initialize a Three.js scene.');
      assert.ok(!requests.some(path=>/\/src\/main\.js$|\/three(?:[/.]|$)/i.test(path)));
      await mode(page,'xray');
      const other=await indexContract(page,profile,'xray');const workOther=await workChrome(page,profile,'xray');const contrastOther=await contrastContract(page,'xray');
      await page.screenshot({path:new URL(`work-${profile.width}-${profile.reduced?'reduced':'active'}-4.png`,output).pathname});
      await mode(page,'normal');
      assert.deepEqual(errors,[]);
      reports.push({...profile,normals,workNormal,contrastNormal,other,workOther,contrastOther,errors});await save();
      console.log(`PASS V3.1 navigation ${profile.width}px: numbered INDEX, shared surfaces/type, compact category row, scoped contrast, cursor and footer baseline.`);
    }catch(error){failures.push({...profile,message:error.stack,errors});await page.screenshot({path:new URL(`failure-${profile.width}.png`,output).pathname}).catch(()=>{});await save();throw error;}
    finally{await context.close();}
  }
}finally{await save();await browser.close();}
