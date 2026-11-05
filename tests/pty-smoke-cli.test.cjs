'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');
const cli = path.resolve(__dirname,'../scripts/pty-native-smoke.cjs');
const actualPty = path.resolve(__dirname,'../node_modules/node-pty');
const verified = 'Electron 45.0.0 PTY verified: {"tty":true,"input":true,"state":true,"resize":true,"cleanup":true}\n';

function fixture(t, {version = '45.0.0', missing = false, cleanupFailure = false, survivingPid = false} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'rift-smoke-cli-test-'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  const scratch = path.join(root,'scratch'); fs.mkdirSync(scratch);
  if (!missing) {
    const pkg = path.join(root,'node_modules/node-pty'); fs.mkdirSync(pkg,{recursive:true});
    // Real Linux PTY; only the retained parent handle is injected. This is not
    // native Electron or ConPTY evidence, despite the test-only version gate.
    fs.writeFileSync(path.join(pkg,'index.js'),`
      const pty = require(${JSON.stringify(actualPty)});
      module.exports = {spawn(...args) {
        const child = pty.spawn(...args);
        ${survivingPid ? "Object.defineProperty(child,'pid',{value:process.pid});" : ''}
        return child;
      }};
    `);
  }
  const preload = path.join(root,'preload.cjs');
  fs.writeFileSync(preload,`
    Object.defineProperty(process.versions,'electron',{value:${JSON.stringify(version)}});
    globalThis.smokeTestHandle = setInterval(() => {},1000);
    ${cleanupFailure ? `const fs = require('node:fs'); const rm = fs.rmSync;
    fs.rmSync = function(target,options) {
      if (require('node:path').basename(target).startsWith('rifttask-pty-smoke-')) throw new Error('INJECTED_TEMP_CLEANUP_FAILURE:' + 'x'.repeat(131072) + ':END');
      return rm.call(this,target,options);
    };` : ''}
  `);
  return {root, preload, scratch};
}
function invoke(f, args = [cli,f.root,process.platform,process.arch], timeout = 4000) {
  return spawnSync(process.execPath,['--require',f.preload,...args],{
    encoding:'utf8',timeout,maxBuffer:1024*1024,
    env:{...process.env,TMPDIR:f.scratch,TMP:f.scratch,TEMP:f.scratch}
  });
}
function exited(result, status) {
  assert.equal(result.error,undefined,`CLI must exit before parent timeout: ${result.error?.code}; stdout=${result.stdout?.slice(-200)}; stderr=${result.stderr?.slice(-200)}`);
  assert.equal(result.signal,null);
  assert.equal(result.status,status);
}

for (const [name,options,diagnostic] of [
  ['wrong Electron version',{version:'44.0.0'},/requires Electron 45\.0\.0, got 44\.0\.0\.\n$/],
  ['missing native module',{missing:true},/Cannot find module/],
  ['temporary directory cleanup failure',{cleanupFailure:true},/INJECTED_TEMP_CLEANUP_FAILURE:x{131072}:END\n$/]
]) {
  test(`smoke CLI exits nonzero for ${name} despite a retained parent handle`, {skip:process.platform !== 'linux'}, t => {
    const f = fixture(t,options);
    const result = invoke(f);
    assert.equal(result.stdout,'','failure must never print verified success');
    assert.match(result.stderr,diagnostic,'complete final stderr must be flushed');
    exited(result,1);
  });
}

test('smoke CLI never verifies a surviving shell PID', {skip:process.platform !== 'linux'}, t => {
  // Real shell exits, but inject a live PID to fault the cleanup observation.
  // This never targets another process: isAlive only probes, it does not kill.
  const f = fixture(t,{survivingPid:true});
  const result = invoke(f,undefined,10000);
  assert.equal(result.stdout,'');
  assert.match(result.stderr,/PTY shell PID survived exit\. stage=CLEANUP/);
  assert.deepEqual(fs.readdirSync(f.scratch),[]);
  exited(result,1);
});

test('imported smoke library returns without terminating its caller', {skip:process.platform !== 'linux'}, t => {
  const f = fixture(t);
  const script = `
    require(${JSON.stringify(cli)}).smoke({root:${JSON.stringify(f.root)},platform:process.platform,arch:process.arch}).then(result => {
      console.log(JSON.stringify(result));
      setTimeout(() => { console.log('CALLER_STILL_ALIVE'); clearInterval(globalThis.smokeTestHandle); },50);
    }).catch(error => { console.error(error); process.exit(1); });
  `;
  const result = invoke(f,['-e',script]);
  exited(result,0);
  assert.equal(result.stdout,verified.slice(verified.indexOf('{')) + 'CALLER_STILL_ALIVE\n');
  assert.equal(result.stderr,'');
  assert.deepEqual(fs.readdirSync(f.scratch),[]);
});

test('smoke CLI rejects a failed stdout flush to a real closed pipe', {skip:process.platform !== 'linux', timeout:6000}, async t => {
  const f = fixture(t);
  const child = spawn(process.execPath,['--require',f.preload,cli,f.root,process.platform,process.arch],{
    stdio:['ignore','pipe','pipe'],
    env:{...process.env,TMPDIR:f.scratch,TMP:f.scratch,TEMP:f.scratch}
  });
  // Close the real reader before the PTY finishes; do not mock stdout.write.
  child.stdout.destroy();
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data',data => { stderr += data; });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); },4000);
  let result;
  try {
    result = await new Promise((resolve,reject) => {
      child.once('error',reject);
      child.once('close',(status,signal) => resolve({status,signal}));
    });
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
  assert.equal(timedOut,false,'closed stdout must not leave the retained handle running');
  assert.equal(result.signal,null);
  assert.equal(result.status,1,'failed final stdout flush must never report success');
  assert.equal(stderr,'','the write callback handles the pipe failure without an unhandled stream error');
  assert.deepEqual(fs.readdirSync(f.scratch),[],'temporary smoke directory removed before final write');
});

test('smoke CLI exits after all five real PTY checks despite a retained parent handle', {skip:process.platform !== 'linux'}, t => {
  const f = fixture(t);
  const result = invoke(f);
  assert.equal(result.stdout,verified,'complete final stdout must be flushed');
  assert.equal(result.stderr,'');
  assert.deepEqual(fs.readdirSync(f.scratch),[],'temporary smoke directory removed before success');
  exited(result,0);
});
