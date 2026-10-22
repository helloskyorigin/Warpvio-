'use strict';
/**
 * R2 private storage adapter. Requires a PRIVATE bucket and S3 API credentials.
 * No customer receives an R2 secret. All presigned URLs expire quickly.
 */
const PLATFORM_EXT={Windows:'exe',Android:'apk',macOS:'dmg'};
function bucketConfig(env=process.env){
  const {R2_ACCOUNT_ID,R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY,R2_BUCKET}=env;
  if(typeof R2_ACCOUNT_ID!=='string'||!/^[0-9a-f]{32}$/i.test(R2_ACCOUNT_ID)||
    typeof R2_ACCESS_KEY_ID!=='string'||R2_ACCESS_KEY_ID.length<10||
    typeof R2_SECRET_ACCESS_KEY!=='string'||R2_SECRET_ACCESS_KEY.length<20||
    typeof R2_BUCKET!=='string'||!/^[a-z0-9.-]{3,63}$/.test(R2_BUCKET))
    throw Object.assign(new Error('Private artifact storage is not configured.'),{code:'R2_NOT_CONFIGURED',status:503});
  return {
    bucket:R2_BUCKET,
    endpoint:'https://'+R2_ACCOUNT_ID+'.r2.cloudflarestorage.com',
    credentials:{accessKeyId:R2_ACCESS_KEY_ID,secretAccessKey:R2_SECRET_ACCESS_KEY}
  };
}
function s3(env=process.env){
  const config=bucketConfig(env);
  const {S3Client}=require('@aws-sdk/client-s3');
  return {
    client:new S3Client({region:'auto',endpoint:config.endpoint,credentials:config.credentials,forcePathStyle:true}),
    bucket:config.bucket
  };
}
function artifactKey(orderId,platform){
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(orderId)||!Object.hasOwn(PLATFORM_EXT,platform))
    throw new Error('Invalid artifact identifier.');
  return 'exports/'+orderId+'/'+platform.toLowerCase()+'/app.'+PLATFORM_EXT[platform];
}
function iconKey(orderId){
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(orderId))throw new Error('Invalid draft identifier.');
  return 'icons/'+orderId+'/source.png';
}
async function signedDownload(key,filename,env=process.env){
  if(typeof key!=='string'||!/^exports\/[a-f0-9-]{36}\/(windows|android|macos)\/app\.(exe|apk|dmg)$/i.test(key))
    throw new Error('Invalid export object.');
  const {GetObjectCommand}=require('@aws-sdk/client-s3');
  const {getSignedUrl}=require('@aws-sdk/s3-request-presigner');
  const {client,bucket}=s3(env);
  const safe=String(filename||'Warpvio-App').replace(/[^A-Za-z0-9_.-]/g,'-').slice(0,70);
  return getSignedUrl(client,new GetObjectCommand({
    Bucket:bucket,Key:key,
    ResponseContentDisposition:'attachment; filename="'+safe+'"'
  }),{expiresIn:120});
}
async function iconUploadUrl(orderId,expectedBytes,env=process.env){
  if(!Number.isInteger(expectedBytes)||expectedBytes<100||expectedBytes>1_200_000)throw Error('Icon must be 100 bytes to 1.2 MB.');
  const {PutObjectCommand}=require('@aws-sdk/client-s3');
  const {getSignedUrl}=require('@aws-sdk/s3-request-presigner');
  const {client,bucket}=s3(env);
  const key=iconKey(orderId);
  return {
    key,
    url:await getSignedUrl(client,new PutObjectCommand({
      Bucket:bucket,Key:key,ContentType:'image/png',ContentLength:expectedBytes
    }),{expiresIn:180,signableHeaders:new Set(['content-type','content-length'])}),
    expiresIn:180
  };
}
async function iconMetadata(orderId,env=process.env){
  const {HeadObjectCommand}=require('@aws-sdk/client-s3');
  const {client,bucket}=s3(env);
  return client.send(new HeadObjectCommand({Bucket:bucket,Key:iconKey(orderId)}));
}
module.exports={PLATFORM_EXT,bucketConfig,artifactKey,iconKey,signedDownload,iconUploadUrl,iconMetadata};
