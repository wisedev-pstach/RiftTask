'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const fs = require('node:fs');
const vm = require('node:vm');
const {registerIpc} = require('../desktop/ipc.cjs');
const indexURL = pathToFileURL(path.resolve(__dirname, '../dist/index.html')).href;
function harness() {
  const handlers = new Map(); const calls = [];
  const frame = {url:indexURL}; const webContents = {mainFrame:frame};
  const service = Object.fromEntries(['session','login','checkLogin','logout','load','save'].map(name => [name, async (...args) => {calls.push([name,...args]); return {ok:name};}]));
  const dispose = registerIpc({ipcMain:{handle:(k,v)=>handlers.set(k,v),removeHandler:k=>handlers.delete(k)},webContents,indexURL,service,shell:{openExternal:async url=>calls.push(['external',url])}});
  return {handlers,calls,dispose,webContents,event:{sender:webContents,senderFrame:frame}};
}
test('task resource IPC has exact trusted-frame arity and fixed native file/folder dialogs',async()=>{const h=fakeElectron();let options;h.deps.createService=o=>{options=o;return {openTaskResource:async(...a)=>a,chooseTaskResource:async(kind)=>o.chooseResourcePath(kind),cancelResourceActions:async()=>{}};};const dialogs=[];h.electron.dialog.showOpenDialog=async(win,o)=>{dialogs.push(o);return {canceled:false,filePaths:['/synthetic/picked']};};const opened=[];h.electron.shell.openPath=async p=>{opened.push(p);return '';};await require('../desktop/main.cjs').start(h.electron,h.deps);const win=h.windows[0],event={sender:win.webContents,senderFrame:win.webContents.mainFrame};for(const [name,args] of [['openTaskResource',['task','resource']],['chooseTaskResource',['file','project','task']],['cancelResourceActions',[]]]){const handler=h.handlers.get('rift:'+name);assert.equal(typeof handler,'function');await assert.rejects(handler({...event,senderFrame:{url:indexURL}},...args),/Untrusted/);await assert.rejects(handler(event,...args,'extra'),/arguments/);await handler(event,...args);}assert.deepEqual(dialogs[0].properties,['openFile']);await options.chooseResourcePath('directory');assert.deepEqual(dialogs[1].properties,['openDirectory']);await assert.rejects(options.chooseResourcePath('url'),/Invalid/);assert.deepEqual(opened,[]);await options.openResourcePath('/synthetic/document.pdf');assert.deepEqual(opened,['/synthetic/document.pdf']);});

