'use strict';
const {createGhRunner}=require('./gh.cjs');const {spawn}=require('node:child_process');const crypto=require('node:crypto');
const LIMIT=512*1024,FILE='rifttask-workspace.json';
function boundedExecute(file,args,options){return new Promise((resolve,reject)=>{
 let child,total=0,out=[],settled=false;
 const fail=(code)=>{if(settled)return;settled=true;clearTimeout(timer);child?.kill('SIGKILL');reject(Object.assign(new Error('Cloud CLI request failed.'),code==='ENOENT'?{code}:{}));};
 const timer=setTimeout(()=>fail(),options.timeout);
 try{child=spawn(file,args,{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,GH_HOST:'github.com',GH_PROMPT_DISABLED:'1',GH_PAGER:'cat'}});}catch(e){fail(e.code);return;}
 child.on('error',e=>fail(e.code));
 for(const [stream,collect] of [[child.stdout,true],[child.stderr,false]])stream.on('data',chunk=>{total+=chunk.length;if(total>options.maxBuffer)return fail();if(collect)out.push(chunk);});
 child.on('close',code=>{if(settled)return;if(code!==0)return fail();settled=true;clearTimeout(timer);resolve({stdout:Buffer.concat(out).toString('utf8')});});
 child.stdin.on('error',()=>fail());child.stdin.end(options.input||'');
});}
function validRepository(r){if(!Number.isSafeInteger(r?.id)||r.id<=0||typeof r.default_branch!=='string'||!r.default_branch||r.default_branch.length>255||/[\0\r\n]/.test(r.default_branch))throw new Error('Invalid cloud repository binding.');}
function createCloudTransport({run=createGhRunner({execute:boundedExecute})}={}){
 async function api(method,endpoint,body){try{return JSON.parse(await run('gh',['api','--hostname','github.com','--method',method,endpoint,...(body?['--input','-']:[])],{shell:false,timeout:20000,maxBuffer:2*1024*1024,encoding:'utf8',input:body?JSON.stringify(body):undefined}));}catch{throw new Error('Cloud request failed or was unverified. Check connection, initialized repository and permissions, then retry. No CLI details are exposed.');}}
 return {
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
