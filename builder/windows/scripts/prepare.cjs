'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  validateWebsiteUrl,
  validateAppName,
  validateAccent,
  validateSize,
  makeAppId
} = require('../app/security.cjs');
const { createPng, isValidPng256, pngToIco } = require('./icon.cjs');

function parseArgs(argv) {
  const accepted = new Set(['url','name','accent','size','icon']);
  const args = {};
  for(let index=0;index<argv.length;index+=2) {
    const key=argv[index];
    const value=argv[index+1];
    if (!key || !key.startsWith('--') || !accepted.has(key.slice(2)) ||
        value===undefined || value.startsWith('--') || args[key.slice(2)]!==undefined) {
      throw new Error('Invalid arguments. Use --url, --name, --accent, --size and optional --icon.');
    }
    args[key.slice(2)]=value;
  }
  return args;
}

function projectConfiguration(input,baseDir=path.resolve(__dirname,'..')) {
  const url=validateWebsiteUrl(input.url);
  const name=validateAppName(input.name);
  const accentKey=input.accent||'blue';
  const hex=validateAccent(accentKey);
  const sizeKey=input.size||'standard';
  const windowSize=validateSize(sizeKey);
  const appId=makeAppId(url);
  const initial=Array.from(name.toUpperCase()).find(letter=>/^[A-Z0-9]$/.test(letter))||'W';

  let iconPng;
  if(input.icon) {
    const iconPath=path.resolve(input.icon);
    if(!fs.statSync(iconPath).isFile())throw new Error('Custom icon is not a regular PNG file.');
    iconPng=fs.readFileSync(iconPath);
    if(!isValidPng256(iconPng))throw new Error('Custom icon must be a 256×256 PNG.');
  } else {
    iconPng=createPng(hex,initial);
  }

  const appConfig={
    schemaVersion:1,
    appName:name,
    appId,
    websiteUrl:url,
    accentColor:hex,
    windowSize: {width:windowSize.width,height:windowSize.height},
    source:'Warpvio manual developer QA build'
  };

  const builderConfig={
    appId,
    productName:name,
    asar:true,
    compression:'normal',
    directories:{output:'dist'},
    files:[
      'app/main.cjs',
      'app/security.cjs',
      'app/offline.html',
      'app/generated-config.json',
      'assets/icon.png',
      'assets/icon.ico'
    ],
    win:{
      target:[{target:'nsis',arch:['x64']}],
      icon:'assets/icon.ico'
    },
    nsis:{
      oneClick:false,
      allowToChangeInstallationDirectory:true,
      createDesktopShortcut:true,
      createStartMenuShortcut:true,
      shortcutName:name
    },
    artifactName:'${productName}-QA-Setup-${version}-${arch}.${ext}'
  };

  fs.mkdirSync(path.join(baseDir,'app'),{recursive:true});
  fs.mkdirSync(path.join(baseDir,'assets'),{recursive:true});
  fs.writeFileSync(path.join(baseDir,'app','generated-config.json'),JSON.stringify(appConfig,null,2)+'\n',{flag:'w',mode:0o600});
  fs.writeFileSync(path.join(baseDir,'assets','icon.png'),iconPng);
  fs.writeFileSync(path.join(baseDir,'assets','icon.ico'),pngToIco(iconPng));
  fs.writeFileSync(path.join(baseDir,'build-config.json'),JSON.stringify(builderConfig,null,2)+'\n');

  return {config:appConfig,builderConfig,files:['app/generated-config.json','assets/icon.png','assets/icon.ico','build-config.json']};
}

if(require.main===module){
  try{
    const args=parseArgs(process.argv.slice(2));
    const input={
      url:args.url||process.env.APP_URL,
      name:args.name||process.env.APP_NAME||'Warpvio Demo',
      accent:args.accent||process.env.APP_ACCENT||'blue',
      size:args.size||process.env.APP_SIZE||'standard',
      icon:args.icon||process.env.APP_ICON_FILE||undefined
    };
    const output=projectConfiguration(input);
    console.log('Windows QA configuration written.');
    console.log('App:',output.config.appName);
    console.log('Website:',output.config.websiteUrl);
    console.log('App ID:',output.config.appId);
    console.log('Export: unsigned Windows x64 NSIS setup (manual QA only).');
  }catch(error){
    console.error('Failed to prepare Windows app:',error.message);
    process.exitCode=1;
  }
}

module.exports={parseArgs,projectConfiguration};
