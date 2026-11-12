'use strict';
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {createAuth} = require('./auth.cjs');
const {createStore} = require('./store.cjs');
const {createService} = require('./service.cjs');
const {registerIpc} = require('./ipc.cjs');

// Electron is loaded only at the executable entry point, enabling node:test
// coverage without disabling Electron's sandbox or starting a GUI in tests.
async function start({app,BrowserWindow,Menu,ipcMain,shell,dialog}, dependencies = {createAuth,createStore,createService}, platform = process.platform) {
  if (!app.requestSingleInstanceLock()) {app.quit(); return;}
  let window = null;
  let dispose = () => {};
  const indexFile = path.join(__dirname,'..','dist','index.html');
  const indexURL = pathToFileURL(indexFile).href;
  function focus() {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  }
  app.on('second-instance',focus);
  app.on('will-quit',()=>dispose());
  app.on('window-all-closed',()=>{if (process.platform !== 'darwin') app.quit();});
  await app.whenReady();
  // Keep native window controls and renderer keyboard input; remove only the
  // default Electron File/Edit/View/Window/Help menu on Windows and Linux.
  if (platform !== 'darwin') Menu.setApplicationMenu(null);
  if (platform === 'win32') app.setAppUserModelId('dev.wisedev.rifttask');
  const userData = app.getPath('userData');
  const auth = dependencies.createAuth({cachePath:path.join(userData,'identity.json')});
  const store = dependencies.createStore(userData);
  const service = dependencies.createService({auth,store,cloudRoot:userData,resourceAuthorized:()=>!!window&&!window.isDestroyed?.()&&window.webContents.mainFrame?.url===indexURL,openResourcePath:p=>shell.openPath(p),chooseResourcePath:async kind=>{
    if(!['file','directory'].includes(kind))throw new Error('Invalid resource kind.');
    const result=await dialog.showOpenDialog(window,{title:kind==='file'?'Choose task file':'Choose task folder',properties:[kind==='file'?'openFile':'openDirectory']});
    return result.canceled?null:result.filePaths[0]??null;
  },chooseExportPath:async()=>{
    const result=await dialog.showSaveDialog(window,{title:'Export workspace backup',defaultPath:'RiftTask-backup.json',filters:[{name:'JSON workspace',extensions:['json']}],properties:['showOverwriteConfirmation']});
    return result.canceled ? null : result.filePath ?? null;
  },chooseImportPath:async()=>{
    const result=await dialog.showOpenDialog(window,{title:'Import workspace backup',filters:[{name:'JSON workspace',extensions:['json']}],properties:['openFile']});
    return result.canceled ? null : result.filePaths[0] ?? null;
  },confirmCloudCreate:async target=>{
    if(typeof target!=='string'||! /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(target)||/[\s\0]/.test(target)||target.split('/').some(v=>v==='.'||v==='..'))throw new Error('Invalid repository name.');
    const result=await dialog.showMessageBox(window,{type:'question',title:'Create private repository?',message:'Create '+target+' on GitHub?',detail:'Creates a private personal repository initialized with a README. No tasks are uploaded. Manual cloud stays off: Verify and separate sync consent are still required. This does not expand GitHub permissions.',buttons:['Cancel','Create private repository'],defaultId:0,cancelId:0,noLink:true});
    return result.response===1;
  },confirmRestore:async()=>{
    const result=await dialog.showMessageBox(window,{type:'warning',title:'Restore workspace backup?',message:'Replace this account’s workspace with the selected validated backup?',detail:'Existing corrupt primary and rolling backup files will first be copied unchanged into a new recovery archive in this account’s data directory. A healthy current workspace is retained as the rolling safety backup. No other account is changed.',buttons:['Cancel','Restore backup'],defaultId:0,cancelId:0,noLink:true});
    return result.response===1;
  }});
  app.on('will-quit',()=>service.dispose?.());
  function fail() {
    dialog.showErrorBox('RiftTask could not start','The local application could not be loaded. Build the app with npm run build, then restart.');
    app.quit();
  }
  function createWindow() {
    const current = new BrowserWindow({
      title:'RiftTask',width:1320,height:900,minWidth:900,minHeight:640,show:false,
      backgroundColor:'#11131a',
      icon:path.join(__dirname,'..','build','icon.png'),
      webPreferences:{
        preload:path.join(__dirname,'preload.cjs'),
        contextIsolation:true,sandbox:true,nodeIntegration:false,
        webSecurity:true,allowRunningInsecureContent:false,webviewTag:false
      }
    });
    if (platform !== 'darwin') {
      current.removeMenu();
      current.setMenuBarVisibility(false);
    }
    window = current;
    const contents = current.webContents;
    const prevent = event => event.preventDefault();
    for (const event of ['will-navigate','will-frame-navigate','will-redirect','will-attach-webview']) contents.on(event,prevent);
    contents.setWindowOpenHandler(()=>({action:'deny'}));
    contents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    contents.session.setPermissionCheckHandler(()=>false);
    dispose = registerIpc({ipcMain,webContents:contents,indexURL,service,shell,getVersion:()=>app.getVersion(),chooseDirectory:async()=>{
      const result=await dialog.showOpenDialog(current,{title:'Choose project directory',properties:['openDirectory']});
      return result.canceled ? null : result.filePaths[0] ?? null;
    }});
    current.once('ready-to-show',()=>current.show());
    contents.on('render-process-gone',()=>service.closeTerminals?.());
    current.on('closed',()=>{service.closeTerminals?.();dispose();dispose=()=>{};window=null;});
    // Never load a dev URL or a renderer URL supplied through the environment.
    current.loadFile(indexFile).catch(fail);
  }
  app.on('activate',()=>{if (!window) createWindow(); else focus();});
  createWindow();
}

if (require.main === module) {
  const electron = require('electron');
  start(electron).catch(()=>{
    electron.dialog.showErrorBox('RiftTask could not start','Application initialization failed. Please restart RiftTask.');
    electron.app.quit();
  });
}
module.exports = {start};
