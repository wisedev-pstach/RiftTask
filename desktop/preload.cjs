'use strict';
// Keep this file self-contained: sandboxed preload can require Electron only.
const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('rift',Object.freeze({
  cloudCreate:input=>ipcRenderer.invoke('rift:cloudCreate',input),
  cloudStatus:()=>ipcRenderer.invoke('rift:cloudStatus'),
  cloudVerify:name=>ipcRenderer.invoke('rift:cloudVerify',name),
  cloudEnable:consent=>ipcRenderer.invoke('rift:cloudEnable',consent),
  cloudDisable:()=>ipcRenderer.invoke('rift:cloudDisable'),
  cloudSync:options=>ipcRenderer.invoke('rift:cloudSync',options),
  ptyStart:project=>ipcRenderer.invoke('rift:ptyStart',project),
  ptyRead:(project,id)=>ipcRenderer.invoke('rift:ptyRead',project,id),
  ptyInput:(project,id,data)=>ipcRenderer.invoke('rift:ptyInput',project,id,data),
  ptyResize:(project,id,cols,rows)=>ipcRenderer.invoke('rift:ptyResize',project,id,cols,rows),
  ptyClose:(project,id)=>ipcRenderer.invoke('rift:ptyClose',project,id),
  session:()=>ipcRenderer.invoke('rift:session'),
  login:()=>ipcRenderer.invoke('rift:login'),
  checkLogin:()=>ipcRenderer.invoke('rift:checkLogin'),
  logout:()=>ipcRenderer.invoke('rift:logout'),
  load:()=>ipcRenderer.invoke('rift:load'),
  save:workspace=>ipcRenderer.invoke('rift:save',workspace),
  chooseDirectory:()=>ipcRenderer.invoke('rift:chooseDirectory'),
  openRepository:url=>ipcRenderer.invoke('rift:openRepository',url),
  openTerminal:projectId=>ipcRenderer.invoke('rift:openTerminal',projectId),
  gitStatus:projectId=>ipcRenderer.invoke('rift:gitStatus',projectId),
  exportBackup:()=>ipcRenderer.invoke('rift:exportBackup'),
  importBackup:()=>ipcRenderer.invoke('rift:importBackup')
}));
