'use strict';
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');

const MAX_BYTES = 600000;
const TIMEOUT = 7000;
const PLATFORMS = ['Windows','Android','macOS'];
const rate = new Map();
const deny4 = new net.BlockList();
for (const [a, p] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]) deny4.addSubnet(a,p,'ipv4');
const deny6 = new net.BlockList();
for (const [a,p] of [['::',128],['::1',128],['::ffff:0:0',96],['64:ff9b:1::',48],['100::',64],['2001::',32],['2002::',16],['fc00::',7],['fe80::',10],['ff00::',8]]) deny6.addSubnet(a,p,'ipv6');

function problem(code,message,status=422) { return Object.assign(new Error(message),{code,status}); }
function publicAddress(ip) {
  const f=net.isIP(ip);
  return f===4?!deny4.check(ip,'ipv4'):f===6?!deny6.check(ip,'ipv6'):false;
}
function target(value) {
  if (typeof value!=='string'||value.length>2048) throw problem('INVALID_URL','Enter a valid website address.');
  let u;
  try { const v=value.trim();u=new URL(/^https?:\/\//i.test(v)?v:'https://'+v); }
  catch { throw problem('INVALID_URL','Enter a valid website address.'); }
  if (!['http:','https:'].includes(u.protocol)||u.username||u.password||
      (u.port&&!['80','443'].includes(u.port))||!u.hostname.includes('.')||
      /(?:^|\.)(?:local|localhost|internal|test|example|invalid|onion)$/i.test(u.hostname))
    throw problem('UNSAFE_URL','Only public HTTP and HTTPS websites are supported.');
  const host=u.hostname.replace(/^\[|\]$/g,'');
  if(net.isIP(host)&&!publicAddress(host)) throw problem('UNSAFE_URL','Private and reserved addresses cannot be scanned.');
  u.hash='';
  return u;
}
async function checkedLookup(host,opts,callback) {
  try {
    const list=await dns.lookup(host,{all:true,verbatim:true});
    if(!list.length||list.some(a=>!publicAddress(a.address)))
      throw problem('UNSAFE_URL','Domain resolves to a blocked address.');
    if(opts&&opts.all) callback(null,list);
    else callback(null,list[0].address,list[0].family);
  } catch(e) {callback(e);}
}
async function requestPage(url,started) {
  if(Date.now()-started>16000)throw problem('TIMEOUT','Website check timed out.',504);
  return new Promise((resolve,reject)=>{
    let finished=false;
    const done=(err,value)=>{if(finished)return;finished=true;err?reject(err):resolve(value);};
    const req=(url.protocol==='https:'?https:http).request(url,{
      method:'GET',lookup:checkedLookup,
      headers:{'User-Agent':'Warpvio-Website-Check/1.0','Accept':'text/html,application/xhtml+xml','Accept-Encoding':'identity'}
    },res=>{
      const status=res.statusCode||0;
      if([301,302,303,307,308].includes(status)){res.resume();return done(null,{redirect:String(res.headers.location||'')});}
      if(status<200||status>=300){res.resume();return done(problem('HTTP_STATUS','Website returned HTTP '+status+'.'));}
      if(!/text\/html|application\/xhtml\+xml/i.test(String(res.headers['content-type']||''))){
        res.resume();return done(problem('NOT_HTML','This URL did not return an HTML webpage.'));
      }
      if(Number(res.headers['content-length']||0)>MAX_BYTES){res.resume();return done(problem('TOO_LARGE','HTML document is too large to check.'));}
      let bytes=0;const chunks=[];
      res.on('data',chunk=>{
        bytes+=chunk.length;
        if(bytes>MAX_BYTES){res.destroy();return done(problem('TOO_LARGE','HTML document is too large to check.'));}
        chunks.push(chunk);
      });
      res.on('end',()=>done(null,{status,headers:res.headers,body:Buffer.concat(chunks).toString('utf8')}));
      res.on('error',e=>done(e));
    });
    req.setTimeout(TIMEOUT,()=>req.destroy(problem('TIMEOUT','The website took too long to respond.',504)));
    req.on('error',e=>done(e));
    req.end();
  });
}
async function getPage(input) {
  let url=target(input),redirects=0;const visited=new Set(),started=Date.now();
  while(true){
    if(visited.has(url.href))throw problem('REDIRECT_LOOP','Website redirect loop detected.');
    visited.add(url.href);
    const page=await requestPage(url,started);
    if(!Object.hasOwn(page,'redirect'))return {...page,finalUrl:url.href,redirects};
    if(++redirects>4)throw problem('REDIRECT_LIMIT','Website redirected too many times.');
    if(!page.redirect)throw problem('BAD_REDIRECT','Website redirected without a URL.');
    let next;try {next=new URL(page.redirect,url);}catch{throw problem('BAD_REDIRECT','Invalid redirect URL.');}
    url=target(next.href);
  }
}
function entities(s) {
  return String(s||'').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/gi,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[x.toLowerCase()]||x)
    .replace(/&#(x[0-9a-f]+|\d+);/gi,(whole,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):parseInt(n,10);return c>0&&c<=0x10ffff?String.fromCodePoint(c):whole;}).replace(/\s+/g,' ').trim();
}
function attrs(tag) {
  const a={};const part=tag.slice(tag.indexOf(' ')+1);
  const re=/([a-zA-Z][\w:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/g;let m;
  while((m=re.exec(part)))a[m[1].toLowerCase()]=m[2]??m[3]??m[4]??'';
  return a;
}
function meta(html,tag) {return [...html.matchAll(new RegExp('<'+tag+'\\b[^>]*>','gi'))].map(m=>attrs(m[0]));}
function inspect(page,platforms,requested) {
  const metas=meta(page.body,'meta'),links=meta(page.body,'link');
  const match=page.body.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const rawTitle=entities(match?.[1]||'');
  const title=rawTitle||new URL(page.finalUrl).hostname;
  const vp=metas.find(m=>String(m.name||'').toLowerCase()==='viewport');
  const description=entities(metas.find(m=>String(m.name||'').toLowerCase()==='description')?.content||'');
  const icon=links.find(m=>/\bicon\b/i.test(m.rel||'')&&m.href);
  let favicon=null;
  try{const u=new URL(icon?.href||'/favicon.ico',page.finalUrl);if(['http:','https:'].includes(u.protocol))favicon=u.href;}catch{}
  const secure=new URL(page.finalUrl).protocol==='https:';
  const checks=[
    {id:'reachable',label:'Website reachable',status:'passed',detail:'HTTP '+page.status+' returned an HTML document.'},
    {id:'https',label:'Secure connection',status:secure?'passed':'warning',detail:secure?'The final URL uses HTTPS.':'The final URL uses HTTP. HTTPS is recommended.'},
    {id:'title',label:'Website title',status:rawTitle?'passed':'warning',detail:rawTitle?'A title was found for the app name.':'No HTML title was found. You can enter the app name manually.'},
    {id:'viewport',label:'Mobile viewport tag',status:vp?'passed':'warning',detail:vp?'Viewport metadata exists; mobile layout is not yet verified.':'No viewport tag was found. Android layout may need adjustments.'},
    {id:'favicon',label:'Website favicon link',status:icon?'passed':'info',detail:icon?'An icon reference was detected (image not fetched).':'No explicit favicon reference found. Add a custom icon later.'}
  ];
  const warnings=checks.filter(c=>c.status==='warning').length;
  return {
    version:1,requestedUrl:requested,finalUrl:page.finalUrl,title:title.slice(0,140),
    description:description.slice(0,200),favicon,platforms,redirects:page.redirects,
    httpStatus:page.status,checks,warnings,analyzedAt:new Date().toISOString(),
    verdict:warnings?'Initial checks completed — some items need attention':'Initial checks passed — native testing still required',
    unverified:[
      'Login, payments, file uploads, popups and deep links have not been tested.',
      'Android navigation and permissions need testing on a real device.',
      'Windows and macOS installers still need build and signing checks.',
      'Your original website and backend must stay online.'
    ]
  };
}
function withinRate(req) {
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].slice(0,100);
  if(rate.size>3000)rate.clear();
  const now=Date.now();let entry=rate.get(ip);
  if(!entry||entry.until<now)entry={hits:0,until:now+60000};
  entry.hits++;rate.set(ip,entry);return entry.hits<=12;
}
module.exports=async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'POST required.'});}
  if(!withinRate(req))return res.status(429).json({ok:false,code:'RATE_LIMIT',error:'Too many checks. Please try again in a minute.'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body!=='object')throw problem('BAD_REQUEST','Invalid request.');
    const url=target(body.url);
    const platforms=Array.isArray(body.platforms)?[...new Set(body.platforms.filter(p=>PLATFORMS.includes(p)))]:[];
    if(!platforms.length)throw problem('NO_PLATFORM','Select at least one platform.');
    const page=await getPage(url.href);
    return res.status(200).json({ok:true,result:inspect(page,platforms,url.href)});
  }catch(e){
    let mapped=e;
    if(['ENOTFOUND','EAI_AGAIN'].includes(e.code))mapped=problem('DNS_ERROR','Website domain could not be resolved.');
    if(['ECONNREFUSED','ECONNRESET','EHOSTUNREACH','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT'].includes(e.code))mapped=problem('CONNECT_ERROR','Could not connect to the website securely.');
    return res.status(mapped.status||422).json({ok:false,code:mapped.code||'CHECK_FAILED',error:mapped.status?mapped.message:'The website could not be checked right now.'});
  }
};