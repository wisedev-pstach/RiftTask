'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {spawnSync}=require('node:child_process');
const pwsh=process.env.RIFT_PWSH || (process.platform==='win32'?'powershell':'pwsh');
const available=spawnSync(pwsh,['-NoProfile','-Command','$PSVersionTable.PSVersion.ToString()'],{env:{...process.env,DOTNET_SYSTEM_GLOBALIZATION_INVARIANT:'1'}}).status===0;
const options={skip:process.platform!=='linux'?'Simulated COM harness is Linux-only: never write the real Windows Start Menu':available?false:'PowerShell runtime required (set RIFT_PWSH)'};
function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rift-register-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const dest=path.join(root,'literal [app] $HOME `x` ; installed');fs.mkdirSync(dest);fs.writeFileSync(path.join(dest,'RiftTask.exe'),'fixture-not-executable');
 const appdata=path.join(root,'roaming [user]');fs.mkdirSync(appdata);
 const link=path.join(appdata,'Microsoft','Windows','Start Menu','Programs','RiftTask.lnk');
 const tmp=path.join(root,'tmp');fs.mkdirSync(tmp);
 return {root,tmp,dest,link,run:(env={})=>spawnSync(pwsh,['-NoProfile','-File',path.join(__dirname,'fixtures/windows-installer.ps1'),'-Installer',path.resolve(__dirname,'../scripts/install.ps1'),'-Dest',dest],{encoding:'utf8',env:{...process.env,RIFTTASK_TEST_GNU_MV:'1',RIFT_ROOT:path.resolve(__dirname,'..'),RIFT_NODE:process.execPath,DOTNET_SYSTEM_GLOBALIZATION_INVARIANT:'1',APPDATA:appdata,LOCALAPPDATA:root,TMPDIR:tmp,TEMP:tmp,TMP:tmp,PROCESSOR_ARCHITECTURE:'AMD64',PROCESSOR_ARCHITEW6432:'',...env}})};
}
test('rerunning the exact Windows irm recipe updates recognized legacy app and keeps backup/data',options,t=>{
 const f=fixture(t);const target=path.join(f.root,'Programs','RiftTask');
 const recipe=fs.readFileSync(path.resolve(__dirname,'../README.md'),'utf8').split('\n').find(line=>line.startsWith('irm https://'));
 let r=f.run({RIFT_MODE:'Install',RIFT_DOC_RECIPE:recipe});assert.equal(r.status,0,r.stdout+r.stderr);
 if(fs.existsSync(path.join(target,'.rifttask-install.json')))fs.unlinkSync(path.join(target,'.rifttask-install.json')); // Legacy install has no managed marker.
 fs.writeFileSync(path.join(target,'RiftTask.exe'),'previous-fixture');
 const data=path.join(f.root,'user-data-sentinel');fs.writeFileSync(data,'tasks preserved');
 r=f.run({RIFT_MODE:'Install',RIFT_DOC_RECIPE:recipe});assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/Previous app backup:/);
 const backupLine=r.stdout.split('\n').find(line=>line.startsWith('Previous app backup: '));const backup=backupLine.slice('Previous app backup: '.length).trim();
 assert.equal(fs.readFileSync(path.join(backup,'RiftTask.exe'),'utf8'),'previous-fixture');assert.equal(fs.readFileSync(data,'utf8'),'tasks preserved');assert.equal(JSON.parse(fs.readFileSync(f.link)).TargetPath,path.join(target,'RiftTask.exe'));
});

test('Windows build/copy failures and running app preserve recognized old bytes; update check is read-only',options,t=>{
 for(const failure of ['build','copy','running']) {
  const f=fixture(t);fs.rmSync(f.dest,{recursive:true});let r=f.run({RIFT_MODE:'Install'});assert.equal(r.status,0,r.stdout+r.stderr);
  const exe=path.join(f.dest,'RiftTask.exe');fs.writeFileSync(exe,'previous app');const snapshot=fs.readdirSync(f.root).sort();
  const env=failure==='build'?{RIFT_FAIL:'build'}:failure==='copy'?{RIFT_COPY_FAIL:'1'}:{RIFT_RUNNING:'1'};
  r=f.run({RIFT_MODE:'Install',...env});assert.notEqual(r.status,0,r.stdout+r.stderr);assert.equal(fs.readFileSync(exe,'utf8'),'previous app');assert.deepEqual(fs.readdirSync(f.root).sort(),snapshot);assert.deepEqual(fs.readdirSync(f.tmp),[]);
  r=f.run({RIFT_MODE:'Check'});assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/Will update/);assert.deepEqual(fs.readdirSync(f.root).sort(),snapshot);
 }
});