test('installed version is a zero-argument trusted-main-frame metadata read',async()=>{const h=fakeElectron();h.electron.app.getVersion=()=> '0.3.0';await require('../desktop/main.cjs').start(h.electron,h.deps);const win=h.windows[0],event={sender:win.webContents,senderFrame:win.webContents.mainFrame};const get=h.handlers.get('rift:getVersion');assert.equal(typeof get,'function');assert.equal(await get(event),'0.3.0');await assert.rejects(get(event,'/arbitrary/executable'),/arguments/);await assert.rejects(get({...event,senderFrame:{url:indexURL}}),/Untrusted/);});
test('IPC only dispatches basic service methods from exact trusted main frame', async () => {
  const h=harness();
  for (const name of ['session','login','checkLogin','logout','load']) {assert.deepEqual(await h.handlers.get('rift:'+name)(h.event),{ok:name});await assert.rejects(h.handlers.get('rift:'+name)(h.event,'renderer-command'),/arguments/);await assert.rejects(h.handlers.get('rift:'+name)({...h.event,sender:{}}),/Untrusted/);}
  const workspace={version:1}; assert.deepEqual(await h.handlers.get('rift:save')(h.event,workspace),{ok:'save'});
  assert.deepEqual(h.calls.at(-1),['save',workspace]);
  for (const event of [{}, {...h.event,sender:{}},{...h.event,senderFrame:{url:indexURL}}, {...h.event,senderFrame:{url:'https://evil.example'}}]) {
    await assert.rejects(h.handlers.get('rift:load')(event),/Untrusted/);
  }
  for(const url of [indexURL+'#fragment',indexURL+'?query','file:///tmp/index.html','https://evil.example']) {
    h.webContents.mainFrame.url=url;
    await assert.rejects(h.handlers.get('rift:load')(h.event),/Untrusted/);
  }
  h.webContents.mainFrame.url=indexURL;
  await assert.rejects(h.handlers.get('rift:session')(h.event,'unexpected'),/arguments/);
  h.dispose(); assert.equal(h.handlers.size,0);
});
test('progress opener accepts only explicit credential-free HTTP(S) from trusted main frame',async()=>{const h=harness(),open=h.handlers.get('rift:openProgressLink');assert.equal(typeof open,'function');for(const url of ['https://example.com/build?x=1#notes','http://localhost:3000/']){await open(h.event,url);assert.deepEqual(h.calls.at(-1),['external',url]);}for(const url of ['javascript:alert(1)','data:text/html,x','file:///a','https://user:secret@example.com','https://example.com/\nsecret','https:\\example.com',null,{},'https://example.com/'+'x'.repeat(2048)]){await assert.rejects(open(h.event,url),/progress link/);}await assert.rejects(open(h.event,'https://example.com','extra'),/arguments/);await assert.rejects(open({...h.event,senderFrame:{url:indexURL}},'https://example.com'),/Untrusted/);});
test('openRepository accepts only credential-free HTTPS provider repository URLs', async () => {
  const h=harness(); const open=h.handlers.get('rift:openRepository');
  for(const url of ['https://github.com/owner/repo','https://dev.azure.com/org/project/_git/repo','https://org.visualstudio.com/project/_git/repo']) {
    await open(h.event,url); assert.deepEqual(h.calls.at(-1),['external',url]);
  }
  for(const url of ['http://github.com/o/r','https://user:secret@github.com/o/r','https://github.com.evil.test/o/r','https://evil.test','file:///tmp/x','https://github.com/o/r?token=secret','https://github.com/o/r#x','https://github.com:444/o/r','https://dev.azure.com/org','https://org.visualstudio.com','https://github.com/o/r/issues','https://github.com/o/../r','https://github.com/o/%2e%2e/r','https://github.com/o/%2f',' https://github.com/o/r','https://github.com\\@evil.test/o/r',null,{},'javascript:alert(1)']) {
    const before=h.calls.length; await assert.rejects(open(h.event,url),/repository URL/); assert.equal(h.calls.length,before);
  }
});
test('sandbox-compatible preload exposes frozen narrow promise bridge without raw Electron', async () => {
  let exposed; const calls=[];
  const source=fs.readFileSync(path.join(__dirname,'../desktop/preload.cjs'),'utf8');
  vm.runInNewContext(source,{require:name=>{
    assert.equal(name,'electron');
    return {contextBridge:{exposeInMainWorld:(name,bridge)=>{assert.equal(name,'rift');exposed=bridge;}},ipcRenderer:{invoke:async (...args)=>{calls.push(args); return 'result';}}};
  }});
  const methods=['openTaskResource','chooseTaskResource','cancelResourceActions','getVersion','session','login','checkLogin','logout','load','save','chooseDirectory','openRepository','openProgressLink','openTerminal','gitStatus','exportBackup','importBackup','cloudStatus','cloudCreate','cloudVerify','cloudEnable','cloudDisable','cloudSync','ptyStart','ptyRead','ptyInput','ptyResize','ptyClose'];
  assert.deepEqual(Object.keys(exposed).sort(),methods.sort()); assert.ok(Object.isFrozen(exposed));
  for(const name of methods) {
    const args=name==='openTaskResource'?['task','resource']:name==='chooseTaskResource'?['file','project','task']:name==='ptyStart'?['p']:name==='ptyRead'||name==='ptyClose'?['p','token']:name==='ptyInput'?['p','token','x']:name==='ptyResize'?['p','token',80,24]:['save','openRepository','openProgressLink','openTerminal','gitStatus','cloudCreate','cloudVerify','cloudEnable','cloudSync'].includes(name)?['value']:[];
    assert.equal(await exposed[name](...args),'result'); assert.deepEqual(calls.at(-1),['rift:'+name,...args]);
  }
  await exposed.session('ignored'); assert.deepEqual(calls.at(-1),['rift:session']);
  await exposed.save('one','ignored'); assert.deepEqual(calls.at(-1),['rift:save','one']);
});

