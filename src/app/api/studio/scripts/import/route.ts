import { handle,success } from "@/lib/api";
import { importScript } from "@/lib/studio-api";
export const runtime="nodejs";
export async function POST(request:Request) { return handle(request,async user=>success(await importScript(request,user!.name),201),{agent:true,write:true}); }
