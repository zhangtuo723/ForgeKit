import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import nextEnv from "@next/env";
import { hashPassword } from "../src/lib/password.mjs";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() { console.error("QA environment configuration could not be loaded."); } });

export function qaBaseUrl() {
  const base = new URL(process.env.API_BASE_URL || "http://127.0.0.1:3002");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) || base.protocol !== "http:" || base.port !== "3002" || base.pathname !== "/" || base.username || base.password || base.search || base.hash) throw new Error("QA tests only accept http://localhost:3002.");
  if (process.env.MYSQL_DATABASE !== "forge_studio_test" || process.env.STUDIO_QA_DATABASE !== "forge_studio_test") throw new Error("QA requires MYSQL_DATABASE=STUDIO_QA_DATABASE=forge_studio_test.");
  return base;
}

export async function qaConnection() {
  qaBaseUrl();
  const connection = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: "forge_studio_test", timezone: "Z", connectTimeout: 10000, ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: true, ...(process.env.MYSQL_SSL_CA_FILE ? { ca: readFileSync(process.env.MYSQL_SSL_CA_FILE, "utf8") } : {}) } : undefined });
  const [rows] = await connection.query("SELECT DATABASE() name");
  if (rows[0].name !== "forge_studio_test") { connection.destroy(); throw new Error("QA connection is not using the isolated test database."); }
  return connection;
}

export async function createQaAdmin(base = qaBaseUrl(), { connection } = {}) {
  const verified = qaBaseUrl();
  if (base.origin !== verified.origin) throw new Error("QA API origin mismatch.");
  const db = connection || await qaConnection();
  const [target] = await db.query("SELECT DATABASE() name");
  if (target[0].name !== "forge_studio_test") throw new Error("Refusing QA account creation outside the isolated test database.");
  const id = randomUUID(); const username = `qa_${randomBytes(12).toString("hex")}`;
  const password = `${randomBytes(27).toString("base64url")}Aa1!`;
  const name = `QA ${id.slice(0,8)}`;
  const now = new Date().toISOString();
  let created = false; let proofHash = ""; let cleaned = false;
  async function cleanup() {
    if (cleaned) return;
    try {
      if (proofHash) await db.execute("DELETE FROM admin_sessions WHERE tokenHash=? AND userId=?", [proofHash, id]);
      if (created) await db.execute("DELETE FROM admin_accounts WHERE id=? AND username=?", [id, username]);
      await db.execute("DELETE FROM login_attempts WHERE `key`=?", [`login:${createHash("sha256").update(username).digest("hex").slice(0,58)}`]);
      cleaned = true;
    } finally { if (!connection) db.destroy(); }
  }
  try {
    const encoded = await hashPassword(password);
    await db.execute("INSERT INTO admin_accounts(id,username,passwordHash,name,role,isActive,createdAt,updatedAt) VALUES (?,?,?,?,?,1,?,?)", [id, username, encoded, name, "超级管理员", now, now]); created = true;
    // A random, account-bound session exists only in the verified QA database.
    // Prove the API reads that DB before any login POST or other API mutations.
    const proofToken = randomBytes(32).toString("hex"); proofHash = createHash("sha256").update(proofToken).digest("hex");
    await db.execute("INSERT INTO admin_sessions(tokenHash,userId,expiresAt) VALUES (?,?,?)", [proofHash, id, Date.now() + 5 * 60 * 1000]);
    const response = await fetch(new URL("/api/studio/auth/me", base), { headers: { Cookie: `forge_admin_session=${proofToken}` }, redirect: "manual", signal: AbortSignal.timeout(30000) });
    const body = await response.json().catch(() => null);
    if (response.status !== 200 || body?.data?.user?.username !== username || body?.data?.user?.name !== name) throw new Error("QA API did not authenticate the isolated database account; no API mutations were performed.");
    await db.execute("DELETE FROM admin_sessions WHERE tokenHash=? AND userId=?", [proofHash, id]); proofHash = "";
    return { id, username, password, name, db, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
