'use strict';
// Keep this file self-contained: sandboxed preload can require Electron only.
const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('rift',Object.freeze({
  session:()=>ipcRenderer.invoke('rift:session'),
  login:()=>ipcRenderer.invoke('rift:login'),
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
