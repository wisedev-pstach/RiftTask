'use strict';
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {createAuth} = require('./auth.cjs');
const {createStore} = require('./store.cjs');
const {createService} = require('./service.cjs');
const {registerIpc} = require('./ipc.cjs');

// Electron is loaded only at the executable entry point, enabling node:test
// coverage without disabling Electron's sandbox or starting a GUI in tests.
async function start({app,BrowserWindow,ipcMain,shell,dialog}, dependencies = {createAuth,createStore,createService}) {
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
  const userData = app.getPath('userData');
  const auth = dependencies.createAuth({cachePath:path.join(userData,'identity.json')});
  const store = dependencies.createStore(userData);
  const service = dependencies.createService({auth,store,chooseExportPath:async()=>{
    const result=await dialog.showSaveDialog(window,{title:'Export workspace backup',defaultPath:'RiftTask-backup.json',filters:[{name:'JSON workspace',extensions:['json']}],properties:['showOverwriteConfirmation']});
    return result.canceled ? null : result.filePath ?? null;
  },chooseImportPath:async()=>{
    const result=await dialog.showOpenDialog(window,{title:'Import workspace backup',filters:[{name:'JSON workspace',extensions:['json']}],properties:['openFile']});
    return result.canceled ? null : result.filePaths[0] ?? null;
  }});
  function fail() {
    dialog.showErrorBox('RiftTask could not start','The local application could not be loaded. Build the app with npm run build, then restart.');
    app.quit();
  }
  function createWindow() {
    const current = new BrowserWindow({
      title:'RiftTask',width:1320,height:900,minWidth:900,minHeight:640,show:false,
      backgroundColor:'#11131a',
      webPreferences:{
        preload:path.join(__dirname,'preload.cjs'),
        contextIsolation:true,sandbox:true,nodeIntegration:false,
        webSecurity:true,allowRunningInsecureContent:false,webviewTag:false
      }
    });
    window = current;
    const contents = current.webContents;
    const prevent = event => event.preventDefault();
    for (const event of ['will-navigate','will-frame-navigate','will-redirect','will-attach-webview']) contents.on(event,prevent);
    contents.setWindowOpenHandler(()=>({action:'deny'}));
    contents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    contents.session.setPermissionCheckHandler(()=>false);
    dispose = registerIpc({ipcMain,webContents:contents,indexURL,service,shell,chooseDirectory:async()=>{
      const result=await dialog.showOpenDialog(current,{title:'Choose project directory',properties:['openDirectory']});
      return result.canceled ? null : result.filePaths[0] ?? null;
    }});
    current.once('ready-to-show',()=>current.show());
    current.on('closed',()=>{dispose();dispose=()=>{};window=null;});
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
