import { body,handle,success } from "@/lib/api";
import { characterById,saveCharacter,deleteCharacter } from "@/lib/studio-api";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context) { return handle(request,async()=>success(await characterById((await context.params).id)),{agent:true}); }
export async function PATCH(request:Request,context:Context) { return handle(request,async user=>{const input=await body(request);return success(await saveCharacter(input,user!.name,await characterById((await context.params).id)));},{agent:true,write:true}); }
export async function DELETE(request:Request,context:Context) { return handle(request,async user=>{await deleteCharacter((await context.params).id,user!.name);return success({ok:true});},{agent:true,write:true}); }
