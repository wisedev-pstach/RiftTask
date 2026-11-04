'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function nativeFixture(t, platform = 'win32', arch = 'x64') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rift-native-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const pty = path.join(root, 'node_modules/node-pty');
  const dir = path.join(pty, 'prebuilds', `${platform}-${arch}`);
  fs.mkdirSync(dir, {recursive:true});
  fs.writeFileSync(path.join(pty, 'package.json'), JSON.stringify({version:'1.1.0'}));
  for (const file of platform === 'win32' ? ['conpty.node','conpty_console_list.node','conpty/conpty.dll','conpty/OpenConsole.exe'] : ['pty.node','spawn-helper']) { fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true}); fs.writeFileSync(path.join(dir,file),'fixture'); }
  return {root, platform, arch, electron:path.join(root,'electron'), pty, dir};
}

test('missing, empty, wrong-arch, unsupported or unpinned prebuilds fail before subprocess execution', async t => {
  for (const fault of ['missing','empty','wrong-arch','unsupported','version','stale-build','stale-debug']) {
    const f = nativeFixture(t);
    if (fault === 'missing') fs.unlinkSync(path.join(f.dir,'conpty_console_list.node'));
    if (fault === 'empty') fs.writeFileSync(path.join(f.dir,'conpty/conpty.dll'),'');
    if (fault === 'wrong-arch') f.arch = 'arm64';
    if (fault === 'unsupported') f.arch = 'ia32';
    if (fault === 'version') fs.writeFileSync(path.join(f.pty,'package.json'), '{"version":"1.0.0"}');
    if (fault === 'stale-build') {fs.mkdirSync(path.join(f.pty,'build/Release'),{recursive:true});fs.writeFileSync(path.join(f.pty,'build/Release/conpty.node'),'stale');}
    if (fault === 'stale-debug') {fs.mkdirSync(path.join(f.pty,'build/Debug'),{recursive:true});fs.writeFileSync(path.join(f.pty,'build/Debug/conpty.node'),'stale');}
    let calls = 0;
    await assert.rejects(require('../scripts/prepare-native.cjs').prepareNative({...f, run(){ calls++; }}), /prebuild|node-pty|architecture/i, fault);
    assert.equal(calls,0,fault);
  }
});

test('runtime incompatibility stops preparation without a compiling fallback', async t => {
  const f = nativeFixture(t); let calls = 0;
  await assert.rejects(require('../scripts/prepare-native.cjs').prepareNative({...f, run(){calls++;throw new Error('incompatible runtime');}}), /incompatible runtime/);
  assert.equal(calls,1);
});

test('Linux retains Electron native rebuild before runtime smoke', async t => {
  const f = nativeFixture(t); const calls = [];
  await require('../scripts/prepare-native.cjs').prepareNative({...f, platform:'linux', run(command,args,options){calls.push({command,args,options});}});
  assert.equal(calls.length,2);
  assert.equal(calls[0].command,process.execPath);
  assert.ok(calls[0].args.includes('install-app-deps'));
  assert.equal(calls[1].command,f.electron);
});

test('missing Electron runtime is installed explicitly with pinned installer, no inherited architecture overrides', async t => {
  const f = nativeFixture(t); delete f.electron;
  const e = path.join(f.root,'node_modules/electron'); fs.mkdirSync(e);
  fs.writeFileSync(path.join(e,'package.json'), '{"version":"45.0.0"}');
  const calls=[];
  await require('../scripts/prepare-native.cjs').prepareNative({...f, run(command,args,options){
    calls.push({command,args,options});
    if(args[0]===path.join(e,'install.js')) {
      fs.mkdirSync(path.join(e,'dist')); fs.writeFileSync(path.join(e,'dist/electron.exe'),'fixture'); fs.writeFileSync(path.join(e,'dist/version'),'45.0.0'); fs.writeFileSync(path.join(e,'path.txt'),'electron.exe');
    }
  }});
  assert.equal(calls.length,2);
  assert.equal(calls[0].command,process.execPath);
  assert.equal(calls[0].options.env.npm_config_arch,'x64');
  assert.equal(calls[0].options.env.ELECTRON_SKIP_BINARY_DOWNLOAD,undefined);
  assert.equal(calls[1].command,path.join(e,'dist/electron.exe'));
});

