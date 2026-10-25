'use strict';
const {readGitStatus} = require('./git.cjs');
const {openTerminalDirectory} = require('./terminal.cjs');
function createService({auth,store,launchTerminal=openTerminalDirectory}) {
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
