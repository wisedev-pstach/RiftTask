// Built renderer only; delayed synthetic session, no real account/auth/data.
const {chromium}=require('/opt/data/projects/game-maze-review/node_modules/playwright-core');
const {spawn}=require('node:child_process');
const {mkdirSync,writeFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const out=process.env.RIFTTASK_STARTUP_SCREENSHOTS||'/opt/data/output/rifttask/startup';
(async()=>{
 mkdirSync(out,{recursive:true});
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--outDir','/opt/data/cache/scratch/rifttask-startup-preview-build','--host','127.0.0.1','--port','5201','--strictPort'],{cwd:root,stdio:'pipe'});
 let browser;
 try{
  let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Owned startup preview server exited');try{if((await fetch('http://127.0.0.1:5201')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready,'Preview server ready');
  browser=await chromium.launch({executablePath:'/opt/hermes/tools/chromium-1208/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const results=[];
  for(const theme of ['dark','light']){
   const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'no-preference'});const errors=[],remote=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:5201/'))remote.push(r.url());});
   await page.addInitScript(theme=>{
    localStorage.setItem('rifttask.appearance',theme);window.__calls={session:0,load:0,login:0,save:0,cloud:0};
    window.rift={session:()=>{window.__calls.session++;return new Promise((resolve,reject)=>{window.__resolveSession=resolve;window.__rejectSession=reject;});},load:async()=>{window.__calls.load++;return {version:1,categories:[],projects:[],tasks:[]};},login:()=>window.__calls.login++,save:()=>window.__calls.save++,cloudStatus:()=>window.__calls.cloud++};
   },theme);
   await page.goto('http://127.0.0.1:5201');await page.getByRole('heading',{name:'Opening RiftTask'}).waitFor();
   await page.evaluate(()=>{const badge=document.createElement('div');badge.textContent='BROWSER PREVIEW · SIMULATED DELAYED SESSION · No native/auth/cloud execution';badge.style.cssText='position:fixed;bottom:14px;left:16px;right:16px;text-align:center;color:var(--muted);font:10px Segoe UI,sans-serif';document.body.append(badge);});
   assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
   assert(await page.locator('.startup-mark img').evaluate(img=>img.complete&&img.naturalWidth>0));
   const motion=()=>page.locator('.startup-orbit').evaluate(el=>getComputedStyle(el,'::after').animationName);
   assert.equal(await motion(),'startup-orbit');await page.screenshot({path:path.join(out,`startup-${theme}.png`)});
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await motion(),'none');
   assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
   await page.setViewportSize({width:360,height:640});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.setViewportSize({width:1440,height:960});await page.emulateMedia({reducedMotion:'no-preference'});
   if(theme==='dark'){
    await page.evaluate(()=>window.__rejectSession(new Error('Example startup failure. Please retry.')));await page.getByRole('alert').waitFor();assert.equal(await motion(),'none');
    await page.screenshot({path:path.join(out,'startup-error-dark.png')});await page.getByRole('button',{name:'Retry loading'}).click();await page.getByRole('status').filter({hasText:'Loading workspace…'}).waitFor();assert.equal(await motion(),'startup-orbit');
   }
   assert.deepEqual(await page.evaluate(()=>window.__calls),{session:theme==='dark'?2:1,load:0,login:0,save:0,cloud:0});
   await page.evaluate(()=>window.__resolveSession({account:null,ghAvailable:false}));await page.getByRole('heading',{name:'Your work, on this device.'}).waitFor();assert.equal(await page.locator('.startup-screen').count(),0);
   assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);results.push({theme,motion:'startup-orbit',reducedMotion:'none; zero running animations',narrowOverflow:false,relativeLogoLoaded:true,errors,remote,sessionResolvedToSignIn:true});await page.close();
  }
  writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify({builtRenderer:true,syntheticDelayedSession:true,nativeVerified:false,results},null,2));console.log(JSON.stringify({out,results},null,2));
 }finally{await browser?.close();if(server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));}}
})().catch(e=>{console.error(e);process.exitCode=1;});
