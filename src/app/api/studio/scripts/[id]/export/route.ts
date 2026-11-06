import { ApiError,handle } from "@/lib/api";
import { scriptById } from "@/lib/studio-api";
export const runtime="nodejs";
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  return handle(request,async()=>{
    const format=new URL(request.url).searchParams.get("format")||"txt";
    if(!["txt","md"].includes(format)) throw new ApiError(400,"导出格式仅支持 txt 或 md");
    const record=await scriptById((await context.params).id);
    const name=encodeURIComponent(record.title.replace(/[\\/:*?"<>|\r\n]/g,"_")+"."+format).replace(/[!'()*]/g,c=>"%"+c.charCodeAt(0).toString(16));
    return new Response(record.content,{headers:{"Content-Type":format==="md"?"text/markdown; charset=utf-8":"text/plain; charset=utf-8","Content-Disposition":`attachment; filename="script.${format}"; filename*=UTF-8''${name}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  },{agent:true});
}
