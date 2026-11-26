const {getDefaultConfig}=require('expo/metro-config');
const path=require('path');

const projectRoot=__dirname;
const root=path.resolve(projectRoot,'../..');

const config=getDefaultConfig(projectRoot);
config.watchFolders=[root];
config.resolver.nodeModulesPaths=[path.resolve(projectRoot,'node_modules'),path.resolve(root,'node_modules')];
// Visual-QA only (web preview with a symlinked node_modules): resolve the workspace package by path.
if(process.env.EXPO_PUBLIC_MOCK==='1'){
  config.resolver.extraNodeModules={'@booqi/business-shared':path.resolve(root,'packages/shared/src')};
}

module.exports=config;
