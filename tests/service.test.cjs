const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createService} = require('../desktop/service.cjs');

const workspace = {version:1,categories:[],projects:[],tasks:[],updatedAt:'2026-10-24T00:00:00.000Z'};
function setup(account = {id:17,login:'solo',name:'Solo'}) {
  const calls=[];
  const auth={session:async()=>({account,offline:false,ghAvailable:true}),login:async()=>({account,offline:false,ghAvailable:true}),logout:async()=>{account=null;}};
  const store={load:async(id)=>{calls.push(['load',id]);return workspace;},save:async(id,data)=>{calls.push(['save',id,data]);return data;}};
  return {service:createService({auth,store}),calls};
}
test('load uses authenticated account ID, not renderer-selected identity',async()=>{
 const {service,calls}=setup();assert.deepEqual(await service.load(99),workspace);assert.deepEqual(calls,[['load',17]]);
});
test('load rejects disconnected users before reading disk',async()=>{
 const {service,calls}=setup(null);await assert.rejects(service.load(),/sign in/i);assert.equal(calls.length,0);
});
test('save derives the account from main-process authentication',async()=>{
 const {service,calls}=setup();assert.deepEqual(await service.save(workspace),workspace);assert.deepEqual(calls,[['save',17,workspace]]);
});
test('external GitHub account switching cannot write an open workspace into a different account',async()=>{
 let account={id:17,login:'first',name:'First'};const writes=[];
 const auth={session:async()=>({account,offline:false,ghAvailable:true}),login:async()=>({account}),logout:async()=>{}};
 const service=createService({auth,store:{load:async()=>workspace,save:async(id,data)=>{writes.push(id);return data;}}});
 await service.session();await service.load();account={id:28,login:'second',name:'Second'};
 await assert.rejects(service.save(workspace),/account changed/i);assert.deepEqual(writes,[]);
 await service.session();await service.load();await service.save(workspace);assert.deepEqual(writes,[28]);
});
test('logout blocks subsequent saves without revoking shared GitHub credentials',async()=>{
 const {service,calls}=setup();await service.logout();await assert.rejects(service.save(workspace),/sign in/i);assert.equal(calls.length,0);
});