test('Electron downloader ignores inherited install-platform overrides without changing shared environment', async t => {
 const f=nativeFixture(t);delete f.electron;
 const e=path.join(f.root,'node_modules/electron');fs.mkdirSync(e);fs.writeFileSync(path.join(e,'package.json'),'{"version":"45.0.0"}');
 const old=process.env.ELECTRON_INSTALL_ARCH;process.env.ELECTRON_INSTALL_ARCH='ia32';t.after(()=>{if(old===undefined)delete process.env.ELECTRON_INSTALL_ARCH;else process.env.ELECTRON_INSTALL_ARCH=old;});
 await require('../scripts/prepare-native.cjs').prepareNative({...f,run(command,args,options){
  if(command===process.execPath){
   assert.equal(options.env.ELECTRON_INSTALL_ARCH,'x64');assert.equal(options.env.ELECTRON_INSTALL_PLATFORM,'win32');
   fs.mkdirSync(path.join(e,'dist'));fs.writeFileSync(path.join(e,'dist/electron.exe'),'fixture');fs.writeFileSync(path.join(e,'dist/version'),'45.0.0');fs.writeFileSync(path.join(e,'path.txt'),'electron.exe');
  }
 }});
 assert.equal(process.env.ELECTRON_INSTALL_ARCH,'ia32');
});

test('real host PTY smoke verifies TTY, input, retained shell state, resize and child cleanup', {skip:process.platform !== 'linux' ? 'Linux host test' : false}, async () => {
  const result = await require('../scripts/pty-native-smoke.cjs').smoke({root:path.resolve(__dirname,'..'), platform:process.platform, arch:process.arch});
  assert.deepEqual(result, {tty:true, input:true, state:true, resize:true, cleanup:true});
});

test('failed smoke waits for real shell cleanup before rejecting', {skip:process.platform !== 'linux'}, async t => {
 const f=nativeFixture(t); const actual=path.resolve(__dirname,'../node_modules/node-pty');
 const exited=path.join(f.root,'exited');const pidFile=path.join(f.root,'pid');
 fs.writeFileSync(path.join(f.pty,'index.js'), `const pty=require(${JSON.stringify(actual)}); const fs=require('node:fs'); exports.spawn=(...args)=>{const child=pty.spawn(...args);fs.writeFileSync(${JSON.stringify(pidFile)},String(child.pid));const onExit=child.onExit.bind(child);return {pid:child.pid,onData:child.onData.bind(child),kill:child.kill.bind(child),onExit:cb=>onExit(event=>setTimeout(()=>{fs.writeFileSync(${JSON.stringify(exited)},'yes');cb(event);},100)),write(){throw new Error('injected input failure');}};};`);
 await assert.rejects(require('../scripts/pty-native-smoke.cjs').smoke({root:f.root,platform:process.platform,arch:process.arch}),/injected input failure/);
 assert.equal(fs.existsSync(exited),true,'exit observed before failure returns');
 const pid=Number(fs.readFileSync(pidFile,'utf8'));assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
});

test('smoke CLI refuses a non-Electron runtime and wrong runtime architecture', () => {
  const {spawnSync} = require('node:child_process');
  const result = spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/pty-native-smoke.cjs'),path.resolve(__dirname,'..'),process.platform,'incorrect'],{encoding:'utf8'});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Electron|architecture/);
});

test('Windows/macOS prepare consumes exact-arch shipped prebuilds without a compiler or rebuild', async t => {
  // Inject only subprocess execution: foreign native binaries cannot run on Linux.
  for (const platform of ['win32', 'darwin']) for (const arch of ['x64', 'arm64']) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rift-native-'));
    t.after(() => fs.rmSync(root, {recursive:true, force:true}));
    const pty = path.join(root, 'node_modules/node-pty');
    const files = platform === 'win32' ? ['conpty.node', 'conpty_console_list.node', 'conpty/conpty.dll', 'conpty/OpenConsole.exe'] : ['pty.node', 'spawn-helper'];
    const prebuild = path.join(pty, 'prebuilds', `${platform}-${arch}`);
    fs.mkdirSync(prebuild, {recursive:true});
    fs.writeFileSync(path.join(pty, 'package.json'), JSON.stringify({version:'1.1.0'}));
    for (const file of files) { fs.mkdirSync(path.dirname(path.join(prebuild,file)),{recursive:true}); fs.writeFileSync(path.join(prebuild, file), 'fixture', {mode:0o644}); }
    const electron = path.join(root, 'electron'); fs.writeFileSync(electron, 'fixture');
    const calls = [];
    await require('../scripts/prepare-native.cjs').prepareNative({root, platform, arch, electron, run(command, args, options) { calls.push({command,args,options}); }});
    assert.equal(calls.length, 1, 'only Electron runtime verification; no compiler/rebuild');
    assert.equal(calls[0].command, electron);
    assert.equal(calls[0].options.env.ELECTRON_RUN_AS_NODE, '1');
    assert.ok(calls[0].args[0].endsWith('pty-native-smoke.cjs'));
    assert.deepEqual(calls[0].args.slice(1), [root, platform, arch]);
    if (platform === 'darwin') assert.equal(fs.statSync(path.join(prebuild,'spawn-helper')).mode & 0o111, 0o111);
  }
});