test('RegisterOnly binds downloaded script parameters, needs no build tools, and writes a literal per-user shortcut',options,t=>{
 const f=fixture(t);const r=f.run();assert.equal(r.status,0,r.stdout+r.stderr);
 const link=JSON.parse(fs.readFileSync(f.link,'utf8'));
 assert.equal(link.TargetPath,path.join(f.dest,'RiftTask.exe'));assert.equal(link.Arguments,'');
 assert.equal(link.WorkingDirectory,f.dest);assert.equal(link.IconLocation,path.join(f.dest,'RiftTask.exe')+',0');
 assert.match(link.Description,/RiftTask/);assert.match(r.stdout,/Start.*RiftTask/i);
 assert.equal(fs.readFileSync(path.join(f.dest,'RiftTask.exe'),'utf8'),'fixture-not-executable');
});
test('repair supports the default existing installation without inspecting build tools',options,t=>{
 const f=fixture(t);const dest=path.join(f.root,'Programs','RiftTask');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'RiftTask.exe'),'default');
 const r=f.run({RIFT_DEFAULT_DEST:'1'});assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(JSON.parse(fs.readFileSync(f.link)).TargetPath,path.join(dest,'RiftTask.exe'));
});
test('copy-ready SETUP repair command binds RegisterOnly through both invocation scopes',options,t=>{
 const f=fixture(t);const dest=path.join(f.root,'Programs','RiftTask');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'RiftTask.exe'),'default');
 const setup=fs.readFileSync(path.resolve(__dirname,'../docs/SETUP.md'),'utf8');
 const command=setup.split('\n').find(line=>line.startsWith('& ([scriptblock]::Create((irm ')&&line.endsWith('-RegisterOnly'));
 assert.ok(command,'documented repair command');const r=f.run({RIFT_DOC_RECIPE:command});assert.equal(r.status,0,r.stdout+r.stderr);
 assert.equal(JSON.parse(fs.readFileSync(f.link)).TargetPath,path.join(dest,'RiftTask.exe'));
});

test('missing executable fails before tools, COM or Start Menu creation',options,t=>{
 const f=fixture(t);fs.unlinkSync(path.join(f.dest,'RiftTask.exe'));const r=f.run({RIFT_COM_FAIL:'1'});
 assert.notEqual(r.status,0);assert.match(r.stderr,/RiftTask.exe not found/);assert.doesNotMatch(r.stderr,/lookup forbidden|COM unavailable/);assert.equal(fs.existsSync(path.dirname(f.link)),false);
});
test('Check is side-effect-free; unrelated existing directories and files are refused',options,t=>{
 const f=fixture(t);fs.rmSync(f.dest,{recursive:true});let r=f.run({RIFT_MODE:'Check',RIFT_COM_FAIL:'1'});
 assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(fs.existsSync(f.link),false);assert.equal(fs.existsSync(f.dest),false);assert.deepEqual(fs.readdirSync(f.tmp),[]);
 for(const kind of ['directory','file']) {
  if(kind==='directory')fs.mkdirSync(f.dest);else {fs.rmdirSync(f.dest);fs.writeFileSync(f.dest,'preserve');}
  r=f.run({RIFT_MODE:'Install'});assert.notEqual(r.status,0);assert.match(r.stderr,/refusing .*existing destination/i);assert.equal(fs.existsSync(f.link),false);
 }
 assert.equal(fs.readFileSync(f.dest,'utf8'),'preserve');
});
test('directories, reparse points and corrupt existing shortcuts are not overwritten',options,t=>{
 for(const kind of ['directory','symlink','corrupt']) {
  const f=fixture(t);fs.mkdirSync(path.dirname(f.link),{recursive:true});const other=path.join(f.root,'unrelated');fs.writeFileSync(other,'preserve');
  if(kind==='directory')fs.mkdirSync(f.link);else if(kind==='symlink')fs.symlinkSync(other,f.link);else fs.writeFileSync(f.link,'not a valid shortcut');
  const r=f.run();assert.notEqual(r.status,0);assert.doesNotMatch(r.stdout,/Open Start/);assert.equal(fs.readFileSync(other,'utf8'),'preserve');
  if(kind==='corrupt')assert.equal(fs.readFileSync(f.link,'utf8'),'not a valid shortcut');
  if(kind==='symlink')assert.equal(fs.lstatSync(f.link).isSymbolicLink(),true);
  if(kind==='directory')assert.equal(fs.lstatSync(f.link).isDirectory(),true);
 }
});

