'use strict';
const path=require('node:path');const fs=require('node:fs/promises');
const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(x);
function nativePath(p){if(typeof p!=='string'||p.length>4096||/[\u0000-\u001f\u007f-\u009f]/.test(p)||!path.isAbsolute(p)||/^(?:\\\\|\/\/)/.test(p)||(process.platform!=='win32'&&!/^\//.test(p)))throw new Error('This reference is not an absolute path on this device.');if(process.platform==='win32'&&(!/^[A-Za-z]:[\\/]/.test(p)||p.slice(2).includes(':')))throw new Error('Unsupported native path.');return p;}
// Refuse launchable extensions, bundles and unknown file types, not just URLs.
const documentExtensions=new Set(['.txt','.md','.markdown','.pdf','.png','.jpg','.jpeg','.webp','.gif','.bmp','.svg','.csv','.json','.yaml','.yml','.toml','.xml','.log','.docx','.xlsx','.pptx','.odt','.ods','.odp','.rtf','.mp3','.wav','.mp4','.mov','.webm']);
function bundle(p){return p.split(/[\\/]/).some(s=>/\.(?:app|bundle|framework|plugin|kext|prefpane|workflow|action)$/i.test(s));}
async function inspectResource(resource,io=fs){
 const source=nativePath(resource.path);let resolved,stat;
 try{resolved=nativePath(await io.realpath(source));stat=await io.stat(resolved);}catch(error){if(error.message.includes('native path')||error.message.includes('absolute path'))throw error;throw new Error('File or folder is missing or unavailable on this device.');}
 if(bundle(source)||bundle(resolved))throw new Error('Open refused: application bundles and launchable items are not supported.');
 if(resource.kind==='directory'){if(!stat.isDirectory())throw new Error('Saved reference is not a folder on this device.');return resolved;}
 if(!stat.isFile())throw new Error('Saved reference is not a regular file on this device.');
 if(!documentExtensions.has(path.extname(source).toLowerCase())||!documentExtensions.has(path.extname(resolved).toLowerCase())||(process.platform!=='win32'&&(stat.mode&0o111)))throw new Error('Open refused: executable, script, shortcut or unsupported file type.');
 let handle;try{handle=await io.open(resolved,require('node:fs').constants.O_RDONLY|(require('node:fs').constants.O_NOFOLLOW||0)|(require('node:fs').constants.O_NONBLOCK||0));const actual=await handle.stat();if(!actual.isFile()||actual.dev!==stat.dev||actual.ino!==stat.ino||(process.platform!=='win32'&&(actual.mode&0o111)))throw new Error('File changed. Retry.');const bytes=Buffer.alloc(8);await handle.read(bytes,0,8,0);const hex=bytes.toString('hex');if(bytes.toString('ascii',0,2)==='#!'||bytes.toString('ascii',0,2)==='MZ'||hex.startsWith('7f454c46')||/^(?:feedface|feedfacf|cefaedfe|cffaedfe|cafebabe)/.test(hex))throw new Error('Open refused: executable content.');}finally{await handle?.close();}
 return resolved;
}
module.exports={safeId,inspectResource};
