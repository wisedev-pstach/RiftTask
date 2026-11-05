'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {projectCloudWorkspace,prepareCloudRestore}=require('./cloud-snapshot.cjs');
const fingerprint=text=>{const value=JSON.parse(text);delete value.workspace.updatedAt;return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');};
function createCloud({root,store,transport,identity,confirmCreate=async()=>false}){
 let pending=null,busy=false,epoch=0;
 async function guard(s,e){const now=await context();if(e!==epoch||now.generation!==s.generation||now.account.id!==s.account.id||now.account.login!==s.account.login||now.offline)throw new Error('Cloud operation cancelled: account or configuration changed.');}
 async function validateRepository(r,s,workspace,bound){
  const name=r?.full_name?.toLowerCase();
  const projectNames=workspace.projects.map(p=>p.repositoryUrl.replace(/\/$/,'').replace(/\.git$/i,'').toLowerCase());
  if(!r||!Number.isSafeInteger(r.id)||r.id<=0||r.id===1432181232||r.private!==true||r.fork!==false||r.archived!==false||r.owner?.type!=='User'||r.owner.id!==s.account.id||!name||name==='wisedev-pstach/rifttask'||projectNames.includes('https://github.com/'+name)||typeof r.default_branch!=='string'||!r.default_branch||r.default_branch.length>255||/[\0\r\n]/.test(r.default_branch)|| (bound&&(r.id!==bound.id||r.owner.id!==bound.owner.id||r.full_name!==bound.full_name||r.default_branch!==bound.default_branch)))throw new Error('Cloud repository must be the exact dedicated personal private repository, never the source or a project repository. Verify again if it changed.');
  const linked=new Set();
  for(const project of workspace.projects){
   if(!project.repositoryUrl)continue;
   const url=new URL(project.repositoryUrl);
   if(url.hostname!=='github.com')continue;
   const projectName=url.pathname.replace(/^\//,'').replace(/\/$/,'').replace(/\.git$/i,'');
   if(!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(projectName))throw new Error('Cannot safely verify a linked project repository. Cloud stays blocked.');
   if(linked.has(projectName.toLowerCase()))continue;
   linked.add(projectName.toLowerCase());
   let metadata;try{metadata=await transport.repository(projectName);}catch{throw new Error('Cannot verify a linked project repository identity. Cloud stays blocked until it is available.');}
   if(!Number.isSafeInteger(metadata?.id)||metadata.id<=0)throw new Error('Cannot verify a linked project repository identity. Cloud stays blocked.');
   if(metadata.id===r.id)throw new Error('Cloud cannot use a project repository, including a renamed alias.');
  }
  return r;
 }
 async function checked(s,c,workspace){if(s.offline)throw new Error('Cloud needs an online verified account. Local work is still available.');return validateRepository(await transport.repository(c.repository.full_name),s,workspace,c.repository);}
 async function context(){const s=await identity();if(!s.account)throw new Error('Sign in before configuring cloud.');return s;}
 function file(id){if(!Number.isSafeInteger(id)||id<=0)throw new Error('Invalid cloud account.');const dir=path.join(root,'accounts',String(id));for(const p of [root,path.join(root,'accounts'),dir,path.join(dir,'cloud.json')]){try{if(fs.lstatSync(p).isSymbolicLink())throw new Error('Unsafe cloud configuration path.');}catch(error){if(error.code!=='ENOENT')throw error;}}fs.mkdirSync(dir,{recursive:true,mode:0o700});return path.join(dir,'cloud.json');}
 function validConfig(c,id){
  const keys=['version','accountId','enabled','repository','baseHash','baseSha'];
  if(!c||typeof c!=='object'||Array.isArray(c)||c.version!==1||c.accountId!==id||typeof c.enabled!=='boolean'||Object.keys(c).some(k=>!keys.includes(k)))return false;
  if(!c.enabled)return !Object.hasOwn(c,'repository')&&!Object.hasOwn(c,'baseHash')&&!Object.hasOwn(c,'baseSha');
  const r=c.repository;
  if(!r||typeof r!=='object'||Array.isArray(r)||!Number.isSafeInteger(r.id)||r.id<=0||r.owner?.id!==id||r.owner?.type!=='User'||r.private!==true||r.fork!==false||r.archived!==false||typeof r.full_name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(r.full_name)||r.full_name.split('/').some(v=>v==='.'||v==='..')||typeof r.default_branch!=='string'||!r.default_branch||r.default_branch.length>255||/[\0\r\n]/.test(r.default_branch))return false;
  const hasHash=Object.hasOwn(c,'baseHash'),hasSha=Object.hasOwn(c,'baseSha');
  return hasHash===hasSha&&(!hasHash||(typeof c.baseHash==='string'&&/^[a-f0-9]{64}$/.test(c.baseHash)&&typeof c.baseSha==='string'&&/^[a-f0-9]{40}$/.test(c.baseSha)));
 }
 function read(id){const p=file(id);if(!fs.existsSync(p))return {enabled:false};try{if(fs.statSync(p).size>16384)throw 0;const c=JSON.parse(fs.readFileSync(p,'utf8'));if(!validConfig(c,id))throw 0;return c;}catch{throw new Error('Cloud configuration is invalid; disable cloud and configure again.');}}
 function save(id,c){const value={...c,version:1,accountId:id};if(!validConfig(value,id))throw new Error('Cloud configuration is invalid; disable cloud and configure again.');const p=file(id),tmp=p+'.tmp-'+crypto.randomUUID();try{fs.writeFileSync(tmp,JSON.stringify(value),{mode:0o600,flag:'wx'});fs.renameSync(tmp,p);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
 return {
 create:async input=>{
  if(busy)throw new Error('Cloud operation is already running.');busy=true;pending=null;
  let posted=false,created=null,target;
  try{
   const s=await context(),e=epoch;
   if(input?.consent!==true)throw new Error('Explicit creation consent is required.');
   if(s.offline)throw new Error('Repository creation requires an online account.');
   const value=input.name;
   if(typeof value!=='string'||! /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(s.account.login))throw new Error('Invalid repository name.');
   target=value.includes('/')?value:s.account.login+'/'+value;
   if(! /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(target)||target.split('/').some(v=>v==='.'||v==='..')||target.split('/')[0]!==s.account.login)throw new Error('Use a repository name in your current personal account only.');
   const policy=()=>{
    // Inspect only the existing local destination-exclusion policy, never project data remotely.
    const workspace=store.load(s.account.id);
    if(target.toLowerCase()==='wisedev-pstach/rifttask'||workspace.projects.some(p=>p.repositoryUrl.replace(/\/$/,'').replace(/\.git$/i,'').toLowerCase()==='https://github.com/'+target.toLowerCase()))throw new Error('Cannot create a source or linked project repository for cloud.');
    return workspace;
   };
   policy();if(read(s.account.id).enabled)throw new Error('Disable existing cloud before creating another repository.');
   await guard(s,e);
   if(await confirmCreate(target)!==true)return {state:'off',cancelled:true};
   await guard(s,e);policy();
   posted=true;created=await transport.createRepository(target);
   await guard(s,e);
   if(created.full_name?.toLowerCase()!==target.toLowerCase()||created.owner?.login?.toLowerCase()!==s.account.login.toLowerCase())throw new Error('Repository owner or name did not match.');
   const repository=await validateRepository(created,s,policy());await guard(s,e);
   return {state:'off',created:repository};
  }catch(error){
   if(!posted)throw error;
   const knownCreated=!!created||error.createdKnown===true;
   if(!knownCreated&&[401,403,404,422].includes(error.httpStatus)){
    const reasons={
     401:'GitHub authentication expired. Sign in again.',
     403:'GitHub denied permission. Check current CLI access; no scopes were expanded.',
     404:'GitHub endpoint not found or inaccessible. Check account access.',
     422:'GitHub rejected repository validation; the name may already exist. Use Verify for an existing repository.'
    };
    throw new Error(reasons[error.httpStatus]+' Cloud was not enabled.');
   }
   // A remote creation cannot be rolled back safely. Never retry or delete here.
   const outcome=knownCreated?'Repository '+target+' was created; cloud binding cancelled. ':'Repository creation may have reached GitHub; outcome unverified. ';
   throw new Error(outcome+'Check the exact repository on GitHub before retrying. Cloud was not enabled. '+(knownCreated?'Account or repository policy must be verified again.':''));
  }finally{busy=false;}
 },
 status:async()=>{const s=await context(),c=read(s.account.id);return {state:c.enabled?'ready':'off',repository:c.enabled?c.repository:null};},
 verify:async name=>{if(busy)throw new Error('Cloud sync is running.');busy=true;pending=null;try{const s=await context(),e=epoch;if(typeof name!=='string'||! /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(name)||name.split('/').some(v=>v==='.'||v==='..'))throw new Error('Invalid repository: enter owner/name.');if(s.offline)throw new Error('Cloud repository verification requires an online account.');const repository=await validateRepository(await transport.repository(name),s,await store.load(s.account.id));await guard(s,e);pending={repository,accountId:s.account.id,generation:s.generation};return repository;}finally{busy=false;}},
 enable:async input=>{if(busy)throw new Error('Cloud sync is running.');const s=await context();if(input?.consent!==true)throw new Error('Explicit consent is required.');if(!pending||pending.accountId!==s.account.id||pending.generation!==s.generation||pending.repository.id!==input.repositoryId)throw new Error('Verify the repository again.');const repository=pending.repository;save(s.account.id,{enabled:true,repository});pending=null;return {state:'ready',repository};},
 disable:async()=>{epoch++;const s=await context();pending=null;save(s.account.id,{enabled:false});return {state:'off'};},
 sync:async(input={})=>{
  if(busy)throw new Error('Cloud sync is already running.');busy=true;
  try{
   const s=await context(),e=epoch,c=read(s.account.id);if(!c.enabled)throw new Error('Cloud is disabled.');
   const local=store.load(s.account.id),scope={accountId:s.account.id,repositoryId:c.repository.id};
   const text=JSON.stringify(projectCloudWorkspace(local,scope)),hash=fingerprint(text);
   const unchanged=()=>fingerprint(JSON.stringify(projectCloudWorkspace(store.load(s.account.id),scope)))===hash;
   const repository=await checked(s,c,local);await guard(s,e);
   if(!unchanged())throw new Error('Local workspace changed during cloud policy verification. Retry.');
   const remote=await transport.read(repository);await guard(s,e);
   if(remote)prepareCloudRestore(remote.text,local,scope);
   if(!unchanged())throw new Error('Local workspace changed during sync. Retry.');
   const acknowledge=r=>{save(s.account.id,{...c,baseHash:hash,baseSha:r.sha});return {state:'verified',repository};};
   if(remote&&(remote.text===text||(c.baseHash===hash&&c.baseSha===remote.sha)))return acknowledge(remote);
   const empty=!local.categories.length&&!local.projects.length&&!local.tasks.length;
   const pullable=remote&&((!c.baseHash&&empty)||(c.baseHash===hash&&remote.sha!==c.baseSha));
   if(pullable){
    if(input.pullSha!==remote.sha)return {state:'download-required',repository,pullSha:remote.sha};
    await guard(s,e);if(!unchanged())throw new Error('Local workspace changed during sync. Retry.');
    const restored=prepareCloudRestore(remote.text,store.load(s.account.id),scope);
    store.save(s.account.id,restored); // store saves the previous workspace to .bak before replacement
    save(s.account.id,{...c,baseHash:fingerprint(JSON.stringify(projectCloudWorkspace(restored,scope))),baseSha:remote.sha});
    return {state:'verified',repository,workspace:restored};
   }
   if(remote&&(!c.baseHash||hash!==c.baseHash)&&(!c.baseSha||remote.sha!==c.baseSha))return {state:'conflict',repository};
   if(!remote&&c.baseSha)return {state:'conflict',repository};
   await guard(s,e);if(!unchanged())throw new Error('Local workspace changed during sync. Retry.');
   let writeRejected=false;
   try{await transport.write(repository,text,remote?.sha);}catch{writeRejected=true;}
   await guard(s,e);
   const readback=await transport.read(repository);await guard(s,e);
   if(!readback||readback.text!==text){if(writeRejected)return {state:'conflict',repository};throw new Error('Cloud write is unverified. Retry Sync now to reconcile; no overwrite was acknowledged.');}
   return acknowledge(readback);
  }finally{busy=false;}
 }
 };
}
module.exports={createCloud};
