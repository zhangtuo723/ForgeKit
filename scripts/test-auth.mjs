import { randomBytes, createHash, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import { createQaAdmin, qaBaseUrl } from "./qa-admin.mjs";
import { hashPassword, verifyPassword } from "../src/lib/password.mjs";

const base = qaBaseUrl();
const derive = promisify(scrypt);
let first, second, cliUsername, cookie = "", otherCookie = "", completed = 0, step = "isolated fixtures";
const cliOnly = process.argv.includes("--cli-only");
function ensure(condition, message) { if (!condition) throw Object.assign(new Error(message), { safeMessage: message }); }
function failure(label, error) {
  const value = String(error?.code || "AUTH_TEST_FAILED");
  console.error(`FAIL ${label}: ${error?.safeMessage || (/^[A-Z0-9_]{1,80}$/.test(value) ? value : "AUTH_TEST_FAILED")}`);
  process.exitCode = 1;
}
async function check(label, action) { step = label; await action(); completed++; console.log(`PASS ${label}`); }
async function request(path, { method = "GET", data, session = cookie, status = 200 } = {}) {
  const response = await fetch(new URL(path, base), { method, redirect: "manual", signal: AbortSignal.timeout(30000), headers: { Origin: base.origin, ...(session ? { Cookie: session } : {}), ...(data ? { "Content-Type": "application/json" } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const body = await response.json().catch(() => null);
  ensure(response.status === status, `${method} ${path}: expected HTTP ${status}, received ${response.status}`);
  return { response, body };
}
async function login(account, password = account.password, remember = false, status = 200) {
  const result = await request("/api/studio/auth/login", { method: "POST", data: { username: account.username, password, remember }, session: "", status });
  return { ...result, cookie: (result.response.headers.get("set-cookie") || "").split(";")[0] };
}
const tokenHash = session => createHash("sha256").update(session.slice(session.indexOf("=") + 1)).digest("hex");
async function sessionRow(session) { const [rows] = await first.db.execute("SELECT tokenHash,userId,expiresAt FROM admin_sessions WHERE tokenHash=?", [tokenHash(session)]); return rows[0]; }
async function accountRow() { const [rows] = await first.db.execute("SELECT * FROM admin_accounts WHERE id=?", [first.id]); return rows[0]; }
async function adminCommand(username, password, { reset = false, expected = 0 } = {}) {
  const child = spawn(process.execPath, ["scripts/set-admin.mjs", "--username", username, "--password-stdin", ...(reset ? ["--reset-password"] : [])], { cwd: process.cwd(), env: process.env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", data => { output += data; }); child.stderr.on("data", data => { output += data; });
  child.stdin.on("error", () => {});
  const result = new Promise((resolve, reject) => { child.once("error", () => reject(Object.assign(new Error(), { safeMessage: "Could not start administrator reset command" }))); child.once("exit", code => resolve(code)); });
  const timeout = setTimeout(() => child.kill(), 30000);
  try {
    child.stdin.end(`${password}\n`);
    ensure(await result === expected, "Administrator command returned an unexpected exit status; its output was withheld");
    ensure(!output.includes(password), "Administrator command exposed a password in its output");
  } finally { clearTimeout(timeout); if (child.exitCode === null && child.signalCode === null) child.kill(); }
}

try {
  first = await createQaAdmin(base);
  if (!cliOnly) {
  second = await createQaAdmin(base);
  await check("salted scrypt hashes are independent, verifiable and never plaintext", async () => {
    const encoded = await hashPassword(first.password), another = await hashPassword(first.password);
    ensure(encoded !== another, "Repeated hashing reused a salt");
    const parts = encoded.split("$");
    ensure(parts.length === 8 && parts[0] === "scrypt" && parts[1] === "v1", "Password hash version format is invalid");
    ensure(parts[2] === "32768" && parts[3] === "8" && parts[4] === "3" && parts[5] === "64", "Password hash parameters differ from the intended scrypt settings");
    ensure(/^[a-f0-9]{32,128}$/.test(parts[6]) && /^[a-f0-9]{128}$/.test(parts[7]), "Password salt or digest has an invalid encoding");
    const derived = await derive(first.password, Buffer.from(parts[6], "hex"), Number(parts[5]), { N: Number(parts[2]), r: Number(parts[3]), p: Number(parts[4]), maxmem: 128 * 1024 * 1024 });
    ensure(derived.toString("hex") === parts[7], "Independent Node scrypt derivation does not match the stored hash format");
    ensure(await verifyPassword(first.password, encoded), "Correct password verification failed");
    ensure(!await verifyPassword(`${first.password}-wrong`, encoded) && !await verifyPassword(first.password, "invalid-format"), "Wrong password or malformed hash was accepted");
    const account = await accountRow(); ensure(account.passwordHash !== first.password && !account.passwordHash.includes(first.password), "Database contains plaintext password material");
    ensure(await verifyPassword(first.password, account.passwordHash), "Database account hash does not verify");
  });
  await check("incorrect password, absent account and legacy fixed login are rejected", async () => {
    const wrong = await login(first, `${first.password}-wrong`, false, 401);
    const absent = await login({ username: `qa_missing_${randomBytes(6).toString("hex")}`, password: first.password }, undefined, false, 401);
    ensure(wrong.body?.error === absent.body?.error, "Unknown user and wrong password have different public errors");
    const [legacy] = await first.db.execute("SELECT id FROM admin_accounts WHERE username='admin'");
    ensure(legacy.length === 0, "Legacy-login rejection test requires no independently provisioned admin account in QA");
    // Negative regression only: the old public default must not be a login fallback.
    await login({ username: "admin", password: "ForgeKit@2026" }, undefined, false, 401);
  });
  await check("normal login creates a hashed, account-bound twelve-hour session", async () => {
    const result = await login(first); cookie = result.cookie;
    const header = result.response.headers.get("set-cookie") || "";
    ensure(/HttpOnly/i.test(header) && /SameSite=Lax/i.test(header) && /Path=\//i.test(header) && /Max-Age=43200(?:;|$)/i.test(header), "Standard session cookie has incorrect protection or lifetime");
    const session = await sessionRow(cookie);
    ensure(session?.userId === first.id && session.tokenHash === tokenHash(cookie), "Session is not bound to its database account and hashed token");
    ensure(Math.abs(Number(session.expiresAt) - Date.now() - 43200000) < 15000, "Standard session expiry is incorrect");
    ensure(session.tokenHash !== cookie.split("=")[1], "Database stored the session token in plaintext");
    const me = (await request("/api/studio/auth/me")).body.data.user;
    ensure(me.username === first.username && me.name === first.name && !("passwordHash" in me), "Session identity is incorrect or contains its password hash");
  });
  await check("sessions resolve distinct accounts and immediately respect account status", async () => {
    otherCookie = (await login(second)).cookie;
    ensure((await request("/api/studio/auth/me", { session: otherCookie })).body.data.user.username === second.username, "Second account resolved to a different administrator");
    await first.db.execute("UPDATE admin_accounts SET name=? WHERE id=?", ["QA updated display name", first.id]);
    ensure((await request("/api/studio/auth/me")).body.data.user.name === "QA updated display name", "Session identity did not refresh from the account record");
    await first.db.execute("UPDATE admin_accounts SET isActive=0 WHERE id=?", [first.id]);
    try { await request("/api/studio/auth/me", { status: 401 }); await login(first, undefined, false, 401); }
    finally { await first.db.execute("UPDATE admin_accounts SET isActive=1 WHERE id=?", [first.id]); }
    ensure((await request("/api/studio/auth/me", { session: otherCookie })).body.data.user.username === second.username, "Disabling one account affected the other account session");
  });
  await check("expired sessions are rejected and remember-me lasts seven days", async () => {
    await first.db.execute("UPDATE admin_sessions SET expiresAt=? WHERE tokenHash=? AND userId=?", [Date.now() - 1, tokenHash(cookie), first.id]);
    await request("/api/studio/auth/me", { status: 401 });
    const remembered = await login(first, undefined, true); cookie = remembered.cookie;
    ensure(/Max-Age=604800(?:;|$)/i.test(remembered.response.headers.get("set-cookie") || ""), "Remember-me cookie lifetime is not seven days");
    const session = await sessionRow(cookie); ensure(session?.userId === first.id && Math.abs(Number(session.expiresAt) - Date.now() - 604800000) < 15000, "Remember-me database expiry is incorrect");
  });
  await check("logout removes the database session as well as the cookie", async () => {
    const previous = cookie;
    const result = await request("/api/studio/auth/logout", { method: "POST" });
    ensure(/Max-Age=0(?:;|$)/i.test(result.response.headers.get("set-cookie") || ""), "Logout did not expire the browser cookie");
    await request("/api/studio/auth/me", { status: 401 }); ensure(!await sessionRow(previous), "Logout left the stored session active"); cookie = "";
  });
  await check("password reset via stdin revokes only that account's existing sessions", async () => {
    const oldHash = (await accountRow()).passwordHash;
    const oldCookies = [(await login(first)).cookie, (await login(first, undefined, true)).cookie];
    const newPassword = `${randomBytes(27).toString("base64url")}Aa2!`;
    await adminCommand(first.username, newPassword, { reset: true });
    const account = await accountRow();
    ensure(account.id === first.id && account.passwordHash !== oldHash && await verifyPassword(newPassword, account.passwordHash) && !await verifyPassword(first.password, account.passwordHash), "Reset did not replace the account hash correctly");
    for (const old of oldCookies) { await request("/api/studio/auth/me", { session: old, status: 401 }); ensure(!await sessionRow(old), "Reset left an old session in the database"); }
    await login(first, undefined, false, 401);
    cookie = (await login(first, newPassword)).cookie;
    ensure((await request("/api/studio/auth/me")).body.data.user.username === first.username, "Reset account cannot log in with the new password");
    ensure((await request("/api/studio/auth/me", { session: otherCookie })).body.data.user.username === second.username, "Reset invalidated another account's session");
  });
  await check("deleted account invalidates its previously issued session", async () => {
    await second.cleanup();
    await request("/api/studio/auth/me", { session: otherCookie, status: 401 });
    ensure(!await sessionRow(otherCookie), "Deleted account left a bound session behind");
  });
  }
  await check("CLI creates a database account through stdin and refuses accidental replacement", async () => {
    cliUsername = `qa_cli_${randomBytes(12).toString("hex")}`;
    const password = `  ${randomBytes(24).toString("base64url")}Aa1!  `;
    await adminCommand(cliUsername, password);
    const [created] = await first.db.execute("SELECT id,passwordHash FROM admin_accounts WHERE username=?", [cliUsername]);
    ensure(created.length === 1 && await verifyPassword(password, created[0].passwordHash), "CLI did not create a correctly hashed account");
    ensure(!await verifyPassword(password.trim(), created[0].passwordHash), "CLI removed intentional leading or trailing password spaces");
    const account = { username: cliUsername, password };
    const issued = await login(account);
    ensure((await request("/api/studio/auth/me", { session: issued.cookie })).body.data.user.username === cliUsername, "CLI-created account cannot authenticate");
    await adminCommand(cliUsername, `${randomBytes(24).toString("base64url")}Aa2!`, { expected: 1 });
    const [preserved] = await first.db.execute("SELECT passwordHash FROM admin_accounts WHERE id=?", [created[0].id]);
    ensure(preserved[0].passwordHash === created[0].passwordHash, "Repeated create changed the existing password hash without an explicit reset");
    await request("/api/studio/auth/me", { session: issued.cookie });
  });
  console.log(`PASS all ${completed} database-account authentication groups.`);
} catch (error) { failure(step, error); }
finally {
  if (cliUsername && first) {
    try {
      await first.db.execute("DELETE FROM admin_accounts WHERE username=?", [cliUsername]);
      await first.db.execute("DELETE FROM login_attempts WHERE `key`=?", [`login:${createHash("sha256").update(cliUsername).digest("hex").slice(0,58)}`]);
    } catch (error) { failure("cleanup CLI-created QA account", error); }
  }
  for (const account of [second, first]) {
    try { await account?.cleanup(); } catch (error) { failure("cleanup isolated QA account", error); }
  }
  if (process.exitCode !== 1) console.log("PASS temporary accounts and their sessions removed; no passwords or tokens printed.");
}
