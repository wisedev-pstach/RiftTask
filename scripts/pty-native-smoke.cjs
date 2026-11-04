'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {randomBytes} = require('node:crypto');
const {setTimeout:delay} = require('node:timers/promises');

function windowsShell(nonce, systemRoot = process.env.SystemRoot || 'C:\\Windows') {
  // No interactive prompt or PSReadLine: input is a tiny Console protocol, not
  // echoed PowerShell source. Frames are never present in input commands.
  const script = `
$ErrorActionPreference = 'Stop'
function Emit($stage) { [Console]::WriteLine('[RIFT:' + '${nonce}' + ':' + $stage + ']') }
if ([Console]::IsInputRedirected -or [Console]::IsOutputRedirected) { exit 11 }
Emit 'TTY'
$riftState = 'retained'
Emit 'READY'
while ($null -ne ($request = [Console]::ReadLine())) {
  switch ($request) {
    'state' { if ($riftState -eq 'retained') { Emit 'STATE' } }
    'resize' { if ([Console]::WindowWidth -eq 91 -and [Console]::WindowHeight -eq 31) { Emit 'RESIZE' } }
    'exit' { exit 0 }
    default { exit 12 }
  }
}
exit 13
`;
  return {shell:path.join(systemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'), args:['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')]};
}

// Exported transport seam: controlled foreign-protocol replay never bypasses
// smoke()'s actual runtime/architecture gate or substitutes a native binary.
async function runSession({child, windows, nonce, start = () => {}, timeoutMs = 10000, cleanupMs = 5000,
  isAlive = () => { try { process.kill(child.pid,0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } }}) {
  let exited = false; let exitCode; let output = '';
  child.onData(data => { output = (output + data).slice(-65536); });
  child.onExit(event => { exited = true; exitCode = event?.exitCode; });
  const diagnostic = stage => {
    // JSON escapes ESC/C0; additionally escape C1 and bidi controls so even a
    // failed terminal launch cannot inject control sequences into installer logs.
    const tail = JSON.stringify(output.slice(-400)).replace(/[\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4,'0')}`);
    return `stage=${stage}, exited=${exited}, exitCode=${exitCode ?? 'unknown'}, outputTail=${tail.slice(-600)}`;
  };
  async function expect(stage) {
    const marker = windows ? `[RIFT:${nonce}:${stage}]` : `RIFT_${stage}`;
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      // ConPTY is a VT stream, not line-oriented stdout. A complete nonce frame
      // survives cursor movement, CR redraws and terminal-width line wrapping.
      const clean = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/\r/g,'');
      const found = windows ? clean.replace(/\n/g,'').includes(marker) : clean.split('\n').some(line => line.trim() === marker);
      if (found) return;
      if (exited) throw new Error(`PTY exited before RIFT_${stage}. ${diagnostic(stage)}`);
      await delay(10);
    }
    throw new Error(`PTY runtime smoke timed out waiting for RIFT_${stage}. ${diagnostic(stage)}`);
  }
  try {
    start();
    if (!windows) child.write("stty -echo; test -t 0 && test -t 1 && printf '\\nRIFT_%s\\n' TTY; riftState=retained; printf '\\nRIFT_%s\\n' READY\r");
    await expect('TTY'); await expect('READY');
    child.write(windows ? 'state\r' : "test \"$riftState\" = retained && printf '\\nRIFT_%s\\n' STATE\r");
    await expect('STATE');
    child.resize(91,31);
    child.write(windows ? 'resize\r' : "test \"$(stty size)\" = '31 91' && printf '\\nRIFT_%s\\n' RESIZE\r");
    await expect('RESIZE');
    child.write('exit\r');
    const end = Date.now() + cleanupMs;
    while (!exited && Date.now() < end) await delay(10);
    if (!exited) throw new Error(`PTY did not exit cleanly. ${diagnostic('EXIT')}`);
    if (exitCode !== 0) throw new Error(`PTY shell exit was not successful. ${diagnostic('EXIT')}`);
    const pidEnd = Date.now() + cleanupMs;
    while (Date.now() < pidEnd) {
      if (!isAlive()) return {tty:true, input:true, state:true, resize:true, cleanup:true};
      await delay(10);
    }
    throw new Error(`PTY shell PID survived exit. ${diagnostic('CLEANUP')}`);
  } finally {
    if (!exited) {
      try { child.kill(); } catch {}
      const end = Date.now() + cleanupMs;
      while (!exited && Date.now() < end) await delay(10);
      if (!exited) console.error('PTY smoke cleanup could not confirm shell exit.');
    }
  }
}

async function smoke({root, platform, arch}) {
  if (process.platform !== platform || process.arch !== arch) throw new Error(`Runtime architecture mismatch: expected ${platform}-${arch}, got ${process.platform}-${process.arch}. Install matching Node/Electron.`);
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rifttask-pty-smoke-'));
  const env = {};
  for (const key of ['PATH','HOME','USERPROFILE','SystemRoot','WINDIR','TEMP','TMP','TMPDIR']) if (process.env[key]) env[key] = process.env[key];
  try {
    const pty = require(path.join(root,'node_modules/node-pty'));
    const windows = platform === 'win32';
    const nonce = randomBytes(8).toString('hex');
    const {shell,args} = windows ? windowsShell(nonce) : {shell:'/bin/sh',args:[]};
    const child = pty.spawn(shell,args,{cwd, env, cols:80, rows:24, name:'xterm-256color'});
    return await runSession({child,windows,nonce});
  } finally {
    fs.rmSync(cwd,{recursive:true,force:true});
  }
}
module.exports = {smoke, runSession, windowsShell};
if (require.main === module) {
  const [root,platform,arch] = process.argv.slice(2);
  Promise.resolve().then(() => {
    if (process.versions.electron !== '45.0.0') throw new Error(`Native installer smoke requires Electron 45.0.0, got ${process.versions.electron || 'system Node'}.`);
    return smoke({root,platform,arch});
  }).then(result => console.log(`Electron ${process.versions.electron} PTY verified: ${JSON.stringify(result)}`)).catch(error => { console.error(error.message); process.exitCode=1; });
}
