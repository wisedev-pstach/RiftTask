'use strict';
const {execFile}=require('node:child_process');const {promisify}=require('node:util');const path=require('node:path');
const INSTRUCTION='Run gh auth login --hostname github.com --git-protocol https --web in your terminal, finish sign-in, then click Check sign-in.';
// No renderer arguments, URLs, executable names or shell text enter this API.
async function launchLogin({platform=process.platform,env=process.env,discover=()=>require('./gh.cjs').discoverGh({platform,env}),execute=promisify(execFile),isCurrent=()=>true}={}){
 if(!['darwin','win32'].includes(platform))throw new Error(INSTRUCTION);
 try{
  const file=await discover();const paths=platform==='win32'?path.win32:path.posix;
  if(!isCurrent())throw new Error('Account disconnected');
  if(typeof file!=='string'||!paths.isAbsolute(file)||/[\0\r\n]/.test(file))throw new Error('Invalid executable');
  const args=['auth','login','--hostname','github.com','--git-protocol','https','--web'];
  if(platform==='darwin'){
   const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
   const command=[file,...args].map(quote).join(' ');
   await execute('/usr/bin/osascript',['-e','on run argv\ntell application "Terminal"\nactivate\ndo script (item 1 of argv)\nend tell\nend run','--',command],{shell:false,timeout:15000,maxBuffer:65536,windowsHide:true});
  }else{
   const root=env.SystemRoot||'C:\\Windows';if(!path.win32.isAbsolute(root)||/[\0\r\n]/.test(root))throw new Error('Invalid system directory');
   const quote=s=>"'"+s.replaceAll("'","''")+"'";
   const command='& '+[file,...args].map(quote).join(' ');
   const encoded=Buffer.from(command,'utf16le').toString('base64');
   const powershell=path.win32.join(root,'System32','WindowsPowerShell','v1.0','powershell.exe');
   // Start-Process gives the visible child its own console and default stdin /
   // stdout. Direct spawn with stdio:ignore would hide gh's device code/prompts.
   const start="$ErrorActionPreference = 'Stop'; Start-Process -FilePath "+quote(powershell)+" -ArgumentList @('-NoLogo', '-NoProfile', '-NoExit', '-EncodedCommand', "+quote(encoded)+')';
   await execute(powershell,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(start,'utf16le').toString('base64')],{shell:false,timeout:15000,maxBuffer:65536,windowsHide:true});
  }
 }catch{throw new Error('Could not open the native sign-in terminal. '+INSTRUCTION);}
}
module.exports={launchLogin};
