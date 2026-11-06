import { success } from "@/lib/api";
import { first } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { await first("SELECT 1 AS connected"); return success({ status: "ok", database: "mysql" }); }
  catch { return Response.json({error:"数据库暂时无法连接"},{status:503,headers:{"Cache-Control":"no-store"}}); }
}

