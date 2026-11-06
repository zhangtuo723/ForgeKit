import { handle,success } from "@/lib/api";
import { revokeAgentKey } from "@/lib/agent-auth";
export const runtime="nodejs";
export async function DELETE(request:Request,context:{params:Promise<{id:string}>}) { return handle(request,async user=>{await revokeAgentKey((await context.params).id,user!.name);return success({ok:true});},{write:true}); }
