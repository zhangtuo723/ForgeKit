import { body,handle,success } from "@/lib/api";
import { listAgentKeys,createAgentKey } from "@/lib/agent-auth";
export const runtime="nodejs";
export async function GET(request:Request) { return handle(request, async () =>success(await listAgentKeys())); }
export async function POST(request:Request) { return handle(request,async user=>success(await createAgentKey(await body(request),user!.name),201),{write:true}); }
