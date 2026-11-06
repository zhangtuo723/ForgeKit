import { body,handle,success } from "@/lib/api";
import { getCharacters } from "@/lib/studio-db";
import { saveCharacter } from "@/lib/studio-api";
export const runtime="nodejs";
export async function GET(request:Request) { return handle(request, async () =>success(await getCharacters(new URL(request.url).searchParams.get("scriptId")||undefined)),{agent:true}); }
export async function POST(request:Request) { return handle(request,async user=>success(await saveCharacter(await body(request),user!.name),201),{agent:true,write:true}); }
