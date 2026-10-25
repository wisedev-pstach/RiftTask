'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {EventEmitter}=require('node:events');
const {createService}=require('../desktop/service.cjs');
const {registerIpc}=require('../desktop/ipc.cjs');

function fakeSpawn({event='spawn',code=0}={}) {
  const calls=[];
  function spawn(...args) {
    calls.push(args);const child=new EventEmitter();child.unref=()=>{child.unreferenced=true;};
    calls.at(-1).child=child;
    process.nextTick(()=>{child.emit(event,event==='error'?new Error('sensitive stderr'):undefined);if(event==='spawn') child.emit('close',code);});
    return child;
  }
  return {calls,spawn};
}

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rift-terminal-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const directory=path.join(root,'project ; $literal & space');fs.mkdirSync(directory);
  return {root,directory};
}

test('openTerminal resolves only the active account persisted project through trusted IPC',async t=>{
  const {directory}=fixture(t);const launches=[];let account={id:17};let loads=0;
  const service=createService({auth:{session:async()=>({account})},store:{load:async id=>{
    assert.equal(id,17);loads++;return {projects:[{id:'project-1',localPath:directory}]};
  }},launchTerminal:async directory=>{launches.push(directory);}});
  const handlers=new Map();const frame={url:'file:///rift/index.html'};const webContents={mainFrame:frame};
  registerIpc({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},webContents,indexURL:frame.url,service,shell:{}});
  const event={sender:webContents,senderFrame:frame};const open=(...args)=>handlers.get('rift:openTerminal')(event,...args);
  assert.equal(await open('project-1'),undefined);
  assert.deepEqual(launches,[directory]);
  for(const id of [directory,'../project-1','--help',{},null,'missing']) await assert.rejects(open(id),/project/i);
  await assert.rejects(open('project-1','arbitrary command'),/arguments/);
  await assert.rejects(handlers.get('rift:openTerminal')({...event,senderFrame:{url:frame.url}},'project-1'),/Untrusted/);
  const before=loads;account={id:28};await assert.rejects(open('project-1'),/account changed/);
  account=null;await assert.rejects(open('project-1'),/sign in/i);
  assert.equal(loads,before);assert.deepEqual(launches,[directory]);
});

test('default service terminal launcher rejects invalid persisted directories without launching',async t=>{
  const {root}=fixture(t);let localPath='';
  const service=createService({auth:{session:async()=>({account:{id:17}})},store:{load:async()=>({projects:[{id:'p',localPath}]})}});
  for(const value of ['', '.', 'relative/path', '/bad\0path', '/bad\npath', '/bad\rpath']) {
    localPath=value;await assert.rejects(service.openTerminal('p'),/absolute local project directory/);
  }
  const file=path.join(root,'file');fs.writeFileSync(file,'text');
  for(const value of [file,path.join(root,'missing')]) {
    localPath=value;await assert.rejects(service.openTerminal('p'),/directory is unavailable/);
  }
});

test('terminal launch failures expose actionable errors without subprocess details',async t=>{
  const {directory}=fixture(t);const {openTerminalDirectory}=require('../desktop/terminal.cjs');
  for(const platform of ['linux','darwin','win32']) {
    const f=fakeSpawn({event:'error'});
    await assert.rejects(openTerminalDirectory(directory,{platform,spawn:f.spawn}),error=>
      /Could not open.*terminal/i.test(error.message) && !/sensitive/.test(error.message));
  }
  for(const platform of ['linux','win32','darwin']) {
    const f=fakeSpawn({code:1});
    await assert.rejects(openTerminalDirectory(directory,{platform,spawn:f.spawn}),/Could not open.*terminal/i);
  }
});

test('interactive terminals detach after startup without waiting for shell exit',async t=>{
  const {directory}=fixture(t);const {openTerminalDirectory}=require('../desktop/terminal.cjs');
  let child;let settled=false;
  const promise=openTerminalDirectory(directory,{platform:'linux',spawn:()=>{
    child=new EventEmitter();child.unref=()=>{child.unreferenced=true;};
    process.nextTick(()=>child.emit('spawn'));return child;
  }}).then(()=>{settled=true;});
  await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(settled,false,'spawn alone must not acknowledge successful startup');
  await promise;assert.equal(child.unreferenced,true);
});

test('terminal launch keeps hostile directory text out of shell commands on each platform',async t=>{
  const {directory}=fixture(t);
  const {openTerminalDirectory}=require('../desktop/terminal.cjs');
  for(const [platform,executable,args] of [
    ['linux','/usr/bin/x-terminal-emulator',[]],
    ['darwin','/usr/bin/open',['-a','Terminal','--',directory]],
    ['win32','C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoLogo','-NoProfile','-NoExit']]
  ]) {
    const f=fakeSpawn();
    await openTerminalDirectory(directory,{platform,spawn:f.spawn,env:{SystemRoot:'C:\\Windows'}});
    assert.equal(f.calls.length,1);const [file,actualArgs,options]=f.calls[0];
    assert.equal(file,executable);assert.deepEqual(actualArgs,args);
    assert.equal(options.cwd,directory);assert.equal(options.shell,false);assert.equal(options.windowsHide,false);
    assert.equal(options.stdio,'ignore');assert.equal(options.detached,platform!=='darwin');
    assert.equal(options.timeout,platform==='darwin'?10000:undefined);
    if(platform!=='darwin') assert.equal(f.calls[0].child.unreferenced,true);
  }
});
