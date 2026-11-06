import { body, handle, success, ApiError } from "@/lib/api";
import { clearLoginFailures, createSession, loginRateLimited, matchesCredentials, recordLoginFailure, secureCookie, SESSION_COOKIE } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handle(request, async () => {
    const input = await body(request);
    if (typeof input.username !== "string" || typeof input.password !== "string" || input.username.length > 80 || input.password.length > 256) throw new ApiError(400, "请填写有效的账号和密码");
    if (input.remember !== undefined && typeof input.remember !== "boolean") throw new ApiError(400, "记住登录选项格式无效");
    if (await loginRateLimited(input.username)) throw new ApiError(429, "登录尝试过多，请在 15 分钟后重试");
    const account=await matchesCredentials(input.username,input.password);
    if (!account) { await recordLoginFailure(input.username); throw new ApiError(401, "账号或密码不正确"); }
    const session=await createSession(account,input.remember===true);
    if(!session)throw new ApiError(401,"账号状态已变更，请重新登录");
    await clearLoginFailures(input.username);
    const {token,maxAge}=session;
    const response = success({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secureCookie(request), path: "/", maxAge });
    return response;
  }, { public: true, write: true });
}

