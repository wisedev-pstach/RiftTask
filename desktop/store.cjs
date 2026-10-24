'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {emptyWorkspace,validateWorkspace,MAX_BYTES}=require('./core.cjs');
function accountId(id){if(!Number.isSafeInteger(id)||id<=0)throw new Error('Invalid account ID: verified positive numeric GitHub ID required');return String(id);}
function atomicWrite(file,text){
 const tmp=file+'.tmp-'+crypto.randomUUID();let fd;
 try{fd=fs.openSync(tmp,'wx',0o600);fs.writeFileSync(fd,text,'utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(tmp,file);}finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
}
function createStore(rootDir){
 const root=path.resolve(rootDir);
 function location(id){
  const directory=path.join(root,'accounts',accountId(id)),file=path.join(directory,'workspace.json');
  for(const target of [root,path.join(root,'accounts'),directory,file,file+'.bak']){
   try{if(fs.lstatSync(target).isSymbolicLink())throw new Error('Unsafe symlink in account persistence path');}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  return file;
 }
 function read(file){if(fs.statSync(file).size>MAX_BYTES)throw new Error('Workspace exceeds size limit');return validateWorkspace(JSON.parse(fs.readFileSync(file,'utf8')));}
 function load(id){
  const file=location(id);if(!fs.existsSync(file)&&!fs.existsSync(file+'.bak'))return emptyWorkspace();
  try{return read(file);}catch(cause){
   // Permissions and other I/O errors are not corruption and must not replace data.
   if(cause.code&&cause.code!=='ENOENT')throw cause;
   let backup;try{backup=read(file+'.bak');}catch{throw Object.assign(new Error('Workspace is corrupt. Original files retained; restore a validated backup.',{cause}),{code:'WORKSPACE_CORRUPT'});}
   const corruptPath=file+'.corrupt-'+crypto.randomUUID();
   if(fs.existsSync(file))fs.copyFileSync(file,corruptPath,fs.constants.COPYFILE_EXCL);
   atomicWrite(file,JSON.stringify(backup));
   throw Object.assign(new Error('Workspace recovered from previous backup. Corrupt original retained. Retry load to acknowledge recovery.'),{code:'WORKSPACE_RECOVERED',recovered:true,corruptPath});
  }
 }
 function save(id,input){
  const file=location(id);const clean=validateWorkspace(input);
  if(fs.existsSync(file)||fs.existsSync(file+'.bak')){const previous=load(id);atomicWrite(file+'.bak',JSON.stringify(previous));}
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});atomicWrite(file,JSON.stringify(clean));return clean;
 }
 return {load,save};
}
module.exports={createStore,accountId};
