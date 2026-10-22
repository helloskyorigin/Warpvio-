(()=>{
'use strict';
const api=window.WarpvioConfig;
const result=api?.result();
let exists=false;
try{exists=!!sessionStorage.getItem(api.KEY)}catch{}
if(!result||!exists){
  document.getElementById('no-order').hidden=false;
  return;
}
const configuration=api.load(result);
const host=(()=>{try{return new URL(result.finalUrl).hostname}catch{return ''}})();
document.getElementById('order-page').hidden=false;
document.getElementById('order-app-name').textContent=configuration.name;
document.getElementById('order-website').textContent=host;
document.getElementById('order-letter').textContent=api.iconLetter(configuration.name);
document.getElementById('order-theme').textContent=
  configuration.theme==='system'?'Follow device':configuration.theme==='dark'?'Dark':'Light';
document.getElementById('order-icon').style.background=
  'linear-gradient(145deg,'+api.COLORS[configuration.accent]+',#8d60f7)';
const icon=configuration.iconData||result.favicon;
if(icon){
  const image=document.getElementById('order-icon-img');
  image.onload=()=>document.getElementById('order-icon').classList.add('with-img');
  image.onerror=()=>document.getElementById('order-icon').classList.remove('with-img');
  image.src=icon;
}
for(const name of result.platforms){
  const span=document.createElement('span');
  span.className='order-platform';span.textContent=name;
  document.getElementById('order-platforms').append(span);
}
const prices={Windows:15,Android:19,macOS:19};
const bundle=result.platforms.length===3;
const rows=bundle?[{name:'All platforms bundle',amount:39}]:
  result.platforms.map(name=>({name:name+' export',amount:prices[name]}));
for(const row of rows){
  const div=document.createElement('div');
  div.className='summary-row';
  const name=document.createElement('span');
  const amount=document.createElement('strong');
  name.textContent=row.name;amount.textContent='$'+row.amount.toFixed(2);
  div.append(name,amount);document.getElementById('order-lines').append(div);
}
document.getElementById('order-total').replaceChildren();
document.getElementById('order-total').textContent='$'+api.price(result.platforms).toFixed(2)+' USD';

(async()=>{
  const el=document.getElementById('checkout-status');
  try{
    const controller=new AbortController();
    const id=setTimeout(()=>controller.abort(),7000);
    let res;
    try{res=await fetch('./api/checkout',{cache:'no-store',signal:controller.signal});}
    finally{clearTimeout(id);}
    const type=res.headers.get('content-type')||'';
    if(!type.includes('application/json'))throw Error('Static hosting does not run the checkout API.');
    const data=await res.json();
    if(!res.ok||!data.ok||!data.pricing)throw Error('Checkout availability could not be verified.');
    const p=data.pricing;
    // Warn if the UI estimate drifts from the server's canonical pricing.
    const expected=api.price(result.platforms);
    const fromServer=bundle?p.allThree:result.platforms.reduce((sum,name)=>sum+p[name],0);
    if(fromServer!==expected){
      el.textContent='Price configuration is being updated. Payments are disabled until our build services are available.';
      return;
    }
    el.textContent=data.reason||'Secure checkout opens after app builds can be delivered.';
  }catch{
    el.textContent='Checkout is not connected on this host. Payments are disabled until the real build and checkout services go live.';
  }
})();
})();
