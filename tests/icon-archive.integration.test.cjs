'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');
const root = path.resolve(__dirname, '..');

// Supply any real packaged app.asar; this never fabricates an archive fixture.
test('real package contains the BrowserWindow icon and browser favicon', {skip: !process.env.RIFT_ICON_ARCHIVE}, () => {
  const archive = process.env.RIFT_ICON_ARCHIVE;
  for (const [target, source] of [['build/icon.png', 'build/icon.png'], ['dist/icon.svg', 'public/icon.svg']]) {
    assert.deepEqual(asar.extractFile(archive, target), fs.readFileSync(path.join(root, source)), target);
  }
  const html = asar.extractFile(archive, 'dist/index.html').toString();
  assert.match(html, /rel="icon"[^>]*href="\.\/icon\.svg"/);
  assert.match(asar.extractFile(archive, 'desktop/main.cjs').toString(), /icon:path\.join\(__dirname,'\.\.','build','icon\.png'\)/);
});