function fakeElectron({lock=true}={}) {
  const {EventEmitter}=require('node:events');
  const app=new EventEmitter(); let quit=0;
  Object.assign(app,{setAppUserModelId:()=>{},requestSingleInstanceLock:()=>lock,whenReady:async()=>{},getPath:()=>'/local/userData',quit:()=>quit++});
  const windows=[]; const handlers=new Map();
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super(); this.options=options; this.webContents=new EventEmitter();
      this.webContents.mainFrame={url:indexURL};
      this.webContents.setWindowOpenHandler=fn=>this.windowOpen=fn;
      this.webContents.session={setPermissionRequestHandler:fn=>this.permission=fn,setPermissionCheckHandler:fn=>this.permissionCheck=fn};
      this.show=()=>this.shown=true;this.focus=()=>this.focused=true;this.isMinimized=()=>true;this.restore=()=>this.restored=true;
      this.removeMenu=()=>this.menuRemoved=true;this.setMenuBarVisibility=value=>this.menuVisible=value;
      this.loadFile=async file=>{this.file=file;}; windows.push(this);
    }
  }
  const electron={app,BrowserWindow,Menu:{setApplicationMenu:()=>{}},ipcMain:{handle:(k,v)=>handlers.set(k,v),removeHandler:k=>handlers.delete(k)},shell:{openExternal:async()=>{}},dialog:{showErrorBox:()=>{}}};
  const deps={createAuth:options=>({options}),createStore:root=>({root}),createService:({auth,store})=>({session:async()=>({auth,store})})};
  return {electron,deps,windows,handlers,quitCount:()=>quit};
}
test('Windows/Linux remove Electron menus on every window while retaining native caption and edit shortcuts', async () => {
  const {start}=require('../desktop/main.cjs');
  for (const platform of ['win32','linux','darwin']) {
    const h=fakeElectron();const menus=[];
    h.electron.Menu={setApplicationMenu:menu=>menus.push(menu)};
    await start(h.electron,h.deps,platform);
    h.windows[0].emit('closed');h.electron.app.emit('activate');
    assert.deepEqual(menus,platform==='darwin'?[]:[null]);
    for(const win of h.windows) {
      assert.notEqual(win.options.frame,false,'keep OS window controls');
      assert.equal(win.webContents.listenerCount('before-input-event'),0,'do not swallow keyboard shortcuts');
      if(platform!=='darwin') {assert.equal(win.menuRemoved,true);assert.equal(win.menuVisible,false);}
    }
  }
});

test('Windows alone sets the runtime application identity to the packaged app ID', async () => {
  const {start}=require('../desktop/main.cjs');
  for (const platform of ['win32','linux','darwin']) {
    const h=fakeElectron();const ids=[];
    h.electron.app.setAppUserModelId=id=>ids.push(id);
    await start(h.electron,h.deps,platform);
    assert.deepEqual(ids,platform==='win32'?['dev.wisedev.rifttask']:[]);
  }
});

