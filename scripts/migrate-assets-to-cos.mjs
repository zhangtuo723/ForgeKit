import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import mysql from "mysql2/promise";
import nextEnv from "@next/env";
import { ensureTunnel } from "./db-tunnel.mjs";
import { createCosLocation, putPrivateObject, getPrivateObject, readCosConfig } from "../src/lib/cos-storage.mjs";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() { console.error("Environment configuration could not be loaded."); } });
const args = process.argv.slice(2);
const apply = args.includes("--apply");
if (args.some(arg => !["--apply", "--dry-run"].includes(arg)) || (apply && args.includes("--dry-run"))) {
  throw new Error("Usage: node scripts/migrate-assets-to-cos.mjs --dry-run | --apply");
}
const database = process.env.MYSQL_DATABASE;
if (!database || !/^[a-zA-Z0-9_]+$/.test(database)) throw new Error("MYSQL_DATABASE must be configured.");
const directory = resolve(process.env.FORGE_DATA_DIR || "data", "uploads");
const lockName = `forge_cos_migrate_${database}`.slice(0, 64);
let connection, tunnel, locked = false, step = "configuration", migrated = 0;

function failureCode(error) {
  const candidate = error?.code || error?.error?.Code;
  return typeof candidate === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(candidate) ? candidate : "MIGRATION_FAILED";
}
function fail(code) { throw Object.assign(new Error(code), { code }); }
const params = location => [location.bucket, location.region, location.objectKey, location.versionId || null];