test('fresh installation registers the copied executable automatically and cleans only owned build files',options,t=>{
 const f=fixture(t);fs.rmSync(f.dest,{recursive:true});const r=f.run({RIFT_MODE:'Install'});assert.equal(r.status,0,r.stdout+r.stderr);
 assert.equal(JSON.parse(fs.readFileSync(f.link)).TargetPath,path.join(f.dest,'RiftTask.exe'));
 assert.equal(fs.readFileSync(path.join(f.dest,'RiftTask.exe'),'utf8'),'packaged-fixture-not-executable');
 assert.match(r.stdout,/installation complete/);assert.deepEqual(fs.readdirSync(f.tmp),[]);
});

test('missing copied executable stops before COM without claiming the application is installed',options,t=>{
 const f=fixture(t);fs.rmSync(f.dest,{recursive:true});const r=f.run({RIFT_MODE:'Install',RIFT_COPY_SKIP:'1',RIFT_COM_FAIL:'1'});
 assert.notEqual(r.status,0);assert.match(r.stderr,/copied executable|RiftTask.exe not found|unpacked directory was not found/i);assert.doesNotMatch(r.stderr,/Application installed at:/);assert.equal(fs.existsSync(f.link),false);assert.deepEqual(fs.readdirSync(f.tmp),[]);
});

test('COM failure reports app installed but registration failed, preserves executable, never claims complete',options,t=>{
 const f=fixture(t);fs.rmSync(f.dest,{recursive:true});const r=f.run({RIFT_MODE:'Install',RIFT_COM_FAIL:'1'});
 assert.notEqual(r.status,0);assert.match(r.stderr,/installed.*registration failed/i);assert.doesNotMatch(r.stdout,/installation complete/);
 assert.equal(fs.readFileSync(path.join(f.dest,'RiftTask.exe'),'utf8'),'packaged-fixture-not-executable');assert.deepEqual(fs.readdirSync(f.tmp),[]);
});

test('registration reads back the saved shortcut before reporting success',options,t=>{
 const f=fixture(t);const r=f.run({RIFT_SAVE_SKIP:'1'});assert.notEqual(r.status,0);assert.match(r.stderr,/verification|not saved/i);assert.doesNotMatch(r.stdout,/Open Start/);
});

test('RegisterOnly rejects Check combinations before creating any shortcut',options,t=>{
 const f=fixture(t);const r=f.run({RIFT_EXTRA_CHECK:'1'});assert.notEqual(r.status,0);assert.match(r.stderr,/RegisterOnly.*Check|combine/i);assert.equal(fs.existsSync(f.link),false);
});

test('RegisterOnly refreshes only a matching canonical target with empty arguments; unrelated and hostile links survive',options,t=>{
  for (const kind of ['same','canonical','case','unrelated','arguments','relative']) {
  const f=fixture(t);fs.mkdirSync(path.dirname(f.link),{recursive:true});
  const target=kind==='case'?path.join(f.dest,'RiftTask.exe').toUpperCase():kind==='unrelated'?path.join(f.root,'Other.exe'):kind==='relative'?'RiftTask.exe':kind==='canonical'?path.join(f.dest,'child','..','RiftTask.exe'):path.join(f.dest,'RiftTask.exe');
  const old=JSON.stringify({TargetPath:target,Arguments:kind==='arguments'?'--run hostile':'',WorkingDirectory:'old',IconLocation:'old',Description:'old'});
  fs.writeFileSync(f.link,old);const r=f.run();
  if(['same','canonical','case'].includes(kind)) {assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(JSON.parse(fs.readFileSync(f.link)).WorkingDirectory,f.dest);}
  else {assert.notEqual(r.status,0);assert.match(r.stderr,/Refusing.*shortcut/i);assert.equal(fs.readFileSync(f.link,'utf8'),old);}
 }
});

