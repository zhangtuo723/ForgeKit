import { handle, success } from "@/lib/api";
import { getActivities } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handle(request, async () => success(await getActivities(250)));
}

