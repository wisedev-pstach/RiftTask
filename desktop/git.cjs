'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const execute = promisify(execFile);

async function readGitStatus(directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory) || /[\0\r\n]/.test(directory)) {
    throw new Error('Choose an absolute local project directory first.');
  }
  try {
    if (!(await fs.stat(directory)).isDirectory()) throw new Error('Not a directory');
  } catch {throw new Error('The saved project directory is unavailable. Choose it again.');}
  // GUI processes may inherit Git overrides from their launcher. Never let
  // those redirect this explicit, local, read-only request to another repo.
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('GIT_')));
  env.GIT_OPTIONAL_LOCKS='0';
  const options={cwd:directory,env,encoding:'utf8',shell:false,windowsHide:true,timeout:10000,maxBuffer:4*1024*1024};
  const args=['--no-optional-locks','-c','core.fsmonitor=false','-c','core.untrackedCache=false'];
  let stdout;
  try {
    let keys='';
    try {
      ({stdout:keys}=await execute('git',['config','--null','--name-only','--get-regexp','^filter\\..*\\.(clean|process|required)$'],options));
    } catch(error) {if(error.code!==1) throw error;}
    // Status may hash files through their clean/process filters. Override every
    // configured driver, including global/included config, before inspecting.
    const drivers=new Set(keys.split('\0').filter(Boolean).map(key=>key.replace(/\.(clean|process|required)$/,'')));
    for(const driver of drivers) args.push('-c',driver+'.clean=','-c',driver+'.process=','-c',driver+'.required=false');
    ({stdout}=await execute('git',[...args,'status','--porcelain=v2','--branch','-z','--untracked-files=normal','--ignore-submodules=all'],options));
  } catch {throw new Error('Could not read local Git status. Check that Git is installed and the saved directory is a repository.');}
  let branch='',changed=0,skipOriginal=false;
  for (const record of stdout.split('\0')) {
    if (skipOriginal) {skipOriginal=false;continue;}
    if (record.startsWith('# branch.head ')) branch=record.slice(14);
    else if (/^(1 |2 |u |\? )/.test(record)) {
      changed++;
      if(record.startsWith('2 ')) skipOriginal=true;
    }
  }
  return {branch,changed};
}
module.exports={readGitStatus};
