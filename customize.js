(function(){
'use strict';
const tool=window.WarpvioConfig;
const r=tool?.result();
const empty=document.getElementById('no-result');
const editor=document.getElementById('editor');
if(!r){empty.hidden=false;return;}
editor.hidden=false;
let state=tool.load(r);
const nameInput=document.getElementById('app-name');
const iconInput=document.getElementById('upload-icon');
const errorBox=document.getElementById('form-error');
const iconError=document.getElementById('icon-error');
const themeArea=document.getElementById('preview-inner');
const DESKTOP=['Windows','macOS'];
const nameLabel=()=>{
  const text=state.name.trim();
  return text||'Your app';
};
const hostname=(()=>{try{return new URL(r.finalUrl).hostname.replace(/^www\./,'')}catch{return 'your website'}})();
document.getElementById('source-url').textContent=hostname;
nameInput.value=state.name;
document.getElementById('name-count').textContent=String(nameInput.value.length);
document.getElementById('windows-size').value=state.windowsSize;
document.getElementById('mac-size').value=state.macSize;
document.getElementById('android-orientation').value=state.androidOrientation;
function message(el,text){el.textContent=text;el.hidden=!text;}
function persist(){
  try{tool.save(state,r);message(errorBox,'');return true}
  catch{message(errorBox,'This browser cannot save your settings. Try enabling site storage, then edit again.');return false}
}
function avatar(image,source,name){
  const holder=image.closest('[data-avatar]')||document.getElementById('editor-icon');
  const text=holder.querySelector('span');
  if(text)text.textContent=tool.iconLetter(name);
  holder.classList.remove('has-image');
  image.onerror=()=>{holder.classList.remove('has-image');image.removeAttribute('src')};
  image.onload=()=>holder.classList.add('has-image');
  if(source){image.src=source}
  else image.removeAttribute('src');
}
function renderIcon(){
  const imageSource=state.iconData||r.favicon||null;
  avatar(document.getElementById('editor-icon-image'),imageSource,nameLabel());
  document.querySelectorAll('[data-avatar-img]').forEach(img=>avatar(img,imageSource,nameLabel()));
  document.getElementById('reset-icon').hidden=!state.iconData;
}
function render(){
  const accent=tool.COLORS[state.accent];
  const n=nameLabel();
  document.querySelectorAll('[data-app-label]').forEach(e=>e.textContent=n);
  document.querySelectorAll('[data-site-url]').forEach(e=>e.textContent=hostname);
  document.getElementById('desktop-app-label').textContent=n;
  document.getElementById('preview-platform-label').textContent=state.activePlatform+' · Concept';
  themeArea.dataset.theme=state.theme;
  const onMobile=state.activePlatform==='Android';
  document.getElementById('mock-desktop').hidden=onMobile;
  document.getElementById('mock-phone').hidden=!onMobile;
  document.querySelectorAll('[data-avatar]').forEach(e=>e.style.background=
    'linear-gradient(145deg,'+accent+',#8d60f7)');
  document.getElementById('editor-icon').style.background='linear-gradient(145deg,'+accent+',#8d60f7)';
  document.querySelectorAll('[data-preview-progress]').forEach(e=>e.style.background=accent);
  document.querySelectorAll('[data-avatar] span').forEach(e=>e.textContent=tool.iconLetter(n));
  document.getElementById('editor-icon').querySelector('span').textContent=tool.iconLetter(n);
  document.querySelectorAll('[data-accent]').forEach(b=>{
    b.setAttribute('aria-pressed',String(b.dataset.accent===state.accent));
    b.textContent=b.dataset.accent===state.accent?'✓':'';
  });
  document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===state.theme)));
  document.getElementById('windows-settings').hidden=state.activePlatform!=='Windows';
  document.getElementById('mac-settings').hidden=state.activePlatform!=='macOS';
  document.getElementById('android-settings').hidden=state.activePlatform!=='Android';
  document.querySelectorAll('[data-active-platform]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.activePlatform===state.activePlatform)));
}
const tabs=document.getElementById('platform-tabs');
for(const platform of r.platforms){
  const tab=document.createElement('button');
  tab.type='button';
  tab.className='platform-tab';
  tab.dataset.activePlatform=platform;
  tab.textContent=platform;
  tab.addEventListener('click',()=>{
    state.activePlatform=platform;
    render();
    persist();
  });
  tabs.append(tab);
}
nameInput.addEventListener('input',()=>{
  state.name=nameInput.value.slice(0,36);
  document.getElementById('name-count').textContent=String(nameInput.value.length);
  nameInput.removeAttribute('aria-invalid');
  render();
  if(state.name.trim())persist();
});
nameInput.addEventListener('blur',()=>{
  if(state.name.trim()) {
    state.name=state.name.trim().replace(/\s+/g,' ');
    nameInput.value=state.name;
    persist();render();
  }
});
document.querySelectorAll('[data-accent]').forEach(b=>b.addEventListener('click',()=>{
  state.accent=b.dataset.accent;
  render();persist();
}));
document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>{
  state.theme=b.dataset.theme;
  render();persist();
}));
for(const [id,key] of [['windows-size','windowsSize'],['mac-size','macSize'],['android-orientation','androidOrientation']]){
  document.getElementById(id).addEventListener('change',e=>{state[key]=e.target.value;persist()});
}
async function prepareImage(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a PNG, JPG or WebP image.');
  if(file.size>4*1024*1024)throw new Error('Icon file must be smaller than 4 MB.');
  const objectURL=URL.createObjectURL(file);
  try{
    const img=new Image();
    await new Promise((resolve,reject)=>{
      img.onload=resolve;
      img.onerror=()=>reject(new Error('This image could not be opened. Choose another file.'));
      img.src=objectURL;
    });
    if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth>7000||img.naturalHeight>7000)throw new Error('Image dimensions are not supported.');
    const canvas=document.createElement('canvas');
    canvas.width=256;canvas.height=256;
    const context=canvas.getContext('2d');
    if(!context)throw new Error('Image editing is unavailable in this browser.');
    const size=Math.min(img.naturalWidth,img.naturalHeight);
    context.drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,256,256);
    const output=canvas.toDataURL('image/png');
    if(!/^data:image\/png;base64,/.test(output)||output.length>1500000)throw new Error('Icon preview is too large. Try a smaller image.');
    return output;
  }finally{URL.revokeObjectURL(objectURL)}
}
iconInput.addEventListener('change',async e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  iconInput.disabled=true;message(iconError,'');
  try{
    const previous=state.iconData;
    state.iconData=await prepareImage(file);
    renderIcon();render();
    if(!persist()){
      state.iconData=previous;renderIcon();render();
      throw new Error('Could not save the new icon in this browser. Try another image.');
    }
  }catch(err){message(iconError,String(err.message||'Could not use this image.'))}
  finally{iconInput.value='';iconInput.disabled=false}
});
document.getElementById('reset-icon').addEventListener('click',()=>{
  state.iconData=null;message(iconError,'');renderIcon();render();persist()
});
document.getElementById('custom-form').addEventListener('submit',event=>{
  event.preventDefault();
  const normalized=nameInput.value.trim().replace(/\s+/g,' ');
  if(normalized.length<2){
    message(errorBox,'Enter an app name with at least 2 characters.');
    nameInput.setAttribute('aria-invalid','true');nameInput.focus();return;
  }
  state.name=normalized;
  nameInput.value=normalized;
  if(!persist())return;
  location.assign('./preview.html');
});
renderIcon();render();
persist();
})();