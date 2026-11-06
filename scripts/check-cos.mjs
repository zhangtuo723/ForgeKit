import { randomUUID } from "node:crypto";
import COS from "cos-nodejs-sdk-v5";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() { console.error("本地配置无法加载，请检查 .env.local。"); } });

const required = ["COS_BUCKET", "COS_REGION", "COS_SECRET_ID", "COS_SECRET_KEY"];
const missing = required.filter(key => !process.env[key]?.trim());
if (missing.length) {
  console.error(`缺少配置：${missing.join("、")}`);
  process.exitCode = 1;
} else {
  const Bucket = process.env.COS_BUCKET.trim();
  const Region = process.env.COS_REGION.trim();
  const prefix = (process.env.COS_PREFIX || "forge-studio/").replace(/^\/+|\/+$/g, "");
  if (!/^[a-z0-9-]+-\d+$/.test(Bucket) || !/^[a-z]{2}-[a-z0-9-]+$/.test(Region) || /[\r\n]/.test(prefix) || prefix.split("/").includes("..")) {
    throw new Error("COS 存储桶、地域或目录配置格式不正确。");
  }
  const id = randomUUID();
  const Key = `${prefix ? `${prefix}/` : ""}characters/_connection-tests/${id}.txt`;
  const Body = Buffer.from(`Forge Studio COS connectivity test.\n${id}\n`, "utf8");
  const cos = new COS({
    SecretId: process.env.COS_SECRET_ID.trim(),
    SecretKey: process.env.COS_SECRET_KEY.trim(),
    ...(process.env.COS_SESSION_TOKEN ? { SecurityToken: process.env.COS_SESSION_TOKEN } : {}),
    Protocol: "https:", StrictSsl: true, Timeout: 15000,
    UploadCheckContentMd5: true,
  });
  let attempted = false; let uploaded = false; let versionId;
  let step = "上传私有测试文件";
  function reportFailure(label, error) {
    // Never print the SDK error object, URL, Authorization header or credentials.
    const candidate = error?.error?.Code || error?.code || "UNKNOWN_ERROR";
    const code = /^[A-Za-z0-9_-]{1,80}$/.test(String(candidate)) ? String(candidate) : "UNKNOWN_ERROR";
    const status = Number(error?.statusCode || 0);
    console.error(`FAIL ${label}：${code}${status ? `（HTTP ${status}）` : ""}`);
  }
  try {
    console.log(`测试目标：${Bucket} / ${Region}`);
    attempted = true;
    const result = await cos.putObject({ Bucket, Region, Key, Body, ContentType: "text/plain; charset=utf-8", ContentLength: Body.length, ACL: "private", CacheControl: "no-store" });
    uploaded = true; versionId = result.VersionId;
    console.log("PASS 私有文件上传");

    step = "读取并校验文件内容";
    const downloaded = await cos.getObject({ Bucket, Region, Key, ...(versionId ? { VersionId: versionId } : {}) });
    if (!Buffer.from(downloaded.Body).equals(Body)) throw Object.assign(new Error(), { code: "CONTENT_MISMATCH" });
    console.log("PASS 签名读取，文件内容完整一致");

    step = "验证匿名访问";
    const url = `https://${Bucket}.cos.${Region}.myqcloud.com/${Key.split("/").map(encodeURIComponent).join("/")}`;
    const anonymous = await fetch(url, { headers: { Range: "bytes=0-0" }, redirect: "error", signal: AbortSignal.timeout(15000) });
    await anonymous.body?.cancel();
    if (anonymous.status === 401 || anonymous.status === 403) console.log(`PASS 私有测试文件拒绝匿名访问（HTTP ${anonymous.status}）`);
    else if (anonymous.ok) { console.error("FAIL 私有测试文件仍可匿名读取，需要检查存储桶策略。"); process.exitCode = 1; }
    else { console.error(`FAIL 无法确认匿名访问控制（HTTP ${anonymous.status}）`); process.exitCode = 1; }
  } catch (error) {
    reportFailure(step, error); process.exitCode = 1;
  } finally {
    // Only this invocation's random, synthetic object is eligible for cleanup.
    if (attempted) {
      try {
        await cos.deleteObject({ Bucket, Region, Key, ...(versionId ? { VersionId: versionId } : {}) });
        console.log(uploaded ? "PASS 删除临时测试文件" : "已执行本次测试对象的清理请求");
        if (uploaded) {
          try {
            await cos.getObject({ Bucket, Region, Key });
            console.error("FAIL 删除后仍能读取测试文件"); process.exitCode = 1;
          } catch (error) {
            if (error?.statusCode === 404 || error?.error?.Code === "NoSuchKey") console.log("PASS 确认测试文件已不存在");
            else { reportFailure("确认删除结果", error); process.exitCode = 1; }
          }
        }
      } catch (error) {
        reportFailure("清理临时测试文件", error);
        console.error(`待核实的测试对象：${Key}`);
        process.exitCode = 1;
      }
    }
  }
}
