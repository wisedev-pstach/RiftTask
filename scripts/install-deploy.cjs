'use strict';
// Loaded only from the freshly fetched source, after npm ci supplies ASAR/plist.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createRequire} = require('node:module');
const localRequire = createRequire(path.join(__dirname, '..', 'node_modules', 'app-builder-lib', 'package.json'));
const asar = localRequire('@electron/asar');
const plist = localRequire('plist');
const APP_ID = 'dev.wisedev.rifttask';
function identity(dir, platform, versionInspector = windowsVersion) {
  const exe = path.join(dir, ...(platform === 'mac' ? ['Contents', 'MacOS', 'RiftTask'] : ['RiftTask.exe']));
  const archive = path.join(dir, ...(platform === 'mac' ? ['Contents', 'Resources', 'app.asar'] : ['resources', 'app.asar']));
  noLinks(exe);
  noLinks(archive);
  if (platform === 'mac') noLinks(path.join(dir, 'Contents', 'Info.plist'));
  const metadata = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'));
  // Builder strips build from historical archives. Missing IDs may use native
  // identity, but an explicitly contradictory ID must never fall back to it.
  const ids = [metadata.build, metadata.rifttask].filter(value => value && Object.hasOwn(value, 'appId')).map(value => value.appId);
  if (metadata.name !== 'rifttask' || metadata.main !== 'desktop/main.cjs' || ids.some(id => id !== APP_ID)) throw new Error('Refusing unrelated/corrupt destination: RiftTask ASAR identity mismatch.');
  const executableStat = fs.statSync(exe);
  if (!executableStat.isFile() || executableStat.size === 0) throw new Error('RiftTask executable missing or empty.');
  if (platform === 'mac') {
    fs.accessSync(exe, fs.constants.X_OK);
    const info = plist.parse(fs.readFileSync(path.join(dir, 'Contents', 'Info.plist'), 'utf8'));
    if (info.CFBundleIdentifier !== APP_ID || info.CFBundleExecutable !== 'RiftTask') throw new Error('RiftTask bundle identity mismatch.');
  } else if (ids.length === 0) {
    const version = versionInspector(exe);
    if (version?.ProductName !== 'RiftTask' || version?.FileDescription !== 'RiftTask') throw new Error('RiftTask native executable identity mismatch.');
  }
}
function windowsVersion(exe) {
  if (process.platform !== 'win32') throw new Error('Native Windows PE identity inspection requires Windows.');
  // Read version resources only: never start or load code from the old app.
  // Path travels as environment data, not PowerShell syntax (literal metacharacters).
  const result = require('node:child_process').spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference='Stop'; $v=[Diagnostics.FileVersionInfo]::GetVersionInfo($env:RIFTTASK_IDENTITY_EXE); @{ProductName=$v.ProductName;FileDescription=$v.FileDescription}|ConvertTo-Json -Compress"
  ], {encoding:'utf8', timeout:10000, maxBuffer:8192, windowsHide:true,
    env:{...process.env, RIFTTASK_IDENTITY_EXE:exe}});
  if (result.error || result.status !== 0) throw new Error('Cannot safely read Windows executable identity.');
  try { return JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim()); }
  catch { throw new Error('Invalid Windows executable identity output.'); }
}
function noLinks(filename) {
  for (let p = path.resolve(filename);; p = path.dirname(p)) {
    let stat;
    try { stat = fs.lstatSync(p); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) throw new Error(`Refusing symlink/reparse path: ${p}`);
    if (p === path.dirname(p)) break;
  }
}
function overlap(a, b) {
  const norm = p => { const result = path.resolve(p); return process.platform === 'win32' ? result.toLowerCase() : result; };
  a = norm(a); b = norm(b);
  return a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
}
function guard(options) {
  const {target, home} = options;
  // Trusted build/temp roots may have an OS-managed alias (macOS /var).
  // Destinations are deliberately never realpathed: aliases remain forbidden.
  const canonicalRoot = p => p && fs.existsSync(p) ? fs.realpathSync(p) : p;
  const source = canonicalRoot(options.source);
  const tmp = canonicalRoot(options.tmp);
  if (!path.isAbsolute(target) || path.resolve(target) === path.parse(path.resolve(target)).root || path.resolve(target) === path.resolve(home) || overlap(target, source) || (tmp && overlap(target, tmp))) throw new Error('Refusing unsafe destination: root/home/source/build/temp overlap.');
  for (const protectedPath of [path.join(home, '.local'), path.join(home, 'Library', 'Application Support'), ...(options.appdata ? [options.appdata] : [])]) {
    if (overlap(target, protectedPath)) throw new Error('Refusing application-data destination.');
  }
  noLinks(target);
  if (fs.existsSync(target) && !fs.lstatSync(target).isDirectory()) throw new Error('Refusing existing non-directory destination.');
}
function fingerprint(dir) {
  const hash = crypto.createHash('sha256');
  function walk(p) {
    const stat = fs.lstatSync(p);
    hash.update(`${path.relative(dir,p)}:${stat.dev}:${stat.ino}:${stat.mode}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}\n`);
    if (stat.isSymbolicLink()) hash.update(fs.readlinkSync(p));
    else if (stat.isDirectory()) for (const name of fs.readdirSync(p).sort()) walk(path.join(p, name));
    else if (stat.isFile()) hash.update(fs.readFileSync(p));
    else throw new Error('Refusing special app file.');
  }
  walk(dir); return hash.digest('hex');
}
function inspect(options) {
  const {target, platform} = options;
  guard(options);
  if (!fs.existsSync(target)) return 'absent';
  try { identity(target, platform, options.versionInspector); }
  catch (error) { throw new Error(`Refusing unrelated/corrupt existing destination: ${target}. ${error.message}`); }
  return fingerprint(target);
}
function assertClosed(options) {
  if (options.running?.()) throw new Error('Please close RiftTask and retry; no processes were stopped.');
}
// Directory-only contract: same-volume rename, exact destination (never nest),
// fail if ANY destination exists. Never emulate exclusivity with exists+rename.
// host/spawnSync/renameSync are test seams, not CLI-controlled platform choices.
function renameExclusiveSync(from, to, hooks = {}) {
  const host = hooks.host || process.platform;
  if (!fs.lstatSync(from).isDirectory()) throw new Error('Exclusive rename requires a real directory source.');
  if (host === 'win32') {
    // libuv fs__rename uses MoveFileExW(MOVEFILE_REPLACE_EXISTING).
    // Microsoft explicitly forbids replacing an existing directory with this
    // flag; directory->file also fails. This is NOT a file-rename provider.
    return (hooks.renameSync || fs.renameSync)(from, to);
  }
  const spawn = hooks.spawnSync || require('node:child_process').spawnSync;
  const bounded = {encoding:'utf8', timeout:10000, maxBuffer:8192, windowsHide:true};
  if (host === 'darwin') {
    // Apple bsd/sys/stdio.h: RENAME_EXCL = 0x00000004; renamex_np is
    // int(const char *, const char *, unsigned int), available since 10.12.
    // Built-in JXA binds libSystem directly: no Python, compiler, or Xcode.
    const script = "ObjC.bindFunction('renamex_np', ['int', ['string', 'string', 'unsigned int']]);\nfunction run(argv) { if (argv.length !== 2 || $.renamex_np(argv[0], argv[1], 0x00000004) !== 0) throw new Error('Exclusive rename failed'); return 'renamed'; }";
    const result = spawn('/usr/bin/osascript', ['-l', 'JavaScript', '-e', script, '--', from, to], bounded);
    if (result.error || result.status !== 0 || result.stdout?.trim() !== 'renamed') throw new Error(`Exclusive rename failed: ${result.error?.message || result.stderr || 'native operation not confirmed'}`);
    return;
  }
  // Linux is ONLY the simulated installer test host, not a supported updater
  // platform. Opt in explicitly; GNU mv's Linux renameat2 path is exercised by
  // fixtures, not asserted portable to old kernels/unsupported filesystems.
  if (host === 'linux' && (hooks.linuxFixture || process.env.RIFTTASK_TEST_GNU_MV === '1')) {
    const result = spawn('/bin/mv', ['--no-copy', '--no-clobber', '--no-target-directory', '--', from, to], bounded);
    // GNU -n reports success on a skip. Never report that as publication.
    if (result.error || result.status !== 0 || fs.existsSync(from)) throw new Error(`Exclusive rename fixture failed: ${result.error?.message || result.stderr || 'destination exists / source not moved'}`);
    return;
  }
  throw new Error(`Unsupported exclusive directory rename host: ${host}`);
}
function deploy(options) {
  const relative = path.relative(path.resolve(options.source), path.resolve(options.bundle));
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('Refusing bundle outside trusted fresh source root.');
  // Resolve only the trusted root, then derive the child path lexically. Running
  // realpath on the bundle would silently accept a symlinked .app or resource.
  const source = fs.realpathSync(options.source);
  options = {...options, source, bundle:path.join(source, relative)};
  const {target, bundle, platform, expected} = options;
  const io = options.io || fs;
  const renameExclusive = io.renameExclusiveSync || renameExclusiveSync;
  guard(options);
  assertClosed(options);
  identity(bundle, platform, options.versionInspector);
  const parent = path.dirname(target);
  fs.mkdirSync(parent, {recursive:true});
  const lock = path.join(parent, `.${path.basename(target)}.rifttask-update.lock`);
  let lockFd;
  try { lockFd = fs.openSync(lock, 'wx'); }
  catch (error) { throw new Error(`Another update/lock prevents installation: ${lock}. Close RiftTask and retry. Do not remove an active lock. ${error.message}`); }
  let stage;
  let backup;
  try {
    if (inspect(options) !== expected) throw new Error('Destination changed during build; refusing replacement.');
    stage = fs.mkdtempSync(path.join(parent, '.rifttask-stage-'));
    const staged = path.join(stage, path.basename(target));
    io.cpSync(bundle, staged, {recursive:true, errorOnExist:true, force:false, verbatimSymlinks:true});
    identity(staged, platform, options.versionInspector);
    fs.writeFileSync(path.join(staged, '.rifttask-install.json'), JSON.stringify({schema:1, repository:'https://github.com/wisedev-pstach/RiftTask.git', appId:APP_ID, commit:options.commit || null}), {flag:'wx'});
    assertClosed(options);
    if (inspect(options) !== expected) throw new Error('Destination changed during build; refusing replacement.');
    if (expected !== 'absent') {
      backup = path.join(fs.mkdtempSync(path.join(parent, '.rifttask-backup-')), path.basename(target));
      try { renameExclusive(target, backup); }
      catch (error) { throw new Error(`Cannot move old app safely; close RiftTask and retry only after inspecting both paths. Original app: ${target}. Previous-app backup candidate: ${backup}. Do not delete either path. ${error.message}`); }
    }
    try { renameExclusive(staged, target); }
    catch (error) {
      if (backup) {
        try {
          renameExclusive(backup, target);
        }
        catch (restoreError) { throw new Error(`Publish failed: ${error.message}. ROLLBACK FAILED: ${restoreError.message}. Previous app: ${backup}. Restore it manually to: ${target}; do not delete either path.`); }
      }
      throw new Error(`Publish failed; previous app restored where applicable. Close RiftTask and retry. ${error.message}`);
    }
    return {target, backup};
  } finally {
    // Cleanup errors must never hide the original promotion/rollback diagnosis.
    const report = options.report || (message => console.error(message));
    if (stage) {
      try { noLinks(stage); io.rmSync(stage, {recursive:true, force:true}); }
      catch (error) { report(`Warning: owned staging could not be cleaned: ${stage}. Inspect manually. ${error.message}`); }
    }
    try { fs.closeSync(lockFd); }
    catch (error) { report(`Warning: could not close invocation lock: ${lock}. ${error.message}`); }
    try { fs.unlinkSync(lock); }
    catch (error) { report(`Warning: invocation lock remains: ${lock}. Inspect before retrying. ${error.message}`); }
  }
}
function isRunning(platform, hooks = {}) {
  const spawn = hooks.spawnSync || require('node:child_process').spawnSync;
  const host = hooks.host || process.platform;
  if (platform === 'win' && host !== 'win32') return false; // Simulated-COM fixtures only, never native acceptance.
  const bounded = {encoding:'utf8', timeout:10000, maxBuffer:8192, windowsHide:true};
  const result = platform === 'mac'
    ? spawn('pgrep', ['-x', 'RiftTask'], bounded)
    : spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "if (Get-Process -Name RiftTask -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"], bounded);
  if (result.error || ![0,1].includes(result.status)) throw new Error('Cannot safely check whether RiftTask is running; close it and retry.');
  return result.status === 0;
}
module.exports = {identity, inspect, deploy, renameExclusiveSync, isRunning};
if (require.main === module) {
  try {
    const [command, platform, target, source, home, tmp, appdata, expected, bundle, commit] = process.argv.slice(2);
    const running = () => isRunning(platform);
    const options = {platform, target, source, home, tmp, appdata, expected, bundle, commit, running};
    assertClosed(options);
    if (command === 'inspect') process.stdout.write(inspect(options) + '\n');
    else if (command === 'deploy') {
      const result = deploy(options);
      if (result.backup) console.log(`Previous app backup: ${result.backup}`);
      console.log('App replacement verified; application data was not modified.');
    } else throw new Error('Unknown deployment command.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
