'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {createAuth}=require('../desktop/auth.cjs');
test('restart resumes cached identity offline, missing gh is disclosed, login never pretends offline verification',async t=>{
 const cachePath=temp(t);await createAuth({cachePath,run:async()=>JSON.stringify({id:9,login:'dev',name:'Dev'})}).login();
 const offline=createAuth({cachePath,run:async()=>{throw Object.assign(new Error('network unavailable'),{code:'ENOTFOUND'});}});
 assert.deepEqual(await offline.session(),{account:{id:9,login:'dev',name:'Dev'},offline:true,ghAvailable:true});await assert.rejects(offline.login(),/gh auth login/);
 const missing=createAuth({cachePath,run:async()=>{throw Object.assign(new Error('missing'),{code:'ENOENT'});}});assert.equal((await missing.session()).ghAvailable,false);
});
test('local logout persists disconnect and never invokes gh logout or revokes shared credentials',async t=>{
 const cachePath=temp(t);let calls=0;const run=async()=>{calls++;return JSON.stringify({id:7,login:'dev',name:'D'});};const a=createAuth({cachePath,run});await a.login();assert.deepEqual(await a.logout(),{account:null,offline:false,ghAvailable:true});assert.equal((await a.session()).account,null);assert.equal((await createAuth({cachePath,run}).session()).account,null);assert.equal(calls,1);assert.equal((await a.login()).account.id,7);
});
test('invalid or unauthorized identities never use cached account; errors are actionable without stderr secrets',async t=>{
 const cachePath=temp(t);await createAuth({cachePath,run:async()=>JSON.stringify({id:3,login:'ok'})}).login();
 for(const raw of [{id:'3',login:'ok'},{id:-3,login:'ok'},{id:3,login:'../../x'},null]){
  const a=createAuth({cachePath,run:async()=>JSON.stringify(raw)});assert.equal((await a.session()).account,null);await assert.rejects(a.login(),/gh auth login/);
 }
 const a=createAuth({cachePath,run:async()=>{throw Object.assign(new Error('secret-token'),{stderr:'HTTP 401 secret-token',code:1});}});assert.deepEqual(await a.session(),{account:null,offline:false,ghAvailable:true});await assert.rejects(a.login(),e=>/gh auth login/.test(e.message)&&!e.message.includes('secret-token'));
});
test('logout wins over an in-flight verification and remains disconnected after restart',async t=>{
 const cachePath=temp(t);let release;const pending=new Promise(resolve=>release=resolve);const a=createAuth({cachePath,run:()=>pending});const s=a.session();const out=a.logout();release(JSON.stringify({id:8,login:'dev'}));await s;await out;assert.equal((await a.session()).account,null);assert.equal((await createAuth({cachePath,run:async()=>{throw new Error('must not run');}}).session()).account,null);
});
test('rejected credentials clear offline identity so later network failure cannot resurrect it',async t=>{
 const cachePath=temp(t);let mode='ok';const run=async()=>{if(mode==='ok')return JSON.stringify({id:1,login:'dev'});if(mode==='denied')throw Object.assign(new Error('denied'),{code:1,stderr:'HTTP 401'});throw Object.assign(new Error('offline'),{code:'ENOTFOUND'});};
 const a=createAuth({cachePath,run});await a.login();mode='denied';assert.equal((await a.session()).account,null);mode='offline';assert.equal((await a.session()).account,null);assert.equal((await createAuth({cachePath,run}).session()).account,null);
});
test('default auth runner finds home-bin gh when a Linux GUI has no gh on PATH',{skip:process.platform!=='linux'},async t=>{
 const cachePath=temp(t),root=path.dirname(cachePath),bin=path.join(root,'bin');
 fs.mkdirSync(bin);
 fs.writeFileSync(path.join(bin,'gh'),'#!/bin/sh\nprintf \'%s\' \'{"id":42,"login":"gui-dev"}\'\n',{mode:0o700});
 const {execFileSync}=require('node:child_process');
 const code=`const cp=require('node:child_process'),{promisify}=require('node:util');const real=promisify(cp.execFile);cp.execFile[promisify.custom]=async(file,args,options)=>{if(file===${JSON.stringify(path.join(bin,'gh'))})return real(file,args,options);throw Object.assign(new Error('fixture PATH miss'),{code:'ENOENT'});};require(${JSON.stringify(require.resolve('../desktop/auth.cjs'))}).createAuth().session().then(s=>process.stdout.write(JSON.stringify(s)))`;
 const actual=JSON.parse(execFileSync(process.execPath,['-e',code],{env:{...process.env,HOME:root,PATH:path.join(root,'empty-path')},encoding:'utf8',timeout:10000}));
 assert.deepEqual(actual,{account:{id:42,login:'gui-dev',name:'gui-dev'},offline:false,ghAvailable:true});
});
function temp(t){const root=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'rifttask-auth-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return path.join(root,'identity.json');}
test('session verifies numeric GitHub identity using gh without exposing response extras',async t=>{
 const calls=[],cachePath=temp(t);const auth=createAuth({cachePath,run:async(...args)=>{calls.push(args);return JSON.stringify({id:123,login:'wise-dev',name:null,token:'never-cache',email:'not-needed'});}});
 assert.deepEqual(await auth.session(),{account:{id:123,login:'wise-dev',name:'wise-dev'},offline:false,ghAvailable:true});assert.equal(calls[0][0],'gh');assert.deepEqual(calls[0][1],['api','user','--hostname','github.com']);assert.equal(calls[0][2].shell,false);
 const cached=fs.readFileSync(cachePath,'utf8');assert.ok(!cached.includes('never-cache'));assert.ok(!cached.includes('email'));
 assert.deepEqual((await auth.login()).account,{id:123,login:'wise-dev',name:'wise-dev'});
});
