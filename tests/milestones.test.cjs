'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSampleWorkspace,validateWorkspace}=require('../desktop/core.cjs');
function fixture(){const w=createSampleWorkspace();w.milestones=[{id:'release',projectId:w.projects[0].id,name:'First playable',color:'#79bbaa'}];w.tasks[0].milestoneId='release';return w;}
test('milestone schema survives real account store restart, rolling backup and cloud projection/restore',()=>{
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
 const {createStore}=require('../desktop/store.cjs');
 const {projectCloudWorkspace,prepareCloudRestore}=require('../desktop/cloud-snapshot.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rifttask-milestones-'));
 try{
  const w=fixture();w.projects[0].localPath='/this-device/game';
  createStore(dir).save(42,w);assert.deepEqual(createStore(dir).load(42),w);
  const envelope=projectCloudWorkspace(w,{accountId:42,repositoryId:81});
  assert.equal(envelope.workspace.projects[0].localPath,'');assert.deepEqual(envelope.workspace.milestones,w.milestones);assert.deepEqual(envelope.workspace.tasks,w.tasks);
  const restored=prepareCloudRestore(JSON.stringify(envelope),w,{accountId:42,repositoryId:81});assert.deepEqual(restored,w);
  const changed=structuredClone(w);changed.milestones[0].name='Renamed release';createStore(dir).save(42,changed);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'accounts/42/workspace.json.bak'),'utf8')),w);
  createStore(dir).save(42,restored);assert.deepEqual(createStore(dir).load(42),w);
  const old=createSampleWorkspace();assert.deepEqual(validateWorkspace(old),old);assert.equal('milestones' in validateWorkspace(old),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('milestone labels and task assignments survive canonical validation without mutation',()=>{
 const w=fixture(),before=structuredClone(w);
 assert.deepEqual(validateWorkspace(w),w);assert.deepEqual(w,before);
});
test('milestone assignments must reference a label in the same project',()=>{
 for(const mutate of [w=>w.tasks[0].milestoneId='missing',w=>{w.projects.push({...w.projects[0],id:'other'});w.milestones[0].projectId='other';},w=>w.milestones[0].projectId='missing',w=>w.milestones.push({...w.milestones[0]}),w=>w.milestones[0].name=' ',w=>w.milestones[0].color='red',w=>w.milestones=null,w=>w.tasks[0].milestoneId=null]){
  const w=fixture();mutate(w);assert.throws(()=>validateWorkspace(w),/Invalid workspace/);
 }
});
