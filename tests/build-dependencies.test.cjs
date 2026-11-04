'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const source = path.resolve(__dirname, '..');
const deprecated = /^(inflight|rimraf|glob|boolean)$/;

test('fresh script-free install excludes the deprecated build chains without hiding warnings', {timeout:180000}, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rift-build-dependencies-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  for (const name of ['package.json', 'package-lock.json', '.npmrc']) {
    if (fs.existsSync(path.join(source, name))) fs.copyFileSync(path.join(source, name), path.join(root, name));
  }
  const install = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=warn'], {cwd:root, encoding:'utf8', timeout:150000});
  assert.equal(install.status, 0, `${install.stdout}\n${install.stderr}`);
  assert.doesNotMatch(install.stdout + install.stderr, /npm warn deprecated (?:inflight@1\.|rimraf@2\.|glob@7\.|boolean@3\.)/i);
  const lock = JSON.parse(fs.readFileSync(path.join(source, 'package-lock.json'), 'utf8'));
  const installedDeprecated = Object.entries(lock.packages).filter(([location, pkg]) => {
    const name = location.split('node_modules/').pop();
    return deprecated.test(name) && pkg.deprecated && fs.existsSync(path.join(root, location));
  });
  assert.deepEqual(installedDeprecated, [], 'deprecated packages must be absent, not just quiet');
  for (const name of ['electron-builder', 'dmg-builder', '@testing-library/dom']) {
    assert.ok(fs.existsSync(path.join(root, 'node_modules', name, 'package.json')), `${name} must remain installed`);
  }
  assert.ok(!fs.existsSync(path.join(root, 'node_modules/electron-builder-squirrel-windows')), 'unused Squirrel peer must remain omitted');
  const compatibility = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const {createRequire} = require('node:module');
    const fromRoot = createRequire(process.cwd() + '/package.json');
    const fromBuilder = createRequire(fromRoot.resolve('app-builder-lib/package.json'));
    for (const [name, apis] of [
      ['@electron/asar', ['createPackageFromStreams', 'listPackage', 'statFile', 'extractFile']],
      ['@electron/get', ['downloadArtifact']],
      ['@electron/universal', ['makeUniversalApp']]
    ]) {
      const api = fromBuilder(name);
      for (const key of apis) assert.equal(typeof api[key], 'function', name + '.' + key);
    }
    assert.equal(fromBuilder('@electron/get').ElectronDownloadCacheMode.ReadWrite, 0);
    console.log('CommonJS builder dependency APIs verified');
  `], {cwd:root, encoding:'utf8', timeout:10000});
  assert.equal(compatibility.status, 0, `${compatibility.stdout}\n${compatibility.stderr}`);
  console.log(install.stdout.trim());
  if (install.stderr) console.log(install.stderr.trim());
  console.log(compatibility.stdout.trim());
});
