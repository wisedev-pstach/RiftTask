'use strict';
const {spawn:spawnProcess}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs/promises');

async function openTerminalDirectory(directory,{platform=process.platform,spawn=spawnProcess,env=process.env}={}) {
  if(typeof directory!=='string' || !path.isAbsolute(directory) || /[\0\r\n]/.test(directory)) {
    throw new Error('Choose an absolute local project directory first.');
  }
  try {if(!(await fs.stat(directory)).isDirectory()) throw new Error('Not a directory');}
  catch {throw new Error('The saved project directory is unavailable. Choose it again.');}
  let executable,args;
  if(platform==='darwin') {executable='/usr/bin/open';args=['-a','Terminal','--',directory];}
  else if(platform==='win32') {
    executable=path.win32.join(env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    args=['-NoLogo','-NoProfile','-NoExit'];
  } else {executable='/usr/bin/x-terminal-emulator';args=[];}
  await new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{cwd:directory,env,shell:false,windowsHide:false,stdio:'ignore',detached:platform!=='darwin',timeout:platform==='darwin'?10000:undefined});
    let timer;
    function finish(error) {
      clearTimeout(timer);
      if(error) reject(error);
      else {if(platform!=='darwin') child.unref();resolve();}
    }
    child.once('error',finish);
    child.once('close',code=>finish(code===0?null:new Error('Terminal launch failed.')));
    // GUI clients may exit successfully after delegating to an existing window.
    // Otherwise observe early failure, then detach without waiting for the shell
    // to close. This acknowledges startup, not proof a visible window appeared.
    if(platform!=='darwin') child.once('spawn',()=>{timer=setTimeout(()=>finish(),300);});
  }).catch(()=>{throw new Error('Could not open the native terminal. Check that Terminal (macOS), Windows PowerShell, or /usr/bin/x-terminal-emulator (Linux) is available.');});
}
module.exports={openTerminalDirectory};
