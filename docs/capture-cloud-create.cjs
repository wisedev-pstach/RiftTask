// Built renderer only. All native dialogs and GitHub calls are simulated.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/data/projects/game-maze-review/node_modules/playwright-core');
const {spawn}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.RIFTTASK_SCREENSHOTS||'/opt/data/output/rifttask/cloud-create';
(async()=>{
 fs.mkdirSync(out,{recursive:true});const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5197','--strictPort'],{cwd:root,stdio:'pipe'});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5197')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/hermes/tools/chromium-1208/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const repo={id:777,full_name:'example-developer/task-data',private:true,fork:false,archived:false,owner:{id:999,login:'example-developer',type:'User'},default_branch:'main'};
   const workspace={version:1,categories:[],projects:[],tasks:[],milestones:[],updatedAt:'2026-11-05T12:00:00.000Z'};
   window.__calls={create:0,verify:0,enable:0,sync:0,status:0};window.rift={session:async()=>({account:{id:999,login:'example-developer'},ghAvailable:true,offline:false}),load:async()=>structuredClone(workspace),cloudStatus:async()=>{window.__calls.status++;return {state:'off'};},cloudCreate:async input=>{if(input.consent!==true)throw new Error('No consent');window.__calls.create++;return {state:'off',created:repo};},cloudVerify:async()=>{window.__calls.verify++;return repo;},cloudEnable:async()=>{window.__calls.enable++;return {state:'ready',repository:repo};},cloudSync:async()=>{window.__calls.sync++;return {state:'verified'};}};
   localStorage.setItem('rifttask.appearance','dark');
  });
  await page.goto('http://127.0.0.1:5197');await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Cloud',exact:true}).click();await page.getByText('Cloud off — local-only storage.').waitFor();
  await page.evaluate(()=>{const label=document.createElement('div');label.textContent='BROWSER PREVIEW · DUMMY DATA · Native confirmation & cloud SIMULATED';label.style.cssText='position:fixed;bottom:8px;right:12px;z-index:100;font:11px sans-serif;color:#333;background:white;padding:5px 9px;border:1px solid #aaa;border-radius:4px;pointer-events:none';document.body.append(label);});
  await page.getByRole('button',{name:'Create private repository',exact:true}).click();await page.getByLabel('New repository name').fill('task-data');assert.equal(await page.getByRole('button',{name:'Continue to confirmation'}).isDisabled(),true);await page.getByLabel(/Create only this private repository/).check();
  await page.screenshot({path:path.join(out,'creation-confirmation-dark.png')});assert.deepEqual(await page.evaluate(()=>window.__calls),{create:0,verify:0,enable:0,sync:0,status:1});
  await page.getByRole('button',{name:'Continue to confirmation'}).click();await page.getByText(/Created: example-developer\/task-data/).waitFor();assert.equal(await page.getByRole('button',{name:'Enable manual cloud'}).count(),0);await page.screenshot({path:path.join(out,'created-not-enabled-dark.png')});
  await page.getByRole('button',{name:'Verify repository',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Enable manual cloud'}).isDisabled(),true);
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'Back to workspace'}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();assert.equal(await page.getByRole('heading',{name:'Manual cloud',exact:true}).count(),1);}
  assert.deepEqual(await page.evaluate(()=>window.__calls),{create:1,verify:1,enable:0,sync:0,status:1});assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify({builtRenderer:true,dummyDataOnly:true,nativeConfirmationAndCloudSimulated:true,calls:await page.evaluate(()=>window.__calls),errors,overflow:false},null,2));console.log(JSON.stringify({out,errors,calls:await page.evaluate(()=>window.__calls)}));
 }finally{await browser?.close();if(server.exitCode===null){const stopped=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');await stopped;}}
})().catch(e=>{console.error(e);process.exitCode=1;});
