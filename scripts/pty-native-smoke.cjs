'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {setTimeout:delay} = require('node:timers/promises');

async function smoke({root, platform, arch}) {
  if (process.platform !== platform || process.arch !== arch) throw new Error(`Runtime architecture mismatch: expected ${platform}-${arch}, got ${process.platform}-${process.arch}. Install matching Node/Electron.`);
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rifttask-pty-smoke-'));
  let child; let exited = false; let output = '';
  const env = {};
  for (const key of ['PATH','HOME','USERPROFILE','SystemRoot','WINDIR','TEMP','TMP','TMPDIR']) if (process.env[key]) env[key] = process.env[key];
  try {
    const pty = require(path.join(root,'node_modules/node-pty'));
    const windows = platform === 'win32';
    const shell = windows ? path.join(process.env.SystemRoot || 'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe') : '/bin/sh';
    child = pty.spawn(shell, windows ? ['-NoLogo','-NoProfile'] : [], {cwd, env, cols:80, rows:24, name:'xterm-256color'});
    child.onData(data => { output = (output + data).slice(-65536); });
    child.onExit(() => { exited = true; });
    async function expect(marker) {
      const end = Date.now() + 10000;
      while (Date.now() < end) {
        const clean = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/\r/g,'');
        if (clean.split('\n').some(line => line.trim() === marker)) return;
        if (exited) throw new Error(`PTY exited before ${marker}.`);
        await delay(20);
      }
      throw new Error(`PTY runtime smoke timed out waiting for ${marker}.`);
    }
    child.write(windows ? "if (-not [Console]::IsOutputRedirected) { Write-Output ([char]10+'RIFT_'+'TTY') }; $riftState='retained'; Write-Output ([char]10+'RIFT_'+'READY')\r" : "stty -echo; test -t 0 && test -t 1 && printf '\\nRIFT_%s\\n' TTY; riftState=retained; printf '\\nRIFT_%s\\n' READY\r");
    await expect('RIFT_TTY'); await expect('RIFT_READY');
    child.write(windows ? "if ($riftState -eq 'retained') { Write-Output ([char]10+'RIFT_'+'STATE') }\r" : "test \"$riftState\" = retained && printf '\\nRIFT_%s\\n' STATE\r");
    await expect('RIFT_STATE');
    child.resize(91,31);
    child.write(windows ? "if ([Console]::WindowWidth -eq 91 -and [Console]::WindowHeight -eq 31) { Write-Output ([char]10+'RIFT_'+'RESIZE') }\r" : "test \"$(stty size)\" = '31 91' && printf '\\nRIFT_%s\\n' RESIZE\r");
    await expect('RIFT_RESIZE');
    child.write('exit\r');
    const end = Date.now() + 5000;
    while (!exited && Date.now() < end) await delay(20);
    if (!exited) throw new Error('PTY did not exit cleanly.');
    for (let i=0; i<100; i++) {
      try { process.kill(child.pid,0); } catch (error) { if (error.code === 'ESRCH') return {tty:true, input:true, state:true, resize:true, cleanup:true}; throw error; }
      await delay(20);
    }
    throw new Error('PTY shell PID survived exit.');
  } finally {
    if (child && !exited) {
      try { child.kill(); } catch {}
      const end = Date.now() + 5000;
      while (!exited && Date.now() < end) await delay(20);
      if (!exited) console.error('PTY smoke cleanup could not confirm shell exit.');
    }
    fs.rmSync(cwd,{recursive:true,force:true});
  }
}
module.exports = {smoke};
if (require.main === module) {
  const [root,platform,arch] = process.argv.slice(2);
  Promise.resolve().then(() => {
    if (process.versions.electron !== '45.0.0') throw new Error(`Native installer smoke requires Electron 45.0.0, got ${process.versions.electron || 'system Node'}.`);
    return smoke({root,platform,arch});
  }).then(result => console.log(`Electron ${process.versions.electron} PTY verified: ${JSON.stringify(result)}`)).catch(error => { console.error(error.message); process.exitCode=1; });
}
