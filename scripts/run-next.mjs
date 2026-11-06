import { spawn } from "node:child_process";
import { resolve } from "node:path";
import nextEnv from "@next/env";
import { ensureTunnel, stopOwnedProcess } from "./db-tunnel.mjs";
import { createNextProcessEnv } from "./next-runtime-env.mjs";

// Keep shell overrides separate from file-loaded variables. Next must load its
// own .env files so worker restarts do not inherit a stale, already-loaded flag.
const shellEnv = { ...process.env };

const args = process.argv.slice(2);
if (!["dev", "start"].includes(args[0])) {
  console.error("用法：node scripts/run-next.mjs dev|start [Next.js 参数]");
  process.exitCode = 1;
} else {
  const development = args[0] === "dev";
  process.env.NODE_ENV ||= development ? "development" : "production";
  // Avoid printing values or raw parser exceptions from local credential files.
  nextEnv.loadEnvConfig(process.cwd(), development, { info() {}, error() { console.error("本地环境配置加载失败，请检查 .env.local 格式。"); } });
  process.env.NEXT_BUILD_DIR ||= development ? ".next-dev" : ".next";
  const controller = new AbortController();
  let nextProcess; let tunnel; let interrupted = false; let tunnelLost = false;
  const stop = () => {
    if (interrupted) return;
    interrupted = true; controller.abort();
    console.log("正在停止本次启动的服务…");
    void stopOwnedProcess(nextProcess, { tree: true });
  };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  try {
    tunnel = await ensureTunnel({ signal: controller.signal });
    if (!controller.signal.aborted) {
      const childEnv = createNextProcessEnv(shellEnv, process.env, { useTunnel: !!process.env.DB_TUNNEL_HOST });
      nextProcess = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), ...args], { cwd: process.cwd(), env: childEnv, windowsHide: true, detached: process.platform !== "win32", stdio: "inherit" });
      tunnel.child?.once("exit", () => {
        if (interrupted || nextProcess.exitCode !== null || nextProcess.signalCode !== null) return;
        tunnelLost = true;
        console.error("数据库隧道已断开，正在停止本次服务。请检查连接后重新启动。");
        void stopOwnedProcess(nextProcess, { tree: true });
      });
      process.exitCode = await new Promise(resolveExit => {
        nextProcess.once("error", () => { console.error("Next.js 启动失败，请确认已安装项目依赖。"); resolveExit(1); });
        nextProcess.once("exit", (code, signal) => resolveExit(tunnelLost ? 1 : interrupted ? 130 : code ?? (signal ? 1 : 0)));
      });
    } else process.exitCode = 130;
  } catch (error) {
    if (interrupted) process.exitCode = 130;
    else { console.error(error instanceof Error ? error.message : "项目启动失败，请检查数据库连接配置。"); process.exitCode = 1; }
  } finally {
    await stopOwnedProcess(nextProcess, { tree: true });
    await tunnel?.close();
    process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
  }
}
