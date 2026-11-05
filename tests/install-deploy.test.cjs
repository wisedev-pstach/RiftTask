'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
// Explicit simulated-host opt-in; never a production platform fallback.
if(process.platform==='linux')process.env.RIFTTASK_TEST_GNU_MV='1';
const exclusiveMove=(from,to)=>require('../scripts/install-deploy.cjs').renameExclusiveSync(from,to);
async function fixture(t,platform='mac') {
 const root=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'rift-deploy-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const home=path.join(root,'home');fs.mkdirSync(home);const target=path.join(home,'Applications',platform==='mac'?'literal $HOME [x].app':'literal $HOME [x]');
 const source=path.join(root,'build');fs.mkdirSync(source);
 const bundle=async (dir,version)=>{fs.mkdirSync(dir,{recursive:true});const resources=path.join(dir,...(platform==='mac'?['Contents','Resources']:['resources']));fs.mkdirSync(resources,{recursive:true});const exe=path.join(dir,...(platform==='mac'?['Contents','MacOS','RiftTask']:['RiftTask.exe']));fs.mkdirSync(path.dirname(exe),{recursive:true});fs.writeFileSync(exe,version,{mode:0o755});if(platform==='mac')fs.writeFileSync(path.join(dir,'Contents','Info.plist'),require('plist').build({CFBundleIdentifier:'dev.wisedev.rifttask',CFBundleExecutable:'RiftTask'}));const input=path.join(root,'asar-'+version);fs.mkdirSync(input);fs.writeFileSync(path.join(input,'package.json'),JSON.stringify({name:'rifttask',main:'desktop/main.cjs',rifttask:{appId:'dev.wisedev.rifttask'}}));await (await import('@electron/asar')).createPackage(input,path.join(resources,'app.asar'));};
 await bundle(target,'old');const packaged=path.join(source,'app');await bundle(packaged,'new');
 return {root,home,target,source,packaged,options:{target,home,source,platform,tmp:path.join(root,'tmp'),running:()=>false},bundle};
}
test('recognized managed app replaced with staged app and previous bytes kept in unique backup',async t=>{
 const f=await fixture(t);const {inspect,deploy}=require('../scripts/install-deploy.cjs');const before=inspect(f.options);const result=deploy({...f.options,bundle:f.packaged,expected:before});assert.equal(fs.readFileSync(path.join(f.target,'Contents/MacOS/RiftTask'),'utf8'),'new');assert.equal(fs.readFileSync(path.join(result.backup,'Contents/MacOS/RiftTask'),'utf8'),'old');assert.equal(fs.existsSync(path.join(f.target,'.rifttask-install.json')),true);
});
test('rejects unrelated, corrupt, symlink, home/root/source/temp overlaps without modifying any bytes',async t=>{
 const {inspect}=require('../scripts/install-deploy.cjs');
 for(const kind of ['file','empty','corrupt','wrong-id','symlink','ancestor-symlink','home','root','source','tmp']) {
  const f=await fixture(t,'win');
  if(['file','empty','symlink'].includes(kind)){fs.rmSync(f.target,{recursive:true});if(kind==='file')fs.writeFileSync(f.target,'precious');if(kind==='empty')fs.mkdirSync(f.target);if(kind==='symlink')fs.symlinkSync(f.packaged,f.target);}
  if(kind==='corrupt')fs.writeFileSync(path.join(f.target,'resources/app.asar'),'corrupt');
  if(kind==='wrong-id'){const input=path.join(f.root,'wrong');fs.mkdirSync(input);fs.writeFileSync(path.join(input,'package.json'),JSON.stringify({name:'other',main:'desktop/main.cjs',rifttask:{appId:'dev.wisedev.rifttask'}}));await(await import('@electron/asar')).createPackage(input,path.join(f.target,'resources/app.asar'));}
  if(kind==='ancestor-symlink'){const link=path.join(f.root,'link');fs.symlinkSync(path.dirname(f.target),link);f.options.target=path.join(link,path.basename(f.target));}
  if(kind==='home')f.options.target=f.home;if(kind==='root')f.options.target=path.parse(f.root).root;
  if(kind==='source')f.options.source=path.dirname(f.target);if(kind==='tmp')f.options.tmp=path.dirname(f.target);
  assert.throws(()=>inspect(f.options),undefined,kind);
 }
});
test('copy/promotion failures preserve old app; failed rollback reports exact manual restore path',async t=>{
 const {inspect,deploy}=require('../scripts/install-deploy.cjs');
 for(const fail of ['copy','promote','rollback']) {
  const f=await fixture(t);const expected=inspect(f.options);let moves=0;
  const io={...fs,cpSync(...args){if(fail==='copy')throw Error('copy fault');return fs.cpSync(...args);},renameExclusiveSync(...args){moves++;if(moves===2 || (fail==='rollback'&&moves===3))throw Error('promotion fault');return exclusiveMove(...args);}};
  assert.throws(()=>deploy({...f.options,expected,bundle:f.packaged,io}),fail==='rollback'?/ROLLBACK FAILED.*Previous app:.*Restore it manually/s:/fault/);
  if(fail!=='rollback')assert.equal(fs.readFileSync(path.join(f.target,'Contents/MacOS/RiftTask'),'utf8'),'old');
  else {const backup=fs.readdirSync(path.dirname(f.target)).find(n=>n.startsWith('.rifttask-backup-'));assert.equal(fs.readFileSync(path.join(path.dirname(f.target),backup,path.basename(f.target),'Contents/MacOS/RiftTask'),'utf8'),'old');}
  assert.equal(fs.readdirSync(path.dirname(f.target)).some(n=>n.startsWith('.rifttask-stage-')),false);
 }
});
test('running app and concurrent lock reject; race to unrelated target before promotion fails closed',async t=>{
 const {inspect,deploy}=require('../scripts/install-deploy.cjs');const f=await fixture(t);const expected=inspect(f.options);
 assert.throws(()=>deploy({...f.options,expected,bundle:f.packaged,running:()=>true}),/close RiftTask/i);
 const lock=path.join(path.dirname(f.target),`.${path.basename(f.target)}.rifttask-update.lock`);fs.writeFileSync(lock,'another invocation');assert.throws(()=>deploy({...f.options,expected,bundle:f.packaged}),/another|lock/i);assert.equal(fs.readFileSync(lock,'utf8'),'another invocation');fs.unlinkSync(lock);
 const io={...fs,cpSync(...args){fs.cpSync(...args);fs.writeFileSync(path.join(f.target,'unrelated'),'changed');}};
 assert.throws(()=>deploy({...f.options,expected,bundle:f.packaged,io}),/changed/i);assert.equal(fs.readFileSync(path.join(f.target,'unrelated'),'utf8'),'changed');
});
test('ASAR package/executable/plist symlinks and forged markers never prove ownership',async t=>{
 const {inspect}=require('../scripts/install-deploy.cjs');
 for(const relative of ['Contents/Resources/app.asar','Contents/MacOS/RiftTask','Contents/Info.plist']) {
  const f=await fixture(t);const filename=path.join(f.target,relative);const outside=path.join(f.root,'external');fs.renameSync(filename,outside);fs.symlinkSync(outside,filename);fs.writeFileSync(path.join(f.target,'.rifttask-install.json'),JSON.stringify({schema:1,appId:'dev.wisedev.rifttask'}));assert.throws(()=>inspect(f.options),/symlink|reparse/i);
 }
});
test('real electron-builder package transformation preserves canonical managed package identity',async t=>{
 const f=await fixture(t,'win');const {createTransformer}=require('app-builder-lib/out/fileTransformer');
 const root=path.resolve(__dirname,'..');const transformed=await createTransformer(root,{},null)(path.join(root,'package.json'));
 const p=JSON.parse(transformed);assert.equal(p.build,undefined,'builder strips build metadata from real packages');assert.equal(p.rifttask?.appId,'dev.wisedev.rifttask');
 const input=path.join(f.root,'sanitized');fs.mkdirSync(input);fs.writeFileSync(path.join(input,'package.json'),transformed);await(await import('@electron/asar')).createPackage(input,path.join(f.target,'resources/app.asar'));
 assert.doesNotThrow(()=>require('../scripts/install-deploy.cjs').inspect(f.options));
});
test('empty packaged executable is rejected before moving previous application',async t=>{
 const f=await fixture(t,'win');const {inspect,deploy}=require('../scripts/install-deploy.cjs');const expected=inspect(f.options);fs.writeFileSync(path.join(f.packaged,'RiftTask.exe'),'');assert.throws(()=>deploy({...f.options,expected,bundle:f.packaged}),/executable/i);assert.equal(fs.readFileSync(path.join(f.target,'RiftTask.exe'),'utf8'),'old');
});
test('cleanup failure cannot mask rollback failure or remove a preexisting backup',async t=>{
 const f=await fixture(t);const {inspect,deploy}=require('../scripts/install-deploy.cjs');const expected=inspect(f.options);const older=path.join(path.dirname(f.target),'.rifttask-backup-existing');fs.mkdirSync(older);fs.writeFileSync(path.join(older,'precious'),'retain');let moves=0;const warnings=[];
 const io={...fs,renameExclusiveSync(...args){if(++moves>=2)throw Error('rename fault');exclusiveMove(...args);},rmSync(){throw Error('cleanup fault');}};
 assert.throws(()=>deploy({...f.options,bundle:f.packaged,expected,io,report:message=>warnings.push(message)}),/ROLLBACK FAILED/);assert.equal(warnings.length,1);assert.match(warnings[0],/staging.*\.rifttask-stage-/i);assert.equal(fs.readFileSync(path.join(older,'precious'),'utf8'),'retain');
});
async function legacyArchive(f) {
 const input=path.join(f.root,'legacy');fs.mkdirSync(input);
 // Transform an actual historical source manifest with the installed builder.
 const {execFileSync}=require('node:child_process');
 const source=JSON.parse(execFileSync('git',['show','30adc55:package.json'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'}));
 assert.equal(source.rifttask,undefined);assert.equal(source.build.appId,'dev.wisedev.rifttask');
 fs.writeFileSync(path.join(input,'package.json'),JSON.stringify(source));
 const transformed=await require('app-builder-lib/out/fileTransformer').createTransformer(input,{},null)(path.join(input,'package.json'));
 const manifest=JSON.parse(transformed);assert.equal(manifest.build,undefined);assert.equal(manifest.rifttask,undefined);
 fs.writeFileSync(path.join(input,'package.json'),transformed);
 await(await import('@electron/asar')).createPackage(input,path.join(f.target,...(f.options.platform==='mac'?['Contents','Resources','app.asar']:['resources','app.asar'])));
}
test('builder-transformed historical Mac archive updates using authoritative bundle identity',async t=>{
 const f=await fixture(t);await legacyArchive(f);const {inspect,deploy}=require('../scripts/install-deploy.cjs');
 const expected=inspect(f.options);const result=deploy({...f.options,expected,bundle:f.packaged});
 assert.equal(fs.readFileSync(path.join(result.backup,'Contents/MacOS/RiftTask'),'utf8'),'old');
 assert.equal(fs.readFileSync(path.join(f.target,'Contents/MacOS/RiftTask'),'utf8'),'new');
});
test('builder-transformed historical Windows archive uses static PE identity without executing old app',async t=>{
 const f=await fixture(t,'win');await legacyArchive(f);const {inspect,deploy}=require('../scripts/install-deploy.cjs');let calls=0;
 const options={...f.options,versionInspector:exe=>{calls++;assert.equal(exe,path.join(f.target,'RiftTask.exe'));return {ProductName:'RiftTask',FileDescription:'RiftTask'};}};
 const expected=inspect(options);const result=deploy({...options,expected,bundle:f.packaged});assert.ok(calls>=3);
 assert.equal(fs.readFileSync(path.join(result.backup,'RiftTask.exe'),'utf8'),'old');assert.equal(fs.readFileSync(path.join(f.target,'RiftTask.exe'),'utf8'),'new');
});
test('trusted fresh source ancestor alias is canonicalized without accepting destination aliases',async t=>{
 const f=await fixture(t);const {inspect,deploy}=require('../scripts/install-deploy.cjs');
 const alias=path.join(f.root,'var');fs.symlinkSync(f.source,alias);
 const options={...f.options,source:alias,bundle:path.join(alias,'app')};const expected=inspect(options);
 const result=deploy({...options,expected});assert.ok(result.backup);assert.equal(fs.readFileSync(path.join(f.target,'Contents/MacOS/RiftTask'),'utf8'),'new');
 const destAlias=path.join(f.root,'destAlias');fs.symlinkSync(path.dirname(f.target),destAlias);
 assert.throws(()=>inspect({...options,target:path.join(destAlias,path.basename(f.target))}),/symlink|reparse/i);
});
test('native fallback rejects contradictory ASAR IDs and invalid legacy native metadata',async t=>{
 const {inspect}=require('../scripts/install-deploy.cjs');
 for(const platform of ['mac','win']) {
  const f=await fixture(t,platform);await legacyArchive(f);
  const archive=path.join(f.target,...(platform==='mac'?['Contents','Resources','app.asar']:['resources','app.asar']));
  const input=path.join(f.root,'legacy');const manifest=JSON.parse(fs.readFileSync(path.join(input,'package.json'),'utf8'));
  for(const field of ['build','rifttask']) {
   const bad={...manifest,build:{appId:'dev.wisedev.rifttask'},rifttask:{appId:'dev.wisedev.rifttask'},[field]:{appId:'unrelated'}};
   fs.writeFileSync(path.join(input,'package.json'),JSON.stringify(bad));await(await import('@electron/asar')).createPackage(input,archive);(await import('@electron/asar')).uncache(archive);
   assert.throws(()=>inspect({...f.options,versionInspector:()=>{throw Error('must not inspect native identity after ASAR contradiction');}}),/ASAR identity mismatch/);
  }
  fs.writeFileSync(path.join(input,'package.json'),JSON.stringify(manifest));await(await import('@electron/asar')).createPackage(input,archive);(await import('@electron/asar')).uncache(archive);
  fs.writeFileSync(path.join(f.target,'.rifttask-install.json'),JSON.stringify({appId:'dev.wisedev.rifttask'}));
  if(platform==='mac') {
   for(const info of [{CFBundleIdentifier:'other',CFBundleExecutable:'RiftTask'},{CFBundleIdentifier:'dev.wisedev.rifttask',CFBundleExecutable:'other'}]) {
    fs.writeFileSync(path.join(f.target,'Contents/Info.plist'),require('plist').build(info));assert.throws(()=>inspect(f.options),/bundle identity mismatch/);
   }
  } else {
   for(const version of [null,{}, {ProductName:'RiftTask',FileDescription:'Electron'},{ProductName:'Electron',FileDescription:'RiftTask'}]) assert.throws(()=>inspect({...f.options,versionInspector:()=>version}),/native executable identity mismatch/);
   assert.throws(()=>inspect({...f.options,versionInspector:()=>{throw Error('PE unreadable');}}),/PE unreadable/);
   if(process.platform!=='win32')assert.throws(()=>inspect(f.options),/requires Windows/);
  }
 }
});
test('trusted source alias never authorizes symlinked bundles/resources or outside-root builds',async t=>{
 const {inspect,deploy}=require('../scripts/install-deploy.cjs');
 for(const relative of ['', 'Contents/MacOS/RiftTask','Contents/Resources/app.asar','Contents/Info.plist']) {
  const f=await fixture(t);const alias=path.join(f.root,'var');fs.symlinkSync(f.source,alias);
  const filename=path.join(f.packaged,relative);const external=path.join(f.root,'external');fs.renameSync(filename,external);fs.symlinkSync(external,filename);
  const options={...f.options,source:alias,bundle:path.join(alias,'app'),expected:inspect(f.options)};
  assert.throws(()=>deploy(options),/symlink|reparse/i);assert.equal(fs.readFileSync(path.join(f.target,'Contents/MacOS/RiftTask'),'utf8'),'old');
 }
 const f=await fixture(t);assert.throws(()=>deploy({...f.options,bundle:f.target,expected:inspect(f.options)}),/outside trusted/);
 const alias=path.join(f.root,'sourceAlias');fs.symlinkSync(f.source,alias);
 assert.throws(()=>inspect({...f.options,source:alias,target:f.packaged}),/overlap/);
});
test('framework relative symlinks survive deployment and removal of fresh source',async t=>{
 const f=await fixture(t);const {inspect,deploy}=require('../scripts/install-deploy.cjs');
 const framework=path.join('Contents','Frameworks','Electron Framework.framework');
 const base=path.join(f.packaged,framework);fs.mkdirSync(path.join(base,'Versions','A','Resources'),{recursive:true});
 fs.writeFileSync(path.join(base,'Versions','A','Electron Framework'),'framework bytes');
 fs.writeFileSync(path.join(base,'Versions','A','Resources','Info.plist'),'resources');
 const links={'Versions/Current':'A','Electron Framework':'Versions/Current/Electron Framework','Resources':'Versions/Current/Resources'};
 for(const [name,literal] of Object.entries(links))fs.symlinkSync(literal,path.join(base,name));
 deploy({...f.options,bundle:f.packaged,expected:inspect(f.options)});
 fs.rmSync(f.source,{recursive:true});
 for(const [name,literal] of Object.entries(links)) {
  const installed=path.join(f.target,framework,name);
  assert.equal(fs.readlinkSync(installed),literal);assert.ok(fs.existsSync(installed));
  assert.ok(fs.realpathSync(installed).startsWith(f.target+path.sep));
 }
 assert.equal(fs.readFileSync(path.join(f.target,framework,'Electron Framework'),'utf8'),'framework bytes');
});
for(const phase of ['publish','rollback'])test(`late ${phase} arrivals preserve unrelated directory inode and previous backup`,async t=>{
 const api=require('../scripts/install-deploy.cjs');
 for(const populated of [false,true]) {
  const f=await fixture(t);let moves=0;let arrival;let backup;
  const move=(from,to)=>{
   moves++;
   if(moves===1)backup=to;
   if(phase==='rollback'&&moves===2)throw Error('publication fault');
   if((phase==='publish'&&moves===2)||(phase==='rollback'&&moves===3)) {
    fs.mkdirSync(f.target);if(populated)fs.writeFileSync(path.join(f.target,'unrelated'),'precious');
    arrival=fs.statSync(f.target).ino;
   }
   return api.renameExclusiveSync(from,to,{linuxFixture:true});
  };
  assert.throws(()=>api.deploy({...f.options,bundle:f.packaged,expected:api.inspect(f.options),io:{...fs,renameExclusiveSync:move}}),/ROLLBACK FAILED/);
  assert.equal(fs.statSync(f.target).ino,arrival);
  assert.deepEqual(fs.readdirSync(f.target),populated?['unrelated']:[]);
  if(populated)assert.equal(fs.readFileSync(path.join(f.target,'unrelated'),'utf8'),'precious');
  assert.equal(fs.readFileSync(path.join(backup,'Contents/MacOS/RiftTask'),'utf8'),'old');
  assert.equal(fs.readdirSync(path.dirname(f.target)).some(n=>n.startsWith('.rifttask-stage-')),false);
  assert.equal(fs.existsSync(path.join(path.dirname(f.target),`.${path.basename(f.target)}.rifttask-update.lock`)),false);
 }
});
test('exclusive rename Darwin bridge binds official flag, passes literal argv and fails closed',async t=>{
 const f=await fixture(t);const {renameExclusiveSync}=require('../scripts/install-deploy.cjs');let script;
 const from=f.packaged;const to=f.target;
 const spawn=(exe,args,options)=>{
  assert.equal(exe,'/usr/bin/osascript');assert.deepEqual(args.slice(0,3),['-l','JavaScript','-e']);
  script=args[3];assert.deepEqual(args.slice(4),['--',from,to]);assert.ok(!script.includes(from));
  assert.equal(options.timeout,10000);assert.equal(options.maxBuffer,8192);assert.equal(options.windowsHide,true);
  return {status:0,stdout:'renamed\n'};
 };
 renameExclusiveSync(from,to,{host:'darwin',spawnSync:spawn});
 const vm=require('node:vm');let call;let bound;
 const context={ObjC:{bindFunction:(...args)=>{bound=args;}},$:{renamex_np:(...args)=>{call=args;return 0;}}};
 vm.createContext(context);vm.runInContext(script,context);assert.equal(context.run([from,to]),'renamed');
 assert.deepEqual(JSON.parse(JSON.stringify(bound)),['renamex_np',['int',['string','string','unsigned int']]]);
 assert.deepEqual(call,[from,to,4]);context.$.renamex_np=()=>-1;assert.throws(()=>context.run([from,to]),/exclusive rename/i);
 for(const result of [{status:1},{status:null,error:Error('timeout')},{status:0,stdout:'unexpected'}])
  assert.throws(()=>renameExclusiveSync(from,to,{host:'darwin',spawnSync:()=>result}),/exclusive rename/i);
});
test('exclusive rename Windows provider is directory-only and unsupported hosts refuse',async t=>{
 const f=await fixture(t);const {renameExclusiveSync}=require('../scripts/install-deploy.cjs');let calls=0;
 renameExclusiveSync(f.packaged,f.target,{host:'win32',renameSync:(from,to)=>{calls++;assert.equal(from,f.packaged);assert.equal(to,f.target);}});
 assert.equal(calls,1);
 assert.throws(()=>renameExclusiveSync(path.join(f.packaged,'Contents/MacOS/RiftTask'),f.target,{host:'win32',renameSync:()=>{throw Error('must not call');}}),/directory/i);
 assert.throws(()=>renameExclusiveSync(f.packaged,f.target,{host:'unknown'}),/unsupported/i);
});
test('running-process probes are bounded and fail closed on timeout or excess output',()=>{
 const {isRunning}=require('../scripts/install-deploy.cjs');
 for(const platform of ['mac','win']) {
  let probe;
  const spawnSync=(exe,args,options)=>{probe={exe,args,options};return {status:1};};
  assert.equal(isRunning(platform,{host:platform==='win'?'win32':'darwin',spawnSync}),false);
  assert.equal(probe.options.timeout,10000);assert.equal(probe.options.maxBuffer,8192);assert.equal(probe.options.windowsHide,true);
  assert.equal(isRunning(platform,{host:'win32',spawnSync:()=>({status:0})}),true);
  for(const result of [{status:null,error:Error('ETIMEDOUT')},{status:null,error:Error('ENOBUFS')},{status:2}])
   assert.throws(()=>isRunning(platform,{host:'win32',spawnSync:()=>result}),/cannot safely check/i);
 }
});
test('late arrival at a fresh publication target is not overwritten or used as a container',async t=>{
 const f=await fixture(t);const api=require('../scripts/install-deploy.cjs');fs.rmSync(f.target,{recursive:true});let inode;
 const io={...fs,renameExclusiveSync(from,to){fs.mkdirSync(to);inode=fs.statSync(to).ino;return exclusiveMove(from,to);}};
 assert.throws(()=>api.deploy({...f.options,bundle:f.packaged,expected:api.inspect(f.options),io}),/Publish failed/);
 assert.equal(fs.statSync(f.target).ino,inode);assert.deepEqual(fs.readdirSync(f.target),[]);
});
test('late arrival at backup destination preserves both the old app and unrelated entry',async t=>{
 const f=await fixture(t);const api=require('../scripts/install-deploy.cjs');let backup;let inode;
 const io={...fs,renameExclusiveSync(from,to){backup=to;fs.mkdirSync(to);inode=fs.statSync(to).ino;return exclusiveMove(from,to);}};
 assert.throws(()=>api.deploy({...f.options,bundle:f.packaged,expected:api.inspect(f.options),io}),/Cannot move old app/);
 assert.equal(fs.statSync(backup).ino,inode);assert.deepEqual(fs.readdirSync(backup),[]);
 assert.equal(fs.readFileSync(path.join(f.target,'Contents/MacOS/RiftTask'),'utf8'),'old');
});
test('exclusive directory rename refuses files and links at the destination without modifying either entry',async t=>{
 const f=await fixture(t);const api=require('../scripts/install-deploy.cjs');
 for(const kind of ['file','symlink','dangling-symlink']) {
  const target=path.join(f.root,kind);
  if(kind==='file')fs.writeFileSync(target,'precious');
  else fs.symlinkSync(kind==='symlink'?f.target:path.join(f.root,'missing'),target);
  const inode=fs.lstatSync(target).ino;
  assert.throws(()=>api.renameExclusiveSync(f.packaged,target));
  assert.equal(fs.lstatSync(target).ino,inode);assert.equal(fs.readFileSync(path.join(f.packaged,'Contents/MacOS/RiftTask'),'utf8'),'new');
 }
});
test('unconfirmed native backup move reports both possible old-app locations without claiming restoration',async t=>{
 const f=await fixture(t);const api=require('../scripts/install-deploy.cjs');let backup;
 const io={...fs,renameExclusiveSync(from,to){backup=to;exclusiveMove(from,to);throw Error('native confirmation timed out');}};
 assert.throws(()=>api.deploy({...f.options,bundle:f.packaged,expected:api.inspect(f.options),io}),error=>{
  assert.ok(error.message.includes(backup));assert.ok(error.message.includes(f.target));
  assert.doesNotMatch(error.message,/Old app preserved at:/);return true;
 });
 assert.equal(fs.readFileSync(path.join(backup,'Contents/MacOS/RiftTask'),'utf8'),'old');assert.equal(fs.existsSync(f.target),false);
});
module.exports={fixture};
