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
function keys(x,allowed){object(x,'progress');if(Object.keys(x).some(k=>!allowed.includes(k)))invalid('progress fields');}
function list(x,max,convert){if(!Array.isArray(x)||x.length>max)invalid('progress limit');const result=x.map(convert),seen=new Set();for(const item of result){if(item.id){if(seen.has(item.id))invalid('duplicate progress id');seen.add(item.id);}}return result;}
function progressLink(x){text(x,'progress link',2048,true);let u;try{u=new URL(x);}catch{invalid('progress link');}if(!/^https?:\/\//.test(x)||!['http:','https:'].includes(u.protocol)||u.username||u.password||/[\s\u0000-\u001f\u007f\\]/.test(x))invalid('progress link');return x;}
function progressImage(x){
 keys(x,['id','name','mime','dataUrl']);const mime=choice(x.mime,['image/png','image/jpeg','image/webp']);
 const data=text(x.dataUrl,'image size',350000);const prefix=`data:${mime};base64,`,encoded=data.slice(prefix.length);
 if(!data.startsWith(prefix)||!encoded||encoded.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))invalid('image encoding');
 const bytes=Buffer.from(encoded,'base64');if(bytes.length>256*1024||bytes.toString('base64')!==encoded)invalid('image size');
 const valid=mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&bytes.length>=33:mime==='image/jpeg'?bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.length>=20&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!valid)invalid('image raster');return {id:id(x.id),name:text(x.name,'image name',200,true),mime,dataUrl:data};
}
function progressEntry(x){
 keys(x,['id','createdAt','body','links','images','imageCount']);
 const result={id:id(x.id),createdAt:iso(x.createdAt),body:text(x.body,'progress body',4000),links:list(x.links,10,progressLink)};
 if(x.images!==undefined)result.images=list(x.images,3,progressImage);
 if(x.imageCount!==undefined){if(!Number.isInteger(x.imageCount)||x.imageCount<0||x.imageCount>3||x.imageCount<(result.images||[]).length)invalid('image count');result.imageCount=x.imageCount;}
 if(!result.body.trim()&&!result.links.length&&!(result.images||[]).length&&!result.imageCount)invalid('empty progress');return result;
}
function emptyWorkspace(){return {version:1,categories:[],projects:[],tasks:[],updatedAt:new Date().toISOString()};}
function validateWorkspace(input){
 object(input,'root');if(input.version!==1)invalid('version');
 const read=(name,max,convert)=>{const a=input[name];if(!Array.isArray(a)||a.length>max)invalid(name);const seen=new Set();return a.map(x=>{object(x,name);const result=convert(x);if(seen.has(result.id))invalid('duplicate id');seen.add(result.id);return result;});};
 const categories=read('categories',1000,x=>({id:id(x.id),name:text(x.name,'name',200,true),color:(typeof x.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(x.color))?x.color:invalid('color')}));
 const categoryIds=new Set(categories.map(x=>x.id));
 const projects=read('projects',5000,x=>{if(!categoryIds.has(x.categoryId))invalid('category reference');return {...(x.icon===undefined?{}:{icon:choice(x.icon,Object.keys(require('./project-icons.json')))}),id:id(x.id),categoryId:id(x.categoryId),name:text(x.name,'name',200,true),description:text(x.description,'description',20000),repositoryUrl:repo(x.repositoryUrl),localPath:text(x.localPath,'localPath',4096),archived:bool(x.archived)};});
 const projectIds=new Set(projects.map(x=>x.id));
 const milestones=input.milestones===undefined?undefined:read('milestones',10000,x=>{if(!projectIds.has(x.projectId))invalid('milestone project reference');return {id:id(x.id),projectId:id(x.projectId),name:text(x.name,'milestone name',200,true),color:(typeof x.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(x.color))?x.color:invalid('milestone color')};});
 const milestoneProjects=new Map((milestones||[]).map(m=>[m.id,m.projectId]));
 const tasks=read('tasks',10000,x=>{if(!projectIds.has(x.projectId))invalid('project reference');const assignment={};if(x.milestoneId!==undefined){if(x.milestoneId!==''&&milestoneProjects.get(id(x.milestoneId))!==x.projectId)invalid('milestone reference');assignment.milestoneId=x.milestoneId;}return {...assignment,...(x.progress===undefined?{}:{progress:list(x.progress,100,progressEntry)}),id:id(x.id),projectId:id(x.projectId),title:text(x.title,'title',300,true),notes:text(x.notes,'notes',20000),status:choice(x.status==='next'?'backlog':x.status,['backlog','doing','done']),priority:choice(x.priority,['low','normal','high']),dueDate:x.dueDate===''?'':date(x.dueDate),today:bool(x.today),createdAt:iso(x.createdAt),completedAt:x.completedAt===null?null:iso(x.completedAt)};});
 const result={version:1,categories,projects,...(milestones===undefined?{}:{milestones}),tasks,updatedAt:iso(input.updatedAt)};
 if(Buffer.byteLength(JSON.stringify(result))>MAX_BYTES)invalid('size');return result;
}
function createSampleWorkspace(){
 const w=emptyWorkspace();
 w.categories=[{id:'sample-games',name:'Games',color:'#8b5cf6'}];
 w.projects=[{id:'sample-lose-dot',categoryId:'sample-games',name:'lose.DOT (sample)',description:'Optional sample project. Not imported from any provider.',repositoryUrl:'',localPath:'',archived:false}];
 w.tasks=[{id:'sample-first-task',projectId:'sample-lose-dot',title:'Try editing this sample task',notes:'Sample only — replace this workspace with your own projects.',status:'backlog',priority:'normal',dueDate:'',today:false,createdAt:w.updatedAt,completedAt:null}];
 return w;
}
module.exports={emptyWorkspace,validateWorkspace,createSampleWorkspace,MAX_BYTES};
