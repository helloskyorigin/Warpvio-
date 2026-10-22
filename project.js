(()=>{
'use strict';
const config=window.WarpvioConfig;
let analysis=config?.result()||null;
let app=analysis?config.load(analysis):null;
const key='warpvio_v1_draft_secret';
const els=id=>document.getElementById(id);
let draft=null,credentials=null;

function notice(text,failed=false){
  const el=els('error-status');el.textContent=text||'';
  el.hidden=!text;
  el.style.color=failed?'#a53644':'#446ab0';
}
function safeRead(){
  try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}
}
function saveSecret(value){
  credentials=value;
  try{sessionStorage.setItem(key,JSON.stringify(value))}catch{}
}
function validSecret(x){
  return x&&/^[0-9a-f-]{36}$/i.test(x.id)&&
    typeof x.accessToken==='string'&&/^[a-zA-Z0-9_-]{43}$/.test(x.accessToken);
}
function recoveryFromHash(){
  try{
    if(!location.hash.startsWith('#id='))return null;
    const q=new URLSearchParams(location.hash.slice(1));
    const c={id:q.get('id'),accessToken:q.get('key')};
    history.replaceState(null,'',location.pathname+location.search);
    return validSecret(c)?c:null;
  }catch{return null}
}
async function api(url,options={}){
  const response=await fetch(url,{cache:'no-store',...options});
  const type=response.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw Error('Warpvio serverless API is not running on this host. Deploy the project to Vercel.');
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Request failed.');
  return data;
}
function headerAuth(){
  if(!validSecret(credentials))throw Error('Private draft access is missing.');
  return {Authorization:'Bearer '+credentials.accessToken};
}
function showReport(draftData){
  draft=draftData;
  els('missing').hidden=true;els('project').hidden=false;
  els('project-name').textContent=draft.name;
  els('project-domain').textContent=draft.site;
  els('project-plan').textContent=draft.platforms.join(' · ')+' · $'+draft.quote.totalUSD.toFixed(2)+' planned one-time export (not payable yet)';
  els('save-step').hidden=true;
  els('saved-step').hidden=false;
  els('domain-step').hidden=false;
  const verified=Boolean(draft.verification.verified);
  els('save-status').textContent=verified?'Website ownership verified · unpaid draft':
    'Saved securely · verification needed · no payment collected';
  els('txt-host').textContent=verified?'Verified':draft.verification.host;
  els('txt-value').textContent=verified?'Verified':draft.verification.value;
  els('verify').disabled=verified;
  els('copy-value').disabled=verified;
  els('upload-icon').hidden=!(verified&&draft.customIconNotTransferred&&app?.iconData);
  els('verification-status').textContent=verified?
    'Domain ownership verified. The app build/download service is not yet active.':
    'Not verified yet. Add the TXT record and click Verify.';
}
async function refresh(){
  if(!validSecret(credentials))return;
  const data=await api('./api/order-status?id='+encodeURIComponent(credentials.id),{
    headers:headerAuth()
  });
  showReport(data.draft);
}
async function create(){
  if(!analysis||!app)return notice('Missing website analysis. Start from the homepage.',true);
  const button=els('create');button.disabled=true;notice('');
  try{
    const body={
      site:analysis.finalUrl,name:app.name,
      platforms:analysis.platforms,
      accent:app.accent,theme:app.theme,
      windowsSize:app.windowsSize,macSize:app.macSize,
      androidOrientation:app.androidOrientation,
      customIcon:!!app.iconData
    };
    const result=await api('./api/order',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    saveSecret({id:result.id,accessToken:result.accessToken});
    await refresh();
  }catch(e){notice(e.message||'Unable to create project.',true)}
  finally{button.disabled=false}
}
async function verify(){
  const b=els('verify');b.disabled=true;notice('');
  els('verification-status').textContent='Checking the domain TXT record…';
  try{
    const out=await api('./api/verify-domain',{
      method:'POST',
      headers:{...headerAuth(),'Content-Type':'application/json'},
      body:JSON.stringify({id:credentials.id})
    });
    if(out.verified)await refresh();
    else els('verification-status').textContent=out.message||'Record not detected yet.';
  }catch(e){els('verification-status').textContent=e.message||'DNS check failed.'}
  finally{b.disabled=!!draft?.verification?.verified}
}
async function uploadIcon(){
  if(!draft?.verification?.verified||!draft.customIconNotTransferred||!app?.iconData){
    return notice('Select an icon in the app editor and verify domain ownership first.',true);
  }
  const btn=els('upload-icon');btn.disabled=true;notice('Uploading your selected 256×256 PNG to private storage…');
  try{
    const base64=app.iconData.split(',')[1];
    if(!base64)throw Error('The selected PNG is missing.');
    const binary=atob(base64);
    if(binary.length>1_200_000||binary.length<100)throw Error('The icon must be a PNG under 1.2 MB.');
    const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
    const upload=await api('./api/icon-upload',{
      method:'POST',headers:{...headerAuth(),'Content-Type':'application/json'},
      body:JSON.stringify({id:credentials.id,bytes:bytes.length})
    });
    const put=await fetch(upload.uploadUrl,{
      method:'PUT',headers:{'Content-Type':'image/png'},
      body:new Blob([bytes],{type:'image/png'})
    });
    if(!put.ok)throw Error('Private icon storage rejected the upload. Check bucket CORS and credentials.');
    await api('./api/icon-confirm',{
      method:'POST',headers:{...headerAuth(),'Content-Type':'application/json'},
      body:JSON.stringify({id:credentials.id})
    });
    await refresh();notice('Icon saved in private storage for a future build. No export has been created.');
  }catch(e){notice(e.message||'Unable to upload icon.',true)}
  finally{btn.disabled=false}
}
async function copy(text){
  if(!navigator.clipboard?.writeText)throw Error('Clipboard permission not available; select the visible TXT value to copy.');
  await navigator.clipboard.writeText(text);
}
els('create').addEventListener('click',create);
els('verify').addEventListener('click',verify);
els('upload-icon').addEventListener('click',uploadIcon);
els('refresh').addEventListener('click',async()=>{
  try{await refresh();notice('Status refreshed.')}catch(e){notice(e.message,true)}
});
els('copy-value').addEventListener('click',async()=>{
  try{await copy(draft.verification.value);notice('TXT record value copied.')}catch(e){notice(e.message,true)}
});
els('copy-recovery').addEventListener('click',async()=>{
  try{
    const url=location.origin+location.pathname+
      '#id='+encodeURIComponent(credentials.id)+'&key='+encodeURIComponent(credentials.accessToken);
    await copy(url);
    notice('Private recovery link copied. Keep it secret.');
  }catch(e){notice(e.message,true)}
});
async function boot(){
  const fromHash=recoveryFromHash();
  const existing=fromHash||safeRead();
  if(validSecret(existing)){
    saveSecret(existing);
    try{
      await refresh();
      const same=(!analysis||!app)||
        (draft?.site===analysis.finalUrl&&draft?.name===app.name&&
        Array.isArray(draft?.platforms)&&draft.platforms.join('|')===analysis.platforms.join('|'));
      if(fromHash||same)return;
      // The customer changed their website/config; don't show the old draft.
      sessionStorage.removeItem(key);
      credentials=null;draft=null;
      els('save-step').hidden=false;els('saved-step').hidden=true;
      els('domain-step').hidden=true;
      notice('');
    }catch(e){notice(e.message,true)}
  }
  if(!analysis||!app){
    els('missing').hidden=false;
  }else{
    els('project').hidden=false;
    els('project-name').textContent=app.name;
    els('project-domain').textContent=analysis.finalUrl;
    els('project-plan').textContent=analysis.platforms.join(' · ')+' · $'+config.price(analysis.platforms).toFixed(2)+' planned one-time export';
  }
}
boot();
})();