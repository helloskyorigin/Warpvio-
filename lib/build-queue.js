'use strict';
/* Future PRIVATE worker dispatch contract; unreachable by public API in this milestone.
 * No build can be launched until exact paid order and domain ownership are verified.
 */
const {validateWebsiteUrl,validateAppName,validateAccent,validateSize}=require('../builder/windows/app/security.cjs');
const {normalizePlatforms}=require('./commerce');

function buildPlan(draft){
  if(!draft||draft.version!==1)throw Error('A persisted order is required.');
  const site=validateWebsiteUrl(draft.site);
  const name=validateAppName(draft.name);
  const platforms=normalizePlatforms(draft.platforms);
  validateAccent(draft.accent);
  validateSize(draft.windowsSize);
  validateSize(draft.macSize);
  if(!['auto','portrait'].includes(draft.androidOrientation))throw Error('Invalid Android setting.');
  if(platforms.includes('Android')&&!/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(name))
    throw Error('Android build requires an ASCII-compatible app name.');
  if(draft.customIconNotTransferred)throw Error('Custom icon has not been uploaded to secure build storage.');
  const base={website_url:site,app_name:name,accent:draft.accent};
  const workflow={
    Windows:{file:'windows-qa.yml',inputs:{...base,window_size:draft.windowsSize},qaOnly:true},
    Android:{file:'android-qa.yml',inputs:{...base,orientation:draft.androidOrientation},qaOnly:true},
    macOS:{file:'macos-qa.yml',inputs:{...base,window_size:draft.macSize},qaOnly:true}
  };
  return platforms.map(p=>({platform:p,...workflow[p]}));
}
function canDispatch(draft){
  return Boolean(draft&&draft.verifiedAt&&draft.status==='paid_verified'&&
    draft.paymentState==='paid_verified'&&
    typeof draft.paymentId==='string'&&draft.paymentId.startsWith('pay_')&&
    typeof draft.amountVerifiedCents==='number'&&
    draft.amountVerifiedCents===draft.quote?.totalUSD*100&&
    draft.currency==='USD');
}
function workerConfig(env=process.env){
  const repo=env.WARPVIO_PRIVATE_WORKER_REPO;
  const token=env.WARPVIO_WORKER_GITHUB_TOKEN;
  if(typeof repo!=='string'||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)||
    repo==='helloskyorigin/Warpvio'||typeof token!=='string'||token.length<30)
    throw Error('Private worker repository is not configured.');
  return {repo,token};
}
async function privateRepoConfirmed(c,fetcher=globalThis.fetch){
  const response=await fetcher('https://api.github.com/repos/'+c.repo,{
    headers:{Authorization:'Bearer '+c.token,Accept:'application/vnd.github+json'},
    signal:AbortSignal.timeout(9000)
  });
  if(!response.ok)throw Error('Private worker repository could not be verified.');
  const repository=await response.json();
  if(repository.full_name!==c.repo||repository.private!==true||repository.archived)
    throw Error('A verified PRIVATE GitHub worker repository is mandatory.');
  return true;
}
async function dispatchPaidDraft(draft,env=process.env,fetcher=globalThis.fetch){
  // This API is an integration contract only. The existing public QA workflows
  // may not be used to deliver customer data or binary artifacts.
  if(env.WARPVIO_CUSTOMER_BUILD_ENABLED!=='true')throw Error('Customer builds are disabled.');
  if(!canDispatch(draft))throw Error('Verified purchase and site ownership are required before build.');
  const c=workerConfig(env);
  await privateRepoConfirmed(c,fetcher);
  // A separate private repo must implement signed release production workflows.
  // Never dispatch public QA workflows: they are debug/unsigned.
  const jobs=buildPlan(draft);
  return {
    ready:false,
    intendedJobs:jobs.map(j=>({platform:j.platform,qaWorkflow:j.file})),
    reason:'Production signed worker workflows and R2 artifact delivery are not configured.'
  };
}
module.exports={buildPlan,canDispatch,workerConfig,privateRepoConfirmed,dispatchPaidDraft};
