import { body,handle,success } from "@/lib/api";
import { assetById,renameAsset,deleteAsset } from "@/lib/studio-api";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context) { return handle(request,async()=>success(await assetById((await context.params).id)),{agent:true}); }
export async function PATCH(request:Request,context:Context) { return handle(request,async user=>{const input=await body(request);return success(await renameAsset((await context.params).id,input,user!.name));},{agent:true,write:true}); }
export async function DELETE(request:Request,context:Context) { return handle(request,async user=>{await deleteAsset((await context.params).id,user!.name);return success({ok:true});},{agent:true,write:true}); }
