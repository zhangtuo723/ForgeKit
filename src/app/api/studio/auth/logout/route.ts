import { handle, success } from "@/lib/api";
import { removeSession, secureCookie, SESSION_COOKIE } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handle(request, async () => {
    await removeSession();
    const response = success({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: secureCookie(request), path: "/", maxAge: 0 });
    return response;
  }, { public: true, write: true });
}

