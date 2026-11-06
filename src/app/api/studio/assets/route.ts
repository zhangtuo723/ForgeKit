import { handle,success } from "@/lib/api";
import { getAssets } from "@/lib/studio-db";
import { uploadAsset } from "@/lib/studio-api";
export const runtime="nodejs";
export async function GET(request:Request) { return handle(request, async () =>{const query=new URL(request.url).searchParams;return success(await getAssets(query.get("characterId")||undefined,query.get("scriptId")||undefined));},{agent:true}); }
export async function POST(request:Request) { return handle(request,async user=>success(await uploadAsset(request,user!.name),201),{agent:true,write:true}); }
