import { handle,success } from "@/lib/api";
import { getStudioActivities } from "@/lib/studio-db";
export const runtime="nodejs";
export async function GET(request:Request) { return handle(request, async () =>success(await getStudioActivities()),{agent:true}); }
