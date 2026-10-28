'use strict';

const BASIC_METHODS = Object.freeze({ptyStart:1,ptyRead:2,ptyInput:3,ptyResize:4,ptyClose:2,cloudStatus:0,cloudVerify:1,cloudEnable:1,cloudDisable:0,cloudSync:1,session:0,login:0,logout:0,load:0,save:1,exportBackup:0,importBackup:0,gitStatus:1,openTerminal:1});

function repositoryURL(value) {
  const invalid = () => {throw new Error('Invalid repository URL. Use an HTTPS GitHub or Azure DevOps repository URL.');};
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\%]/.test(value)) return invalid();
  let url;
  try {url = new URL(value);} catch {return invalid();}
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || url.href !== value) return invalid();
  const segment = '[A-Za-z0-9_.-]+';
  const github = url.hostname === 'github.com' && new RegExp('^/'+segment+'/'+segment+'/?$').test(url.pathname);
  const azure = url.hostname === 'dev.azure.com' && new RegExp('^/'+segment+'/'+segment+'/_git/'+segment+'/?$').test(url.pathname);
  const legacy = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.visualstudio\.com$/.test(url.hostname) && new RegExp('^/(?:DefaultCollection/)?'+segment+'/_git/'+segment+'/?$').test(url.pathname);
  if (!(github || azure || legacy) || url.pathname.split('/').some(s => s === '.' || s === '..')) return invalid();
  return url.href;
}

function registerIpc({ipcMain,webContents,indexURL,service,shell,chooseDirectory}) {
  const channels = [];
  const methods = {...BASIC_METHODS,openRepository:1,openTerminal:1,gitStatus:1,chooseDirectory:0,exportBackup:0,importBackup:0};
  for (const [name,arity] of Object.entries(methods)) {
    const channel = 'rift:'+name;
    ipcMain.handle(channel, async (event,...args) => {
      if (!event || event.sender !== webContents || !event.senderFrame ||
          event.senderFrame !== webContents.mainFrame || event.senderFrame.url !== indexURL) {
        throw new Error('Untrusted IPC sender.');
      }
      if (args.length !== arity) throw new Error('Invalid IPC arguments.');
      if (name === 'openRepository') {await shell.openExternal(repositoryURL(args[0])); return;}
      if (name === 'chooseDirectory') return chooseDirectory();
      if (!Object.hasOwn(BASIC_METHODS,name)) throw new Error(name+' is not yet available. Scheduled for the native-integration milestone.');
      return service[name](...args);
    });
    channels.push(channel);
  }
  return () => channels.forEach(channel => ipcMain.removeHandler(channel));
}

module.exports = {registerIpc};
