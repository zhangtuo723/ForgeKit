import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";
import COS from "cos-nodejs-sdk-v5";
import nextEnv from "@next/env";
import { drainStorageCleanup } from "../src/lib/storage-cleanup.mjs";
import { getPrivateObject, putPrivateObject, readCosConfig } from "../src/lib/cos-storage.mjs";
import { createQaAdmin } from "./qa-admin.mjs";

// Credentials are loaded, never printed. The server must use the same QA prefix.
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() { console.error("Local environment configuration could not be loaded."); } });
const run = `cos-api-${randomUUID()}`;
const base = new URL(process.env.API_BASE_URL || "http://127.0.0.1:3002");
const database = process.env.MYSQL_DATABASE;
const qaDatabase = process.env.STUDIO_QA_DATABASE;
const objectPrefix = process.env.COS_PREFIX || "";
const Bucket = process.env.COS_BUCKET?.trim();
const Region = process.env.COS_REGION?.trim();
let db, cleanupPool, cos;
let cookie = "", writer = "", reader = "", qa;
let serverConfirmed = false, step = "configuration guards", completed = 0;
const characters = new Map(), keys = new Map(), locations = new Map(), assetIds = new Set();
const safeCleanupCharacters = new Set();
const cleanupJobIds = new Set();

function ensure(condition, message) {
  if (!condition) throw Object.assign(new Error(message), { safeMessage: message });
}
function safeFailure(label, error) {
  const candidate = String(error?.error?.Code || error?.code || "UNKNOWN_ERROR");
  const code = /^[A-Za-z0-9_-]{1,80}$/.test(candidate) ? candidate : "UNKNOWN_ERROR";
  const status = Number(error?.statusCode || 0);
  console.error(`FAIL ${label}: ${error?.safeMessage || code}${status ? ` (HTTP ${status})` : ""}`);
  process.exitCode = 1;
}
async function check(label, work) { step = label; await work(); completed++; console.log(`PASS ${label}`); }
async function request(path, { method = "GET", data, form, token = writer, session = "", origin, expected = 200 } = {}) {
  const response = await fetch(new URL(path, base), {
    method, redirect: "manual", signal: AbortSignal.timeout(60000),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(session ? { Cookie: session } : {}), ...(origin || session ? { Origin: origin || base.origin } : {}), ...(!form && data !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(form ? { body: form } : data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  if (response.status !== expected) { await response.body?.cancel(); ensure(false, `${method} ${path}: expected HTTP ${expected}, received ${response.status}`); }
  return response;
}
async function json(path, options) { const response = await request(path, options); return (await response.json()).data; }
async function newKey(permission) {
  const name = `${run}-${permission}`;
  const created = await json("/api/studio/agent-keys", { method: "POST", token: "", session: cookie, expected: 201, data: { name, permission, expiresInDays: 30 } });
  keys.set(created.key.id, name); return created.token;
}
async function newCharacter(label) {
  const name = `${run}-${label}`;
  const created = await json("/api/studio/characters", { method: "POST", expected: 201, data: { name, role: "COS integration fixture", description: "Synthetic QA fixture. Safe to delete after this test." } });
  characters.set(created.id, name); return created;
}
async function imageForm(characterId, fileName = "clipboard-synthetic.png") {
  const bytes = await sharp({ create: { width: 17, height: 13, channels: 4, background: { r: 27, g: 113, b: 87, alpha: 0.8 } } }).png().toBuffer();
  const form = new FormData(); form.set("characterId", characterId); form.set("name", `${run}-image`); form.set("file", new Blob([bytes], { type: "image/png" }), fileName); return form;
}
function locationArgs(location) { return { Bucket: location.bucket, Region: location.region, Key: location.objectKey, ...(location.versionId ? { VersionId: location.versionId } : {}) }; }
function rememberLocation(location) {
  ensure(assetIds.has(location.assetId), "Storage mapping must belong to an asset created by this invocation");
  ensure(location.bucket === Bucket && location.region === Region, "Server COS bucket or region differs from this QA configuration");
  ensure(location.objectKey === `${objectPrefix}characters/${location.assetId}.webp`, "Server COS prefix differs from this QA configuration; refusing unrelated object operations");
  ensure(location.versionId === null || typeof location.versionId === "string", "COS version locator is invalid");
  ensure(typeof location.createdAt === "string" && !Number.isNaN(Date.parse(location.createdAt)), "Storage mapping has no valid creation timestamp");
  locations.set(location.assetId, location);
}
async function upload(characterId) {
  const asset = await json("/api/studio/assets", { method: "POST", form: await imageForm(characterId), expected: 201 });
  assetIds.add(asset.id);
  const [rows] = await db.execute("SELECT assetId,bucket,region,objectKey,versionId,createdAt FROM studio_asset_storage WHERE assetId=?", [asset.id]);
  ensure(rows.length === 1, "Uploaded image has no unique persistent COS mapping");
  rememberLocation(rows[0]);
  ensure(asset.mimeType === "image/webp" && asset.width === 17 && asset.height === 13, "Uploaded image metadata does not match the converted synthetic PNG");
  ensure(!existsSync(join(resolve(process.env.FORGE_DATA_DIR), "uploads", `${asset.id}.webp`)), "COS upload unexpectedly left a local image copy");
  const [queued] = await db.execute("SELECT COUNT(*) AS count FROM studio_storage_cleanup WHERE assetId=?", [asset.id]);
  ensure(Number(queued[0].count) === 0, "Successful upload left a pending compensation task");
  return asset;
}
async function expectMissing(location) {
  try { await cos.getObject(locationArgs(location)); }
  catch (error) { if (Number(error?.statusCode) === 404 || error?.error?.Code === "NoSuchKey" || error?.error?.Code === "NoSuchVersion") return; throw error; }
  ensure(false, "Deleted COS object remains readable through authenticated storage access");
}
async function verifyDeleted(id) {
  const [mapping] = await db.execute("SELECT assetId FROM studio_asset_storage WHERE assetId=?", [id]);
  ensure(mapping.length === 0, "Deleted asset retained its database storage mapping");
  const [queued] = await db.execute("SELECT id,attempts,lastError FROM studio_storage_cleanup WHERE assetId=?", [id]);
  ensure(queued.length === 0, "COS deletion did not complete immediately; a cleanup task remains pending");
  await expectMissing(locations.get(id));
  await request(`/api/studio/assets/${id}/file`, { expected: 404 });
  locations.delete(id);
}

try {
  ensure(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) && base.protocol === "http:" && base.port === "3002" && base.pathname === "/" && !base.username && !base.password && !base.search && !base.hash, "COS API tests only accept http://localhost:3002");
  ensure(database === "forge_studio_test" && qaDatabase === database, "MYSQL_DATABASE and STUDIO_QA_DATABASE must both equal forge_studio_test");
  ensure(/^forge-studio\/_qa\/[A-Za-z0-9_-]{8,100}\/$/.test(objectPrefix), "COS_PREFIX must be an explicit forge-studio/_qa/<run>/ directory shared with the QA server");
  ensure(!!process.env.FORGE_DATA_DIR, "FORGE_DATA_DIR must explicitly match the QA server's local data directory");
  ensure(Bucket && /^[a-z0-9-]+-\d+$/.test(Bucket) && Region && /^[a-z]{2}-[a-z0-9-]+$/.test(Region), "Valid COS bucket and region are required");
  ensure(process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY && process.env.MYSQL_USER && process.env.MYSQL_PASSWORD !== undefined, "COS and QA MySQL credentials are required");
  const mysqlOptions = { host: process.env.MYSQL_HOST || "127.0.0.1", port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database, timezone: "Z", connectTimeout: 10000, ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: true, ...(process.env.MYSQL_SSL_CA_FILE ? { ca: readFileSync(process.env.MYSQL_SSL_CA_FILE, "utf8") } : {}) } : undefined };
  db = await mysql.createConnection(mysqlOptions);
  cleanupPool = mysql.createPool({ ...mysqlOptions, connectionLimit: 2 });
  const [current] = await db.query("SELECT DATABASE() AS current_database");
  ensure(current[0].current_database === "forge_studio_test", "The SQL connection is not the isolated QA database");
  cos = new COS({ SecretId: process.env.COS_SECRET_ID.trim(), SecretKey: process.env.COS_SECRET_KEY.trim(), ...(process.env.COS_SESSION_TOKEN ? { SecurityToken: process.env.COS_SESSION_TOKEN } : {}), Protocol: "https:", StrictSsl: true, Timeout: 15000 });

  await check("QA server database identity before API mutations", async () => {
    qa = await createQaAdmin(base, { connection: db });
    const login = await request("/api/studio/auth/login", { method: "POST", token: "", origin: base.origin, data: { username: qa.username, password: qa.password } });
    cookie = login.headers.get("set-cookie").split(";")[0];
    await login.body?.cancel();
    serverConfirmed = true;
    writer = await newKey("write"); reader = await newKey("read");
  });
  let character, firstAsset;
  await check("synthetic PNG upload and complete COS storage mapping", async () => {
    character = await newCharacter("portrait"); firstAsset = await upload(character.id);
    ensure((await json(`/api/studio/characters/${character.id}`)).coverAssetId === firstAsset.id, "First uploaded asset did not become the character cover");
  });
  await check("cookie and Bearer image proxy equal private COS bytes; anonymous access denied", async () => {
    const location = locations.get(firstAsset.id);
    const stored = await cos.getObject(locationArgs(location)); const cosBytes = Buffer.from(stored.Body);
    const legacy = await request(`/api/assets/${firstAsset.id}/file?download=1`, { token: reader, expected: 307 });
    ensure(new URL(legacy.headers.get("location"),base).href === new URL(`/api/studio/assets/${firstAsset.id}/file?download=1`,base).href, "Legacy image URL did not preserve its asset and query when redirecting");
    await legacy.body?.cancel();
    for (const options of [{ token: "", session: cookie }, { token: reader }]) {
      const response = await request(`/api/studio/assets/${firstAsset.id}/file`, options);
      ensure(response.headers.get("location") === null, "Canonical image API must return bytes directly");
      ensure(response.headers.get("content-type") === "image/webp", "Private image proxy returned the wrong content type");
      ensure(/private.*no-store/.test(response.headers.get("cache-control") || ""), "Private image proxy is missing no-store cache protection");
      const data = Buffer.from(await response.arrayBuffer()); ensure(data.equals(cosBytes), "Authenticated API bytes differ from the private COS object");
    }
    const metadata = await sharp(cosBytes).metadata(); ensure(metadata.format === "webp" && metadata.width === 17 && metadata.height === 13, "COS object is not the expected converted WebP");
    ensure(cosBytes.length === firstAsset.size, "COS object length differs from database asset metadata");
    const anonymousUrl = `https://${location.bucket}.cos.${location.region}.myqcloud.com/${location.objectKey.split("/").map(encodeURIComponent).join("/")}`;
    const anonymous = await fetch(anonymousUrl, { redirect: "error", signal: AbortSignal.timeout(15000), headers: { Range: "bytes=0-0" } });
    await anonymous.body?.cancel(); ensure(anonymous.status === 403, "COS object must reject anonymous access with HTTP 403");
    await request(`/api/studio/assets/${firstAsset.id}/file`, { token: "", expected: 401 });
  });
  await check("invalid bytes and read-only writes do not create assets", async () => {
    const before = await json(`/api/studio/assets?characterId=${character.id}`);
    const invalid = new FormData(); invalid.set("characterId", character.id); invalid.set("file", new Blob(["not an image"], { type: "image/png" }), "invalid.png");
    await request("/api/studio/assets", { method: "POST", form: invalid, expected: 415 });
    await request("/api/studio/assets", { method: "POST", token: reader, form: await imageForm(character.id), expected: 403 });
    await request(`/api/studio/assets/${firstAsset.id}`, { method: "DELETE", token: reader, expected: 403 });
    const after = await json(`/api/studio/assets?characterId=${character.id}`); ensure(after.length === before.length, "Rejected uploads changed the asset collection");
  });
  await check("persisted COS locator remains readable when the configured upload prefix changes", async () => {
    const originalPrefix = process.env.COS_PREFIX;
    const changedPrefix = `forge-studio/_qa/${run}-changed/`;
    try {
      process.env.COS_PREFIX = changedPrefix;
      ensure(readCosConfig().prefix === changedPrefix, "The storage module did not observe the changed configuration");
      const persisted = await getPrivateObject(locations.get(firstAsset.id));
      const response = await request(`/api/studio/assets/${firstAsset.id}/file`, { token: reader });
      ensure(persisted.equals(Buffer.from(await response.arrayBuffer())), "Changing upload prefix prevented reading the persisted object's original locator");
    } finally { process.env.COS_PREFIX = originalPrefix; }
  });
  await check("single asset deletion removes COS object, mapping and cleanup task", async () => {
    await request(`/api/studio/assets/${firstAsset.id}`, { method: "DELETE" }); await verifyDeleted(firstAsset.id);
    const current = await json(`/api/studio/characters/${character.id}`); ensure(current.coverAssetId === null && current.assetCount === 0, "Deleting the last image did not reset the character cover and count");
  });
  await check("character deletion cascades beyond the immediate three-image batch", async () => {
    const cascadeAssets = [];
    for (let index = 0; index < 4; index++) cascadeAssets.push(await upload(character.id));
    await request(`/api/studio/characters/${character.id}`, { method: "DELETE" }); characters.delete(character.id);
    const ids = cascadeAssets.map(asset => asset.id);
    const deadline = Date.now() + 45000;
    while (true) {
      const [pending] = await db.execute(`SELECT COUNT(*) AS count FROM studio_storage_cleanup WHERE assetId IN (${ids.map(() => "?").join(",")})`, ids);
      if (Number(pending[0].count) === 0 || Date.now() >= deadline) break;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    for (const asset of cascadeAssets) await verifyDeleted(asset.id);
    await request(`/api/studio/characters/${character.id}`, { expected: 404 });
  });
  await check("COS deletion failure persists with backoff and recovers after credentials are restored", async () => {
    const assetId = randomUUID(), jobId = randomUUID(), now = new Date().toISOString();
    assetIds.add(assetId);
    let location = { assetId, bucket: Bucket, region: Region, objectKey: `${objectPrefix}characters/${assetId}.webp`, versionId: null, createdAt: now };
    rememberLocation(location);
    const image = await sharp({ create: { width: 3, height: 3, channels: 3, background: "#198571" } }).webp().toBuffer();
    location = { ...location, ...await putPrivateObject(location, image) }; rememberLocation(location);
    await db.execute("INSERT INTO studio_storage_cleanup(id,assetId,storageType,bucket,region,objectKey,versionId,reason,nextAttemptAt,attempts,lastError,createdAt) VALUES (?,?,'cos',?,?,?,?,'delete',?,0,NULL,?)", [jobId, assetId, location.bucket, location.region, location.objectKey, location.versionId, now, now]);
    cleanupJobIds.add(jobId);
    const originalKey = process.env.COS_SECRET_KEY;
    let failed;
    try {
      process.env.COS_SECRET_KEY = "invalid-integration-secret";
      failed = await drainStorageCleanup(cleanupPool, { limit: 1, ids: [jobId] });
    } finally { process.env.COS_SECRET_KEY = originalKey; }
    ensure(failed.failed === 1 && failed.removed === 0, "A rejected COS deletion was not reported as a retained failed task");
    const [pending] = await db.execute("SELECT attempts,nextAttemptAt,lastError FROM studio_storage_cleanup WHERE id=?", [jobId]);
    ensure(pending.length === 1 && pending[0].attempts === 1 && Date.parse(pending[0].nextAttemptAt) > Date.now() && !!pending[0].lastError, "Failed deletion did not persist attempt count, error code and retry backoff");
    const retained = await cos.getObject(locationArgs(location)); ensure(Buffer.from(retained.Body).equals(image), "The original object must remain available after the rejected deletion");
    await db.execute("UPDATE studio_storage_cleanup SET nextAttemptAt=? WHERE id=? AND assetId=?", [new Date().toISOString(), jobId, assetId]);
    const retried = await drainStorageCleanup(cleanupPool, { limit: 1, ids: [jobId] });
    ensure(retried.removed === 1 && retried.failed === 0, "Restoring credentials did not let the queued deletion finish");
    const [remaining] = await db.execute("SELECT id FROM studio_storage_cleanup WHERE id=?", [jobId]); ensure(remaining.length === 0, "Successful retry left its cleanup task behind");
    await expectMissing(location); locations.delete(assetId); cleanupJobIds.delete(jobId);
  });
  console.log(`PASS all ${completed} COS API integration groups.`);
} catch (error) { safeFailure(step, error); }
finally {
  // Clean only this invocation's exact IDs and names; never sweep a shared prefix.
  if (db && serverConfirmed) {
    for (const [id, name] of characters) {
      try {
        const [rows] = await db.execute("SELECT m.assetId,m.bucket,m.region,m.objectKey,m.versionId,m.createdAt FROM studio_asset_storage m JOIN studio_assets a ON a.id=m.assetId JOIN studio_characters c ON c.id=a.characterId WHERE c.id=? AND c.name=?", [id, name]);
        for (const location of rows) { assetIds.add(location.assetId); rememberLocation(location); }
        safeCleanupCharacters.add(id);
        const [existing] = await db.execute("SELECT id FROM studio_characters WHERE id=? AND name=?", [id, name]);
        if (existing.length) await request(`/api/studio/characters/${id}`, { method: "DELETE", token: "", session: cookie });
      } catch (error) { safeFailure("cleanup own character", error); }
    }
    for (const location of locations.values()) {
      try {
        // The mapping has already been validated as this test's exact object.
        await cos.deleteObject(locationArgs(location)); await expectMissing(location);
        await db.execute("DELETE FROM studio_storage_cleanup WHERE assetId=? AND bucket=? AND region=? AND objectKey=?", [location.assetId, location.bucket, location.region, location.objectKey]);
      } catch (error) { safeFailure("cleanup own COS object", error); }
    }
    for (const [id, name] of characters) {
      if (!safeCleanupCharacters.has(id)) continue;
      try { await db.execute("DELETE FROM studio_characters WHERE id=? AND name=?", [id, name]); }
      catch (error) { safeFailure("cleanup own QA character row", error); }
    }
    for (const [id, name] of keys) {
      try { await db.execute("DELETE FROM studio_agent_keys WHERE id=? AND name=?", [id, name]); }
      catch (error) { safeFailure("cleanup own QA key", error); }
    }
  }
  try { await qa?.cleanup(); } catch (error) { safeFailure("cleanup own QA account and sessions", error); }
  try { await cleanupPool?.end(); } catch (error) { safeFailure("close QA pool", error); }
  db?.destroy();
  if (process.exitCode !== 1) console.log("PASS removed this invocation's QA records and COS objects; unrelated fixtures preserved.");
}
