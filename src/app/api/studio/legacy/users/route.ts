import { body, handle, saveUser, success } from "@/lib/api";
import { getUsers } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handle(request, async () => success(await getUsers()));
}
export async function POST(request: Request) {
  return handle(request, async () => success(await saveUser(await body(request)), 201), { write: true });
}

