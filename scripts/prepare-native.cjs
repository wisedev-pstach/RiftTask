'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

function run(command, args, options) {
  const result = spawnSync(command, args, {stdio:'inherit', timeout:120000, ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Native preparation failed (exit ${result.status}, signal ${result.signal || 'none'}).`);
}

function validatePrebuild(root, platform, arch) {
  if (!['win32','darwin'].includes(platform) || !['x64','arm64'].includes(arch)) throw new Error(`Unsupported prebuild architecture: ${platform}-${arch}`);
  const pty = path.join(root, 'node_modules/node-pty');
  if (JSON.parse(fs.readFileSync(path.join(pty, 'package.json'), 'utf8')).version !== '1.1.0') throw new Error('Expected pinned node-pty 1.1.0 prebuilds.');
  const dir = path.join(pty, 'prebuilds', `${platform}-${arch}`);
  for (const file of platform === 'win32' ? ['conpty.node','conpty_console_list.node','conpty/conpty.dll','conpty/OpenConsole.exe'] : ['pty.node','spawn-helper']) {
    const target = path.join(dir, file);
    let stat; try { stat = fs.statSync(target); } catch {}
    if (!stat?.isFile() || !stat.size) throw new Error(`Missing or empty node-pty prebuild: ${target}. Reinstall locked dependencies; no compiler fallback is attempted.`);
  }
  for (const relative of ['build/Release','build/Debug']) {
    const build = path.join(pty, relative);
    if (fs.existsSync(build) && fs.readdirSync(build).some(file => file.endsWith('.node'))) throw new Error('Stale node-pty build overrides shipped prebuilds. Use a fresh npm ci --ignore-scripts.');
  }
  return dir;
}

async function prepareNative({root = path.resolve(__dirname, '..'), platform = process.platform, arch = process.arch, electron, run: execute = run} = {}) {
  if (!['linux','darwin','win32'].includes(platform) || !['x64','arm64'].includes(arch)) throw new Error(`Unsupported native architecture: ${platform}-${arch}`);
  if (platform !== 'linux') {
    const dir = validatePrebuild(root, platform, arch);
    if (platform === 'darwin') fs.chmodSync(path.join(dir, 'spawn-helper'), 0o755);
  }
  // npm ci --ignore-scripts deliberately avoids node-pty's compile fallback.
  // Run only the reviewed, pinned Electron downloader, not arbitrary lifecycles.
  if (!electron) {
    const dir = path.join(root, 'node_modules/electron');
    if (JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8')).version !== '45.0.0') throw new Error('Expected pinned Electron 45.0.0.');
    const env = {...process.env, npm_config_arch:arch, npm_config_platform:platform, ELECTRON_INSTALL_ARCH:arch, ELECTRON_INSTALL_PLATFORM:platform};
    for (const key of ['ELECTRON_SKIP_BINARY_DOWNLOAD','ELECTRON_OVERRIDE_DIST_PATH','npm_config_target_arch','npm_config_target_platform','npm_config_build_from_source']) delete env[key];
    const relative = platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : platform === 'win32' ? 'electron.exe' : 'electron';
    electron = path.join(dir, 'dist', relative);
    function runtimeInstalled() {
      try {
        const stat = fs.statSync(electron);
        return fs.readFileSync(path.join(dir, 'path.txt'), 'utf8').trim() === relative &&
          fs.readFileSync(path.join(dir, 'dist/version'), 'utf8').trim().replace(/^v/, '') === '45.0.0' && stat.isFile() && stat.size > 0;
      } catch { return false; }
    }
    if (!runtimeInstalled()) {
      // Invalidate only the installer's marker so a partial cache cannot make
      // the pinned downloader take its isInstalled() shortcut. One attempt only.
      fs.rmSync(path.join(dir, 'path.txt'), {force:true});
      execute(process.execPath, [path.join(dir,'install.js')], {cwd:root, env});
    }
    if (!runtimeInstalled()) throw new Error('Electron 45.0.0 runtime missing or invalid after download.');
  }
  if (platform === 'linux') execute(process.execPath, [path.join(root,'node_modules/electron-builder/cli.js'), 'install-app-deps', '--arch', arch], {cwd:root, env:{...process.env}});
  execute(electron, [path.join(__dirname, 'pty-native-smoke.cjs'), root, platform, arch], {cwd:root, env:{...process.env, ELECTRON_RUN_AS_NODE:'1'}});
}
module.exports = {prepareNative, validatePrebuild};
if (require.main === module) prepareNative({arch:process.argv[2] || process.arch}).catch(error => { console.error(error.message); process.exitCode = 1; });
