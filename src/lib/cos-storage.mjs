import COS from "cos-nodejs-sdk-v5";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";

export class CosStorageError extends Error {
  constructor(code,statusCode=0) { super("Object storage operation failed");this.name="CosStorageError";this.code=code;this.statusCode=statusCode; }
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const keyPattern=/^forge-studio\/(?:_qa\/[A-Za-z0-9_-]+\/)?characters\/([a-f0-9-]{36})\.webp$/;
export function safeStorageError(error) {
  const candidate=error?.code||error?.error?.Code||"STORAGE_ERROR";
  return /^[A-Za-z0-9_-]{1,80}$/.test(String(candidate))?String(candidate):"STORAGE_ERROR";
}
export function readCosConfig() {
  const required=["COS_BUCKET","COS_REGION","COS_SECRET_ID","COS_SECRET_KEY"];
  if(required.some(key=>!process.env[key]?.trim())) throw new CosStorageError("COS_NOT_CONFIGURED");
  const bucket=process.env.COS_BUCKET.trim(),region=process.env.COS_REGION.trim();
  const prefix=(process.env.COS_PREFIX||"forge-studio/").replace(/\/+$/g,"")+"/";
  if(!/^[a-z0-9-]+-\d+$/.test(bucket)||!/^[a-z]{2}-[a-z0-9-]+$/.test(region)||!/^forge-studio\/(?:_qa\/[A-Za-z0-9_-]+\/)?$/.test(prefix)) throw new CosStorageError("COS_INVALID_CONFIGURATION");
  return {bucket,region,prefix};
}
function client() {
  if(!process.env.COS_SECRET_ID?.trim()||!process.env.COS_SECRET_KEY?.trim()) throw new CosStorageError("COS_NOT_CONFIGURED");
  return new COS({SecretId:process.env.COS_SECRET_ID.trim(),SecretKey:process.env.COS_SECRET_KEY.trim(),...(process.env.COS_SESSION_TOKEN?{SecurityToken:process.env.COS_SESSION_TOKEN}:{}),Protocol:"https:",StrictSsl:true,Timeout:15000,ChunkRetryTimes:0});
}
export function validateCosLocation(location) {
  const match=typeof location?.objectKey==="string"?keyPattern.exec(location.objectKey):null;
  if(!/^[a-z0-9-]+-\d+$/.test(location?.bucket||"")||!/^[a-z]{2}-[a-z0-9-]+$/.test(location?.region||"")||!match||!uuid.test(match[1])||(location.versionId!==null&&location.versionId!==undefined&&(typeof location.versionId!=="string"||location.versionId.length>256))) throw new CosStorageError("UNSAFE_OBJECT_LOCATION");
  return location;
}
export function createCosLocation(assetId) {
  if(!uuid.test(assetId)) throw new CosStorageError("INVALID_ASSET_ID");
  const {bucket,region,prefix}=readCosConfig();
  return {bucket,region,objectKey:`${prefix}characters/${assetId}.webp`,versionId:null};
}
function params(location) { validateCosLocation(location);return {Bucket:location.bucket,Region:location.region,Key:location.objectKey,...(location.versionId?{VersionId:location.versionId}:{})}; }
function cleanError(error) { if(error instanceof CosStorageError)return error;return new CosStorageError(safeStorageError(error),Number(error?.statusCode||0)); }
export async function putPrivateObject(location,buffer) {
  validateCosLocation(location);
  if(location.versionId)throw new CosStorageError("OBJECT_ALREADY_VERSIONED");
  try {
    // COS SDK retries buffer bodies internally; a stream deliberately prevents
    // replay so a version-enabled bucket gets only one PUT for this unique key.
    const result=await client().putObject({...params(location),Body:Readable.from([buffer]),ContentLength:buffer.length,ContentMD5:createHash("md5").update(buffer).digest("base64"),ContentType:"image/webp",ACL:"private",CacheControl:"private, no-store"});
    return {...location,versionId:result.VersionId||null};
  } catch(error) {throw cleanError(error);}
}
export async function getPrivateObject(location) {
  try { const result=await client().getObject(params(location));return Buffer.from(result.Body); }
  catch(error) {throw cleanError(error);}
}
export async function deletePrivateObject(location) {
  try {
    const cos=client();let target=validateCosLocation(location);
    // An interrupted PUT can have committed without returning its VersionId.
    // Unique keys and a one-byte GET recover that version using GetObject
    // permission; no additional HeadObject permission is required.
    if(!target.versionId) {
      try { const head=await cos.getObject({...params(target),Range:"bytes=0-0"});target={...target,versionId:head.VersionId||head.headers?.["x-cos-version-id"]||null}; }
      catch(error) { if(error?.statusCode===404||error?.error?.Code==="NoSuchKey")return;throw error; }
    }
    await cos.deleteObject(params(target));
  } catch(error) {if(error?.statusCode===404||error?.error?.Code==="NoSuchKey"||error?.error?.Code==="NoSuchVersion")return;throw cleanError(error);}
}