test('main boots only local dist with locked down BrowserWindow and denies navigation/windows/permissions', async () => {
  const {start}=require('../desktop/main.cjs'); const h=fakeElectron();
  let closes=0,disposals=0;const originalService=h.deps.createService;h.deps.createService=options=>({...originalService(options),closeTerminals:()=>closes++,dispose:()=>disposals++});
  process.env.ELECTRON_RENDERER_URL='https://evil.example';
  try {await start(h.electron,h.deps);} finally {delete process.env.ELECTRON_RENDERER_URL;}
  const win=h.windows[0]; assert.equal(win.file,path.resolve(__dirname,'../dist/index.html'));
  const prefs=win.options.webPreferences;
  assert.equal(prefs.contextIsolation,true); assert.equal(prefs.sandbox,true); assert.equal(prefs.nodeIntegration,false);
  assert.equal(prefs.webviewTag,false); assert.equal(prefs.webSecurity,true); assert.equal(prefs.allowRunningInsecureContent,false);
  assert.equal(prefs.preload,path.resolve(__dirname,'../desktop/preload.cjs'));
  assert.deepEqual(win.windowOpen({url:'https://github.com/o/r'}),{action:'deny'});
  for(const event of ['will-navigate','will-frame-navigate','will-redirect','will-attach-webview']) {
    let prevented=false;win.webContents.emit(event,{preventDefault:()=>prevented=true},'https://evil.example');assert.ok(prevented,event);
  }
  let permission;win.permission({},'camera',value=>permission=value);assert.equal(permission,false);assert.equal(win.permissionCheck(),false);
  const session=await h.handlers.get('rift:session')({sender:win.webContents,senderFrame:win.webContents.mainFrame});
  assert.equal(session.auth.options.cachePath,path.join('/local/userData','identity.json'));assert.equal(session.store.root,'/local/userData');
  win.emit('ready-to-show');assert.equal(win.shown,true);
  h.electron.app.emit('second-instance');assert.equal(win.restored,true);assert.equal(win.focused,true);
  win.emit('closed');assert.equal(h.handlers.size,0);assert.equal(closes,1);
  h.electron.app.emit('activate');assert.equal(h.windows.length,2);
  h.electron.app.emit('will-quit');assert.equal(h.handlers.size,0);assert.equal(disposals,1);
});
test('repository creation confirmation is native, exact-target and defaults to Cancel',async()=>{
 const h=fakeElectron();let options;h.deps.createService=value=>{options=value;return {};};let response=0;const calls=[];
 h.electron.dialog.showMessageBox=async(win,payload)=>{calls.push(payload);assert.equal(win,h.windows[0]);return {response};};
 await require('../desktop/main.cjs').start(h.electron,h.deps);
 assert.equal(await options.confirmCloudCreate('solo/task-data'),false);response=1;assert.equal(await options.confirmCloudCreate('solo/task-data'),true);
 assert.equal(calls[0].defaultId,0);assert.equal(calls[0].cancelId,0);assert.deepEqual(calls[0].buttons,['Cancel','Create private repository']);assert.match(calls[0].message,/solo\/task-data/);assert.match(calls[0].detail,/not enable|stays off/);
 await assert.rejects(options.confirmCloudCreate('solo/data\nSECRET'),/Invalid/);assert.equal(calls.length,2);
});
test('chooseDirectory uses the native directory-only dialog and handles cancellation', async () => {
  const {start}=require('../desktop/main.cjs');const h=fakeElectron();
  const choices=[{canceled:false,filePaths:['/chosen/project']},{canceled:true,filePaths:[]}];
  const calls=[];
  h.electron.dialog.showOpenDialog=async (...args)=>{calls.push(args);return choices.shift();};
  await start(h.electron,h.deps);
  const win=h.windows[0];const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};
  const choose=h.handlers.get('rift:chooseDirectory');
  assert.equal(await choose(event),'/chosen/project');
  assert.equal(calls[0][0],win);
  assert.deepEqual(calls[0][1],{title:'Choose project directory',properties:['openDirectory']});
  assert.equal(await choose(event),null);
  await assert.rejects(choose({...event,senderFrame:{url:indexURL}}),/Untrusted/);
  await assert.rejects(choose(event,'/renderer/path'),/arguments/);
  assert.equal(calls.length,2);
});

test('failed local page load reports a safe startup error and quits', async () => {
  const {start}=require('../desktop/main.cjs');const h=fakeElectron();
  const Base=h.electron.BrowserWindow;
  h.electron.BrowserWindow=class extends Base {constructor(options){super(options);this.loadFile=async()=>{throw new Error('secret local path');};}};
  let message;h.electron.dialog.showErrorBox=(...args)=>message=args.join(':');
  await start(h.electron,h.deps);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.quitCount(),1);assert.match(message,/npm run build/);assert.doesNotMatch(message,/secret/);
});

