'use strict';
const fs=require('node:fs');const path=require('node:path');
// Runs before signing. npm's tarball ships prebuilt mac helpers without +x.
module.exports=async function afterPack({electronPlatformName,appOutDir,packager}){
 if(electronPlatformName!=='darwin')return;
 const root=path.join(appOutDir,packager.appInfo.productFilename+'.app','Contents','Resources','app.asar.unpacked','node_modules','node-pty');
 for(const relative of ['build/Release/spawn-helper','prebuilds/darwin-arm64/spawn-helper','prebuilds/darwin-x64/spawn-helper']){
  const file=path.join(root,relative);if(fs.existsSync(file))fs.chmodSync(file,0o755);
 }
};
