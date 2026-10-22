'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {validateWebsiteUrl,validateAppName,validateAccent,validateSize,makeAppId}=require('../../windows/app/security.cjs');
const {createPng,isValidPng256}=require('../../windows/scripts/icon.cjs');

function parseArgs(argv) {
  const allowed=new Set(['url','name','accent','size','icon']);
  const args={};
  if(argv.length%2!==0)throw Error('Every argument must have a value.');
  for(let i=0;i<argv.length;i+=2){
    const key=argv[i],value=argv[i+1];
    if(!key?.startsWith('--')||!allowed.has(key.slice(2))||!value||value.startsWith('--')||Object.hasOwn(args,key.slice(2)))throw Error('Invalid, unknown or duplicate option.');
    args[key.slice(2)]=value;
  }
  return args;
}
function prepareApp(input,root=path.resolve(__dirname,'..')){
  const websiteUrl=validateWebsiteUrl(input.url);
  const appName=validateAppName(input.name);
  const accentColor=validateAccent(input.accent||'blue');
  const size=validateSize(input.size||'standard');
  const appId=makeAppId(websiteUrl);
  const initial=Array.from(appName.toUpperCase()).find(x=>/^[A-Z0-9]$/.test(x))||'W';
  let png;
  if(input.icon){
    const p=path.resolve(input.icon);
    const stat=fs.statSync(p);
    if(!stat.isFile()||stat.size>4*1024*1024)throw Error('Icon must be a PNG file under 4 MB.');
    png=fs.readFileSync(p);
    if(!isValidPng256(png))throw Error('Icon must be a 256×256 PNG.');
  }else{
    png=createPng(accentColor,initial);
  }
  const config={
    schemaVersion:1,
    appName,appId,websiteUrl,accentColor,
    windowSize:{width:size.width,height:size.height},
    source:'Warpvio developer QA macOS build; no paid export'
  };
  const manifest={
    appId,productName:appName,
    asar:true,compression:'normal',
    directories:{output:'dist'},
    files:['app/main.cjs','app/security.cjs','app/offline.html','app/generated-config.json','assets/icon.png','assets/icon.icns'],
    mac:{
      category:'public.app-category.productivity',
      target:['dmg'],
      icon:'assets/icon.icns',
      identity:null,
      hardenedRuntime:false
    },
    dmg:{title:'${productName} QA',sign:false},
    artifactName:'${productName}-QA-${version}-${arch}.${ext}'
  };
  const appDir=path.join(root,'app'),assets=path.join(root,'assets');
  fs.mkdirSync(appDir,{recursive:true});
  fs.mkdirSync(assets,{recursive:true});
  const shared=path.resolve(__dirname,'..','..','windows','app');
  for(const name of ['main.cjs','security.cjs','offline.html']){
    fs.copyFileSync(path.join(shared,name),path.join(appDir,name));
  }
  fs.writeFileSync(path.join(appDir,'generated-config.json'),JSON.stringify(config,null,2)+'\n',{mode:0o600});
  fs.writeFileSync(path.join(assets,'icon.png'),png);
  fs.writeFileSync(path.join(root,'build-config.json'),JSON.stringify(manifest,null,2)+'\n');
  return {config,manifest,iconBytes:png.length};
}
if(require.main===module){
  try{
    const a=parseArgs(process.argv.slice(2));
    const v=prepareApp({
      url:a.url||process.env.APP_URL,
      name:a.name||process.env.APP_NAME||'Warpvio QA Demo',
      accent:a.accent||process.env.APP_ACCENT||'blue',
      size:a.size||process.env.APP_SIZE||'standard',
      icon:a.icon||process.env.APP_ICON_FILE||undefined
    });
    console.log('macOS app prepared:',v.config.appName,'origin:',new URL(v.config.websiteUrl).origin);
    console.log('Unsigned DMG QA only; no code signing, notarization or live downloads.');
  }catch(e){console.error('Mac QA setup failed: '+e.message);process.exitCode=1}
}
module.exports={parseArgs,prepareApp};
