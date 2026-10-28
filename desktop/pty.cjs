'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');

// In-memory only. The resolver is main-process owned; never accept a renderer cwd
// or executable. A nonce is required for every operation on a started shell.
function createPty({resolve, spawn = (...args) => require('node-pty').spawn(...args)}) {
  const sessions = new Map();
  let epoch = 0, closed = false, pending = 0;
  const same = (s, scope) => s.account === scope.account && s.path === scope.path &&
    s.directory === scope.directory && s.inode === scope.inode;
  const snapshot = s => ({id:s.id, output:s.output, revision:s.revision, running:s.running});

  function remove(project) {
    const s = sessions.get(project);
    if (!s) return;
    // Invalidate before kill: native callbacks can arrive during/after teardown.
    sessions.delete(project);
    try {s.child.kill();} catch {}
  }
  async function scopeFor(project) {
    if (pending >= 16) throw new Error('Terminal busy: request limit reached.');
    pending++;
    const version = epoch;
    let scope;
    try {
      scope = await resolve(project);
      if (closed || epoch !== version) throw new Error('Terminal sessions closed.');
      if (typeof scope.path !== 'string' || !path.isAbsolute(scope.path) || /[\0\r\n]/.test(scope.path)) {
        throw new Error('Invalid directory.');
      }
      const stat = fs.statSync(scope.path);
      if (!stat.isDirectory()) throw new Error('Invalid directory.');
      scope = {...scope, directory:fs.realpathSync(scope.path), inode:`${stat.dev}:${stat.ino}`};
    } catch {
      if (epoch === version) remove(project);
      if (closed || epoch !== version) throw new Error('Terminal sessions closed.');
      throw new Error('Terminal session scope or local directory is unavailable.');
    } finally {pending--;}
    const s = sessions.get(project);
    if (s && !same(s, scope)) remove(project);
    return scope;
  }
  async function current(project, id) {
    await scopeFor(project);
    const s = sessions.get(project);
    if (!s || s.id !== id) throw new Error('Terminal session is no longer available.');
    return s;
  }
  function budget(s) {
    if (Date.now() - s.window >= 1000) {
      s.window = Date.now();s.inputBytes = 0;s.outputBytes = 0;
    }
  }
  return {
    async start(project) {
      const version = epoch;
      const scope = await scopeFor(project);
      if (closed || epoch !== version) throw new Error('Terminal sessions closed.');
      const old = sessions.get(project);
      if (old) return snapshot(old);
      if (sessions.size >= 4) throw new Error('Terminal session limit reached (4). Close a session first.');
      if (!path.isAbsolute(scope.path) || !fs.statSync(scope.path).isDirectory()) {
        throw new Error('Choose an existing local directory.');
      }
      const windows = process.platform === 'win32';
      // Construct an allowlist, not a token-name denylist. No inherited app
      // tokens, SSH agent socket, preload variables, shell functions or hooks.
      const env = {
        PATH:windows ? 'C:\\Windows\\System32;C:\\Windows' : '/usr/local/bin:/usr/bin:/bin',
        TERM:'xterm-256color', LANG:'en_US.UTF-8'
      };
      for (const key of windows ? ['SystemRoot','WINDIR','USERPROFILE'] : ['HOME','USER','LOGNAME']) {
        if (process.env[key]) env[key] = process.env[key];
      }
      const child = spawn(
        windows ? 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' : '/bin/bash',
        windows ? ['-NoLogo','-NoProfile'] : ['--noprofile','--norc'],
        {cwd:scope.path, env, name:'xterm-256color', cols:80, rows:24}
      );
      const s = {...scope, id:randomUUID(), child, output:'', revision:0, running:true,
        window:Date.now(), inputBytes:0, outputBytes:0};
      sessions.set(project, s);
      child.onData(data => {
        if (sessions.get(project) !== s) return;
        budget(s);
        s.outputBytes += Buffer.byteLength(data);
        if (s.outputBytes > 1048576) {remove(project);return;}
        s.output = (s.output + data).slice(-65536);
        s.revision++;
      });
      child.onExit(() => {
        if (sessions.get(project) !== s) return;
        s.running = false;s.revision++;
      });
      return snapshot(s);
    },
    async read(project, id) {return snapshot(await current(project, id));},
    async input(project, id, data) {
      if (typeof data !== 'string' || Buffer.byteLength(data) > 4096) throw new Error('Invalid terminal input.');
      const s = await current(project, id);
      if (!s.running) throw new Error('Terminal session has exited.');
      budget(s);
      s.inputBytes += Buffer.byteLength(data);
      if (s.inputBytes > 65536) throw new Error('Terminal input rate limit.');
      s.child.write(data);
    },
    async resize(project, id, cols, rows) {
      if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || cols > 300 || rows < 2 || rows > 100) {
        throw new Error('Invalid terminal size.');
      }
      (await current(project, id)).child.resize(cols, rows);
    },
    async close(project, id) {await current(project, id);remove(project);},
    async audit() {
      for (const project of sessions.keys()) {
        try {await scopeFor(project);} catch {remove(project);}
      }
    },
    reset() {epoch++;for (const project of sessions.keys()) remove(project);},
    dispose() {closed = true;epoch++;for (const project of sessions.keys()) remove(project);}
  };
}
module.exports = {createPty};
