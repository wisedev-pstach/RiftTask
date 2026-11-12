'use strict';
const {validateWorkspace}=require('./core.cjs');
const {isDeepStrictEqual}=require('node:util');
const MAX_CLOUD_BYTES=512*1024;
// Pure preparation only. This module does not authorize or perform transfers.
function projectCloudWorkspace(input,scope){
 validateScope(scope);
 const workspace=validateWorkspace(input);
 if(!isDeepStrictEqual(input,workspace))throw new Error('Unsupported cloud workspace');
 for(const project of workspace.projects)project.localPath='';
 for(const task of workspace.tasks)delete task.localResources;
 for(const task of workspace.tasks)for(const entry of task.progress||[]){if(entry.images?.length)entry.imageCount=Math.max(entry.imageCount||0,entry.images.length);delete entry.images;}
 const envelope={formatVersion:1,accountId:scope.accountId,repositoryId:scope.repositoryId,workspace};
 if(Buffer.byteLength(JSON.stringify(envelope))>MAX_CLOUD_BYTES)throw new Error('Cloud snapshot exceeds 512 KiB');
 return envelope;
}
function validateScope(scope){
 if(!scope||!Number.isSafeInteger(scope.accountId)||scope.accountId<=0||!Number.isSafeInteger(scope.repositoryId)||scope.repositoryId<=0)throw new Error('Invalid cloud scope');
}
function prepareCloudRestore(json,local,scope){
 validateScope(scope);
 let envelope,workspace;
 try{
  if(typeof json!=='string'||Buffer.byteLength(json)>MAX_CLOUD_BYTES)throw new Error();
  envelope=JSON.parse(json);
  workspace=projectCloudWorkspace(envelope.workspace,scope).workspace;
  if(!isDeepStrictEqual(envelope,{formatVersion:1,accountId:scope.accountId,repositoryId:scope.repositoryId,workspace}))throw new Error();
 }catch{throw new Error('Invalid cloud snapshot');}
 const validatedLocal=validateWorkspace(local);
 const paths=new Map(validatedLocal.projects.map(p=>[p.id,p.localPath]));
 for(const project of workspace.projects)project.localPath=paths.get(project.id)||'';
 for(const task of workspace.tasks){const previous=validatedLocal.tasks.find(t=>t.id===task.id&&t.projectId===task.projectId);if(previous?.localResources!==undefined)task.localResources=previous.localResources;for(const entry of task.progress||[]){const images=previous?.progress?.find(e=>e.id===entry.id)?.images;if(images?.length){entry.images=images;entry.imageCount=Math.max(entry.imageCount||0,images.length);}}}
 return validateWorkspace(workspace);
}
module.exports={projectCloudWorkspace,prepareCloudRestore};
