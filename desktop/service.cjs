'use strict';
const {readGitStatus} = require('./git.cjs');
const {openTerminalDirectory} = require('./terminal.cjs');
const fs=require('node:fs');
const {validateWorkspace,MAX_BYTES}=require('./core.cjs');
function readBackup(source){
  let fd,text;
  try{
    if(!fs.lstatSync(source).isFile())throw new Error('Not a regular file');
    fd=fs.openSync(source,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0)|(fs.constants.O_NONBLOCK||0));
    const stat=fs.fstatSync(fd);
    if(!stat.isFile()||stat.size>MAX_BYTES)throw new Error('Invalid file size or type');
    // Read at most limit+1 even if the file grows after fstat.
    const buffer=Buffer.alloc(MAX_BYTES+1);let length=0;
    while(length<buffer.length){const count=fs.readSync(fd,buffer,length,buffer.length-length,null);if(!count)break;length+=count;}
    if(length>MAX_BYTES)throw new Error('Size limit');
    text=buffer.toString('utf8',0,length);
    const closing=fd;fd=undefined;fs.closeSync(closing);
  }catch{
    if(fd!==undefined){try{fs.closeSync(fd);}catch{}}
    throw new Error('Could not read backup. Choose a regular JSON file no larger than 8 MiB.');
  }
  try{return validateWorkspace(JSON.parse(text));}
  catch{throw new Error('Invalid backup. A valid version-1 RiftTask workspace is required; no data was replaced.');}
}
function createService({auth,store,launchTerminal=openTerminalDirectory,chooseExportPath,chooseImportPath,cloudRoot,cloudTransport}) {
  let boundAccount=null,generation=0;
  const cloud=cloudRoot?require('./cloud-runtime.cjs').createCloud({root:cloudRoot,store,transport:cloudTransport||require('./cloud-transport.cjs').createCloudTransport(),identity:async()=>{const id=await accountId();const state=await auth.session();if(state.account?.id!==id)throw new Error('GitHub account changed.');return {...state,generation};}}):null;
  const cloudCall=method=>async(...args)=>{if(!cloud)throw new Error('Cloud is unavailable.');return cloud[method](...args);};
  async function refresh(method) {
    const state=await auth[method]();
    if(boundAccount!==(state.account?.id??null))generation++;
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
    cloudStatus:async()=>cloud?cloud.status():{state:'off'},
    cloudVerify:cloudCall('verify'),cloudEnable:cloudCall('enable'),cloudDisable:cloudCall('disable'),cloudSync:cloudCall('sync'),
    session:()=>refresh('session'),
    login:()=>refresh('login'),
    logout:async()=>{generation++;const state=await auth.logout();boundAccount=null;return state;},
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
    importBackup:async()=>{
      const id=await accountId();
      const source=await chooseImportPath();
      if(!source)return null;
      if(await accountId()!==id)throw new Error('GitHub account changed. Retry backup import.');
      const workspace=readBackup(source);
      if(await accountId()!==id)throw new Error('GitHub account changed. Retry backup import.');
      return store.save(id,workspace);
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
