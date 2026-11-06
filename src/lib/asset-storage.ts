import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after } from "next/server";
import { execute,first,getDb,type Connection } from "./db";
import { ApiError } from "./api";
import { createCosLocation,getPrivateObject,putPrivateObject,safeStorageError,type CosLocation } from "./cos-storage.mjs";
import { drainStorageCleanup,localAssetPath } from "./storage-cleanup.mjs";

export function storageApiError(error:unknown) {
  const code=safeStorageError(error);
  const status=(error as {statusCode?:number})?.statusCode;
  if(code==="COS_NOT_CONFIGURED"||code==="COS_INVALID_CONFIGURATION") return new ApiError(503,"人物图片对象存储未配置完整，请联系管理员");
  if(status===404||code==="NoSuchKey"||code==="NoSuchVersion") return new ApiError(404,"图片文件不存在，请重新上传");
  return new ApiError(502,"图片存储服务暂时不可用，请稍后重试");
}
export async function stageCosUpload(assetId:string) {
  let location:CosLocation;
  try {location=createCosLocation(assetId);}catch(error){throw storageApiError(error);}
  const jobId=randomUUID(),now=new Date().toISOString();
  await execute("INSERT INTO studio_storage_cleanup(id,assetId,storageType,bucket,region,objectKey,versionId,reason,nextAttemptAt,attempts,lastError,createdAt) VALUES (?,?,'cos',?,?,?,NULL,'upload',?,0,NULL,?)",[jobId,assetId,location.bucket,location.region,location.objectKey,new Date(Date.now()+3600000).toISOString(),now]);
  return {jobId,location};
}
export async function uploadStagedObject(jobId:string,location:CosLocation,buffer:Buffer) {
  let uploaded:CosLocation;
  try {uploaded=await putPrivateObject(location,buffer);}catch(error){throw storageApiError(error);}
  const result=await execute("UPDATE studio_storage_cleanup SET versionId=? WHERE id=?",[uploaded.versionId,jobId]);
  if(!result.affectedRows) throw new ApiError(503,"上传任务已失效，请重新上传图片");
  return uploaded;
}
export async function attachCosObject(assetId:string,jobId:string,location:CosLocation,connection:Connection) {
  const job=await first<{id:string}>("SELECT id FROM studio_storage_cleanup WHERE id=? AND assetId=? FOR UPDATE",[jobId,assetId],connection);
  if(!job)throw new ApiError(503,"上传任务已失效，请重新上传图片");
  await execute("INSERT INTO studio_asset_storage(assetId,bucket,region,objectKey,versionId,createdAt) VALUES (?,?,?,?,?,?)",[assetId,location.bucket,location.region,location.objectKey,location.versionId,new Date().toISOString()],connection);
  await execute("DELETE FROM studio_storage_cleanup WHERE id=?",[jobId],connection);
}
export async function queueAssetCleanup(assetId:string,connection:Connection) {
  const location=await first<CosLocation>("SELECT bucket,region,objectKey,versionId FROM studio_asset_storage WHERE assetId=?",[assetId],connection);
  const id=randomUUID(),now=new Date().toISOString();
  await execute("INSERT INTO studio_storage_cleanup(id,assetId,storageType,bucket,region,objectKey,versionId,reason,nextAttemptAt,attempts,lastError,createdAt) VALUES (?,?,?,?,?,?,?,'delete',?,0,NULL,?)",[id,assetId,location?"cos":"local",location?.bucket||null,location?.region||null,location?.objectKey||null,location?.versionId||null,now,now],connection);
  return id;
}
export async function tryCleanup(ids:string[]) {
  if(!ids.length)return;
  // Jobs were committed before this best-effort attempt. Any SDK/DB failure
  // leaves the durable record for the cleanup command; errors contain no keys.
  try {await drainStorageCleanup(await getDb(),{limit:Math.min(3,ids.length),ids:ids.slice(0,3)});}
  catch {console.error("Storage cleanup deferred; durable queue retained");}
  if(ids.length>3)after(async()=>{
    for(let offset=3;offset<ids.length;offset+=20) {
      const batch=ids.slice(offset,offset+20);
      try {await drainStorageCleanup(await getDb(),{limit:batch.length,ids:batch});}
      catch {console.error("Background storage cleanup deferred; durable queue retained");}
    }
  });
}
export async function abandonUpload(jobId:string,putConfirmed=false) {
  // A timeout may still have committed remotely. Keep the original one-hour
  // delay until that uncertain PUT is settled instead of treating a quick 404
  // as proof that no object can subsequently appear.
  if(!putConfirmed)return;
  try {await execute("UPDATE studio_storage_cleanup SET nextAttemptAt=? WHERE id=?",[new Date().toISOString(),jobId]);}
  catch {console.error("Upload cleanup remains queued with original retry time");return;}
  await tryCleanup([jobId]);
}
export async function readAssetBytes(assetId:string) {
  const location=await first<CosLocation>("SELECT bucket,region,objectKey,versionId FROM studio_asset_storage WHERE assetId=?",[assetId]);
  if(location) {try{return await getPrivateObject(location);}catch(error){throw storageApiError(error);}}
  try{return await readFile(localAssetPath(assetId));}
  catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")throw new ApiError(404,"旧版图片文件不存在，请重新上传");throw error;}
}
