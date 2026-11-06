import { body,handle,success } from "@/lib/api";
import { getScripts } from "@/lib/studio-db";
import { saveScript,SCRIPT_BODY_LIMIT } from "@/lib/studio-api";
export const runtime="nodejs";
export async function GET(request:Request) { return handle(request, async () =>success(await getScripts()),{agent:true}); }
export async function POST(request:Request) { return handle(request,async user=>success(await saveScript(await body(request,SCRIPT_BODY_LIMIT),user!.name),201),{agent:true,write:true}); }
