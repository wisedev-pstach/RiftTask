'use strict';
const {setInterval,clearInterval}=require('node:timers');
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
function createService({auth,store,launchTerminal=openTerminalDirectory,chooseExportPath,chooseImportPath,confirmRestore=async()=>false,cloudRoot,cloudTransport,confirmCloudCreate=async()=>false,ptySpawn,openResourcePath,chooseResourcePath,resourceFs,resourceAuthorized=()=>true}) {
  let boundAccount=null,generation=0,terminalAccount=null,terminalBlocked=false,disconnecting=false;
  const pty=require('./pty.cjs').createPty({spawn:ptySpawn,resolve:async projectId=>{
    if(typeof projectId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(projectId))throw new Error('Invalid project ID.');
    const version=generation;
    if(terminalBlocked||disconnecting)throw new Error('Terminal is disconnected. Check sign-in first.');
    const id=terminalAccount??await accountId();
    const workspace=await store.load(id);
    if(version!==generation||boundAccount!==id||terminalBlocked||disconnecting)throw new Error('Account changed.');
    const project=workspace.projects.find(p=>p.id===projectId&&!p.archived);
    if(!project||!project.localPath)throw new Error('Choose a local project directory.');
    terminalAccount=id;return {account:id,path:project.localPath};
  }});
  let auditing=false;
  const auditTimer=setInterval(async()=>{if(auditing||terminalAccount===null)return;auditing=true;try{await accountId();await pty.audit();}catch{pty.reset();terminalAccount=null;}finally{auditing=false;}},5000);auditTimer.unref?.();
  const cloud=cloudRoot?require('./cloud-runtime.cjs').createCloud({root:cloudRoot,store,confirmCreate:confirmCloudCreate,transport:cloudTransport||require('./cloud-transport.cjs').createCloudTransport(),identity:async()=>{const id=await accountId();const state=await auth.session();if(state.account?.id!==id)throw new Error('GitHub account changed.');return {...state,generation};}}):null;
  const cloudCall=method=>async(...args)=>{if(!cloud)throw new Error('Cloud is unavailable.');return cloud[method](...args);};
  async function refresh(method) {
    const version=generation;if(disconnecting)throw new Error('Account disconnect is in progress.');
    const state=await auth[method]();
    if(version!==generation||disconnecting)throw new Error('Account changed during sign-in check. Retry.');
    if(boundAccount!==(state.account?.id??null)){generation++;pty.reset();terminalAccount=null;}
    boundAccount=state.account?.id??null;
    terminalBlocked=!state.account;
    return state;
  }
  async function accountId() {
    const {account}=await auth.session();
    if (!account) {pty.reset();terminalAccount=null;throw new Error('Sign in to GitHub to open your workspace.');}
    if (boundAccount!==null && boundAccount!==account.id) {
      pty.reset();terminalAccount=null;
      throw new Error('GitHub account changed. Disconnect and check sign-in before opening or saving another workspace.');
    }
    boundAccount=account.id;
    return account.id;
  }
  let resourceGeneration=0;
  const {safeId,inspectResource}=require('./task-resources.cjs');
  async function resourceContext(){
    // Snapshot before the first await: stale auth must never rebind a newer session.
    const epoch=resourceGeneration,version=generation,binding=boundAccount;
    const guardBinding=expected=>{if(epoch!==resourceGeneration||version!==generation||boundAccount!==expected||disconnecting||!resourceAuthorized())throw new Error('Resource action expired. Retry from the current task.');};
    guardBinding(binding);
    const {account}=await auth.session();guardBinding(binding);
    if(!account)throw new Error('Sign in to GitHub to open your workspace.');
    if(binding!==null&&binding!==account.id)throw new Error('GitHub account changed. Retry.');
    const id=account.id;boundAccount=id;
    const guard=()=>guardBinding(id);
    const verify=async()=>{guard();const state=await auth.session();guard();if(state.account?.id!==id)throw new Error('GitHub account changed. Retry.');};
    return {id,guard,verify};
  }
  return {
    cancelResourceActions:()=>{resourceGeneration++;},
    chooseTaskResource:async(kind,projectId,taskId)=>{
      if(!['file','directory'].includes(kind)||!safeId(projectId)||(taskId!==''&&!safeId(taskId)))throw new Error('Invalid resource picker arguments.');
      const context=await resourceContext();context.guard();
      let originalProject;
      const check=async()=>{const w=await store.load(context.id);context.guard();const task=taskId===''?null:w.tasks.find(t=>t.id===taskId);if(!w.projects.some(p=>p.id===projectId&&!p.archived)||(taskId!==''&&(!task||!w.projects.some(p=>p.id===task.projectId&&!p.archived))))throw new Error('Task or project not found.');if(task){if(originalProject!==undefined&&originalProject!==task.projectId)throw new Error('Saved task project changed. Retry.');originalProject=task.projectId;}};
      await check();context.guard();if(!chooseResourcePath)throw new Error('Native picker unavailable.');const selected=await chooseResourcePath(kind);context.guard();await context.verify();context.guard();await check();context.guard();return selected;
    },
    openTaskResource:async(taskId,resourceId)=>{
      if(!safeId(taskId)||!safeId(resourceId))throw new Error('Invalid resource ID.');
      const context=await resourceContext();context.guard();
      const resolve=async()=>{const w=await store.load(context.id);context.guard();const task=w.tasks.find(t=>t.id===taskId);if(!task||!w.projects.some(p=>p.id===task.projectId&&!p.archived))throw new Error('Task or project not found.');const resource=task.localResources?.find(r=>r.id===resourceId);if(!resource)throw new Error('Saved resource not found. Save the task first.');return {projectId:task.projectId,resource};};
      const original=await resolve();context.guard();const target=await inspectResource(original.resource,resourceFs);context.guard();const current=await resolve();context.guard();if(JSON.stringify(original)!==JSON.stringify(current))throw new Error('Saved reference changed. Retry.');await context.verify();context.guard();if(!openResourcePath)throw new Error('Native Open unavailable.');const error=await openResourcePath(target);context.guard();if(error)throw new Error('Could not open file or folder: '+error);
    },
    ptyStart:project=>pty.start(project),ptyRead:(project,id)=>pty.read(project,id),ptyInput:(project,id,data)=>pty.input(project,id,data),ptyResize:(project,id,cols,rows)=>pty.resize(project,id,cols,rows),ptyClose:(project,id)=>pty.close(project,id),
    closeTerminals:()=>{resourceGeneration++;pty.reset();terminalAccount=null;},
    dispose:()=>{resourceGeneration++;clearInterval(auditTimer);pty.dispose();},
    cloudStatus:async()=>cloud?cloud.status():{state:'off'},
    cloudCreate:cloudCall('create'),cloudVerify:cloudCall('verify'),cloudEnable:cloudCall('enable'),cloudDisable:cloudCall('disable'),cloudSync:cloudCall('sync'),
    session:()=>refresh('session'),
    checkLogin:()=>refresh('checkLogin'),
    login:()=>refresh('login'),
    logout:async()=>{generation++;pty.reset();terminalAccount=null;terminalBlocked=true;disconnecting=true;try{const state=await auth.logout();boundAccount=null;return state;}finally{disconnecting=false;}},
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
      const version=generation;
      const verify=async()=>{if(await accountId()!==id||version!==generation||disconnecting)throw new Error('GitHub account changed. Retry backup import.');};
      const source=await chooseImportPath();
      if(!source)return null;
      await verify();
      const workspace=readBackup(source);
      await verify();
      if(await confirmRestore()!==true)return null;
      await verify();
      let saved;
      try{saved=await store.restore(id,workspace);}
      catch{throw new Error('Could not restore backup. Existing originals retained; check disk space and account-directory permissions, then retry. A partial recovery archive may remain; do not delete original files.');}
      await pty.audit();return saved;
    },
    load:async()=>store.load(await accountId()),
    save:async(workspace)=>{resourceGeneration++;const saved=await store.save(await accountId(),workspace);await pty.audit();return saved;},
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
