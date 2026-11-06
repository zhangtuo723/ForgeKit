import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute } from "node:path";
import { createConnection as tcpConnect } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import mysql from "mysql2/promise";

const stops = new WeakMap();
const noop = async () => {};

function port(value, fallback, label) {
  const parsed = value ? Number(value) : fallback;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error(`${label} 必须是 1 到 65535 之间的端口。`);
  return parsed;
}

function codeOf(error) {
  const value = error && typeof error === "object" ? error.code : "";
  return typeof value === "string" && /^[A-Z0-9_]{1,60}$/.test(value) ? value : "DB_CONNECTION_FAILED";
}

function abortIfNeeded(signal) {
  if (signal?.aborted) throw new Error("启动已取消。");
}

async function absoluteReadableFile(value, label) {
  if (!value || !isAbsolute(value) || /[\r\n"]/.test(value)) throw new Error(`${label} 必须配置为有效的绝对文件路径。`);
  try { await access(value, constants.R_OK); }
  catch { throw new Error(`${label} 指定的文件不可读取，请检查配置和文件权限。`); }
  return value;
}

export async function tcpReady(host, portNumber, timeout = 700) {
  return new Promise(resolve => {
    const socket = tcpConnect({ host, port: portNumber });
    let done = false;
    const finish = value => { if (done) return; done = true; socket.destroy(); resolve(value); };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

async function mysqlOptions() {
  const missing = ["MYSQL_USER", "MYSQL_DATABASE", "MYSQL_PASSWORD"].filter(name => process.env[name] === undefined || (name !== "MYSQL_PASSWORD" && !process.env[name]));
  if (missing.length) throw new Error(`请在本地环境配置中填写 ${missing.join("、")}。`);
  let ssl;
  if (process.env.MYSQL_SSL === "true") {
    ssl = { rejectUnauthorized: true };
    if (process.env.MYSQL_SSL_CA_FILE) {
      try { ssl.ca = await readFile(process.env.MYSQL_SSL_CA_FILE, "utf8"); }
      catch { throw new Error("MYSQL_SSL_CA_FILE 证书不可读取。"); }
    }
  }
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: port(process.env.MYSQL_PORT, process.env.DB_TUNNEL_HOST ? 13306 : 3306, "MYSQL_PORT"),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    connectTimeout: 10000,
    charset: "utf8mb4",
    timezone: "Z",
    ...(ssl ? { ssl } : {}),
  };
}

// Never forward mysql2 errors: their messages can contain connection details.
export async function verifyMysql({ details = false } = {}) {
  const options = await mysqlOptions();
  let connection;
  try {
    connection = await mysql.createConnection(options);
    const [rows] = await connection.query({ sql: "SELECT 1 AS connection_ok", timeout: 10000 });
    if (rows[0]?.connection_ok !== 1) throw new Error("Unexpected health response");
    if (!details) return { ok: true };
    await connection.query({ sql: "SET time_zone = '+00:00'", timeout: 10000 });
    const [info] = await connection.query({ sql: "SELECT DATABASE() AS database_name, VERSION() AS version, @@session.time_zone AS session_timezone, UTC_TIMESTAMP() AS utc_now", timeout: 10000 });
    return { ok: true, database: info[0].database_name, version: info[0].version, timezone: info[0].session_timezone, utcNow: info[0].utc_now };
  } catch (error) {
    const code = codeOf(error);
    if (code === "ER_ACCESS_DENIED_ERROR" || code === "ER_DBACCESS_DENIED_ERROR") throw new Error(`MySQL 认证或数据库授权失败（${code}），请检查本地凭证和数据库账号权限。`);
    if (code === "ER_BAD_DB_ERROR") throw new Error("目标 MySQL 数据库不存在，请先创建数据库。");
    throw new Error(`MySQL 连接验证失败（${code}），请检查服务、端口和连接配置。`);
  } finally { connection?.destroy(); }
}

function childExited(child) {
  return !child || child.exitCode !== null || child.signalCode !== null;
}

async function waitForExit(child, timeout) {
  if (childExited(child)) return;
  await new Promise(resolve => {
    const done = () => { clearTimeout(timer); child.removeListener("exit", done); child.removeListener("error", done); resolve(); };
    const timer = setTimeout(done, timeout);
    child.once("exit", done); child.once("error", done);
  });
}

// Only call this for a ChildProcess created by this invocation. No port-based kills.
export function stopOwnedProcess(child, { tree = false } = {}) {
  if (!child || !child.pid || childExited(child)) return Promise.resolve();
  if (stops.has(child)) return stops.get(child);
  const work = (async () => {
    if (process.platform === "win32" && tree) {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      // Handle errors even when taskkill is unavailable; the fallback stays scoped.
      await new Promise(resolve => { killer.once("error", resolve); killer.once("exit", resolve); });
      if (!childExited(child)) child.kill();
    } else {
      try {
        if (tree && process.platform !== "win32") process.kill(-child.pid, "SIGTERM");
        else child.kill("SIGTERM");
      } catch { /* The owned process may have exited concurrently. */ }
    }
    await waitForExit(child, 4000);
    if (!childExited(child)) {
      try {
        if (tree && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch { /* Already exited. */ }
      await waitForExit(child, 1000);
    }
  })();
  stops.set(child, work);
  return work;
}

export async function ensureTunnel({ signal, log = console.log } = {}) {
  abortIfNeeded(signal);
  const remoteHost = process.env.DB_TUNNEL_HOST;
  if (!remoteHost) return { mode: "direct", owned: false, child: null, close: noop };
  if (/^[\s-]|[\s\r\n]/.test(remoteHost)) throw new Error("DB_TUNNEL_HOST 格式无效。");
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error("使用 SSH 隧道时，MYSQL_HOST 必须为本机回环地址。");
  const localPort = port(process.env.MYSQL_PORT, 13306, "MYSQL_PORT");
  const sshPort = port(process.env.DB_TUNNEL_PORT, 22, "DB_TUNNEL_PORT");
  const user = process.env.DB_TUNNEL_USER || "forge_tunnel";
  if (!/^[a-zA-Z0-9_.-]+$/.test(user) || user.startsWith("-")) throw new Error("DB_TUNNEL_USER 格式无效。");
  process.env.MYSQL_HOST = host;
  process.env.MYSQL_PORT = String(localPort);
  process.env.MYSQL_SSL = "false"; // SSH encrypts transport to the loopback-only MySQL service.

  if (await tcpReady(host, localPort)) {
    abortIfNeeded(signal);
    try { await verifyMysql(); }
    catch (error) { throw new Error(`本地数据库端口已被占用，但未通过 MySQL 验证；不会修改或终止已有服务。${error.message}`); }
    abortIfNeeded(signal);
    log("已验证并复用现有数据库连接。");
    return { mode: "reused", owned: false, child: null, close: noop };
  }

  const key = await absoluteReadableFile(process.env.DB_TUNNEL_KEY_FILE, "DB_TUNNEL_KEY_FILE");
  const knownHosts = await absoluteReadableFile(process.env.DB_TUNNEL_KNOWN_HOSTS_FILE, "DB_TUNNEL_KNOWN_HOSTS_FILE");
  const bind = host.includes(":") ? `[${host}]` : host;
  const args = [
    "-N", "-T", "-F", "none", "-p", String(sshPort), "-i", key,
    "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "IdentityAgent=none",
    "-o", "StrictHostKeyChecking=yes", "-o", `UserKnownHostsFile="${knownHosts.replace(/\\/g, "/")}"`,
    "-o", "UpdateHostKeys=no", "-o", "ExitOnForwardFailure=yes",
    "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=3", "-o", "ConnectTimeout=10",
    "-L", `${bind}:${localPort}:127.0.0.1:3306`, `${user}@${remoteHost}`,
  ];
  const child = spawn(process.env.SSH_BINARY || "ssh", args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  let launchFailed = false; let failureHint = "";
  child.once("error", () => { launchFailed = true; });
  // Recognize only fixed categories; never echo raw SSH output or command arguments.
  child.stderr.on("data", buffer => {
    const output = buffer.toString();
    if (/host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/i.test(output)) failureHint = "SSH 主机指纹验证失败，请核对专用 known_hosts 文件。";
    else if (/permission denied|load key|identity file/i.test(output)) failureHint = "SSH 密钥认证失败，请检查专用密钥文件与隧道账号权限。";
    else if (/address already in use|cannot listen/i.test(output)) failureHint = "本地转发端口已被其他进程占用。";
  });
  const close = () => stopOwnedProcess(child);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      abortIfNeeded(signal);
      if (launchFailed) throw new Error("无法启动 OpenSSH，请安装 ssh 或配置 SSH_BINARY。");
      if (childExited(child)) throw new Error(failureHint || "SSH 隧道启动失败，请检查服务器地址、网络和专用密钥配置。");
      if (await tcpReady(host, localPort, 300)) { ready = true; break; }
      await delay(150, undefined, signal ? { signal } : undefined);
    }
    if (!ready) throw new Error("等待数据库隧道就绪超时，请检查网络及服务器 SSH 服务。");
    await verifyMysql();
    abortIfNeeded(signal);
    if (launchFailed || childExited(child)) throw new Error(failureHint || "SSH 隧道在连接验证时断开。");
    log("数据库 SSH 隧道已连接，MySQL 验证通过。");
    return { mode: "created", owned: true, child, close };
  } catch (error) { await close(); throw error; }
}
