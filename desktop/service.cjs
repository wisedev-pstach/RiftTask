'use strict';
const {readGitStatus} = require('./git.cjs');
const {openTerminalDirectory} = require('./terminal.cjs');
const fs=require('node:fs');
const {validateWorkspace}=require('./core.cjs');
function createService({auth,store,launchTerminal=openTerminalDirectory,chooseExportPath}) {
  let boundAccount=null;
  async function refresh(method) {
    const state=await auth[method]();
    boundAccount=state.account?.id??null;
    return state;
  }
  async function accountId() {
    const {account}=await auth.session();
    if (!account) throw new Error('Sign in to GitHub to open your workspace.');
    if (boundAccount!==null && boundAccount!==account.id) {
      throw new Error('GitHub account changed. Disconnect and check sign-in before opening or saving another workspace.');
    }
    boundAccount=account.id;
    return account.id;
  }
  return {
    session:()=>refresh('session'),
    login:()=>refresh('login'),
    logout:async()=>{const state=await auth.logout();boundAccount=null;return state;},
    exportBackup:async()=>{
      const id=await accountId();
      const destination=await chooseExportPath();
      if(!destination)return false;
      if(await accountId()!==id)throw new Error('GitHub account changed. Retry backup export.');
      const text=JSON.stringify(validateWorkspace(await store.load(id)));
      if(await accountId()!==id)throw new Error('GitHub account changed. Retry backup export.');
      let fd,created=false;
      try {
        fd=fs.openSync(destination,'wx',0o600);created=true;
        fs.writeFileSync(fd,text,'utf8');
        fs.fsyncSync(fd);
        const closing=fd;fd=undefined;fs.closeSync(closing);
      } catch(error) {
        let incomplete=false;
        if(fd!==undefined){try{fs.closeSync(fd);}catch{}fd=undefined;}
        if(error.code!=='EEXIST'){
          // Only remove files this operation actually created, never a failed open.
          // A close error also means the newly created destination is incomplete.
          if(created){try{fs.unlinkSync(destination);}catch{incomplete=true;}}
        }
        throw new Error(error.code==='EEXIST'?'Backup destination already exists. Choose a new filename; existing files are never replaced.':incomplete?'Could not export backup. An incomplete destination could not be removed; delete it before retrying.':'Could not export backup. Choose a writable destination and retry.');
      }
      return true;
    },
    load:async()=>store.load(await accountId()),
    save:async(workspace)=>store.save(await accountId(),workspace),
    openTerminal:async(projectId)=>{
      if (typeof projectId!=='string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(projectId)) throw new Error('Invalid project ID.');
      const workspace=await store.load(await accountId());
      const project=workspace.projects.find(project=>project.id===projectId);
      if (!project) throw new Error('Project not found in the active workspace.');
      await launchTerminal(project.localPath);
    },
    gitStatus:async(projectId)=>{
      if (typeof projectId!=='string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(projectId)) throw new Error('Invalid project ID.');
      const workspace=await store.load(await accountId());
      const project=workspace.projects.find(project=>project.id===projectId);
      if (!project) throw new Error('Project not found in the active workspace.');
      return readGitStatus(project.localPath);
    }
  };
}
module.exports={createService};