test('second app instance quits before constructing any window or IPC', async () => {
  const {start}=require('../desktop/main.cjs');const h=fakeElectron({lock:false});
  await start(h.electron,h.deps); assert.equal(h.quitCount(),1);assert.equal(h.windows.length,0);assert.equal(h.handlers.size,0);
});

test('export backup uses a native save dialog behind trusted zero-argument IPC',async t=>{
  const os=require('node:os');const {createStore}=require('../desktop/store.cjs');
  const {createService}=require('../desktop/service.cjs');const {emptyWorkspace}=require('../desktop/core.cjs');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rift-export-ipc-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const h=fakeElectron();const target=path.join(root,'export.json');let dialogs=0;
  h.electron.dialog.showSaveDialog=async(win,options)=>{
    assert.equal(win,h.windows[0]);assert.equal(options.title,'Export workspace backup');
    assert.match(options.defaultPath,/\.json$/);assert.deepEqual(options.filters,[{name:'JSON workspace',extensions:['json']}]);
    dialogs++;return dialogs===1?{canceled:false,filePath:target}:{canceled:true};
  };
  const store=createStore(path.join(root,'app'));const workspace=emptyWorkspace();store.save(17,workspace);
  await require('../desktop/main.cjs').start(h.electron,{createAuth:()=>({session:async()=>({account:{id:17}})}),createStore:()=>store,createService});
  const win=h.windows[0];const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};
  const handler=h.handlers.get('rift:exportBackup');
  await assert.rejects(handler({...event,senderFrame:{url:indexURL}}),/Untrusted/);
  await assert.rejects(handler(event,'/renderer/path'),/arguments/);assert.equal(dialogs,0);
  assert.equal(await handler(event),true);assert.deepEqual(JSON.parse(fs.readFileSync(target,'utf8')),workspace);
  assert.equal(await handler(event),false);assert.equal(dialogs,2);
});

test('import uses a native single-file dialog through trusted zero-argument IPC',async t=>{
 const os=require('node:os');const {createStore}=require('../desktop/store.cjs');
 const {createService}=require('../desktop/service.cjs');const {emptyWorkspace,createSampleWorkspace}=require('../desktop/core.cjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rift-import-ipc-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const h=fakeElectron();const source=path.join(root,'backup.json');const incoming=createSampleWorkspace();fs.writeFileSync(source,JSON.stringify(incoming));let dialogs=0;
 h.electron.dialog.showOpenDialog=async(win,options)=>{
  assert.equal(win,h.windows[0]);assert.equal(options.title,'Import workspace backup');
  assert.deepEqual(options.properties,['openFile']);assert.deepEqual(options.filters,[{name:'JSON workspace',extensions:['json']}]);
  return ++dialogs===1?{canceled:false,filePaths:[source]}:{canceled:true,filePaths:[]};
 };
 const store=createStore(path.join(root,'app'));store.save(17,emptyWorkspace());
 h.electron.dialog.showMessageBox=async(win,options)=>{assert.equal(win,h.windows[0]);assert.equal(options.cancelId,0);assert.equal(options.defaultId,0);assert.deepEqual(options.buttons,['Cancel','Restore backup']);assert.match(options.detail,/recovery archive/);return {response:1};};
 await require('../desktop/main.cjs').start(h.electron,{createAuth:()=>({session:async()=>({account:{id:17}})}),createStore:()=>store,createService});
 const win=h.windows[0];const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};const handler=h.handlers.get('rift:importBackup');
 await assert.rejects(handler({...event,senderFrame:{url:indexURL}}),/Untrusted/);
 await assert.rejects(handler(event,source),/arguments/);assert.equal(dialogs,0);
 assert.deepEqual(await handler(event),incoming);assert.deepEqual(store.load(17),incoming);
 assert.equal(await handler(event),null);assert.equal(dialogs,2);
});