try {
  readCosConfig();
  tunnel = await ensureTunnel({ signal: new AbortController().signal });
  connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database,
    charset: "utf8mb4", timezone: "Z", connectTimeout: 10000,
    ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: true, ...(process.env.MYSQL_SSL_CA_FILE ? { ca: await readFile(process.env.MYSQL_SSL_CA_FILE, "utf8") } : {}) } : undefined,
  });
  step = "migration lock";
  const [lockResult] = await connection.query("SELECT GET_LOCK(?,10) acquired", [lockName]);
  if (lockResult[0]?.acquired !== 1) fail("MIGRATION_ALREADY_RUNNING");
  locked = true;

  // Dry runs never change schema, records, local files, or COS objects.
  step = "local file preflight";
  const [table] = await connection.execute("SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=? AND table_name='studio_asset_storage'", [database]);
  const [assets] = await connection.query(table[0].n
    ? "SELECT a.id,a.characterId,a.size FROM studio_assets a LEFT JOIN studio_asset_storage s ON s.assetId=a.id WHERE s.assetId IS NULL ORDER BY a.id"
    : "SELECT id,characterId,size FROM studio_assets ORDER BY id");
  let totalBytes = 0;
  for (const asset of assets) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(asset.id)) fail("INVALID_ASSET_ID");
    const bytes = await readFile(join(directory, `${asset.id}.webp`));
    if (bytes.length !== asset.size || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") fail("LOCAL_IMAGE_INVALID");
    totalBytes += bytes.length;
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", database, localAssets: assets.length, totalBytes }));
  if (apply) {
    step = "storage schema";
    const schema = JSON.parse(await readFile(new URL("../src/lib/mysql-schema.json", import.meta.url), "utf8"));
    const storageSchema = schema.filter(sql => /^CREATE TABLE IF NOT EXISTS studio_(asset_storage|storage_cleanup) \(/.test(sql));
    if (storageSchema.length !== 2) fail("STORAGE_SCHEMA_UNAVAILABLE");
    for (const sql of storageSchema) await connection.query(sql);

    for (const asset of assets) {
      const jobId = randomUUID();
      let staged = false;
      let putConfirmed = false;
      try {
        const bytes = await readFile(join(directory, `${asset.id}.webp`));
        if (bytes.length !== asset.size) fail("LOCAL_IMAGE_CHANGED");
        let location = createCosLocation(asset.id);
        step = "register recoverable migration";
        // An interrupted attempt can still own this exact object key. Do not
        // overwrite it while its durable cleanup job may delete that key.
        const [pending] = await connection.execute("SELECT id FROM studio_storage_cleanup WHERE storageType='cos' AND bucket=? AND region=? AND objectKey=? LIMIT 1", params(location).slice(0, 3));
        if (pending.length) fail("PENDING_CLEANUP_RUN_COS_CLEANUP_FIRST");
        const now = new Date().toISOString();
        await connection.execute("INSERT INTO studio_storage_cleanup(id,assetId,storageType,bucket,region,objectKey,versionId,reason,nextAttemptAt,attempts,lastError,createdAt) VALUES (?,?,'cos',?,?,?,?,?,?,0,NULL,?)", [jobId, asset.id, ...params(location), "migration", new Date(Date.now() + 3600000).toISOString(), now]);
        staged = true;
        step = "private upload";
        location = await putPrivateObject(location, bytes);
        putConfirmed = true;
        await connection.execute("UPDATE studio_storage_cleanup SET versionId=? WHERE id=?", [location.versionId || null, jobId]);
        step = "verify downloaded bytes";
        if (!(await getPrivateObject(location)).equals(bytes)) fail("CONTENT_MISMATCH");
        step = "verify private access";
        const url = `https://${location.bucket}.cos.${location.region}.myqcloud.com/${location.objectKey.split("/").map(encodeURIComponent).join("/")}`;
        const anonymous = await fetch(url, { headers: { Range: "bytes=0-0" }, redirect: "error", signal: AbortSignal.timeout(15000) });
        await anonymous.body?.cancel();
        if (![401, 403].includes(anonymous.status)) fail("PRIVATE_ACCESS_CHECK_FAILED");

        step = "switch asset storage";
        await connection.beginTransaction();
        try {
          // Preserve the application's parent -> asset -> cleanup lock order.
          const [characters] = await connection.execute("SELECT id FROM studio_characters WHERE id=? FOR UPDATE", [asset.characterId]);
          const [current] = await connection.execute("SELECT id,characterId,size FROM studio_assets WHERE id=? FOR UPDATE", [asset.id]);
          if (!characters.length || !current.length || current[0].characterId !== asset.characterId || current[0].size !== bytes.length) fail("ASSET_CHANGED_DURING_MIGRATION");
          const [mapping] = await connection.execute("SELECT assetId FROM studio_asset_storage WHERE assetId=?", [asset.id]);
          if (mapping.length) fail("ASSET_ALREADY_MIGRATED");
          const [jobs] = await connection.execute("SELECT id FROM studio_storage_cleanup WHERE id=? FOR UPDATE", [jobId]);
          if (!jobs.length) fail("MIGRATION_LEASE_EXPIRED");
          await connection.execute("INSERT INTO studio_asset_storage(assetId,bucket,region,objectKey,versionId,createdAt) VALUES (?,?,?,?,?,?)", [asset.id, ...params(location), new Date().toISOString()]);
          await connection.execute("DELETE FROM studio_storage_cleanup WHERE id=?", [jobId]);
          await connection.commit();
          staged = false;
          migrated++;
          console.log(`PASS migrated image ${migrated}/${assets.length}; bytes verified; anonymous access denied; local backup retained`);
        } catch (error) { await connection.rollback(); throw error; }
      } catch (error) {
        if (staged) {
          // A timed-out PUT may still complete remotely. Keep its one-hour
          // grace period so cleanup cannot mistake a late object for absence.
          await connection.execute(putConfirmed
            ? "UPDATE studio_storage_cleanup SET nextAttemptAt=?,lastError=? WHERE id=?"
            : "UPDATE studio_storage_cleanup SET lastError=? WHERE id=?",
          putConfirmed ? [new Date().toISOString(), failureCode(error), jobId] : [failureCode(error), jobId]).catch(() => {});
        }
        throw error;
      }
    }
    console.log(`Migration complete: ${migrated} images moved to COS. All original local files retained.`);
  } else console.log("Dry run complete. No data changed. Use --apply to migrate the listed image count.");
} catch (error) {
  // Do not print SDK/driver errors, SQL, credentials, or user asset content.
  console.error(`Migration stopped at ${step}: ${failureCode(error)}. Migrated: ${migrated}. Local files are unchanged.`);
  process.exitCode = 1;
} finally {
  if (connection) {
    if (locked) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => {});
    await connection.end();
  }
  await tunnel?.close();
}
