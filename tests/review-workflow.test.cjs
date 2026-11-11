'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSampleWorkspace,validateWorkspace}=require('../desktop/core.cjs');
const {createStore}=require('../desktop/store.cjs');
const {createService}=require('../desktop/service.cjs');
const {projectCloudWorkspace,prepareCloudRestore}=require('../desktop/cloud-snapshot.cjs');
test('review survives real storage restart backup export import and strict cloud projection without losing rich data',async t=>{
 const root=fs.mkdtempSync(path.join(process.env.TMPDIR,'rift-review-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const w=createSampleWorkspace();w.projects[0].icon='rocket';w.projects[0].localPath='/synthetic/project';w.tasks[0].status='review';w.tasks[0].today=true;w.tasks[0].progress=[{id:'entry',createdAt:w.updatedAt,body:'**Ready**',links:['https://example.com/check'],images:[{id:'image',name:'synthetic.png',mime:'image/png',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII='}]}];
 assert.deepEqual(validateWorkspace(w),w);
 const store=createStore(root);store.save(42,w);assert.deepEqual(createStore(root).load(42),w);store.save(42,w);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'accounts/42/workspace.json.bak'),'utf8')),w);
 const backup=path.join(root,'export.json');const service=createService({auth:{session:async()=>({account:{id:42}})},store,chooseExportPath:async()=>backup,chooseImportPath:async()=>backup,confirmRestore:async()=>true});assert.equal(await service.exportBackup(),true);store.save(42,{...w,tasks:[]});assert.deepEqual(await service.importBackup(),w);assert.deepEqual(createStore(root).load(42),w);
 const scope={accountId:42,repositoryId:81},envelope=projectCloudWorkspace(w,scope);assert.equal(envelope.workspace.tasks[0].status,'review');assert.equal(JSON.stringify(envelope).includes('data:image'),false);const restored=prepareCloudRestore(JSON.stringify(envelope),w,scope);assert.deepEqual(restored,{...w,tasks:[{...w.tasks[0],progress:[{...w.tasks[0].progress[0],imageCount:1}]}]});
 for(const status of ['InReview','future','nextt']){const bad=structuredClone(w);bad.tasks[0].status=status;assert.throws(()=>validateWorkspace(bad),/Invalid workspace: enum/);const remote=structuredClone(envelope);remote.workspace.tasks[0].status=status;assert.throws(()=>prepareCloudRestore(JSON.stringify(remote),w,scope),/Invalid/);}
 const bad=structuredClone(envelope);bad.workspace.tasks[0].unexpected=true;assert.throws(()=>prepareCloudRestore(JSON.stringify(bad),w,scope),/Invalid cloud snapshot/);
 const legacy=structuredClone(w);legacy.tasks[0].status='next';assert.deepEqual(validateWorkspace(legacy),{...legacy,tasks:[{...legacy.tasks[0],status:'backlog'}]});
});
