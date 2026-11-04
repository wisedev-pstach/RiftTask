'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const asar = require('@electron/asar');
let root;
if (process.env.RIFT_TEST_ARCHIVES) {
  test.before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rift-archive-source-'));
    const source = path.resolve(__dirname, '..');
    for (const name of ['package.json', 'package-lock.json', '.npmrc', 'desktop', 'scripts', 'dist', 'build']) fs.cpSync(path.join(source, name), path.join(root, name), {recursive:true});
    const install = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {cwd:root, encoding:'utf8', timeout:120000});
    assert.equal(install.status, 0, `${install.stdout}\n${install.stderr}`);
  });
  test.after(() => { if (root) fs.rmSync(root, {recursive:true, force:true}); });
}
// Opt in: downloads real target Electron distributions and runs electron-builder.
// No npmRebuild override: exercise the ordinary source-package configuration.
for (const [platform, arch] of [['win32','x64'], ['win32','arm64'], ['darwin','x64'], ['darwin','arm64'], ['linux',process.arch]]) {
  test(`real ${platform}-${arch} archive retains production dependencies and shipped PTY assets`, {skip: !process.env.RIFT_TEST_ARCHIVES, timeout: 240000}, async t => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'rift-archive-'));
    t.after(() => fs.rmSync(output, {recursive:true, force:true}));
    const args = ['node_modules/electron-builder/cli.js', platform === 'win32' ? '--win' : platform === 'darwin' ? '--mac' : '--linux', `--${arch}`, '--dir', '--publish', 'never', `--config.directories.output=${output}`,
      ...(platform === 'win32' ? ['--config.win.signAndEditExecutable=false'] : platform === 'darwin' ? ['--config.mac.identity=null'] : [])];
    const result = spawnSync(process.execPath, args, {cwd:root, encoding:'utf8', timeout:220000, env:{...process.env, CSC_IDENTITY_AUTO_DISCOVERY:'false'}});
    assert.equal(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
    if (platform === 'linux') assert.match(result.stdout + result.stderr, /executing @electron\/rebuild/);
    else assert.doesNotMatch(result.stdout + result.stderr, /executing @electron\/rebuild|installing native dependencies/);
    const unpacked = platform === 'win32' ? (arch === 'x64' ? 'win-unpacked' : `win-${arch}-unpacked`) : platform === 'darwin' ? (arch === 'x64' ? 'mac' : `mac-${arch}`) : (arch === 'x64' ? 'linux-unpacked' : `linux-${arch}-unpacked`);
    const resources = path.join(output, unpacked, ...(platform === 'darwin' ? ['RiftTask.app', 'Contents', 'Resources'] : ['resources']));
    const archive = path.join(resources, 'app.asar');
    const entries = asar.listPackage(archive);
    for (const name of ['node-pty', 'node-addon-api']) assert.ok(entries.includes(`/node_modules/${name}/package.json`), `${name} absent from real app.asar (${entries.filter(p=>p.includes('/node_modules/')).length} dependency entries)`);
    const assets = platform === 'win32' ? ['conpty.node', 'conpty_console_list.node', 'conpty/conpty.dll', 'conpty/OpenConsole.exe'] : platform === 'darwin' ? ['pty.node', 'spawn-helper'] : ['pty.node'];
    for (const asset of assets) {
      const relative = platform === 'linux' ? `node_modules/node-pty/build/Release/${asset}` : `node_modules/node-pty/prebuilds/${platform}-${arch}/${asset}`;
      assert.equal(asar.statFile(archive, relative).unpacked, true, relative);
      assert.ok(fs.statSync(path.join(resources, 'app.asar.unpacked', relative)).size > 0, relative);
    }
    if (platform === 'darwin') assert.equal(fs.statSync(path.join(resources, 'app.asar.unpacked/node_modules/node-pty/prebuilds', `${platform}-${arch}`, 'spawn-helper')).mode & 0o111, 0o111);
    console.log(`ARCHIVE VERIFIED ${platform}-${arch}: node-pty, node-addon-api, ${assets.join(', ')} (${entries.filter(p=>p.includes('/node_modules/')).length} dependency entries)`);
  });
}
