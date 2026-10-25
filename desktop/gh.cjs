'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const path=require('node:path');
function createGhRunner({execute=promisify(execFile),platform=process.platform,env=process.env}={}) {
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
 return async(_file,args,options)=>{
  for(const file of candidates) {
   try{return (await execute(file,args,options)).stdout;}
   catch(error){if(error.code!=='ENOENT'||file===candidates.at(-1))throw error;}
  }
 };
}
module.exports={createGhRunner};
