'use strict';
const {Arch} = require('builder-util');
const {validatePrebuild} = require('../scripts/prepare-native.cjs');
const originalRebuild = new WeakMap();
// beforePack runs before installAppDependencies. npmRebuild=false skips only
// compilation; beforeBuild=false also disables the production dependency collector.
module.exports = async function beforePack({electronPlatformName, arch, packager}) {
  const config = packager.config;
  if (!originalRebuild.has(config)) originalRebuild.set(config, config.npmRebuild);
  if (electronPlatformName === 'linux') {
    config.npmRebuild = originalRebuild.get(config);
    return;
  }
  validatePrebuild(packager.info.appDir, electronPlatformName, Arch[arch]);
  config.npmRebuild = false;
};
