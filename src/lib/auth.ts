import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { execute, first, transaction, addActivity } from "./db";
import { validateUsername,verifyPassword } from "./password.mjs";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "forge_admin_session";
type Account = SessionUser & { id:string; passwordHash:string; isActive:number };
export type AuthenticatedAccount = Account;
const digest = (value:string)=>createHash("sha256").update(value).digest();
const dummyHash="scrypt$v1$32768$8$3$64$"+"0".repeat(32)+"$"+"0".repeat(128);

export async function matchesCredentials(username:string,password:string):Promise<AuthenticatedAccount|null> {
  const account=validateUsername(username)?await first<Account>("SELECT id,username,passwordHash,name,role,isActive FROM admin_accounts WHERE username=?",[username]):undefined;
  // Unknown accounts still incur the same KDF work; no default credentials exist.
  const valid=await verifyPassword(password,account?.passwordHash||dummyHash);
  return account&&account.isActive&&valid?account:null;
}
export async function createSession(account:AuthenticatedAccount,remember:boolean) {
  const token=randomBytes(32).toString("hex"),maxAge=(remember?7*24:12)*3600;
  return transaction(async connection=>{
    const current=await first<Account>("SELECT id,username,passwordHash,name,role,isActive FROM admin_accounts WHERE id=? FOR UPDATE",[account.id],connection);
    if(!current||!current.isActive||!timingSafeEqual(digest(current.passwordHash),digest(account.passwordHash)))return null;
    await execute("DELETE FROM admin_sessions WHERE expiresAt<=?",[Date.now()],connection);
    await execute("INSERT INTO admin_sessions(tokenHash,userId,expiresAt) VALUES (?,?,?)",[digest(token).toString("hex"),current.id,Date.now()+maxAge*1000],connection);
    await addActivity("登录了管理系统",current.username,"system",current.name,connection);
    await execute("INSERT INTO studio_activities(id,actor,action,target,type,createdAt) VALUES (?,?,?,?,?,?)",[randomUUID(),current.name,"登录了工作室",current.username,"system",new Date().toISOString()],connection);
    return {token,maxAge};
  });
}
export async function getSession():Promise<SessionUser|null> {
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const account=await first<SessionUser>("SELECT a.username,a.name,a.role FROM admin_sessions s JOIN admin_accounts a ON a.id=s.userId WHERE s.tokenHash=? AND s.expiresAt>? AND a.isActive=1",[digest(token).toString("hex"),Date.now()]);
  return account?{username:account.username,name:account.name,role:account.role}:null;
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/studio/login");
  return session;
}

export async function removeSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) await execute("DELETE FROM admin_sessions WHERE tokenHash=?",[digest(token).toString("hex")]);
}

const loginRateKey=(username:string)=>`login:${digest(username).toString("hex").slice(0,58)}`;
export async function loginRateLimited(username:string): Promise<boolean> {
  const now=Date.now();
  await execute("DELETE FROM login_attempts WHERE windowStart < ?",[now-15*60*1000]);
  const attempts=await first<{count:number}>("SELECT count FROM login_attempts WHERE `key`=?",[loginRateKey(username)]);
  return !!attempts && attempts.count>=10;
}
export async function recordLoginFailure(username:string) {
  await execute("INSERT INTO login_attempts(`key`,count,windowStart) VALUES (?,1,?) ON DUPLICATE KEY UPDATE count=count+1",[loginRateKey(username),Date.now()]);
}
export async function clearLoginFailures(username:string) { await execute("DELETE FROM login_attempts WHERE `key`=?",[loginRateKey(username)]); }

export function secureCookie(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host")?.split(":")[0] || url.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || url.hostname === "[::1]";
  // No client-supplied forwarded header can downgrade production cookies.
  return url.protocol === "https:" || (process.env.NODE_ENV === "production" && !local);
}
