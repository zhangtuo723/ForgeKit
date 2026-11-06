import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { deletePrivateObject, safeStorageError, validateCosLocation } from "./cos-storage.mjs";

export function localAssetPath(id) {
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) throw Object.assign(new Error("Invalid asset ID"),{code:"UNSAFE_ASSET_PATH"});
  return join(process.env.FORGE_DATA_DIR||join(process.cwd(),"data"),"uploads",`${id}.webp`);
}
export async function drainStorageCleanup(pool,{limit=20,ids,apply=true}={}) {
  if(!Number.isInteger(limit)||limit<1||limit>100) throw new Error("Cleanup limit must be 1..100");
  if(ids && (!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=="string"))) throw new Error("Invalid cleanup IDs");
  const selected=ids?.length?` AND id IN (${ids.map(()=>"?").join(",")})`:"";
  const [jobs]=await pool.execute(`SELECT * FROM studio_storage_cleanup WHERE nextAttemptAt<=?${selected} ORDER BY createdAt,id LIMIT ${limit}`,[new Date().toISOString(),...(ids||[])]);
  const result={considered:jobs.length,removed:0,retained:0,failed:0};
  if(!apply)return result;
  for(const candidate of jobs) {
    const connection=await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [locked]=await connection.execute("SELECT * FROM studio_storage_cleanup WHERE id=? AND nextAttemptAt<=? FOR UPDATE",[candidate.id,new Date().toISOString()]);
      const job=locked[0];if(!job){await connection.commit();continue;}
      const [mapping]=await connection.execute("SELECT bucket,region,objectKey,versionId FROM studio_asset_storage WHERE assetId=?",[job.assetId]);
      const [assets]=await connection.execute("SELECT id FROM studio_assets WHERE id=?",[job.assetId]);
      const same=mapping[0]&&mapping[0].bucket===job.bucket&&mapping[0].region===job.region&&mapping[0].objectKey===job.objectKey;
      // A committed live asset is never eligible for object deletion.
      if((job.storageType==="cos"&&same)||(job.storageType==="local"&&assets.length&&!mapping.length)) {
        await connection.execute("DELETE FROM studio_storage_cleanup WHERE id=?",[job.id]);result.retained++;
      } else {
        try {
          if(job.storageType==="cos") {
            validateCosLocation(job);
            if(!job.objectKey.endsWith(`/characters/${job.assetId}.webp`)) throw Object.assign(new Error("Object ID mismatch"),{code:"UNSAFE_OBJECT_LOCATION"});
            await deletePrivateObject(job);
          } else if(job.storageType==="local") {
            try {await unlink(localAssetPath(job.assetId));}catch(error){if(error?.code!=="ENOENT")throw error;}
          } else throw Object.assign(new Error("Storage type invalid"),{code:"INVALID_STORAGE_TYPE"});
          await connection.execute("DELETE FROM studio_storage_cleanup WHERE id=?",[job.id]);result.removed++;
        } catch(error) {
          const attempt=Number(job.attempts)+1;
          const next=new Date(Date.now()+Math.min(86400000,60000*2**Math.min(attempt-1,10))).toISOString();
          await connection.execute("UPDATE studio_storage_cleanup SET attempts=?,lastError=?,nextAttemptAt=? WHERE id=?",[attempt,safeStorageError(error),next,job.id]);result.failed++;
        }
      }
      await connection.commit();
    } catch(error) {await connection.rollback();throw error;}
    finally {connection.release();}
  }
  return result;
}
