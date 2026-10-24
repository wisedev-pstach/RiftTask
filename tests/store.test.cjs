'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {emptyWorkspace}=require('../desktop/core.cjs');const {createStore}=require('../desktop/store.cjs');
test('atomic replacement retains backup and corrupt primary is preserved before explicit recovery',t=>{
 const root=temp(t),s=createStore(root),a=emptyWorkspace();s.save(12,a);const b={...a,updatedAt:'2026-03-01T00:00:00.000Z'};s.save(12,b);
 const file=path.join(root,'accounts','12','workspace.json');assert.deepEqual(JSON.parse(fs.readFileSync(file+'.bak','utf8')),a);assert.equal(fs.readdirSync(path.dirname(file)).filter(x=>x.includes('.tmp-')).length,0);
 fs.writeFileSync(file,'{broken');assert.throws(()=>s.load(12),e=>e.code==='WORKSPACE_RECOVERED'&&e.recovered===true&&fs.readFileSync(e.corruptPath,'utf8')==='{broken');assert.deepEqual(s.load(12),a);
 assert.equal(fs.statSync(file).mode&0o777,0o600);
});
test('unrecoverable corruption blocks save without replacing the original',t=>{
 const root=temp(t),s=createStore(root);s.save(1,emptyWorkspace());const file=path.join(root,'accounts','1','workspace.json');fs.writeFileSync(file,'bad');assert.throws(()=>s.load(1),e=>e.code==='WORKSPACE_CORRUPT');assert.throws(()=>s.save(1,emptyWorkspace()),e=>e.code==='WORKSPACE_CORRUPT');assert.equal(fs.readFileSync(file,'utf8'),'bad');
});
test('symlink account directories or workspace files cannot redirect persistence',t=>{
 const root=temp(t),outside=temp(t),s=createStore(root);fs.mkdirSync(path.join(root,'accounts'));fs.symlinkSync(outside,path.join(root,'accounts','1'),'dir');assert.throws(()=>s.save(1,emptyWorkspace()),/symlink/i);assert.deepEqual(fs.readdirSync(outside),[]);
 fs.mkdirSync(path.join(root,'accounts','2'));const target=path.join(outside,'target.json');fs.writeFileSync(target,JSON.stringify(emptyWorkspace()));fs.symlinkSync(target,path.join(root,'accounts','2','workspace.json'));assert.throws(()=>s.load(2),/symlink/i);
});
test('complete task workspace roundtrips across fresh stores and alternating accounts',t=>{
 const root=temp(t),s=createStore(root),a=require('../desktop/core.cjs').createSampleWorkspace();a.tasks[0]={...a.tasks[0],notes:'Unicode 🎮',status:'done',priority:'high',dueDate:'2028-02-29',today:true,completedAt:a.updatedAt};
 const b=structuredClone(a);b.tasks[0].title='Other account';s.save(21,a);s.save(22,b);assert.deepEqual(createStore(root).load(21),a);assert.deepEqual(createStore(root).load(22),b);assert.deepEqual(s.load(23).tasks,[]);
});
function temp(t){const root=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'rifttask-store-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('account workspaces persist across restart and are isolated with safe numeric paths',t=>{
 const root=temp(t),s=createStore(root);assert.deepEqual(s.load(12).tasks,[]);const w=emptyWorkspace();w.categories=[{id:'c1',name:'Mine',color:'#123456'}];assert.deepEqual(s.save(12,w),w);assert.deepEqual(createStore(root).load(12),w);assert.deepEqual(s.load(13).categories,[]);assert.ok(fs.existsSync(path.join(root,'accounts','12','workspace.json')));
 for(const bad of ['../x','12','001',0,-1,1.5,NaN,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>s.load(bad),/account/i);
 const before=fs.readFileSync(path.join(root,'accounts','12','workspace.json'),'utf8');assert.throws(()=>s.save(12,{version:2}),/Invalid workspace/);assert.equal(fs.readFileSync(path.join(root,'accounts','12','workspace.json'),'utf8'),before);
});
