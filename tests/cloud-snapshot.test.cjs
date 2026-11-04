'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSampleWorkspace}=require('../desktop/core.cjs');
const cloud=require('../desktop/cloud-snapshot.cjs');
test('cloud projection rejects invalid account/repository scope',()=>{
 for(const bad of [undefined,null,{}, {accountId:0,repositoryId:81},{accountId:42,repositoryId:'81'},{accountId:NaN,repositoryId:81},{accountId:42,repositoryId:Number.MAX_SAFE_INTEGER+1}]){
  assert.throws(()=>cloud.projectCloudWorkspace(fixture(),bad),/Invalid cloud scope/);
 }
});
test('projection refuses unsupported fields instead of silently dropping future data',()=>{
 for(const add of [w=>w.futureField=[],w=>w.projects[0].milestones=[],w=>w.tasks[0].futureField='future']){
  const w=fixture();add(w);assert.throws(()=>cloud.projectCloudWorkspace(w,scope),/Unsupported cloud workspace/);
 }
});
test('remote snapshot preparation retains only this device project paths by exact project ID',()=>{
 const local=fixture(),remote=fixture();remote.projects[0].localPath='/other-machine/path';remote.tasks[0].notes='Remote note';
 remote.projects.push({...remote.projects[0],id:'new-project',localPath:'/other-machine/new'});
 const wire=JSON.stringify(cloud.projectCloudWorkspace(remote,scope));const before=structuredClone(local);
 const result=cloud.prepareCloudRestore(wire,local,scope);
 assert.equal(result.projects[0].localPath,'/private/device/project');assert.equal(result.projects[1].localPath,'');
 assert.equal(result.tasks[0].notes,'Remote note');assert.deepEqual(local,before);
 assert.deepEqual(result.tasks,remote.tasks);
});
test('restore rejects wrong scope, unsupported format/fields and remote device paths',()=>{
 const local=fixture();
 for(const mutate of [e=>e.accountId=43,e=>e.repositoryId=82,e=>e.formatVersion=2,e=>e.extra='unknown',e=>e.workspace.projects[0].localPath='/remote',e=>e.workspace.tasks[0].milestoneId='future',e=>e.workspace.tasks[0].projectId='missing',e=>e.workspace.tasks[0].status='next']){
  const e=cloud.projectCloudWorkspace(local,scope);mutate(e);
  assert.throws(()=>cloud.prepareCloudRestore(JSON.stringify(e),local,scope),/Invalid cloud snapshot/);
 }
 for(const bad of [undefined,{}, {accountId:42,repositoryId:0}])assert.throws(()=>cloud.prepareCloudRestore(JSON.stringify(cloud.projectCloudWorkspace(local,scope)),local,bad),/Invalid cloud scope/);
});
test('cloud JSON is bounded to 512 KiB UTF-8 before parsing or projection transfer preparation',()=>{
 const local=fixture();
 for(const bad of [null,{},'{secret note', ' '.repeat(512*1024+1),JSON.stringify({secret:'é'.repeat(256*1024)})]){
  assert.throws(()=>cloud.prepareCloudRestore(bad,local,scope),/^Error: Invalid cloud snapshot$/);
 }
 const large=fixture();large.tasks=Array.from({length:30},(_,i)=>({...large.tasks[0],id:`task-${i}`,notes:'é'.repeat(19000)}));
 assert.throws(()=>cloud.projectCloudWorkspace(large,scope),/Cloud snapshot exceeds 512 KiB/);
 // Whitespace contributes to wire size even though it is absent after parsing.
 const wire=JSON.stringify(cloud.projectCloudWorkspace(local,scope));
 const padded=wire+' '.repeat(512*1024-Buffer.byteLength(wire));
 assert.equal(cloud.prepareCloudRestore(padded,local,scope).tasks.length,1);
});
const scope={accountId:42,repositoryId:81};
function fixture(){const w=createSampleWorkspace();w.projects[0].localPath='/private/device/project';w.tasks[0].notes='Keep these notes';return w;}
test('cloud projection removes device paths without mutating or losing canonical task data',()=>{
 const w=fixture(),before=structuredClone(w);
 const result=cloud.projectCloudWorkspace(w,scope);
 assert.deepEqual(result,{formatVersion:1,...scope,workspace:{...w,projects:w.projects.map(p=>({...p,localPath:''}))}});
 assert.deepEqual(w,before);
 assert.equal(JSON.stringify(result).includes('/private/device/project'),false);
 result.workspace.tasks[0].notes='changed';assert.equal(w.tasks[0].notes,'Keep these notes');
});
