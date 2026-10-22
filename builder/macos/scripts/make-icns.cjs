'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {isValidPng256}=require('../../windows/scripts/icon.cjs');
const SIZES=[['icon_16x16.png',16],['icon_16x16@2x.png',32],['icon_32x32.png',32],['icon_32x32@2x.png',64],['icon_128x128.png',128],['icon_128x128@2x.png',256],['icon_256x256.png',256],['icon_256x256@2x.png',512],['icon_512x512.png',512],['icon_512x512@2x.png',1024]];
function iconset(pngPath,outPath){
  if(process.platform!=='darwin')throw Error('ICNS creation must run on macOS (sips + iconutil).');
  if(!isValidPng256(fs.readFileSync(pngPath)))throw Error('A 256x256 PNG is required.');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'warpvio-'));
  const destination=path.join(temp,'App.iconset');
  fs.mkdirSync(destination);
  try{
    for(const [name,size] of SIZES){
      execFileSync('sips',['-z',String(size),String(size),pngPath,'--out',path.join(destination,name)],{stdio:'pipe',timeout:20000});
    }
    fs.mkdirSync(path.dirname(outPath),{recursive:true});
    execFileSync('iconutil',['-c','icns',destination,'-o',outPath],{stdio:'pipe',timeout:20000});
    if(!fs.existsSync(outPath)||fs.statSync(outPath).size<1000)throw Error('ICNS output was not generated.');
    return outPath;
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
}
if(require.main===module){
  try{const project=path.resolve(__dirname,'..');const result=iconset(path.join(project,'assets','icon.png'),path.join(project,'assets','icon.icns'));console.log('Created macOS ICNS: '+result)}
  catch(e){console.error(e.message);process.exitCode=1}
}
module.exports={iconset,SIZES};
