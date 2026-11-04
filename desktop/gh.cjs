'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const path=require('node:path');
function candidatesFor(platform,env){
 const paths=platform==='win32'?path.win32:path.posix;
 const candidates=['gh'];
 const add=(root,...parts)=>{if(typeof root==='string'&&paths.isAbsolute(root)&&!/[\0\r\n]/.test(root))candidates.push(paths.join(root,...parts));};
 if(platform==='win32') {
  add(env.ProgramFiles||'C:\\Program Files','GitHub CLI','gh.exe');
  add(env.LOCALAPPDATA,'Programs','GitHub CLI','gh.exe');
  add(env.LOCALAPPDATA,'Microsoft','WinGet','Links','gh.exe');
 } else if(platform==='darwin') {
  candidates.push('/opt/homebrew/bin/gh','/usr/local/bin/gh');
 } else {
  candidates.push('/usr/local/bin/gh','/usr/bin/gh');
  add(env.HOME,'bin','gh');
 }
 return candidates;
}
function createGhRunner({execute=promisify(execFile),platform=process.platform,env=process.env}={}) {
 const candidates=candidatesFor(platform,env);
 return async(_file,args,options)=>{
  for(const file of candidates) {
   try{return (await execute(file,args,options)).stdout;}
   catch(error){if(error.code!=='ENOENT'||file===candidates.at(-1))throw error;}
  }
 };
}
async function discoverGh({execute=promisify(execFile),platform=process.platform,env=process.env}={}){
 const paths=platform==='win32'?path.win32:path.posix;
 const search=(env.PATH||env.Path||'').split(platform==='win32'?';':':').filter(p=>paths.isAbsolute(p)&&!/[\0\r\n]/.test(p)).map(p=>paths.join(p,platform==='win32'?'gh.exe':'gh'));
 for(const file of [...search,...candidatesFor(platform,env).slice(1)]){
  try{
   const {stdout}=await execute(file,['--version'],{shell:false,timeout:15000,maxBuffer:65536,windowsHide:true});
   if(!/^gh version \d+\./.test(stdout))throw new Error('Invalid GitHub CLI');
   return file;
  }catch(error){if(error.code!=='ENOENT')throw new Error('Could not verify official GitHub CLI.');}
 }
 throw new Error('Install official GitHub CLI from https://cli.github.com/.');
}
module.exports={createGhRunner,discoverGh};
