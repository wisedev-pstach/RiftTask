'use strict';
// Renderer-only synthetic fixture. No authentication, native operations or cloud access.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.RIFT_PLAYWRIGHT||'/opt/data/cache/scratch/rifttask-browser/node_modules/playwright');
(async()=>{
 const output=path.resolve(process.env.RIFT_SCREENSHOT_OUTPUT||'artifacts/screenshots/category-badges');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.RIFT_CHROMIUM||'/opt/hermes/tools/chromium-1208/chrome-linux64/chrome',args:['--no-sandbox']});
 const records=[],errors=[],external=[];
 try{
  for(const stress of [false,true]){
   const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:33865/')&&!r.url().startsWith('data:'))external.push(r.url());});
   if(stress)await page.route('**/docs/previews/project-progress.html*',async route=>{const response=await route.fetch();let body=await response.text();body=body.replace(/name:\s*['"]Games['"],\s*color:\s*['"]#c8ff63['"]/,"name:'SyntheticLongCategoryNameWithoutSpacesForWrappingAndReadableContext',color:'#ffffff'").replace(/name:\s*['"]Tools['"],\s*color:\s*['"]#79bbaa['"]/,"name:'Release preparation and documentation category',color:'#ffffff'");await route.fulfill({response,body});});
   await page.goto('http://127.0.0.1:33865/docs/previews/project-progress.html');await page.getByRole('heading',{name:'Projects',exact:true}).waitFor();
   for(const theme of ['dark','light']){
    await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:theme==='dark'?'Dark':'Light',exact:true}).click();await page.getByRole('button',{name:'Back to workspace',exact:true}).click();
    for(const width of [1440,1024])for(const layout of ['Board','List']){
     await page.setViewportSize({width,height:1000});await page.locator('nav').getByText('In progress',{exact:true}).click();await page.getByRole('button',{name:layout,exact:true}).click();await page.getByLabel('Filter by category').selectOption('');
     assert.equal(await page.locator('.task-category').count(),2);
     const geometry=await page.locator('.task-row').evaluateAll(rows=>rows.map(row=>{
      const badge=row.querySelector('.task-category'),style=getComputedStyle(badge),box=badge.getBoundingClientRect(),r=row.getBoundingClientRect();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');const luminance=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);const rgb=[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};const fg=luminance(style.color),bg=luminance(style.backgroundColor);
      const controls=[...row.querySelectorAll('button,select')].map(el=>{const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {name:el.getAttribute('aria-label'),insideRow:b.left>=r.left&&b.right<=r.right+1&&b.top>=r.top&&b.bottom<=r.bottom+1,hit:el===hit||el.contains(hit)};});
      return {category:badge.textContent,color:style.color,background:style.backgroundColor,contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05),badgeInside:box.left>=r.left&&box.right<=r.right+1,overflow:badge.scrollWidth>badge.clientWidth+1,controls};
     }));
     for(const row of geometry){assert.ok(row.contrast>=4.5,JSON.stringify(row));assert.ok(row.badgeInside&&!row.overflow,JSON.stringify(row));for(const control of row.controls)assert.ok(control.insideRow&&control.hit,JSON.stringify(control));}
     const file=`in-progress-${layout.toLowerCase()}-${theme}-${width}${stress?'-long-white':''}.png`;await page.screenshot({path:path.join(output,file)});records.push({file,theme,width,layout,stress,geometry});
     await page.getByLabel('Filter by category').selectOption('games');assert.equal(await page.locator('.task-category').count(),1);assert.equal(await page.locator('.task-category').textContent(),stress?'SyntheticLongCategoryNameWithoutSpacesForWrappingAndReadableContext':'Games');await page.getByLabel('Filter by category').selectOption('');assert.equal(await page.evaluate(()=>window.__simulated.saved),0);
    }
   }
   await page.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);fs.writeFileSync(path.join(output,'category-browser-result.json'),JSON.stringify({synthetic:true,screenshots:records.length,saves:0,errors,external,records},null,2));console.log(JSON.stringify({screenshots:records.length,saves:0,errors,external,minimumContrast:Math.min(...records.flatMap(r=>r.geometry.map(g=>g.contrast)))},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
