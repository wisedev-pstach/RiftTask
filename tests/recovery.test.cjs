'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {createStore}=require('../desktop/store.cjs');const {createService}=require('../desktop/service.cjs');const {emptyWorkspace}=require('../desktop/core.cjs');
function fixture(t,confirmRestore=async()=>true){const root=fs.mkdtempSync(path.join(process.env.TMPDIR,'rift-recovery-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const store=createStore(root);store.save(17,emptyWorkspace());const file=path.join(root,'accounts/17/workspace.json');const primary=Buffer.from([0,255,123]),backup=Buffer.from('broken backup');fs.writeFileSync(file,primary);fs.writeFileSync(file+'.bak',backup);const source=path.join(root,'export.json');const incoming=emptyWorkspace();incoming.categories.push({id:'restored',name:'Restored',color:'#ffffff'});fs.writeFileSync(source,JSON.stringify(incoming));let account={id:17};const service=createService({auth:{session:async()=>({account})},store,chooseImportPath:async()=>source,confirmRestore});t.after(()=>service.dispose());return {root,file,primary,backup,incoming,source,service,switchAccount:(id=28)=>account={id}};}
test('confirmed import recovers double-corrupt workspace only after byte-exact owned archive of both originals',async t=>{
 let confirmations=0;const h=fixture(t,async()=>{confirmations++;return true;});await assert.rejects(h.service.load(),/corrupt/);
 assert.deepEqual(await h.service.importBackup(),h.incoming);assert.equal(confirmations,1);assert.deepEqual(createStore(h.root).load(17),h.incoming);
 const archives=fs.readdirSync(path.dirname(h.file)).filter(n=>n.startsWith('recovery-'));assert.equal(archives.length,1);const archive=path.join(path.dirname(h.file),archives[0]);
 assert.deepEqual(fs.readFileSync(path.join(archive,'workspace.json')),h.primary);assert.deepEqual(fs.readFileSync(path.join(archive,'workspace.json.bak')),h.backup);
 // Subsequent save may rotate rolling backup, but cannot touch recovery originals.
 createStore(h.root).save(17,h.incoming);assert.deepEqual(fs.readFileSync(path.join(archive,'workspace.json.bak')),h.backup);
});
test('archive copy and atomic replacement failures preserve primary AND backup bytes',async t=>{
 for(const operation of ['copy','rename']){
  const h=fixture(t);const originalCopy=fs.copyFileSync,originalRename=fs.renameSync;
  if(operation==='copy')fs.copyFileSync=(source,...args)=>{if(source===h.file+'.bak')throw new Error('fixture disk full');return originalCopy(source,...args);};
  else fs.renameSync=(source,target)=>{if(target===h.file)throw new Error('fixture rename denied');return originalRename(source,target);};
  try{await assert.rejects(h.service.importBackup(),error=>/Could not restore backup.*originals retained/i.test(error.message)&&!error.message.includes('fixture')&&!error.message.includes(h.root));}finally{fs.copyFileSync=originalCopy;fs.renameSync=originalRename;}
  assert.deepEqual(fs.readFileSync(h.file),h.primary);assert.deepEqual(fs.readFileSync(h.file+'.bak'),h.backup);
 }
});
test('same-account rebind after switching away invalidates pending recovery generation',async t=>{
 let h;h=fixture(t,async()=>{h.switchAccount(28);await h.service.session();h.switchAccount(17);await h.service.session();return true;});await h.service.session();await assert.rejects(h.service.importBackup(),/account changed/i);assert.deepEqual(fs.readFileSync(h.file),h.primary);assert.deepEqual(fs.readFileSync(h.file+'.bak'),h.backup);
});
test('native refusal and account switch during confirmation preserve both corrupt originals without archives',async t=>{
 for(const mode of ['cancel','switch']){let h;h=fixture(t,async()=>{if(mode==='switch')h.switchAccount();return mode!=='cancel';});if(mode==='cancel')assert.equal(await h.service.importBackup(),null);else await assert.rejects(h.service.importBackup(),/account changed/i);assert.deepEqual(fs.readFileSync(h.file),h.primary);assert.deepEqual(fs.readFileSync(h.file+'.bak'),h.backup);assert.equal(fs.readdirSync(path.dirname(h.file)).some(n=>n.startsWith('recovery-')),false);}
});
