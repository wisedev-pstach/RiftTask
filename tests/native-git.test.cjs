'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {createService} = require('../desktop/service.cjs');
const {registerIpc} = require('../desktop/ipc.cjs');

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rifttask-git-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const directory=path.join(root,'project ; $literal & space');
  fs.mkdirSync(directory);
  const git=(...args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8'}).trim();
  git('init','--initial-branch=trunk');
  git('config','user.name','RiftTask Test');git('config','user.email','test@invalid.example');
  fs.writeFileSync(path.join(directory,'tracked.txt'),'initial');
  git('add','.');git('-c','commit.gpgsign=false','commit','-m','fixture');
  const workspace={projects:[{id:'project-1',localPath:directory}]};
  const service=createService({auth:{session:async()=>({account:{id:17}})},store:{load:async()=>workspace}});
  const frame={url:'file:///rift/index.html'};const webContents={mainFrame:frame};const handlers=new Map();
  registerIpc({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},webContents,indexURL:frame.url,service,shell:{}});
  const status=(id='project-1')=>handlers.get('rift:gitStatus')({sender:webContents,senderFrame:frame},id);
  return {root,directory,git,status,workspace,service};
}

test('explicit gitStatus reads the persisted project directory through trusted IPC without fetching',async t=>{
  const f=fixture(t);
  assert.deepEqual(await f.status(),{branch:'trunk',changed:0});
  fs.writeFileSync(path.join(f.directory,'tracked.txt'),'modified');
  fs.writeFileSync(path.join(f.directory,'untracked.txt'),'new');
  assert.deepEqual(await f.status(),{branch:'trunk',changed:2});
  assert.equal(f.git('remote'), '');
});

test('gitStatus counts staged renames once and handles detached and unborn branches',async t=>{
  const f=fixture(t);
  f.git('mv','tracked.txt',process.platform==='win32'?'renamed file.txt':'renamed\nfile.txt');
  assert.deepEqual(await f.status(),{branch:'trunk',changed:1});
  f.git('reset','--hard','HEAD');f.git('checkout','--quiet','--detach');
  assert.deepEqual(await f.status(),{branch:'(detached)',changed:0});
  const unborn=path.join(f.root,'unborn');fs.mkdirSync(unborn);
  execFileSync('git',['init','--initial-branch=first'],{cwd:unborn});
  f.workspace.projects[0].localPath=unborn;
  assert.deepEqual(await f.status(),{branch:'first',changed:0});
});

test('gitStatus rejects renderer paths, missing projects and invalid saved paths',async t=>{
  const f=fixture(t);
  for(const id of [f.directory,'../project-1','--help',{},null,'missing']) {
    await assert.rejects(f.status(id),/project/i);
  }
  for(const directory of ['', '.', 'relative/project', '/bad\0path', '/bad\npath']) {
    f.workspace.projects[0].localPath=directory;
    await assert.rejects(f.status(),/absolute local project directory/);
  }
  for(const directory of [path.join(f.root,'missing'),path.join(f.directory,'tracked.txt')]) {
    f.workspace.projects[0].localPath=directory;
    await assert.rejects(f.status(),/directory is unavailable/);
  }
  f.workspace.projects[0].localPath=f.root;
  await assert.rejects(f.status(),/Could not read local Git status/);
});

test('gitStatus blocks disconnected or switched accounts before accessing the workspace',async()=>{
  let account={id:17};let loads=0;
  const service=createService({auth:{session:async()=>({account})},store:{load:async()=>{loads++;return {projects:[]};}}});
  await service.session();account={id:28};
  await assert.rejects(service.gitStatus('project-1'),/account changed/);
  account=null;await assert.rejects(service.gitStatus('project-1'),/sign in/i);
  assert.equal(loads,0);
});

test('gitStatus never executes a repository-configured clean filter',async t=>{
  const f=fixture(t);const marker=path.join(f.root,'filter-executed');
  const script=path.join(f.root,'filter.cjs');
  fs.writeFileSync(script,`require('node:fs').writeFileSync(${JSON.stringify(marker)},'ran');process.stdin.pipe(process.stdout);`);
  fs.writeFileSync(path.join(f.directory,'.gitattributes'),'tracked.txt filter=unsafe\n');
  f.git('config','filter.unsafe.clean',`"${process.execPath}" "${script}"`);
  fs.writeFileSync(path.join(f.directory,'tracked.txt'),'changed');
  await f.status();
  assert.equal(fs.existsSync(marker),false,'Git status must not execute configured filter commands');
});

test('gitStatus ignores inherited Git redirection and disables repository fsmonitor commands',async t=>{
  const f=fixture(t);
  // A configured fsmonitor would execute arbitrary repository-configured code.
  const marker=path.join(f.root,'executed');
  f.git('config','core.fsmonitor',`touch '${marker}'`);
  const previous=process.env.GIT_DIR;
  process.env.GIT_DIR=path.join(f.root,'not-a-repository');
  try {assert.deepEqual(await f.status(),{branch:'trunk',changed:0});}
  finally {if(previous===undefined) delete process.env.GIT_DIR;else process.env.GIT_DIR=previous;}
  assert.equal(fs.existsSync(marker),false);
});
