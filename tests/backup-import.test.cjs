'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createService}=require('../desktop/service.cjs');
const {createStore}=require('../desktop/store.cjs');
const {emptyWorkspace,createSampleWorkspace,MAX_BYTES}=require('../desktop/core.cjs');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rift-import-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const store=createStore(path.join(root,'app'));const original=emptyWorkspace();store.save(17,original);
 const source=path.join(root,'backup.json');const incoming=createSampleWorkspace();fs.writeFileSync(source,JSON.stringify(incoming));
 let account={id:17};let selection=source;
 const service=createService({auth:{session:async()=>({account})},store,chooseImportPath:async()=>selection,confirmRestore:async()=>true});
 return {root,store,original,source,incoming,service,switchAccount:value=>account=value,select:value=>selection=value};
}
test('import cancellation leaves the current workspace and backup untouched',async t=>{
 const h=fixture(t);h.select(null);assert.equal(await h.service.importBackup(),null);
 assert.deepEqual(h.store.load(17),h.original);
 assert.equal(fs.existsSync(path.join(h.root,'app/accounts/17/workspace.json.bak')),false);
});
test('import refuses account changes during the dialog or final verification',async t=>{
 for(const phase of ['dialog','final']){
  const h=fixture(t);let checks=0;let account={id:17};
  const service=createService({auth:{session:async()=>({account:++checks===3&&phase==='final'?{id:28}:account})},store:h.store,chooseImportPath:async()=>{if(phase==='dialog')account={id:28};return h.source;}});
  await assert.rejects(service.importBackup(),/account changed/i);
  assert.deepEqual(h.store.load(17),h.original);assert.equal(h.store.load(28).projects.length,0);
 }
});
test('import rejects invalid, oversized and non-regular input without changing persistence or leaking paths',async t=>{
 const h=fixture(t);const primary=path.join(h.root,'app/accounts/17/workspace.json');const before=fs.readFileSync(primary,'utf8');
 const bad=[['broken','{'],['version',JSON.stringify({...h.incoming,version:2})],['references',JSON.stringify({...h.incoming,categories:[]})],['large',' '.repeat(MAX_BYTES+1)]];
 for(const [name,text] of bad){const file=path.join(h.root,name);fs.writeFileSync(file,text);h.select(file);await assert.rejects(h.service.importBackup(),/Invalid backup|Could not read backup/);}
 const link=path.join(h.root,'symlink');fs.symlinkSync(h.source,link);
 for(const file of [h.root,link,path.join(h.root,'private-missing')]){h.select(file);await assert.rejects(h.service.importBackup(),error=>/backup/i.test(error.message)&&!error.message.includes(h.root));}
 assert.equal(fs.readFileSync(primary,'utf8'),before);assert.equal(fs.existsSync(primary+'.bak'),false);
});
test('import preserves current primary when safety backup cannot be replaced',async t=>{
 const h=fixture(t);const primary=path.join(h.root,'app/accounts/17/workspace.json');
 const before=fs.readFileSync(primary,'utf8');fs.mkdirSync(primary+'.bak');
 await assert.rejects(h.service.importBackup());assert.equal(fs.readFileSync(primary,'utf8'),before);
});
test('confirmed import retains a corrupt current original in an owned recovery archive',async t=>{
 const h=fixture(t);const primary=path.join(h.root,'app/accounts/17/workspace.json');fs.writeFileSync(primary,'corrupt original');
 await h.service.importBackup();const archive=fs.readdirSync(path.dirname(primary)).find(n=>n.startsWith('recovery-'));assert.equal(fs.readFileSync(path.join(path.dirname(primary),archive,'workspace.json'),'utf8'),'corrupt original');assert.deepEqual(h.store.load(17),h.incoming);
});
test('import restores a validated workspace and retains the previous workspace backup across restart',async t=>{
 const h=fixture(t);assert.deepEqual(await h.service.importBackup(),h.incoming);
 assert.deepEqual(createStore(path.join(h.root,'app')).load(17),h.incoming);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(h.root,'app/accounts/17/workspace.json.bak'),'utf8')),h.original);
 assert.deepEqual(JSON.parse(fs.readFileSync(h.source,'utf8')),h.incoming);
});
