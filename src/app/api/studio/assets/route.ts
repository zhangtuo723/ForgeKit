import { handle,success } from "@/lib/api";
import { listAssets } from "@/lib/studio-db";
import { uploadAsset } from "@/lib/studio-api";
import { listOptions } from "@/lib/pagination";
export const runtime="nodejs";
export async function GET(request:Request) { return handle(request, async () =>Response.json(await listAssets(listOptions(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}}),{agent:true}); }
export async function POST(request:Request) { return handle(request,async user=>success(await uploadAsset(request,user!.name),201),{agent:true,write:true}); }
