'use strict';
const {createGhRunner}=require('./gh.cjs');const {spawn}=require('node:child_process');const crypto=require('node:crypto');
const LIMIT=512*1024,FILE='rifttask-workspace.json';
function boundedExecute(file,args,options){return new Promise((resolve,reject)=>{
 let child,total=0,out=[],err=[],settled=false;
 const fail=(code,httpStatus)=>{if(settled)return;settled=true;clearTimeout(timer);child?.kill('SIGKILL');reject(Object.assign(new Error('Cloud CLI request failed.'),code==='ENOENT'?{code}:httpStatus?{httpStatus}:{}));};
 const timer=setTimeout(()=>fail(),options.timeout);
 try{child=spawn(file,args,{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,GH_HOST:'github.com',GH_PROMPT_DISABLED:'1',GH_PAGER:'cat'}});}catch(e){fail(e.code);return;}
 child.on('error',e=>fail(e.code));
 for(const [stream,collect] of [[child.stdout,true],[child.stderr,false]])stream.on('data',chunk=>{total+=chunk.length;if(total>options.maxBuffer)return fail();if(collect)out.push(chunk);else err.push(chunk);});
 child.on('close',code=>{if(settled)return;if(code!==0){const match=Buffer.concat(err).toString('utf8').match(/^gh: [^\r\n]* \(HTTP (401|403|404|422)\)\r?$/m);return fail(undefined,match?Number(match[1]):undefined);}settled=true;clearTimeout(timer);resolve({stdout:Buffer.concat(out).toString('utf8')});});
 child.stdin.on('error',()=>fail());child.stdin.end(options.input||'');
});}
function validRepository(r){if(!Number.isSafeInteger(r?.id)||r.id<=0||typeof r.default_branch!=='string'||!r.default_branch||r.default_branch.length>255||/[\0\r\n]/.test(r.default_branch))throw new Error('Invalid cloud repository binding.');}
function createCloudTransport({run=createGhRunner({execute:boundedExecute})}={}){
 async function api(method,endpoint,body){try{return JSON.parse(await run('gh',['api','--hostname','github.com','--method',method,endpoint,...(body?['--input','-']:[])],{shell:false,timeout:20000,maxBuffer:2*1024*1024,encoding:'utf8',input:body?JSON.stringify(body):undefined}));}catch(error){const messages={401:'GitHub authentication expired. Please sign in again before trying again.',403:'GitHub denied permission. Check repository access and existing CLI permissions; RiftTask does not expand scopes.',404:'Repository not found or inaccessible. Check owner/name and account access, or explicitly create a new private repository.',422:'GitHub rejected repository validation. The name may already exist; use Verify for an existing repository. Nothing was adopted.'};const httpStatus=[401,403,404,422].includes(error.httpStatus)?error.httpStatus:undefined;throw Object.assign(new Error(messages[httpStatus]||'Cloud request failed or was unverified. Check connection and repository permissions. No CLI details are exposed.'),{httpStatus});}}
 return {
 createRepository:async fullName=>{
  if(typeof fullName!=='string'||! /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(fullName)||fullName.split('/').some(v=>v==='.'||v==='..'))throw new Error('Invalid repository: use owner/name.');
  const created=await api('POST','user/repos',{name:fullName.split('/')[1],private:true,auto_init:true,description:'Private manual cloud storage for RiftTask',has_issues:false,has_projects:false,has_wiki:false});
  try{
   const r=await api('GET','repos/'+fullName);
   if(!Number.isSafeInteger(created.id)||created.id!==r.id||r.full_name?.toLowerCase()!==fullName.toLowerCase())throw new Error('Repository creation readback did not match.');
   return {id:r.id,name:r.name,full_name:r.full_name,private:r.private,fork:r.fork,archived:r.archived,owner:{id:r.owner?.id,login:r.owner?.login,type:r.owner?.type},default_branch:r.default_branch};
  }catch{throw Object.assign(new Error('Repository creation readback failed. Check the exact repository on GitHub before retrying; cloud was not enabled.'),{createdKnown:Number.isSafeInteger(created?.id)&&created.id>0&&created.full_name?.toLowerCase()===fullName.toLowerCase()});}
 },
 repository:async name=>{if(typeof name!=='string'||! /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(name)||name.split('/').some(v=>v==='.'||v==='..'))throw new Error('Invalid repository: use owner/name.');const r=await api('GET','repos/'+name);return {id:r.id,name:r.name,full_name:r.full_name,private:r.private,fork:r.fork,archived:r.archived,owner:{id:r.owner?.id,login:r.owner?.login,type:r.owner?.type},default_branch:r.default_branch};},
 read:async repository=>{
  validRepository(repository);const base=`repositories/${repository.id}/contents`,ref='?ref='+encodeURIComponent(repository.default_branch);
  const entries=await api('GET',base+ref);if(!Array.isArray(entries)||entries.length>=1000)throw new Error('Cloud directory is ambiguous or too large.');
  if(entries.some(e=>e.type!=='file'||! /^(?:README(?:\.md|\.txt)?|LICENSE(?:\.md|\.txt)?|\.gitignore|\.gitattributes|rifttask-workspace\.json)$/i.test(e.name)))throw new Error('Cloud requires a dedicated data repository with only a README, license, Git settings and RiftTask snapshot.');
  const entry=entries.find(e=>e.name===FILE);if(!entry)return null;
  if(entry.type!=='file'||entry.path!==FILE)throw new Error('Invalid cloud snapshot file.');
  const data=await api('GET',base+'/'+FILE+ref);
  if(data.type!=='file'||data.path!==FILE||data.encoding!=='base64'||typeof data.content!=='string'||data.content.length>LIMIT*1.4||data.size>LIMIT||! /^[a-f0-9]{40}$/.test(data.sha)||data.sha!==entry.sha)throw new Error('Invalid or oversized cloud snapshot.');
  const buffer=Buffer.from(data.content,'base64');
  if(buffer.length>LIMIT||buffer.length!==data.size||crypto.createHash('sha1').update(Buffer.from(`blob ${buffer.length}\0`)).update(buffer).digest('hex')!==data.sha)throw new Error('Cloud snapshot verification failed.');
  return {text:buffer.toString('utf8'),sha:data.sha};
 },
 write:async(repository,text,sha)=>{validRepository(repository);if(typeof text!=='string'||Buffer.byteLength(text)>LIMIT||(sha!==undefined&&! /^[a-f0-9]{40}$/.test(sha)))throw new Error('Invalid cloud snapshot write.');await api('PUT',`repositories/${repository.id}/contents/${FILE}`,{message:'Update RiftTask workspace',branch:repository.default_branch,content:Buffer.from(text).toString('base64'),...(sha?{sha}:{})});}
 };
}
module.exports={createCloudTransport,boundedExecute};
