'use strict';
const MAX_BYTES=8*1024*1024;
function invalid(field){throw new Error(`Invalid workspace: ${field}`);}
function object(x,field){if(!x||typeof x!=='object'||Array.isArray(x))invalid(field);return x;}
function text(x,field,max,required=false){if(typeof x!=='string'||x.length>max||x.includes('\0')||(required&&!x.trim()))invalid(field);return required?x.trim():x;}
function id(x){if(typeof x!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(x))invalid('id');return x;}
function bool(x){if(typeof x!=='boolean')invalid('boolean');return x;}
function date(x){if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x)||!Number.isFinite(Date.parse(x+'T00:00:00.000Z'))||new Date(x+'T00:00:00.000Z').toISOString().slice(0,10)!==x)invalid('date');return x;}
function iso(x){if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x))invalid('timestamp');date(x.slice(0,10));if(!Number.isFinite(Date.parse(x))||Number(x.slice(11,13))>23||Number(x.slice(14,16))>59||Number(x.slice(17,19))>59)invalid('timestamp');return x;}
function choice(x,values){if(!values.includes(x))invalid('enum');return x;}
function repo(x){text(x,'repositoryUrl',2048);if(x){let u;try{u=new URL(x);}catch{invalid('repositoryUrl');}if(u.protocol!=='https:'||u.username||u.password||!['github.com','dev.azure.com'].includes(u.hostname)&&!u.hostname.endsWith('.visualstudio.com'))invalid('repositoryUrl');}return x;}
function emptyWorkspace(){return {version:1,categories:[],projects:[],tasks:[],updatedAt:new Date().toISOString()};}
function validateWorkspace(input){
 object(input,'root');if(input.version!==1)invalid('version');
 const read=(name,max,convert)=>{const a=input[name];if(!Array.isArray(a)||a.length>max)invalid(name);const seen=new Set();return a.map(x=>{object(x,name);const result=convert(x);if(seen.has(result.id))invalid('duplicate id');seen.add(result.id);return result;});};
 const categories=read('categories',1000,x=>({id:id(x.id),name:text(x.name,'name',200,true),color:(typeof x.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(x.color))?x.color:invalid('color')}));
 const categoryIds=new Set(categories.map(x=>x.id));
 const projects=read('projects',5000,x=>{if(!categoryIds.has(x.categoryId))invalid('category reference');return {id:id(x.id),categoryId:id(x.categoryId),name:text(x.name,'name',200,true),description:text(x.description,'description',20000),repositoryUrl:repo(x.repositoryUrl),localPath:text(x.localPath,'localPath',4096),archived:bool(x.archived)};});
 const projectIds=new Set(projects.map(x=>x.id));
 const tasks=read('tasks',10000,x=>{if(!projectIds.has(x.projectId))invalid('project reference');return {id:id(x.id),projectId:id(x.projectId),title:text(x.title,'title',300,true),notes:text(x.notes,'notes',20000),status:choice(x.status,['backlog','next','doing','done']),priority:choice(x.priority,['low','normal','high']),dueDate:x.dueDate===''?'':date(x.dueDate),today:bool(x.today),createdAt:iso(x.createdAt),completedAt:x.completedAt===null?null:iso(x.completedAt)};});
 const result={version:1,categories,projects,tasks,updatedAt:iso(input.updatedAt)};
 if(Buffer.byteLength(JSON.stringify(result))>MAX_BYTES)invalid('size');return result;
}
function createSampleWorkspace(){
 const w=emptyWorkspace();
 w.categories=[{id:'sample-games',name:'Games',color:'#8b5cf6'}];
 w.projects=[{id:'sample-lose-dot',categoryId:'sample-games',name:'lose.DOT (sample)',description:'Optional sample project. Not imported from any provider.',repositoryUrl:'',localPath:'',archived:false}];
 w.tasks=[{id:'sample-first-task',projectId:'sample-lose-dot',title:'Try editing this sample task',notes:'Sample only — replace this workspace with your own projects.',status:'next',priority:'normal',dueDate:'',today:false,createdAt:w.updatedAt,completedAt:null}];
 return w;
}
module.exports={emptyWorkspace,validateWorkspace,createSampleWorkspace,MAX_BYTES};
