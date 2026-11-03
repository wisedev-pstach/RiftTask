'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const installSh = path.join(root, 'scripts/install.sh');
const installPs1 = path.join(root, 'scripts/install.ps1');
const scratch = process.env.TMPDIR || os.tmpdir();
function executable(name) {
  const found = (process.env.PATH || '').split(path.delimiter).map(p => path.join(p, name)).find(p => {
    try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; }
  });
  assert.ok(found, `${name} required for POSIX installer fixtures`);
  return found;
}
const bash = process.platform === 'win32' ? null : executable('bash');
function fixture(t, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(scratch, 'rifttask-installer-'));
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  const bin = path.join(dir, 'bin');
  const home = path.join(dir, 'home');
  const tmp = path.join(dir, 'tmp');
  for (const p of [bin, home, tmp]) fs.mkdirSync(p);
  for (const cmd of ['bash', 'dirname', 'mktemp', 'cp', 'rm', 'chmod', 'head', 'mkdir', 'grep', 'cat']) {
    fs.symlinkSync(executable(cmd), path.join(bin, cmd));
  }
  // Only controlled programs are visible: never discover a real gh or npm.
  const program = `#!${process.execPath}\n` + String.raw`
const fs=require('node:fs'),path=require('node:path');
const cmd=path.basename(process.argv[1]),args=process.argv.slice(2),e=process.env;
fs.appendFileSync(e.LOG,JSON.stringify([cmd,...args])+'\n');
if(cmd==='uname') { console.log(args[0]==='-s' ? (e.FIXTURE_OS || 'Linux') : (e.ARCH || 'x86_64')); process.exit(0); }
if(args.includes('--version')) { console.log(cmd==='node' ? (e.NODE_VERSION || 'v24.15.0') : 'fixture 1'); process.exit(0); }
if(cmd==='node') { console.log('24.15.0'); process.exit(0); }
if(cmd==='gh' && args[0]==='auth') process.exit(e.AUTH_FAIL==='1'?1:0);
if(cmd==='gh' && args[0]==='repo') {
  if(e.LOCAL_SOURCE) {
    const r=require('node:child_process').spawnSync(e.REAL_GIT,['clone',...args.slice(5),'--',e.LOCAL_SOURCE,args[3]],{env:e,encoding:'utf8'});
    process.stdout.write(r.stdout||''); process.stderr.write(r.stderr||''); process.exit(r.status??1);
  }
  const dest=args[3]; fs.mkdirSync(dest,{recursive:true});
  fs.mkdirSync(path.join(dest,'release','linux-unpacked'),{recursive:true});
  fs.writeFileSync(path.join(dest,'release','linux-unpacked','stale'),'stale');
  if(e.STALE_EXEC==='1') fs.writeFileSync(path.join(dest,'release','linux-unpacked','rifttask'),'stale executable',{mode:0o755});
  process.exit(e.FAIL==='clone'?9:0);
}
const step=cmd==='npm' ? (args[0]==='ci'?'ci':args[1]) : 'package';
if(e.LOCAL_SOURCE && cmd==='npm' && args[0]==='ci' && fs.readFileSync('ref-marker','utf8')!=='feature') process.exit(19);
if(e.FAIL===step) process.exit(9);
if(cmd==='npx' || step==='pack') {
  if(e.NO_OUTPUT==='1') process.exit(0);
  const arch=e.WRONG_ARCH==='1'?'x64':(args.includes('--arm64')?'arm64':'x64');
  const out=e.FIXTURE_OS==='Darwin' ? (arch==='arm64'?'mac-arm64':'mac') : (arch==='arm64'?'linux-arm64-unpacked':'linux-unpacked');
  const bundle=path.join(process.cwd(),'release',out,...(e.FIXTURE_OS==='Darwin'?['RiftTask.app']:[]));
  fs.mkdirSync(bundle,{recursive:true});
  const app=path.join(bundle,'rifttask');
  fs.writeFileSync(app,'#!'+e.BASH+'\nprintf \'%s\\n\' "$@" > "$LAUNCH_LOG"\n');fs.chmodSync(app,0o755);
  if(e.FIXTURE_OS==='Darwin') {
    const macExe=path.join(bundle,'Contents','MacOS','RiftTask');
    fs.mkdirSync(path.dirname(macExe),{recursive:true}); fs.copyFileSync(app,macExe); fs.chmodSync(macExe,0o755);
  }
}
`;
  for (const cmd of ['gh', 'git', 'node', 'npm', 'npx', 'uname', 'xattr']) {
    fs.writeFileSync(path.join(bin, cmd), program, {mode:0o755});
  }
  const env = {PATH:bin, HOME:home, TMPDIR:tmp, LOG:path.join(dir,'calls'), BASH:bash,
    RIFTTASK_SKIP_CANDIDATE_SEARCH:'1', ...overrides};
  const dest = path.join(dir, 'destination');
  const script = path.join(dir, 'install.sh');
  fs.copyFileSync(installSh,script);
  return {dir, bin, home, tmp, env, dest, script,
    run(args=[]) {return spawnSync(bash,[script,...args],{env,encoding:'utf8',cwd:dir,timeout:15000});},
    calls() {return fs.existsSync(env.LOG) ? fs.readFileSync(env.LOG,'utf8').trim().split('\n').map(JSON.parse) : [];}
  };
}
const pwshProbe=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command','$PSVersionTable.PSVersion.ToString()'],{encoding:'utf8'});
test('PowerShell parser (only when pwsh is already installed)', {skip:pwshProbe.error?.code==='ENOENT'?'pwsh unavailable; Windows native behavior NOT verified':false}, () => {
  const parser='$tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile($env:RIFTTASK_PARSER_FILE,[ref]$tokens,[ref]$errors) > $null; if($errors.Count) { $errors | Out-String | Write-Error; exit 1 }';
  const r=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',parser],{encoding:'utf8',env:{...process.env,RIFTTASK_PARSER_FILE:installPs1}});
  assert.equal(r.status,0,r.stderr);
});
test('PowerShell source contract: hostile launch path stays plain data (not native proof)', () => {
  const s=fs.readFileSync(installPs1,'utf8');
  const launchLines=s.split('\n').filter(line=>/^\s*Write-Host.*\$ExePath/.test(line));
  assert.deepEqual(launchLines.map(line=>line.trim()),['Write-Host "Application executable: $ExePath"']);
  const hostile='C:\\literal $(Start-Process injected) `" & [x]\\RiftTask.exe';
  const rendered=launchLines[0].trim().replace('Write-Host "','').replace(/"$/,'').replace('$ExePath',()=>hostile);
  assert.equal(rendered,`Application executable: ${hostile}`);
  assert.match(s,/Write-Host "Open the application at the path above using your file manager\."/);
});
test('PowerShell source contract: all native calls use immediately checked exit status (not native proof)', () => {
  const s=fs.readFileSync(installPs1,'utf8');
  assert.match(s,/function Invoke-Native[\s\S]*?& \$Command @Arguments\s*\r?\n\s*if \(\$LASTEXITCODE -ne 0\)/);
  assert.equal(s.includes('Select-Object -First'),false,'do not short-circuit the native exit check');
  for(const command of ["Invoke-Native gh @('auth', 'status')", "Invoke-Native gh @('repo', 'clone'", "Invoke-Native npm @('ci'", "Invoke-Native npm @('run', 'native:rebuild')", "Invoke-Native npm @('run', 'build')", "Invoke-Native npx @("])
    assert.ok(s.includes(command),command);
});
test('PowerShell source contract: refuse existing literal destination, no recursive user-path removal (not native proof)', () => {
  const s=fs.readFileSync(installPs1,'utf8');
  assert.ok(s.includes('Get-Item -LiteralPath $TargetDir -Force -ErrorAction SilentlyContinue'));
  assert.ok(s.includes('refusing existing destination'));
  assert.equal(/Remove-Item[^\n]*\$TargetDir/.test(s),false);
  assert.ok(s.includes('New-Item -ItemType Directory -Path $TargetDir -ErrorAction Stop'));
  assert.ok(s.includes('Copy-Item -LiteralPath'));
});
test('PowerShell source contract: isolated explicit feature clone owned before clone and cleanup after Pop (not native proof)', () => {
  const s=fs.readFileSync(installPs1,'utf8');
  assert.ok(s.includes("$SourceRef = 'feat/cloud-persistence'"));
  assert.ok(s.includes("'--depth=1', '--branch', $SourceRef"));
  assert.equal(s.includes('Using existing repository'),false);
  assert.ok(s.indexOf('try {\n    New-Item -ItemType Directory -Path $TempBuildDir') < s.indexOf("Invoke-Native gh @('repo'"));
  assert.ok(s.includes('Remove-Item -LiteralPath $TempBuildDir'));
});
test('PowerShell source contract: ARM64 architecture and unpacked path are explicit (not native proof)', () => {
  const s=fs.readFileSync(installPs1,'utf8');
  assert.ok(s.includes('PROCESSOR_ARCHITEW6432'));
  assert.ok(s.includes("'ARM64' { 'arm64' }"));
  assert.ok(s.includes("'AMD64' { 'x64' }"));
  assert.ok(s.includes("'release\\win-arm64-unpacked'"));
  assert.equal(s.includes('Is64BitOperatingSystem'),false);
});
test('PowerShell source contract: preview validates Node baseline and writes no shared shortcuts (not native proof)', () => {
  const s=fs.readFileSync(installPs1,'utf8');
  assert.ok(s.includes("[version]'24.15.0'"));
  assert.ok(s.includes('$NodeVersion.Major -ge 26'));
  assert.equal(s.includes('CreateShortcut'),false,'preview must not replace unrelated shortcuts');
});
const posix = {skip: process.platform === 'win32' ? 'POSIX installer requires Bash' : false};
test('Linux launcher treats metacharacter destination and arguments as literal data', posix, t => {
  const f=fixture(t);
  const dest=path.join(f.dir,'literal $(mkdir injected) `mkdir backtick` $HOME " [x]');
  const r=f.run(['--dest',dest]);
  assert.equal(r.status,0,r.stdout+r.stderr);
  const log=path.join(f.dir,'launched');
  const launch=spawnSync(bash,[path.join(f.home,'.local/bin/rifttask'),'hello " ; $HOME'],{
    cwd:f.dir,env:{...f.env,LAUNCH_LOG:log},encoding:'utf8'});
  assert.equal(launch.status,0,launch.stderr);
  assert.equal(fs.readFileSync(log,'utf8'),'hello " ; $HOME\n');
  assert.equal(fs.existsSync(path.join(f.dir,'injected')),false);
  assert.equal(fs.existsSync(path.join(f.dir,'backtick')),false);
});
test('macOS hostile destination is printed only as a plain path, never a launch command', posix, t => {
  const f=fixture(t,{FIXTURE_OS:'Darwin'});
  const dest=path.join(f.dir,'literal $(mkdir injected) `mkdir backtick` $HOME " [x].app');
  const r=f.run(['--dest',dest]);
  assert.equal(r.status,0,r.stdout+r.stderr);
  assert.equal(r.stdout.split('\n').some(line=>line.includes(dest)&&!line.startsWith('Application installed at: ')),false,r.stdout);
  assert.match(r.stdout,/file manager/i);
  assert.equal(fs.existsSync(path.join(f.dir,'injected')),false);
  assert.equal(fs.existsSync(path.join(f.dir,'backtick')),false);
});
test('macOS fixture copies exact new .app destination without changing quarantine', posix, t => {
  const f=fixture(t,{FIXTURE_OS:'Darwin',ARCH:'arm64'});
  const dest=path.join(f.dir,'literal [app] $HOME.app');
  const r=f.run(['--dest',dest]);
  assert.equal(r.status,0,r.stdout+r.stderr);
  assert.equal(fs.existsSync(path.join(dest,'rifttask')),true);
  assert.equal(f.calls().some(c=>c[0]==='xattr'),false,'never strip quarantine');
});
test('Linux ARM64 requests matching package and consumes ARM64 output only', posix, t => {
  const f=fixture(t,{ARCH:'aarch64'});
  const r=f.run(['--dest',f.dest]);
  assert.equal(r.status,0,r.stdout+r.stderr);
  assert.equal(fs.existsSync(path.join(f.dest,'rifttask')),true);
  const pack=f.calls().find(c=>c[0]==='npx');
  assert.ok(pack,'explicit electron-builder invocation required');
  assert.ok(pack.includes('--arm64'));
  assert.ok(pack.includes('--linux'));
});
test('successful packaging without executable never installs stale output', posix, t => {
  const f=fixture(t,{NO_OUTPUT:'1'});
  const r=f.run(['--dest',f.dest]);
  assert.notEqual(r.status,0,r.stdout+r.stderr);
  assert.equal(fs.existsSync(f.dest),false);
  assert.deepEqual(fs.readdirSync(f.tmp),[]);
});
test('check rejects Node 20 despite executable presence', posix, t => {
  const f=fixture(t,{NODE_VERSION:'v20.19.0'});
  const r=f.run(['--check']);
  assert.notEqual(r.status,0,r.stdout+r.stderr);
  assert.match(r.stderr,/24\.15|unsupported Node/i);
});
test('macOS ARM64 never falls back to a different architecture output', posix, t => {
  const f=fixture(t,{FIXTURE_OS:'Darwin',ARCH:'arm64',WRONG_ARCH:'1'});
  const dest=path.join(f.dir,'new.app');
  const r=f.run(['--dest',dest]);
  assert.notEqual(r.status,0,r.stdout+r.stderr);
  assert.equal(fs.existsSync(dest),false);
});
test('failed clone/install/rebuild/build/package stop before consuming stale executable output', posix, t => {
  for (const fail of ['clone','ci','native:rebuild','build','package']) {
    const f=fixture(t,{FAIL:fail,STALE_EXEC:'1'});
    const r=f.run(['--dest',f.dest]);
    assert.notEqual(r.status,0,`${fail}: ${r.stdout} ${r.stderr}`);
    assert.equal(fs.existsSync(f.dest),false,fail);
    assert.equal(r.stdout.includes('installation complete'),false,fail);
    assert.deepEqual(fs.readdirSync(f.tmp),[],fail);
  }
});
test('successful check is side-effect-free and missing tools fail using isolated PATH', posix, t => {
  for (const missing of [null,'gh','node','npm','git']) {
    const f=fixture(t);
    if(missing) fs.unlinkSync(path.join(f.bin,missing));
    const r=f.run(['--check','--dest',f.dest]);
    if(missing) assert.notEqual(r.status,0,missing);
    else assert.equal(r.status,0,r.stdout+r.stderr);
    assert.deepEqual(fs.readdirSync(f.home),[]);
    assert.deepEqual(fs.readdirSync(f.tmp),[]);
    assert.equal(fs.existsSync(f.dest),false);
    assert.equal(f.calls().some(c=>c[1]==='repo'||c[1]==='ci'),false);
  }
});
test('real local Git clone selects feature even when default main lacks feature content', posix, t => {
  const f=fixture(t);
  const git=executable('git');
  const remote=path.join(f.dir,'local-source');fs.mkdirSync(remote);
  const gitEnv={...f.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(f.dir,'no-config'),GIT_ALLOW_PROTOCOL:'file'};
  const run=(args) => {
    const r=spawnSync(git,args,{cwd:remote,env:gitEnv,encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);return r.stdout;
  };
  run(['init','-b','main']);fs.writeFileSync(path.join(remote,'ref-marker'),'main');
  run(['add','.']);run(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','main']);
  run(['checkout','-b','feat/cloud-persistence']);fs.writeFileSync(path.join(remote,'ref-marker'),'feature');
  run(['add','.']);run(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','feature']);
  run(['checkout','main']);
  Object.assign(f.env,gitEnv,{LOCAL_SOURCE:require('node:url').pathToFileURL(remote).href,REAL_GIT:git});
  const r=f.run(['--dest',f.dest]);
  assert.equal(r.status,0,r.stdout+r.stderr);
  assert.equal(fs.existsSync(path.join(f.dest,'rifttask')),true);
  assert.equal(fs.readFileSync(path.join(remote,'ref-marker'),'utf8'),'main','source unchanged');
});
test('missing destination option value fails actionably before commands', posix, t => {
  const f=fixture(t);
  const r=f.run(['--dest']);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/--dest needs a new directory path/);
  assert.deepEqual(f.calls(),[]);
});
test('Bash syntax and help', posix, () => {
  assert.equal(spawnSync(bash,['-n',installSh]).status,0);
  assert.match(spawnSync(bash,[installSh,'--help'],{encoding:'utf8'}).stdout,/Usage: install.sh/);
});
test('unauthenticated check fails without modifying filesystem', posix, t => {
  const f=fixture(t,{AUTH_FAIL:'1'});
  const r=f.run(['--check','--dest',f.dest]);
  assert.notEqual(r.status,0,r.stdout+r.stderr);
  assert.equal(fs.existsSync(f.dest),false);
  assert.deepEqual(fs.readdirSync(f.tmp),[]);
  assert.equal(f.calls().some(c=>c[1]==='repo'||c[1]==='ci'),false);
});
test('relative TMPDIR is rejected before clone without owned-tree leaks', posix, t => {
  const f=fixture(t,{TMPDIR:'tmp'});
  const sentinel=path.join(f.tmp,'unrelated');
  fs.writeFileSync(sentinel,'preserve');
  const r=f.run(['--dest',f.dest]);
  assert.notEqual(r.status,0,r.stdout+r.stderr);
  assert.match(r.stderr,/TMPDIR.*absolute/i);
  assert.equal(f.calls().some(c=>c[1]==='repo'||c[1]==='ci'),false);
  assert.deepEqual(fs.readdirSync(f.tmp),['unrelated']);
  assert.equal(fs.readFileSync(sentinel,'utf8'),'preserve');
  assert.equal(fs.existsSync(f.dest),false);
});
test('source clone explicitly selects the feature ref, never default main or local checkout', posix, t => {
  const f=fixture(t);
  const r=f.run(['--dest',f.dest]);
  const clone=f.calls().find(c=>c[0]==='gh'&&c[1]==='repo');
  assert.ok(clone,r.stdout+r.stderr);
  assert.deepEqual(clone.slice(5),['--','--depth=1','--branch','feat/cloud-persistence']);
  assert.deepEqual(fs.readdirSync(f.tmp),[], 'owned build root cleaned');
});
test('every existing destination is refused before build and preserved byte-for-byte', posix, t => {
  for (const kind of ['directory','file','symlink']) {
    const f=fixture(t);
    const original=path.join(f.dir,'original'); fs.writeFileSync(original,'precious');
    if(kind==='directory') {fs.mkdirSync(f.dest); fs.writeFileSync(path.join(f.dest,'data'),'precious');}
    if(kind==='file') fs.writeFileSync(f.dest,'precious');
    if(kind==='symlink') fs.symlinkSync(original,f.dest);
    const r=f.run(['--dest',f.dest]);
    assert.notEqual(r.status,0,`${kind}: ${r.stdout} ${r.stderr}`);
    assert.match(r.stderr,/exist|refus/i);
    assert.equal(fs.readFileSync(kind==='directory'?path.join(f.dest,'data'):f.dest,'utf8'),'precious');
    assert.equal(f.calls().some(c=>c[1]==='repo'||c[1]==='ci'),false);
  }
});
