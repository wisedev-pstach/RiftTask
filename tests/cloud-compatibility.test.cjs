'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSampleWorkspace,validateWorkspace}=require('../desktop/core.cjs');
const cloud=require('../desktop/cloud-snapshot.cjs');
const scope={accountId:42,repositoryId:81};
const timestamp='2026-11-07T12:00:00.000Z';
function fixture(){const w=createSampleWorkspace();w.updatedAt=timestamp;w.projects[0].icon='game';w.tasks[0].createdAt=timestamp;w.tasks[0].progress=[{id:'progress-1',createdAt:timestamp,body:'Synthetic milestone reached',links:['https://example.com/build'],imageCount:1}];return w;}
function envelope(w=fixture()){return {formatVersion:1,...scope,workspace:w};}
test('newer canonical progress/icon envelope restores without Invalid cloud snapshot',()=>{
 const remote=fixture();assert.deepEqual(cloud.prepareCloudRestore(JSON.stringify(envelope(remote)),createSampleWorkspace(),scope),remote);
 assert.deepEqual(validateWorkspace(remote),remote);
 for(const omit of [w=>delete w.projects[0].icon,w=>delete w.tasks[0].progress]){const one=fixture();omit(one);assert.deepEqual(cloud.prepareCloudRestore(JSON.stringify(envelope(one)),createSampleWorkspace(),scope),one);}
});
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';
function image(id='image-1'){return {id,name:'synthetic.png',mime:'image/png',dataUrl:png};}
test('local attachments are redacted before cloud sizing and restored only by project/task/entry identity',()=>{
 const local=fixture();local.projects[0].localPath='/synthetic/device';
 const entry=local.tasks[0].progress[0];entry.images=[image()];
 // Signature-valid bounded synthetic PNG buffers: total local payload exceeds cloud limit.
 const bytes=Buffer.alloc(200*1024);Buffer.from('89504e470d0a1a0a','hex').copy(bytes);
 entry.images=Array.from({length:3},(_,i)=>({...image('image-'+i),dataUrl:'data:image/png;base64,'+bytes.toString('base64')}));entry.imageCount=3;
 const before=structuredClone(local),projected=cloud.projectCloudWorkspace(local,scope);
 assert.ok(Buffer.byteLength(JSON.stringify(local))>512*1024);
 assert.equal(projected.workspace.tasks[0].progress[0].images,undefined);
 assert.equal(projected.workspace.tasks[0].progress[0].imageCount,3);
 assert.equal(projected.workspace.projects[0].localPath,'');assert.deepEqual(local,before);
 const wire=JSON.stringify(projected),restored=cloud.prepareCloudRestore(wire,local,scope);
 assert.deepEqual(restored,local);
 for(const mutate of [w=>w.tasks[0].id='different',w=>w.tasks[0].progress[0].id='different',w=>{w.projects.push({...w.projects[0],id:'other'});w.tasks[0].projectId='other';}]){
  const unrelated=structuredClone(local);mutate(unrelated);
  assert.equal(cloud.prepareCloudRestore(wire,unrelated,scope).tasks[0].progress[0].images,undefined);
 }
 const remoteWithImages=envelope(local);remoteWithImages.workspace.projects[0].localPath='';
 assert.throws(()=>cloud.prepareCloudRestore(JSON.stringify(remoteWithImages),local,scope),/Invalid cloud snapshot/);
 const small=fixture();small.tasks[0].progress[0].images=[image()];
 assert.throws(()=>cloud.prepareCloudRestore(JSON.stringify(envelope(small)),local,scope),/Invalid cloud snapshot/);
});
test('progress, icons, links and device-only images survive real store restart/edit/upload/save',t=>{
 const fs=require('node:fs'),path=require('node:path'),{createStore}=require('../desktop/store.cjs');
 const root=fs.mkdtempSync(path.join(process.env.TMPDIR,'rift-compat-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const initial=fixture();initial.projects[0].localPath='/synthetic/device';initial.tasks[0].progress[0].images=[image()];
 const store=createStore(root);store.save(42,initial);assert.deepEqual(createStore(root).load(42),initial);
 const edited=createStore(root).load(42);edited.tasks[0].title='Edited title';store.save(42,edited);
 const restored=cloud.prepareCloudRestore(JSON.stringify(cloud.projectCloudWorkspace(edited,scope)),store.load(42),scope);
 store.save(42,restored);assert.deepEqual(createStore(root).load(42),edited);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'accounts/42/workspace.json'),'utf8')),edited);
});
test('strict progress validation rejects unsafe links, invalid attachments, unknown fields and bounds',()=>{
 const mutations=[e=>e.links=['javascript:alert(1)'],e=>e.links=['file:///x'],e=>e.links=['https://user:pass@example.com'],e=>e.links=['http:example.com'],e=>e.links=['https://example.com\\evil'],e=>e.links=['https://example.com/ x'],e=>e.links=Array(11).fill('https://example.com'),e=>e.body='x'.repeat(4001),e=>e.createdAt='yesterday',e=>e.id='../bad',e=>e.extra=true,e=>e.imageCount=4,e=>e.imageCount=-1,e=>e.imageCount=0.5,e=>e.imageCount=0,e=>e.images[0].extra=true,e=>e.images[0].mime='image/svg+xml',e=>e.images[0].dataUrl='data:image/png;base64,PGh0bWw+',e=>e.images[0].dataUrl=png+'!',e=>e.images[0].dataUrl='data:image/png;base64,'+Buffer.alloc(256*1024+1).toString('base64'),e=>e.images.push(image()),e=>e.images=Array.from({length:4},(_,i)=>image('image-'+i)),e=>{e.body='';e.links=[];e.images=[];e.imageCount=0;}];
 for(const mutate of mutations){const w=fixture();w.tasks[0].progress[0].images=[image()];mutate(w.tasks[0].progress[0]);assert.throws(()=>validateWorkspace(w),/Invalid workspace/);}
 for(const mutate of [w=>w.tasks[0].progress.push({...w.tasks[0].progress[0]}),w=>w.tasks[0].progress=Array.from({length:101},(_,i)=>({...w.tasks[0].progress[0],id:'entry-'+i})),w=>w.projects[0].icon='unknown']){const w=fixture();mutate(w);assert.throws(()=>validateWorkspace(w),/Invalid workspace/);}
});
test('cloud restore still rejects unknown fields at every level, invalid roots, versions and nonnumeric scopes',()=>{
 for(const mutate of [e=>e.extra=true,e=>e.formatVersion=2,e=>e.accountId='42',e=>e.repositoryId=82,e=>e.workspace.version=2,e=>e.workspace.extra=true,e=>e.workspace.categories[0].collapsed=true,e=>e.workspace.projects[0].extra=true,e=>e.workspace.tasks[0].extra=true,e=>e.workspace.tasks[0].progress[0].extra=true]){
  const e=envelope();mutate(e);assert.throws(()=>cloud.prepareCloudRestore(JSON.stringify(e),fixture(),scope),/Invalid cloud snapshot/);
 }
 for(const root of [null,[],{},42,'text'])assert.throws(()=>cloud.prepareCloudRestore(JSON.stringify(root),fixture(),scope),/Invalid cloud snapshot/);
 for(const bad of [{accountId:'42',repositoryId:81},{accountId:42,repositoryId:'81'},{accountId:-1,repositoryId:81},{accountId:42,repositoryId:0}])assert.throws(()=>cloud.prepareCloudRestore(JSON.stringify(envelope()),fixture(),bad),/Invalid cloud scope/);
});
test('legacy workspace remains unchanged and icon manifest is included in desktop packaging',()=>{
 const fs=require('node:fs'),path=require('node:path'),pkg=require('../package.json'),lock=require('../package-lock.json');
 const old=createSampleWorkspace();assert.deepEqual(validateWorkspace(old),old);
 assert.deepEqual(cloud.prepareCloudRestore(JSON.stringify(cloud.projectCloudWorkspace(old,scope)),old,scope),old);
 assert.ok(pkg.build.files.includes('desktop/**/*'));assert.ok(fs.existsSync(path.join(__dirname,'../desktop/project-icons.json')));
 assert.equal(pkg.version,'0.1.1');assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);
});
