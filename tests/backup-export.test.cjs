'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createService}=require('../desktop/service.cjs');
const {createStore}=require('../desktop/store.cjs');
const {emptyWorkspace}=require('../desktop/core.cjs');
function fixture(t,chooseExportPath) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rift-export-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 let account={id:17,login:'solo',name:'Solo'};
 const store=createStore(path.join(root,'app'));const workspace=emptyWorkspace();workspace.categories.push({id:'cat',name:'Personal',color:'#123456'});store.save(17,workspace);
 const service=createService({auth:{session:async()=>({account})},store,chooseExportPath});
 return {root,store,workspace,service,switchAccount:value=>{account=value;}};
}
test('export rejects an account change while loading the selected workspace',async t=>{
 let target;const h=fixture(t,async()=>target);target=path.join(h.root,'switched.json');
 const load=h.store.load;h.store.load=id=>{const data=load(id);h.switchAccount({id:28});return data;};
 await assert.rejects(h.service.exportBackup(),/account changed/i);assert.equal(fs.existsSync(target),false);
});
test('export cancellation and disconnected sessions create no files',async t=>{
 let dialogs=0;const h=fixture(t,async()=>{dialogs++;return null;});
 assert.equal(await h.service.exportBackup(),false);assert.equal(dialogs,1);
 h.switchAccount(null);await assert.rejects(h.service.exportBackup(),/sign in/i);assert.equal(dialogs,1);
});
test('export never replaces existing files, account persistence or symlink targets',async t=>{
 let target;const h=fixture(t,async()=>target);
 const existing=path.join(h.root,'existing.json');fs.writeFileSync(existing,'keep me');
 const link=path.join(h.root,'link.json');fs.symlinkSync(existing,link);
 const primary=path.join(h.root,'app','accounts','17','workspace.json');const before=fs.readFileSync(primary,'utf8');
 for(target of [existing,link,primary])await assert.rejects(h.service.exportBackup(),/already exists/);
 assert.equal(fs.readFileSync(existing,'utf8'),'keep me');assert.equal(fs.readFileSync(primary,'utf8'),before);
});
test('export rechecks account after dialog and does not leak filesystem error details',async t=>{
 let target;let h=fixture(t,async()=>{h.switchAccount({id:28});return target;});target=path.join(h.root,'backup.json');
 await assert.rejects(h.service.exportBackup(),/account changed/i);assert.equal(fs.existsSync(target),false);
 h=fixture(t,async()=>path.join(h.root,'secret-missing-directory','backup.json'));
 await assert.rejects(h.service.exportBackup(),error=>/writable destination/.test(error.message)&&!error.message.includes('secret-missing'));
});
test('export refuses invalid workspace data before creating an output file',async t=>{
 let target;const h=fixture(t,async()=>target);target=path.join(h.root,'backup.json');h.store.load=()=>({version:999});
 await assert.rejects(h.service.exportBackup());assert.equal(fs.existsSync(target),false);
});
test('export sanitizes write, fsync, close and cleanup failures',async()=>{
 const vm=require('node:vm');const {createRequire}=require('node:module');
 const file=path.resolve(__dirname,'../desktop/service.cjs');
 for(const failure of ['write','fsync','close','unlink']) {
  const io={openSync:()=>42,writeFileSync:()=>{},fsyncSync:()=>{},closeSync:()=>{},unlinkSync:()=>{}};
  const fail=()=>{throw Object.assign(new Error('/private/secret/backup.json'),{code:'EACCES'});};
  if(failure==='write'||failure==='unlink')io.writeFileSync=fail;
  if(failure==='fsync')io.fsyncSync=fail;
  if(failure==='close')io.closeSync=fail;
  if(failure==='unlink')io.unlinkSync=fail;
  const sandbox={module:{exports:{}},require:name=>name==='node:fs'?io:createRequire(file)(name)};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox);
  const service=sandbox.module.exports.createService({auth:{session:async()=>({account:{id:17}})},store:{load:()=>emptyWorkspace()},chooseExportPath:async()=>'/private/secret/backup.json'});
  await assert.rejects(service.exportBackup(),error=>/Could not export backup/.test(error.message)&&!error.message.includes('/private/secret'));
 }
});
test('export writes a validated active-account workspace readable by a fresh store without identity data',async t=>{
 let target;const h=fixture(t,async()=>target);target=path.join(h.root,'backup.json');
 assert.equal(await h.service.exportBackup(),true);
 assert.deepEqual(JSON.parse(fs.readFileSync(target,'utf8')),h.workspace);
 const restored=createStore(path.join(h.root,'restored'));restored.save(99,JSON.parse(fs.readFileSync(target,'utf8')));
 assert.deepEqual(restored.load(99),h.workspace);
 assert.equal(fs.statSync(target).mode&0o777,0o600);
});
