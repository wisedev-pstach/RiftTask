'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
test('explicit PTY start uses persisted directory, clean shell environment and retains one session',async t=>{
 const {createPty}=require('../desktop/pty.cjs');const root=fs.mkdtempSync(path.join(os.tmpdir(),'rift-pty-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 let spawned=0,options,args;const callbacks={};
 const manager=createPty({resolve:async()=>({account:1,path:root}),spawn:(shell,a,o)=>{spawned++;options=o;args=a;return {onData:f=>callbacks.data=f,onExit:f=>callbacks.exit=f,write(){},resize(){},kill(){}};}});t.after(()=>manager.dispose());
 assert.equal(spawned,0);const first=await manager.start('p');callbacks.data('hello');
 const second=await manager.start('p');assert.equal(first.id,second.id);assert.equal(spawned,1);assert.equal(second.output,'hello');assert.equal(options.cwd,root);
 assert.equal(options.env.GH_TOKEN,undefined);assert.equal(options.env.NODE_OPTIONS,undefined);assert.deepEqual(args,['--noprofile','--norc']);
});
test('path/account changes and disposal invalidate in-flight starts and late events',async t=>{
 const h=fixture(t);const s=await h.manager.start('p');h.setScope({account:2,path:h.root});
 await assert.rejects(h.manager.read('p',s.id),/session/i);assert.equal(h.children[0].killed,1);
 const next=await h.manager.start('p');h.children[0].data('old account secret');assert.equal((await h.manager.read('p',next.id)).output,'');
 h.setScope(null);await h.manager.audit();assert.equal(h.children[1].killed,1);
 let release;const m=require('../desktop/pty.cjs').createPty({resolve:()=>new Promise(r=>release=r),spawn:()=>{throw new Error('must not spawn');}});
 const pending=m.start('p');m.dispose();release({account:1,path:h.root});await assert.rejects(pending,/closed/i);
});
test('caps sessions and kills output floods; input rate is bounded',async t=>{
 const h=fixture(t);const s=await h.manager.start('p');for(let i=0;i<3;i++)await h.manager.start('p'+i);await assert.rejects(h.manager.start('overflow'),/limit/i);
 for(let i=0;i<16;i++)await h.manager.input('p',s.id,'x'.repeat(4096));await assert.rejects(h.manager.input('p',s.id,'x'),/rate/i);
 h.children[0].data('x'.repeat(1048577));assert.equal(h.children[0].killed,1);await assert.rejects(h.manager.read('p',s.id),/session/i);
});
test('disappearing or redirected local directories close the old shell before any input',async t=>{
 const h=fixture(t);const dir=path.join(h.root,'local');fs.mkdirSync(dir);h.setScope({account:1,path:dir});const s=await h.manager.start('p');fs.rmdirSync(dir);
 await assert.rejects(h.manager.input('p',s.id,'must not run'),/directory|scope/i);assert.equal(h.children[0].killed,1);assert.deepEqual(h.children[0].writes,[]);
});
test('bounds concurrent asynchronous scope checks before starting shells',async t=>{
 const h=fixture(t);const releases=[];let spawned=0;const m=require('../desktop/pty.cjs').createPty({resolve:()=>new Promise(r=>releases.push(r)),spawn:()=>{spawned++;throw new Error('unexpected');}});t.after(()=>m.dispose());
 const pending=Array.from({length:16},()=>m.start('p').catch(e=>e));const overflow=m.start('p').then(()=>false,error=>/busy|limit/i.test(error.message));const rejected=await Promise.race([overflow,new Promise(r=>setTimeout(()=>r(false),20))]);m.dispose();for(const release of releases)release({account:1,path:h.root});await Promise.all(pending);await overflow;assert.equal(rejected,true);assert.equal(spawned,0);
});
test('teardown after scope validation cancels start before shell creation',async t=>{
 for(const action of ['reset','dispose']){
  let release,spawned=0;
  const m=require('../desktop/pty.cjs').createPty({resolve:()=>new Promise(r=>release=r),spawn:()=>{spawned++;return {onData(){},onExit(){},kill(){}};}});
  t.after(()=>m.dispose());
  const pending=m.start('p');release({account:1,path:process.cwd()});
  queueMicrotask(()=>m[action]());
  await assert.rejects(pending,/closed/i);assert.equal(spawned,0);
 }
});
function fixture(t){
 const {createPty}=require('../desktop/pty.cjs');const root=fs.mkdtempSync(path.join(os.tmpdir(),'rift-pty-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 let scope={account:1,path:root};const children=[];
 const manager=createPty({resolve:async()=>{if(!scope)throw new Error('No project');return {...scope};},spawn:()=>{const c={killed:0,writes:[],sizes:[],onData(f){this.data=f;},onExit(f){this.exit=f;},kill(){this.killed++;},write(s){this.writes.push(s);},resize(...s){this.sizes.push(s);}};children.push(c);return c;}});t.after(()=>manager.dispose());
 return {manager,children,setScope:s=>scope=s,root};
}
test('bounded input/resize operate only on the current session token; output is retained within limits',async t=>{
 const {manager:m,children}=fixture(t);const s=await m.start('p');
 await m.input('p',s.id,'echo hi\r');await m.resize('p',s.id,100,30);assert.deepEqual(children[0].writes,['echo hi\r']);assert.deepEqual(children[0].sizes,[[100,30]]);
 await assert.rejects(m.input('p','stale','x'),/session/i);await assert.rejects(m.input('p',s.id,'x'.repeat(4097)),/input/i);await assert.rejects(m.resize('p',s.id,10000,30),/size/i);
 children[0].data('x'.repeat(300000));const state=await m.read('p',s.id);assert.ok(state.output.length<=65536);assert.ok(state.revision>0);
 await m.close('p',s.id);assert.equal(children[0].killed,1);children[0].data('late');await assert.rejects(m.read('p',s.id),/session/i);
});
