import nextEnv from "@next/env";
import { ensureTunnel, verifyMysql } from "./db-tunnel.mjs";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info() {}, error() { console.error("本地环境配置加载失败，请检查 .env.local 格式。"); } });
const controller = new AbortController();
let tunnel;
const stop = () => controller.abort();
process.on("SIGINT", stop); process.on("SIGTERM", stop);
try {
  tunnel = await ensureTunnel({ signal: controller.signal });
  const result = await verifyMysql({ details: true });
  if (controller.signal.aborted) process.exitCode = 130;
  else {
    console.log("MySQL 连接检查通过。");
    console.log(`数据库：${result.database}`);
    console.log(`版本：${result.version}`);
    console.log(`会话时区：${result.timezone}（UTC）`);
    console.log(`服务器 UTC 时间：${result.utcNow instanceof Date ? result.utcNow.toISOString() : result.utcNow}`);
  }
} catch (error) {
  if (controller.signal.aborted) process.exitCode = 130;
  else { console.error(error instanceof Error ? error.message : "数据库检查失败。"); process.exitCode = 1; }
} finally {
  await tunnel?.close();
  process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
}
