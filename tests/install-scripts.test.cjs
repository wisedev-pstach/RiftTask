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
  // Only controlled programs are visible: gh is a fail-fast trap, never a real CLI.
  const program = `#!${process.execPath}\n` + String.raw`
const fs=require('node:fs'),path=require('node:path');
const cmd=path.basename(process.argv[1]),args=process.argv.slice(2),e=process.env;
fs.appendFileSync(e.LOG,JSON.stringify([cmd,...args])+'\n');
if(cmd==='uname') { console.log(args[0]==='-s' ? (e.FIXTURE_OS || 'Linux') : (e.ARCH || 'x86_64')); process.exit(0); }
if(cmd==='gh') process.exit(97); // Any installer invocation is a regression.
if(args.includes('--version')) { console.log(cmd==='node' ? (e.NODE_VERSION || 'v24.15.0') : 'fixture 1'); process.exit(0); }
if(cmd==='node') { console.log('24.15.0'); process.exit(0); }
if(cmd==='git' && e.LOCAL_SOURCE) {
 const actual=args[0]==='clone'?args.map(a=>a==='https://github.com/wisedev-pstach/RiftTask.git'?e.LOCAL_SOURCE:a):args;
 const r=require('node:child_process').spawnSync(e.REAL_GIT,actual,{env:e,encoding:'utf8'});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exit(r.status??1);
}
if(cmd==='git' && args[0]==='clone') {
  const dest=args.at(-1); fs.mkdirSync(dest,{recursive:true});
  fs.mkdirSync(path.join(dest,'release','linux-unpacked'),{recursive:true});
  fs.writeFileSync(path.join(dest,'release','linux-unpacked','stale'),'stale');
  if(e.STALE_EXEC==='1') fs.writeFileSync(path.join(dest,'release','linux-unpacked','rifttask'),'stale executable',{mode:0o755});
  process.exit(e.FAIL==='clone'?9:0);
}
const step=cmd==='npm' ? (args[0]==='ci'?'ci':args[1]) : 'package';
if(e.LOCAL_SOURCE && cmd==='npm' && args[0]==='ci' && fs.readFileSync('ref-marker','utf8')!==(e.EXPECT_MARKER || 'feature')) process.exit(19);
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
    ...overrides};
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
test('PowerShell downloaded entrypoint source contract: IEX-safe returns and scoped preferences (not runtime proof)', () => {
  const s=fs.readFileSync(installPs1,'utf8');
  assert.equal(/^\s*exit\b/m.test(s),false,'IEX must never terminate the caller PowerShell session');
  assert.match(s,/& \{\s*\$ErrorActionPreference = 'Stop'/,'scope preferences and helper functions');
  assert.match(s,/if \(\$CheckOnly\) \{[^}]*return/s);
  assert.equal(s.includes('Get-Help $MyInvocation.MyCommand.Path'),false,'downloaded text has no script path');
  const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
  assert.ok(readme.split('\n').includes('irm https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.ps1 | iex'));
  assert.equal(/ExecutionPolicy\s+Bypass|Set-ExecutionPolicy/i.test(readme),false);
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
  for(const command of ["Invoke-Native git @('clone'", "Invoke-Native npm @('ci'", "Invoke-Native npm @('run', 'native:prepare', '--', $Arch)", "Invoke-Native npm @('run', 'build')", "Invoke-Native npx @("])
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
test('PowerShell source contract: isolated public main clone owned before clone and cleanup after Pop (not native proof)', () => {
  const s=fs.readFileSync(installPs1,'utf8');
  assert.equal(/Get-Command gh|Invoke-Native gh|credential\.helper/.test(s),false);
  assert.ok(s.includes('https://github.com/wisedev-pstach/RiftTask.git'));
  assert.ok(s.includes("$SourceRef = 'main'"));
  assert.ok(s.includes("'--depth=1', '--branch', $SourceRef"));
  assert.equal(s.includes('Using existing repository'),false);
  assert.ok(s.indexOf('try {\n    New-Item -ItemType Directory -Path $TempBuildDir') < s.indexOf("Invoke-Native git @('clone'"));
  assert.ok(s.includes('Remove-Item -LiteralPath $TempBuildDir'));
});
test('PowerShell source contract: full commit pin is validated, fetched and verified before npm (not native proof)',()=>{
 const s=fs.readFileSync(installPs1,'utf8');assert.ok(s.includes('[string]$Ref'));assert.ok(s.includes("'^[0-9a-f]{40}$'"));assert.ok(s.includes("Invoke-Native git @('fetch', '--depth=1', 'origin', $Ref)"));assert.ok(s.includes("Invoke-Native git @('checkout', '--detach', $Ref)"));assert.ok(s.includes('$ActualCommit -cne $Ref'));
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
test('macOS installer uses script-free ci, exact runtime arch preparation, and disables packaging rebuild', posix, t => {
 const f=fixture(t,{FIXTURE_OS:'Darwin',ARCH:'arm64',npm_config_build_from_source:'true'});
 const r=f.run(['--dest',path.join(f.dir,'new.app')]);
 assert.equal(r.status,0,r.stdout+r.stderr);
 const calls=f.calls();
 assert.ok(calls.find(c=>c[0]==='npm'&&c[1]==='ci').includes('--ignore-scripts'));
 assert.deepEqual(calls.find(c=>c[0]==='npm'&&c[2]==='native:prepare'),['npm','run','native:prepare','--','arm64']);
 assert.equal(calls.some(c=>c.includes('native:rebuild')),false);
 assert.ok(calls.find(c=>c[0]==='npx').includes('--config.npmRebuild=false'));
});
test('macOS failed native preparation stops before build, packaging or destination creation', posix,t=>{
 const f=fixture(t,{FIXTURE_OS:'Darwin',FAIL:'native:prepare'});const dest=path.join(f.dir,'new.app');
 const r=f.run(['--dest',dest]);assert.notEqual(r.status,0);assert.equal(fs.existsSync(dest),false);
 assert.equal(f.calls().some(c=>c[0]==='npx'||c[2]==='build'),false);assert.deepEqual(fs.readdirSync(f.tmp),[]);
});
test('Windows source contract consumes prebuilds without lifecycle compilation (not native execution)',()=>{
 const s=fs.readFileSync(installPs1,'utf8');
 assert.match(s,/Invoke-Native npm @\('ci', '--ignore-scripts'/);
 assert.ok(s.includes("Invoke-Native npm @('run', 'native:prepare', '--', $Arch)"));
 assert.ok(s.includes("'--config.npmRebuild=false'"));
 assert.equal(s.includes("'native:rebuild'"),false);
});
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
  for (const fail of ['clone','ci','native:prepare','build','package']) {
    const f=fixture(t,{FAIL:fail,STALE_EXEC:'1'});
    const r=f.run(['--dest',f.dest]);
    assert.notEqual(r.status,0,`${fail}: ${r.stdout} ${r.stderr}`);
    assert.equal(fs.existsSync(f.dest),false,fail);
    assert.equal(r.stdout.includes('installation complete'),false,fail);
    assert.deepEqual(fs.readdirSync(f.tmp),[],fail);
  }
});
test('successful check is side-effect-free and missing tools fail using isolated PATH', posix, t => {
  for (const missing of [null,'node','npm','git']) {
    const f=fixture(t);
    if(missing) fs.unlinkSync(path.join(f.bin,missing));
    const r=f.run(['--check','--dest',f.dest]);
    if(missing) assert.notEqual(r.status,0,missing);
    else assert.equal(r.status,0,r.stdout+r.stderr);
    assert.deepEqual(fs.readdirSync(f.home),[]);
    assert.deepEqual(fs.readdirSync(f.tmp),[]);
    assert.equal(fs.existsSync(f.dest),false);
    assert.equal(f.calls().some(c=>c[1]==='clone'||c[1]==='ci'),false);
  }
});
test('public isolated source build uses main with gh absent and authentication unavailable', posix, t => {
  const f=fixture(t,{AUTH_FAIL:'1',GH_TOKEN:'',GITHUB_TOKEN:'',EXPECT_MARKER:'main'});
  fs.unlinkSync(path.join(f.bin,'gh'));
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
test('source commit pin is fetched, checked out detached and verified before building (real Git fixture)',posix,t=>{
 const f=fixture(t);const git=executable('git');const remote=path.join(f.dir,'pin-source');fs.mkdirSync(remote);const gitEnv={...f.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(f.dir,'no-config'),GIT_ALLOW_PROTOCOL:'file'};
 const run=args=>{const r=spawnSync(git,args,{cwd:remote,env:gitEnv,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 run(['init','-b','main']);fs.writeFileSync(path.join(remote,'ref-marker'),'feature');run(['add','.']);run(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','pinned']);const pin=run(['rev-parse','HEAD']);
 fs.writeFileSync(path.join(remote,'ref-marker'),'wrong-tip');run(['add','.']);run(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','moving tip']);
 Object.assign(f.env,gitEnv,{LOCAL_SOURCE:require('node:url').pathToFileURL(remote).href,REAL_GIT:git});const r=f.run(['--ref',pin,'--dest',f.dest]);assert.equal(r.status,0,r.stdout+r.stderr);assert.ok(r.stdout.includes(pin));assert.equal(fs.existsSync(path.join(f.dest,'rifttask')),true);
 const bad=fixture(t);const result=bad.run(['--ref','--upload-pack=injected']);assert.notEqual(result.status,0);assert.deepEqual(bad.calls(),[]);
});
test('README is a short concrete entrypoint with detailed setup relocated', () => {
 const s=fs.readFileSync(path.join(root,'README.md'),'utf8');
 assert.ok(s.trim().split('\n').length <= 70, 'keep README at most 70 lines');
 assert.match(s,/docs\/SETUP\.md/);
 assert.match(s,/no (?:C\+\+|compiler)/i);
 const guide=fs.readFileSync(path.join(root,'docs/SETUP.md'),'utf8');
 assert.match(guide,/### Optional: download and inspect first/);
 assert.match(guide,/### Advanced: build a reviewed commit/);
 assert.ok(guide.includes('bash ./install.sh --ref "$ref"'));
 assert.ok(guide.includes('& .\\install.ps1 -Ref $Ref'));
});
test('README separates optional inspection and commit pins from the quick setup', () => {
 const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
 assert.match(readme,/docs\/SETUP\.md/);
 const s=fs.readFileSync(path.join(root,'docs/SETUP.md'),'utf8');
 assert.match(s,/### Optional: download and inspect first/);
 assert.match(s,/### Advanced: build a reviewed commit/);
 assert.ok(s.includes('bash ./install.sh --ref "$ref"'));
 assert.ok(s.includes('& .\\install.ps1 -Ref $Ref'));
 assert.equal(s.includes('Run it from a directory without an existing `RiftTask-source-preview` folder.'),false);
});
function quickRecipe() {
 const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
 const recipe=readme.split('\n').find(line=>line.startsWith("bash -o pipefail -c 'curl -fsSL "));
 assert.ok(recipe,'README must offer the simple curl | bash recipe with fetch-error propagation');
 assert.equal(recipe,"bash -o pipefail -c 'curl -fsSL https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.sh | bash'");
 return recipe;
}
function curlFixture(f, fail=false) {
 fs.writeFileSync(path.join(f.bin,'curl'),`#!${process.execPath}\nconst fs=require('node:fs'); const args=process.argv.slice(2); fs.appendFileSync(process.env.LOG,JSON.stringify(['curl',...args])+'\\n'); if(${fail}) process.exit(22); process.stdout.write(fs.readFileSync(${JSON.stringify(f.script)}));`,{mode:0o755});
}
test('README quick curl recipe streams macOS source build without gh',posix,t=>{
 const f=fixture(t,{FIXTURE_OS:'Darwin',ARCH:'arm64'});
 fs.unlinkSync(path.join(f.bin,'gh'));curlFixture(f);
 const r=spawnSync(bash,['-c',quickRecipe()],{cwd:f.dir,env:f.env,encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stdout+r.stderr);
 assert.equal(fs.existsSync(path.join(f.home,'Applications/RiftTask.app/Contents/MacOS/RiftTask')),true);
 assert.deepEqual(f.calls()[0],['curl','-fsSL','https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.sh']);
 assert.equal(f.calls().some(c=>c[0]==='gh'),false);
 assert.deepEqual(fs.readdirSync(f.tmp),[]);
 assert.equal(fs.existsSync(path.join(f.dir,'RiftTask-source-preview')),false);
 const again=spawnSync(bash,['-c',quickRecipe()],{cwd:f.dir,env:f.env,encoding:'utf8'});
 assert.notEqual(again.status,0);assert.match(again.stderr,/refusing existing destination/);
 assert.equal(f.calls().filter(c=>c[1]==='clone').length,1,'retry must not build or overwrite');
});
test('README quick curl recipe reports fetch failure without clone or build',posix,t=>{
 const f=fixture(t);curlFixture(f,true);
 const r=spawnSync(bash,['-c',quickRecipe()],{cwd:f.dir,env:f.env,encoding:'utf8',timeout:15000});
 assert.equal(r.status,22,r.stdout+r.stderr);
 assert.equal(f.calls().length,1,'failed fetch must not start installer commands');
 assert.deepEqual(fs.readdirSync(f.home),[]);assert.deepEqual(fs.readdirSync(f.tmp),[]);
});
test('Bash syntax and help', posix, () => {
  assert.equal(spawnSync(bash,['-n',installSh]).status,0);
  assert.match(spawnSync(bash,[installSh,'--help'],{encoding:'utf8'}).stdout,/Usage: install.sh/);
});
test('public source check succeeds with gh absent or trapped and authentication unavailable', posix, t => {
  for (const absent of [true,false]) {
    const f=fixture(t,{AUTH_FAIL:'1',GH_TOKEN:'',GITHUB_TOKEN:''});
    if (absent) fs.unlinkSync(path.join(f.bin,'gh'));
    else fs.writeFileSync(path.join(f.bin,'gh'),`#!${process.execPath}\nrequire('node:fs').appendFileSync(process.env.LOG,JSON.stringify(['gh','FORBIDDEN'])+'\\n');process.exit(97);`,{mode:0o755});
    const r=f.run(['--check','--dest',f.dest]);
    assert.equal(r.status,0,r.stdout+r.stderr);
    assert.equal(fs.existsSync(f.dest),false);
    assert.deepEqual(fs.readdirSync(f.home),[]);
    assert.deepEqual(fs.readdirSync(f.tmp),[]);
    assert.equal(f.calls().some(c=>c[0]==='gh'||c[1]==='clone'||c[1]==='ci'),false);
  }
});
test('relative TMPDIR is rejected before clone without owned-tree leaks', posix, t => {
  const f=fixture(t,{TMPDIR:'tmp'});
  const sentinel=path.join(f.tmp,'unrelated');
  fs.writeFileSync(sentinel,'preserve');
  const r=f.run(['--dest',f.dest]);
  assert.notEqual(r.status,0,r.stdout+r.stderr);
  assert.match(r.stderr,/TMPDIR.*absolute/i);
  assert.equal(f.calls().some(c=>c[1]==='clone'||c[1]==='ci'),false);
  assert.deepEqual(fs.readdirSync(f.tmp),['unrelated']);
  assert.equal(fs.readFileSync(sentinel,'utf8'),'preserve');
  assert.equal(fs.existsSync(f.dest),false);
});
test('source clone explicitly selects public HTTPS main in an isolated tree', posix, t => {
  const f=fixture(t);
  const r=f.run(['--dest',f.dest]);
  const clone=f.calls().find(c=>c[0]==='git'&&c[1]==='clone');
  assert.ok(clone,r.stdout+r.stderr);
  assert.deepEqual(clone.slice(1,6),['clone','--depth=1','--branch','main','https://github.com/wisedev-pstach/RiftTask.git']);
  assert.ok(clone[6].startsWith(f.tmp+path.sep));
  assert.equal(f.calls().some(c=>c[0]==='gh'),false);
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
    assert.equal(f.calls().some(c=>c[1]==='clone'||c[1]==='ci'),false);
  }
});
