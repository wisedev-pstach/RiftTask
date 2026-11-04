'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const config=require('../package.json');
test('mac packaging marks unpacked spawn-helper executable before signing',async t=>{
 const fs=require('node:fs'),path=require('node:path');const root=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'rift-pack-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const helper=path.join(root,'RiftTask.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper');fs.mkdirSync(path.dirname(helper),{recursive:true});fs.writeFileSync(helper,'fixture',{mode:0o644});
 await require('../desktop/pty-packaging.cjs')({electronPlatformName:'darwin',appOutDir:root,packager:{appInfo:{productFilename:'RiftTask'}}});assert.equal(fs.statSync(helper).mode&0o111,0o111);
});
test('packaging preserves Linux rebuilds, selectively skips prebuilt platforms, and unpacks native assets', async () => {
 assert.equal(config.build.npmRebuild,true);
 assert.ok(config.build.asarUnpack.includes('node_modules/node-pty/**/*'));
 assert.equal(config.scripts['native:prepare'],'node scripts/prepare-native.cjs');
 assert.equal(config.scripts['native:rebuild'],'npm run native:prepare');
 assert.equal(config.build.beforePack,'desktop/pty-before-pack.cjs');
 assert.equal(config.build.beforeBuild,undefined);
 const beforePack = require('../desktop/pty-before-pack.cjs');
 const build = {npmRebuild:true};
 await beforePack({electronPlatformName:'linux',arch:1,packager:{config:build,appDir:__dirname}});
 assert.equal(build.npmRebuild,true);
});
test('prebuilt packaging skips compilation without claiming external node_modules handling; Linux setting is restored', async () => {
 const beforePack = require('../desktop/pty-before-pack.cjs');
 const {Arch} = require('builder-util');
 const build = {npmRebuild:true};
 const packager = {config:build,info:{appDir:require('node:path').resolve(__dirname,'..')}};
 // Validate actual shipped assets; ignore the repository's Linux-only local build here.
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rift-pack-prebuild-'));
 try {
  fs.cpSync(path.join(packager.info.appDir,'node_modules/node-pty'),path.join(root,'node_modules/node-pty'),{recursive:true,filter:source=>!source.includes('/node-pty/build')});
  packager.info.appDir=root;
  for (const electronPlatformName of ['win32','darwin']) for (const arch of [Arch.x64,Arch.arm64]) {
   assert.notEqual(await beforePack({electronPlatformName,arch,packager}),false);
   assert.equal(build.npmRebuild,false);
  }
  await beforePack({electronPlatformName:'linux',arch:Arch.x64,packager});
  assert.equal(build.npmRebuild,true);
  const explicit={npmRebuild:false};
  await beforePack({electronPlatformName:'linux',arch:Arch.x64,packager:{...packager,config:explicit}});
  assert.equal(explicit.npmRebuild,false);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
