import { body,handle,success } from "@/lib/api";
import { getCharacters } from "@/lib/studio-db";
import { saveCharacter } from "@/lib/studio-api";
import { listOptions } from "@/lib/pagination";
export const runtime="nodejs";
export async function GET(request:Request) { return handle(request, async () =>Response.json(await getCharacters(listOptions(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}}),{agent:true}); }
export async function POST(request:Request) { return handle(request,async user=>success(await saveCharacter(await body(request),user!.name),201),{agent:true,write:true}); }
