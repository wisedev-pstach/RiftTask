'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {createGhRunner}=require('./gh.cjs');
const defaultRun=createGhRunner();
function identity(raw){
 if(!raw||!Number.isSafeInteger(raw.id)||raw.id<=0||typeof raw.login!=='string'||!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(raw.login)||raw.name!==null&&raw.name!==undefined&&(typeof raw.name!=='string'||raw.name.length>200||raw.name.includes('\0')))throw new Error('Invalid GitHub identity');
 return {id:raw.id,login:raw.login,name:raw.name||raw.login};
}
function createAuth({run=defaultRun,cachePath}={}){
 let cached=null,disconnected=false,ghAvailable=true;
 if(cachePath){try{if(fs.statSync(cachePath).size<=65536){const data=JSON.parse(fs.readFileSync(cachePath,'utf8'));disconnected=data.disconnected===true;if(!disconnected)cached=identity(data.account);}}catch{}}
 function persist(account,disconnected){
  if(!cachePath)return;
  fs.mkdirSync(path.dirname(cachePath),{recursive:true,mode:0o700});const tmp=cachePath+'.tmp-'+crypto.randomUUID();try{fs.writeFileSync(tmp,JSON.stringify({account,disconnected}),{mode:0o600,flag:'wx'});fs.renameSync(tmp,cachePath);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
 }
 async function session(strict=false){
  if(disconnected&&!strict)return {account:null,offline:false,ghAvailable};
  let account;
  try{
   const stdout=await run('gh',['api','user','--hostname','github.com'],{shell:false,timeout:15000,maxBuffer:65536,windowsHide:true});
   account=identity(JSON.parse(stdout));
  }catch(error){
   const unavailable=['ENOENT','ENOTFOUND','EAI_AGAIN','ECONNRESET','ECONNREFUSED','ETIMEDOUT'].includes(error.code)||error.killed===true||/error connecting to api\.github\.com|network is unreachable|temporary failure in name resolution|dial tcp|TLS handshake timeout/i.test(error.stderr||'');
   ghAvailable=error.code!=='ENOENT';
   if(!unavailable){persist(null,false);cached=null;}
   if(strict)throw new Error('GitHub sign-in could not be verified. Install official gh and run gh auth login --hostname github.com, then retry.');
   return {account:unavailable?cached:null,offline:unavailable&&cached!==null,ghAvailable};
  }
  persist(account,false);cached=account;disconnected=false;ghAvailable=true;
  return {account,offline:false,ghAvailable:true};
 }
 async function logout(){persist(null,true);cached=null;disconnected=true;return {account:null,offline:false,ghAvailable};}
 let queue=Promise.resolve();
 const serialize=fn=>{const pending=queue.then(fn);queue=pending.catch(()=>{});return pending;};
 return {session:()=>serialize(()=>session(false)),login:()=>serialize(()=>session(true)),logout:()=>serialize(logout)};
}
module.exports={createAuth};
