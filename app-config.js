/* Warpvio V1 customization state and validation. Browser-only draft, NOT an export entitlement. */
(function(global){
'use strict';
const KEY='warpvio_v1_customization';
const RESULT='warpvio_v1_result';
const PLATFORM_LIST=['Windows','Android','macOS'];
const THEMES=['system','light','dark'];
const COLORS={blue:'#3478f6',violet:'#825df5',mint:'#168f91',rose:'#d85f89'};
const SIZE_OPTIONS=['standard','compact'];
const ORIENTATIONS=['auto','portrait'];

function result(){
  try {
    const r=JSON.parse(sessionStorage.getItem(RESULT)||'null');
    if(!r||r.version!==1||!Array.isArray(r.checks)||typeof r.finalUrl!=='string')return null;
    const u=new URL(r.finalUrl);
    if(!['http:','https:'].includes(u.protocol))return null;
    const platforms=[...new Set((Array.isArray(r.platforms)?r.platforms:[]).filter(p=>PLATFORM_LIST.includes(p)))];
    if(!platforms.length)return null;
    return {...r,platforms};
  }catch{return null}
}
function defaultName(r){
  const host=new URL(r.finalUrl).hostname.replace(/^www\./,'').split('.')[0]||'My App';
  const raw=(typeof r.title==='string'?r.title:'').split(/\s[|—–]\s/)[0].trim();
  return (raw||host).slice(0,36);
}
function fresh(r){
  return {
    version:1,
    site:r.finalUrl,
    name:defaultName(r),
    accent:'blue',
    theme:'system',
    iconData:null,
    activePlatform:r.platforms[0],
    windowsSize:'standard',
    macSize:'standard',
    androidOrientation:'auto'
  };
}
function normalize(x,r){
  const base=fresh(r);
  if(!x||typeof x!=='object'||x.version!==1||x.site!==r.finalUrl)return base;
  const name=typeof x.name==='string'?x.name.trim().replace(/\s+/g,' ').slice(0,36):base.name;
  const icon=typeof x.iconData==='string'&&/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(x.iconData)&&x.iconData.length<1600000?x.iconData:null;
  return {
    version:1,site:r.finalUrl,
    name:name||base.name,
    accent:Object.hasOwn(COLORS,x.accent)?x.accent:'blue',
    theme:THEMES.includes(x.theme)?x.theme:'system',
    iconData:icon,
    activePlatform:r.platforms.includes(x.activePlatform)?x.activePlatform:r.platforms[0],
    windowsSize:SIZE_OPTIONS.includes(x.windowsSize)?x.windowsSize:'standard',
    macSize:SIZE_OPTIONS.includes(x.macSize)?x.macSize:'standard',
    androidOrientation:ORIENTATIONS.includes(x.androidOrientation)?x.androidOrientation:'auto'
  };
}
function load(r){try{return normalize(JSON.parse(sessionStorage.getItem(KEY)||'null'),r)}catch{return fresh(r)}}
function save(state,r){
  const safe=normalize(state,r);
  sessionStorage.setItem(KEY,JSON.stringify(safe));
  return safe;
}
function price(platforms){
  if(platforms.length===3)return 39;
  return platforms.reduce((sum,p)=>sum+({Windows:15,Android:19,macOS:19}[p]||0),0);
}
function iconLetter(name){
  const text=String(name||'App').trim();
  return Array.from(text)[0]?.toUpperCase()||'A';
}
global.WarpvioConfig={result,load,save,fresh,normalize,price,iconLetter,COLORS,KEY};
})(window);
