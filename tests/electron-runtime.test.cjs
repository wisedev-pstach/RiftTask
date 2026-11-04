'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const {prepareNative} = require('../scripts/prepare-native.cjs');
function fixture(t, fault) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rift-runtime-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const e = path.join(root, 'node_modules/electron');
  fs.mkdirSync(path.join(e, 'dist'), {recursive:true});
  fs.writeFileSync(path.join(e, 'package.json'), '{"version":"45.0.0"}');
  fs.writeFileSync(path.join(e, 'path.txt'), 'electron');
  fs.writeFileSync(path.join(e, 'dist/version'), fault === 'version' ? '44.0.0' : '45.0.0');
  if (fault !== 'executable') fs.writeFileSync(path.join(e, 'dist/electron'), 'fixture');
  if (fault === 'metadata') fs.unlinkSync(path.join(e, 'dist/version'));
  return {root, e};
}
for (const fault of ['executable', 'version', 'metadata']) {
  test(`incomplete cached runtime (${fault}) is repaired once through pinned installer before smoke`, async t => {
    const {root, e} = fixture(t, fault); const calls=[];
    await prepareNative({root, platform:'linux', arch:'x64', run(command,args) {
      calls.push(args);
      if (args[0] === path.join(e, 'install.js')) {
        fs.writeFileSync(path.join(e, 'path.txt'), 'electron');
        fs.writeFileSync(path.join(e, 'dist/version'), '45.0.0');
        fs.writeFileSync(path.join(e, 'dist/electron'), 'repaired');
      }
    }});
    assert.equal(calls.filter(args=>args[0] === path.join(e,'install.js')).length, 1);
    assert.ok(calls[0][0].endsWith('install.js'));
    assert.ok(calls.at(-1)[0].endsWith('pty-native-smoke.cjs'));
  });
}
test('failed cache repair stops before Linux rebuild or smoke without an install loop', async t => {
  const {root, e} = fixture(t, 'version'); const calls=[];
  await assert.rejects(prepareNative({root, platform:'linux', arch:'x64', run(command,args) {calls.push(args);}}), /Electron.*45\.0\.0|runtime/i);
  assert.deepEqual(calls, [[path.join(e,'install.js')]]);
});
test('smoke rejects a real running process claiming the wrong Electron version before PTY execution', () => {
  const script=path.resolve(__dirname,'../scripts/pty-native-smoke.cjs');
  const result=spawnSync(process.execPath,['-e',`process.versions.electron='44.0.0';process.argv=[process.execPath,${JSON.stringify(script)},${JSON.stringify(path.resolve(__dirname,'..'))},process.platform,process.arch];require('node:module').runMain();`],{encoding:'utf8'});
  assert.notEqual(result.status,0, result.stdout);
  assert.match(result.stderr,/45\.0\.0/);
});
