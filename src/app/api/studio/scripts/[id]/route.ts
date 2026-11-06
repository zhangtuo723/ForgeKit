import { body,handle,success } from "@/lib/api";
import { scriptById,saveScript,deleteScript,SCRIPT_BODY_LIMIT } from "@/lib/studio-api";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context) { return handle(request,async()=>success(await scriptById((await context.params).id)),{agent:true}); }
export async function PATCH(request:Request,context:Context) { return handle(request,async user=>{const input=await body(request,SCRIPT_BODY_LIMIT);return success(await saveScript(input,user!.name,await scriptById((await context.params).id)));},{agent:true,write:true}); }
export async function DELETE(request:Request,context:Context) { return handle(request,async user=>{await deleteScript((await context.params).id,user!.name);return success({ok:true});},{agent:true,write:true}); }
