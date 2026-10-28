'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {createService}=require('../desktop/service.cjs');const {createStore}=require('../desktop/store.cjs');const {createSampleWorkspace}=require('../desktop/core.cjs');
test('logout blocks a new PTY start while disconnect is still pending',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rift-pty-disconnect-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const store=createStore(root);const w=createSampleWorkspace();w.projects[0].localPath=root;store.save(1,w);let finish,spawned=0;
 const service=createService({store,auth:{session:async()=>({account:{id:1}}),logout:()=>new Promise(r=>finish=r)},ptySpawn:()=>{spawned++;return {onData(){},onExit(){},kill(){}};}});t.after(()=>service.dispose());
 await service.session();const pending=service.logout();await assert.rejects(service.ptyStart(w.projects[0].id));assert.equal(spawned,0);finish({account:null});await pending;
});
test('PTY service gates persisted local projects and closes sessions on save, logout, account switch and window close',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rift-pty-service-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));let account={id:1};let killed=0,spawned=0;
 const store=createStore(root);let w=createSampleWorkspace();w.projects[0].localPath=root;store.save(1,w);const p=w.projects[0].id;
 const service=createService({store,auth:{session:async()=>({account}),logout:async()=>{account=null;return {account};}},ptySpawn:()=>{spawned++;return {onData(){},onExit(){},kill(){killed++;},write(){},resize(){}};}});t.after(()=>service.dispose());
 await assert.rejects(service.ptyStart('/renderer/path'));await assert.rejects(service.ptyStart({command:'bad'}));assert.equal(spawned,0);
 const s=await service.ptyStart(p);assert.equal((await service.ptyStart(p)).id,s.id);assert.equal(spawned,1);
 w.projects[0].localPath='';await service.save(w);assert.equal(killed,1);await assert.rejects(service.ptyStart(p));
 w.projects[0].localPath=root;await service.save(w);await service.ptyStart(p);await service.logout();assert.equal(killed,2);await assert.rejects(service.ptyStart(p));
 account={id:1};await service.session();await service.ptyStart(p);account={id:2};await service.session();await assert.rejects(service.ptyRead(p,s.id));assert.equal(killed,3);
 account={id:1};await service.session();await service.ptyStart(p);service.closeTerminals();assert.equal(killed,4);
});
