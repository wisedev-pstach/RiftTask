'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createAuth}=require('../desktop/auth.cjs');
const denied=()=>Object.assign(new Error('secret'),{code:1,stderr:'HTTP 401 secret'});
test('sign-in launches official CLI only when unauthenticated; pending never becomes an account; check only verifies',async()=>{
 let signed=false,launches=0;const calls=[];
 const auth=createAuth({run:async(_file,args)=>{calls.push(args);if(signed)return JSON.stringify({id:4,login:'dev'});throw denied();},launchLogin:async()=>{launches++;}});
 const pending=await auth.login();assert.equal(pending.account,null);assert.equal(pending.loginPending,true);assert.equal(launches,1);
 await auth.login();assert.equal(launches,1);
 await assert.rejects(auth.checkLogin(),/verified/);assert.equal(launches,1);
 await auth.login();assert.equal(launches,2); // explicit retry after a failed check, e.g. a closed terminal
 signed=true;assert.equal((await auth.checkLogin()).account.id,4);await auth.login();assert.equal(launches,2);
 assert.ok(calls.every(a=>!a.includes('logout')&&!a.includes('token')));
});
test('disconnect invalidates a pending sign-in before it can launch a terminal',async()=>{
 let release,launches=0;const gate=new Promise(resolve=>release=resolve);const auth=createAuth({launchLogin:async()=>{launches++;},run:async()=>{await gate;throw denied();}});
 const pending=auth.login();await new Promise(resolve=>setImmediate(resolve));const logout=auth.logout();release();await assert.rejects(pending,/changed|disconnect/i);await logout;assert.equal(launches,0);assert.equal((await auth.session()).account,null);
});
test('disconnect before queued sign-in starts prevents native launch',async()=>{
 let launches=0;const auth=createAuth({launchLogin:async()=>launches++,run:async()=>{throw denied();}});const pending=auth.login();const out=auth.logout();await assert.rejects(pending,/disconnect/i);await out;assert.equal(launches,0);
});
test('api rejection with a working shared CLI status never launches account-changing authentication',async()=>{
 let launches=0;const auth=createAuth({launchLogin:async()=>launches++,run:async(_file,args)=>{if(args[0]==='auth')return '';throw denied();}});await assert.rejects(auth.login(),/verified/);assert.equal(launches,0);
});
test('existing authenticated CLI and offline failure never launch login or change shared credentials',async()=>{
 let launches=0;const launchLogin=async()=>{launches++;};
 const valid=createAuth({launchLogin,run:async()=>JSON.stringify({id:5,login:'existing'})});assert.equal((await valid.login()).account.id,5);
 const offline=createAuth({launchLogin,run:async()=>{throw Object.assign(new Error('secret'),{code:'ENOTFOUND'});}});await assert.rejects(offline.login(),e=>!e.message.includes('secret'));assert.equal(launches,0);
});
