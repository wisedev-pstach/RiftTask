'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');

test('browser and native packages share the original RiftTask icon', () => {
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /rel="icon"[^>]*href="(?:\.\/|\/)icon\.svg"/);
  assert.equal(pkg.build.mac.icon, 'build/icon.icns');
  assert.equal(pkg.build.win.icon, 'build/icon.ico');
  assert.equal(pkg.build.linux.icon, 'build/icon.png');
  assert.ok(pkg.build.files.includes('build/icon.png'));
  assert.deepEqual(fs.readFileSync(path.join(root, 'public/icon.svg')), fs.readFileSync(path.join(root, 'build/icon.svg')));
  const main = fs.readFileSync(path.join(root, 'desktop/main.cjs'), 'utf8');
  assert.match(main, /icon:path\.join\(__dirname,'\.\.','build','icon\.png'\)/);
});
