import { handle } from "@/lib/api";
import { assetFile } from "@/lib/studio-api";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{id:string}>}) { return handle(request,async()=>assetFile((await context.params).id),{agent:true}); }
