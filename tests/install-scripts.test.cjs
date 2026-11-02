'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const installSh = path.join(root, 'scripts', 'install.sh');
const installPs1 = path.join(root, 'scripts', 'install.ps1');

test('install.sh exists and passes bash syntax check', () => {
  assert.ok(fs.existsSync(installSh), 'scripts/install.sh must exist');
  const res = spawnSync('bash', ['-n', installSh], {encoding: 'utf8'});
  assert.equal(res.status, 0, `bash -n failed: ${res.stderr}`);
});

test('install.sh --help displays usage and exit code 0', () => {
  assert.ok(fs.existsSync(installSh));
  const res = spawnSync('bash', [installSh, '--help'], {encoding: 'utf8'});
  assert.equal(res.status, 0);
  assert.match(res.stdout, /Usage: install\.sh/);
  assert.match(res.stdout, /--check/);
  assert.match(res.stdout, /--dry-run/);
});

test('install.sh --check inspects prerequisites and reports status without modifying system', () => {
  assert.ok(fs.existsSync(installSh));
  const res = spawnSync('bash', [installSh, '--check'], {
    encoding: 'utf8',
    env: {...process.env, PATH: `/opt/data/bin:${process.env.PATH}`}
  });
  assert.equal(res.status, 0, `install.sh --check failed: ${res.stderr}\n${res.stdout}`);
  assert.match(res.stdout, /OS:/);
  assert.match(res.stdout, /Arch:/);
  assert.match(res.stdout, /GitHub CLI \(gh\):/);
  assert.match(res.stdout, /Node\.js:/);
});

test('install.sh fails with actionable error when node is missing from PATH', () => {
  assert.ok(fs.existsSync(installSh));
  const res = spawnSync('bash', [installSh, '--check'], {
    encoding: 'utf8',
    env: {PATH: '/usr/bin:/bin', HOME: '/tmp'} // Excludes /usr/local/bin where node is located
  });
  assert.equal(res.status, 1);
  assert.match(res.stderr + res.stdout, /Node\.js.*not found/i);
});

test('install.sh fails with actionable error when gh is missing entirely', () => {
  assert.ok(fs.existsSync(installSh));
  const tempBin = fs.mkdtempSync(path.join('/tmp', 'rifttask-test-bin-'));
  try {
    fs.symlinkSync('/usr/local/bin/node', path.join(tempBin, 'node'));
    fs.symlinkSync('/usr/local/bin/npm', path.join(tempBin, 'npm'));
    fs.symlinkSync('/usr/bin/git', path.join(tempBin, 'git'));
    fs.symlinkSync('/usr/bin/bash', path.join(tempBin, 'bash'));
    fs.symlinkSync('/usr/bin/uname', path.join(tempBin, 'uname'));
    fs.symlinkSync('/usr/bin/dirname', path.join(tempBin, 'dirname'));
    // Do not link gh, and point HOME to empty dir so candidate search fails
    const res = spawnSync('bash', [installSh, '--check'], {
      encoding: 'utf8',
      env: {PATH: tempBin, HOME: tempBin, RIFTTASK_SKIP_CANDIDATE_SEARCH: '1'}
    });
    assert.equal(res.status, 1);
    assert.match(res.stderr + res.stdout, /GitHub CLI.*gh.*not found/i);
  } finally {
    fs.rmSync(tempBin, {recursive: true, force: true});
  }
});

test('install.ps1 manages working directory cleanly and checks LASTEXITCODE', () => {
  assert.ok(fs.existsSync(installPs1));
  const content = fs.readFileSync(installPs1, 'utf8');
  assert.match(content, /Push-Location/, 'Must use Push-Location to prevent directory locks');
  assert.match(content, /Pop-Location/, 'Must use Pop-Location in finally block');
  assert.match(content, /\$LASTEXITCODE\s*-eq\s*0/, 'Must check LASTEXITCODE for gh auth status');
});

test('install.sh properly formats launcher target and mac app bundle destination', () => {
  assert.ok(fs.existsSync(installSh));
  const content = fs.readFileSync(installSh, 'utf8');
  assert.match(content, /TARGET_APP="\$CUSTOM_DEST\/\$APP_NAME\.app"/, 'Must ensure .app bundle suffix on custom dest');
  assert.match(content, /exec "\$TARGET_DIR\/rifttask"/, 'Must use TARGET_DIR in launcher script');
});
