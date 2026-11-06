import { handle, success } from "@/lib/api";
import { getSettings } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handle(request, async user => success({ user, settings: await getSettings() }));
}

