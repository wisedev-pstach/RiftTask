'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {runSession, windowsShell} = require('../scripts/pty-native-smoke.cjs');

// Synthetic ConPTY-shaped output, not a capture from the user's Windows host.
const redraw = text => `\x1b[2K\rPS> \x1b[8;1H${text.slice(0,12)}\r\n${text.slice(12)}\x1b[9;1HPS> `;
function harness(mode = 'success') {
  let data, exit; let alive = true; const writes = []; let killed = false;
  const nonce = '0123456789abcdef';
  const frame = stage => `[RIFT:${nonce}:${stage}]`;
  const child = {
    pid:12345,
    onData(fn) { data = fn; }, onExit(fn) { exit = fn; },
    write(command) {
      writes.push(command);
      if (command === 'exit\r') { if (mode !== 'cleanup') { alive = mode === 'surviving-pid'; exit({exitCode:mode === 'bad-exit' ? 5 : 0}); } return; }
      if (mode === 'echo-state') { data(command); return; }
      if (mode === 'wrong-state') { data(frame('STATE').replace(nonce,'fedcba9876543210')); return; }
      if (mode === 'exit') { alive = false; exit({exitCode:7}); return; }
      if (mode === 'echo') { data(command); return; }
      if (mode === 'truncated') { data(frame('TTY')); data(frame('READY').slice(0,-1)); return; }
      if (mode === 'stderr') { data('Write-Error: protocol failed\r\n'); return; }
      const stage = command.trim().toUpperCase();
      if (stage === 'STATE' || stage === 'RESIZE') {
        // Split even inside CSI and marker, as node-pty callbacks may do.
        const text = redraw(frame(stage)); for (const c of text) data(c);
      }
    },
    resize(cols,rows) { assert.deepEqual([cols,rows],[91,31]); },
    kill() { killed = true; alive = false; setTimeout(() => exit({exitCode:1}),5); }
  };
  const start = () => {
    if (['success','cleanup','echo-state','wrong-state','bad-exit','surviving-pid'].includes(mode)) data(redraw(frame('TTY')) + redraw(frame('READY')));
    else child.write('bootstrap\r');
  };
  return {child, nonce, start, writes, isAlive:() => alive, wasKilled:() => killed};
}

test('Windows handshake accepts framed VT redraw/wrap output without newline boundaries', async () => {
  // This is the specific legacy parser failure, independent of the new protocol.
  const legacy = redraw('RIFT_READY').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/\r/g,'');
  assert.equal(legacy.split('\n').some(line => line.trim() === 'RIFT_READY'),false);
  const h = harness();
  const result = await runSession({...h, windows:true, timeoutMs:50, cleanupMs:50});
  assert.deepEqual(result,{tty:true,input:true,state:true,resize:true,cleanup:true});
  assert.deepEqual(h.writes,['state\r','resize\r','exit\r']);
});

for (const [mode,stage] of [['echo','TTY'],['echo-state','STATE'],['wrong-state','STATE'],['truncated','READY'],['stderr','TTY'],['exit','TTY'],['cleanup','EXIT'],['bad-exit','EXIT'],['surviving-pid','CLEANUP']]) {
  test(`Windows protocol fails closed for ${mode}, with stage diagnostics and cleanup`, async () => {
    const h = harness(mode);
    await assert.rejects(runSession({...h,windows:true,timeoutMs:30,cleanupMs:30}), error => {
      assert.match(error.message,new RegExp(`stage=${stage}`));
      assert.match(error.message,/exited=(true|false), exitCode=(unknown|\d+), outputTail=/);
      assert.ok(error.message.length < 800,'bounded diagnostics');
      assert.ok(!error.message.includes('\x1b'),'VT is escaped, never rendered');
      return true;
    });
    if (!['exit','bad-exit','surviving-pid'].includes(mode)) {
      assert.equal(h.wasKilled(),true);
      assert.equal(h.isAlive(),false,'cleanup observed before rejection');
    }
  });
}

test('timeout diagnostics bound and escape terminal controls, including C1 sequences', async () => {
  const h = harness();
  // Replace startup delivery only: this is output from the owned smoke child,
  // never a dump of the parent environment or unrelated terminal sessions.
  let receive;
  h.child.onData = fn => { receive = fn; };
  await assert.rejects(runSession({...h,start:() => receive('x'.repeat(2000) + '\x9b31m\x1b[2J'),windows:true,timeoutMs:30,cleanupMs:30}), error => {
    assert.match(error.message,/stage=TTY/);
    assert.ok(!/[\x1b\x7f-\x9f]/.test(error.message),'no executable terminal controls');
    assert.ok(error.message.length < 800);
    return true;
  });
});

test('controlled real child completes Windows protocol replay and its PID is gone', async () => {
  const {spawn} = require('node:child_process');
  const nonce = 'fedcba9876543210';
  const script = `
    const readline = require('node:readline');
    const emit = stage => process.stdout.write('\\x1b[2K\\rPS> [RIFT:${nonce}:' + stage + ']\\x1b[1G');
    let state = 'retained', size = '';
    emit('TTY'); emit('READY');
    readline.createInterface({input:process.stdin}).on('line', command => {
      if (command === 'state' && state === 'retained') emit('STATE');
      else if (command.startsWith('size ')) size = command;
      else if (command === 'resize' && size === 'size 91 31') emit('RESIZE');
      else if (command === 'exit') process.exit(0);
      else process.exit(12);
    });
  `;
  const processChild = spawn(process.execPath,['-e',script],{stdio:['pipe','pipe','pipe']});
  const child = {
    pid:processChild.pid,
    onData:fn => processChild.stdout.on('data',data => fn(data.toString())),
    onExit:fn => processChild.on('exit',exitCode => fn({exitCode})),
    write:text => processChild.stdin.write(text.replace(/\r/g,'\n')),
    resize:(cols,rows) => processChild.stdin.write(`size ${cols} ${rows}\n`),
    kill:() => processChild.kill()
  };
  const result = await runSession({child,windows:true,nonce,timeoutMs:2000,cleanupMs:1000});
  assert.equal(result.cleanup,true);
  assert.throws(() => process.kill(child.pid,0),{code:'ESRCH'});
});

test('Windows uses a deterministic noninteractive Console protocol, without echoed source or profiles', () => {
  const nonce = '0123456789abcdef';
  const spec = windowsShell(nonce,'D:\\Windows');
  assert.equal(spec.shell,require('node:path').join('D:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'));
  assert.deepEqual(spec.args.slice(0,-1),['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand']);
  const script = Buffer.from(spec.args.at(-1),'base64').toString('utf16le');
  assert.match(script,/\[Console\]::ReadLine\(\)/);
  assert.match(script,/IsInputRedirected -or \[Console\]::IsOutputRedirected/);
  assert.match(script,/WindowWidth -eq 91 -and \[Console\]::WindowHeight -eq 31/);
  assert.ok(!script.includes(`[RIFT:${nonce}:READY]`),'no whole frame in source or input echo');
});
