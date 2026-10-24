'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../desktop/core.cjs');
function fixture(){return {...core.emptyWorkspace(),categories:[{id:'cat-1',name:'Games',color:'#abcdef'}],projects:[{id:'proj-1',categoryId:'cat-1',name:'Game',description:'',repositoryUrl:'',localPath:'',archived:false}],tasks:[{id:'task-1',projectId:'proj-1',title:'Build',notes:'',status:'next',priority:'normal',dueDate:'2028-02-29',today:false,createdAt:'2026-01-01T00:00:00.000Z',completedAt:null}]};}
test('validates all schema fields, limits and references without mutation',()=>{
 const w=fixture(); w.extra='discard'; w.tasks[0].extra='discard'; const clean=core.validateWorkspace(w); assert.equal(clean.extra,undefined); assert.equal(clean.tasks[0].extra,undefined); assert.equal(w.extra,'discard'); assert.notEqual(clean.tasks[0],w.tasks[0]);
 const cases=[x=>x.version=2,x=>x.categories=null,x=>x.updatedAt='yesterday',x=>x.updatedAt='2026-02-30T00:00:00Z',x=>x.categories[0].id='../x',x=>x.categories.push({...x.categories[0]}),x=>x.categories[0].name=' ',x=>x.categories[0].color='red',x=>x.projects[0].categoryId='missing',x=>x.tasks[0].projectId='missing',x=>x.projects[0].archived='false',x=>x.projects[0].description='x'.repeat(20001),x=>x.projects[0].localPath='a\u0000b',x=>x.projects[0].repositoryUrl='javascript:alert(1)',x=>x.tasks[0].title='x'.repeat(301),x=>x.tasks[0].notes='x'.repeat(20001),x=>x.tasks[0].status='bad',x=>x.tasks[0].priority='bad',x=>x.tasks[0].today=1,x=>x.tasks[0].dueDate='2027-02-29',x=>x.tasks[0].createdAt='2026-13-01T00:00:00Z',x=>x.tasks[0].completedAt=123,x=>x.tasks=Array(10001).fill(x.tasks[0])];
 for(const mutate of cases){const x=fixture();mutate(x);assert.throws(()=>core.validateWorkspace(x),/Invalid workspace/);}
 assert.throws(()=>core.validateWorkspace(null),/Invalid workspace/);
});
test('UTF-8 payload size is capped even when every field and count is in bounds',()=>{
 const w=fixture();const task=w.tasks[0];w.tasks=Array.from({length:220},(_,i)=>({...task,id:'task-'+i,notes:'💥'.repeat(10000)}));assert.throws(()=>core.validateWorkspace(w),/Invalid workspace: size/);
});
test('explicit sample generator is valid and never seeds a blank workspace',()=>{
 const sample=core.createSampleWorkspace();assert.equal(sample.categories[0].name,'Games');assert.equal(sample.projects[0].name,'lose.DOT (sample)');assert.equal(sample.tasks.length,1);assert.deepEqual(core.validateWorkspace(sample),sample);assert.deepEqual(core.emptyWorkspace().tasks,[]);assert.notEqual(sample.tasks,core.createSampleWorkspace().tasks);
});
test('empty workspace is fresh, versioned and valid',()=>{
 const a=core.emptyWorkspace(); assert.deepEqual(a.categories,[]); assert.deepEqual(a.projects,[]); assert.deepEqual(a.tasks,[]); assert.equal(a.version,1); assert.ok(Number.isFinite(Date.parse(a.updatedAt))); assert.deepEqual(core.validateWorkspace(a),a); assert.notEqual(a,core.emptyWorkspace());
});
