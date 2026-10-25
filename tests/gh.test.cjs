'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createGhRunner}=require('../desktop/gh.cjs');

for(const [platform,env,expected] of [
 ['win32',{ProgramFiles:'C:\\Program Files',LOCALAPPDATA:'C:\\Users\\dev\\AppData\\Local'},['gh','C:\\Program Files\\GitHub CLI\\gh.exe','C:\\Users\\dev\\AppData\\Local\\Programs\\GitHub CLI\\gh.exe','C:\\Users\\dev\\AppData\\Local\\Microsoft\\WinGet\\Links\\gh.exe']],
 ['linux',{HOME:'/opt/data'},['gh','/usr/local/bin/gh','/usr/bin/gh','/opt/data/bin/gh']],
 ['darwin',{HOME:'/Users/dev'},['gh','/opt/homebrew/bin/gh','/usr/local/bin/gh']]
]) test(`missing PATH searches only known ${platform} gh executable locations`,async()=>{
 const calls=[];
 const run=createGhRunner({platform,env,execute:async file=>{calls.push(file);throw Object.assign(new Error('missing'),{code:'ENOENT'});}});
 await assert.rejects(run('gh',[],{shell:false}),{code:'ENOENT'});
 assert.deepEqual(calls,expected);
});

for(const code of [1,'EACCES','ETIMEDOUT']) test(`gh ${code} failure never falls through to another installation`,async()=>{
 const calls=[],failure=Object.assign(new Error('sensitive stderr'),{code});
 const run=createGhRunner({platform:'darwin',execute:async file=>{calls.push(file);throw failure;}});
 await assert.rejects(run('gh',[],{}),error=>error===failure);
 assert.deepEqual(calls,['gh']);
});

test('fallback authentication failure never probes a different gh installation',async()=>{
 const calls=[],failure=Object.assign(new Error('denied'),{code:1});
 const run=createGhRunner({platform:'darwin',execute:async file=>{calls.push(file);if(file==='gh')throw Object.assign(new Error('missing'),{code:'ENOENT'});throw failure;}});
 await assert.rejects(run('gh',[],{}),error=>error===failure);
 assert.deepEqual(calls,['gh','/opt/homebrew/bin/gh']);
});

test('relative or control-character installation roots are never executable candidates',async()=>{
 const calls=[];
 const run=createGhRunner({platform:'win32',env:{ProgramFiles:'.\\untrusted',LOCALAPPDATA:'C:\\bad\nroot'},execute:async file=>{calls.push(file);throw Object.assign(new Error('missing'),{code:'ENOENT'});}});
 await assert.rejects(run('gh',[],{}),{code:'ENOENT'});
 assert.deepEqual(calls,['gh']);
});

test('successful PATH gh remains preferred without probing other installations',async()=>{
 const calls=[];
 const run=createGhRunner({execute:async file=>{calls.push(file);return {stdout:'ok'};}});
 assert.equal(await run('gh',[],{}),'ok');
 assert.deepEqual(calls,['gh']);
});

test('GUI launch falls back to official macOS gh locations only when PATH has no gh',async()=>{
 const calls=[];
 const run=createGhRunner({platform:'darwin',env:{HOME:'/Users/dev'},execute:async(file,args,options)=>{
  calls.push({file,args,options});
  if(file!=='/opt/homebrew/bin/gh')throw Object.assign(new Error('missing'),{code:'ENOENT'});
  return {stdout:'verified identity'};
 }});
 const args=['api','user','--hostname','github.com'];
 assert.equal(await run('gh',args,{timeout:15000,shell:false,maxBuffer:65536,windowsHide:true}),'verified identity');
 assert.deepEqual(calls.map(c=>c.file),['gh','/opt/homebrew/bin/gh']);
 assert.deepEqual(calls[1].args,args);
 assert.equal(calls[1].options.shell,false);
 assert.equal(calls[1].options.timeout,15000);
 assert.equal(calls[1].options.maxBuffer,65536);
 assert.equal(calls[1].options.windowsHide,true);
});
