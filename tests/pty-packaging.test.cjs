'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const config=require('../package.json');
test('mac packaging marks unpacked spawn-helper executable before signing',async t=>{
 const fs=require('node:fs'),path=require('node:path');const root=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'rift-pack-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const helper=path.join(root,'RiftTask.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper');fs.mkdirSync(path.dirname(helper),{recursive:true});fs.writeFileSync(helper,'fixture',{mode:0o644});
 await require('../desktop/pty-packaging.cjs')({electronPlatformName:'darwin',appOutDir:root,packager:{appInfo:{productFilename:'RiftTask'}}});assert.equal(fs.statSync(helper).mode&0o111,0o111);
});
test('packaging explicitly rebuilds native dependencies and unpacks PTY binaries/helpers outside asar',()=>{
 assert.equal(config.build.npmRebuild,true);assert.ok(config.build.asarUnpack.includes('node_modules/node-pty/**/*'));assert.equal(config.scripts['native:rebuild'],'electron-builder install-app-deps');
});
