(function(){
'use strict';
const api=window.WarpvioConfig;
const result=api?.result();
const empty=document.getElementById('no-preview');
const review=document.getElementById('review');
let saved=null;
try{saved=sessionStorage.getItem(api.KEY)}catch{}
if(!result||!saved){empty.hidden=false;return;}
const config=api.load(result);
review.hidden=false;
const host=(()=>{try{return new URL(result.finalUrl).hostname.replace(/^www\./,'')}catch{return 'your website'}})();
const text=(id,value)=>{document.getElementById(id).textContent=String(value)};
const accent=api.COLORS[config.accent];
text('source-url',host);
text('review-url',host);
text('review-name',config.name);
text('review-platforms',result.platforms.join(' · '));
text('review-theme',config.theme==='system'?'Follow device':config.theme==='dark'?'Dark':'Light');
text('review-accent',config.accent[0].toUpperCase()+config.accent.slice(1));
text('review-price','$'+api.price(result.platforms));
for(const [platform,row,valueId,value] of [
  ['Windows','windows-review-row','windows-review',config.windowsSize==='compact'?'Compact · 960 × 700':'Standard · 1200 × 800'],
  ['macOS','mac-review-row','mac-review',config.macSize==='compact'?'Compact · 960 × 700':'Standard · 1200 × 800'],
  ['Android','android-review-row','android-review',config.androidOrientation==='portrait'?'Portrait preferred':'Follow device']
]){
  if(result.platforms.includes(platform)){document.getElementById(row).hidden=false;text(valueId,value)}
}
const imageSrc=config.iconData||result.favicon||null;
function setAvatar(holder){
  if(!holder)return;
  holder.style.background='linear-gradient(145deg,'+accent+',#8d60f7)';
  const letter=holder.querySelector('span');
  if(letter)letter.textContent=api.iconLetter(config.name);
  const image=holder.querySelector('img');
  if(!image)return;
  holder.classList.remove('has-image');
  image.onerror=()=>holder.classList.remove('has-image');
  image.onload=()=>holder.classList.add('has-image');
  if(imageSrc)image.src=imageSrc;
}
setAvatar(document.getElementById('review-avatar'));
document.querySelectorAll('[data-avatar]').forEach(setAvatar);
text('desktop-app-label',config.name);
document.querySelectorAll('[data-app-label]').forEach(e=>e.textContent=config.name);
document.querySelectorAll('[data-site-url]').forEach(e=>e.textContent=host);
document.querySelectorAll('[data-preview-progress]').forEach(e=>e.style.background=accent);
document.getElementById('preview-inner').dataset.theme=config.theme;
const tabs=document.getElementById('platform-tabs');
for(const platform of result.platforms){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=platform;
  button.className='platform-tab';
  button.dataset.platform=platform;
  button.addEventListener('click',()=>select(platform));
  tabs.append(button);
}
function select(platform){
  if(!result.platforms.includes(platform))return;
  document.getElementById('mock-desktop').hidden=platform==='Android';
  document.getElementById('mock-phone').hidden=platform!=='Android';
  tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.platform===platform)));
}
select(config.activePlatform);
})();