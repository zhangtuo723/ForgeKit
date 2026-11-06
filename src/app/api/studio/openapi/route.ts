import { handle } from "@/lib/api";
export const runtime="nodejs";

const string=(maxLength?:number)=>({type:"string",...(maxLength?{maxLength}:{})});
const id={type:"string",format:"uuid"};
const date={type:"string",format:"date-time"};
const nullableId={...id,nullable:true};
const ref=(name:string)=>({$ref:`#/components/schemas/${name}`});
const wrapped=(schema:unknown)=>({type:"object",required:["data"],properties:{data:schema}});
const collection=(name:string)=>({type:"array",items:ref(name)});
const json=(schema:unknown)=>({"application/json":{schema}});
const response=(schema:unknown,description="Success")=>({description,content:json(schema)});
const errors=Object.fromEntries([400,401,403,404,409,413,415,500].map(code=>[String(code),response({type:"object",required:["error"],properties:{error:string()}},{400:"Invalid request",401:"Missing, expired, or revoked credentials",403:"Read-only API key or invalid browser Origin",404:"Record not found",409:"Revision conflict: fetch latest script; do not overwrite blindly",413:"Payload too large",415:"Unsupported content or file type",500:"Server error"}[code]) ]));
const pathId={name:"id",in:"path",required:true,schema:id};
const queryId=(name:string)=>({name,in:"query",schema:id});
const body=(schema:unknown,type="application/json")=>({required:true,content:{[type]:{schema}}});
const ok=wrapped({type:"object",properties:{ok:{type:"boolean"}},required:["ok"]});
const scriptInput={type:"object",properties:{title:string(120),synopsis:string(2000),genre:string(40),status:{type:"string",enum:["草稿","创作中","已定稿","已归档"]},content:{...string(200000),description:"Plain text / Markdown; whitespace is preserved. Maximum JSON payload 1 MiB."}}};
const characterInput={type:"object",properties:{scriptId:nullableId,name:string(80),role:string(40),description:string(2000),appearance:string(2000),personality:string(2000),coverAssetId:{...nullableId,description:"Must reference an asset owned by this character; null clears the cover."}}};
const operation=(operationId:string,summary:string,schema:unknown,extra:Record<string,unknown>={})=>({operationId,summary,responses:{"200":response(wrapped(schema)),...errors},...extra});
const create=(operationId:string,summary:string,schema:unknown,input:unknown,type="application/json")=>operation(operationId,summary,schema,{requestBody:body(input,type),responses:{"201":response(wrapped(schema),"Created"),...errors}});

export async function GET(request:Request) {
  return handle(request, async () =>{
    const spec={
      openapi:"3.0.3",
      info:{title:"幕间 Studio Agent API",version:"1.0.0",description:"Authenticate external agents with Authorization: Bearer <API_KEY>. Create and revoke keys from the logged-in Integrations page. Read keys allow GET; write keys allow GET/POST/PATCH/DELETE. Browser-cookie writes require the matching Origin header. Bearer requests do not require Origin. Scripts lists omit content (empty string); fetch the individual script before editing. Script PATCH requires its current revision and returns 409 on conflict. Keys cannot administer other keys. Image files are private; access through the authenticated file endpoint. No sample scripts or characters are seeded."},
      servers:[{url:process.env.FORGE_APP_URL?new URL(process.env.FORGE_APP_URL).origin:new URL(request.url).origin}],
      security:[{bearerAuth:[]},{cookieAuth:[]}],
      paths:{
        "/api/studio/scripts":{
          get:operation("listScripts","List scripts (content is empty; fetch detail to edit)",collection("Script")),
          post:create("createScript","Create a script",ref("Script"),{...scriptInput,required:["title"]})
        },
        "/api/studio/scripts/{id}":{parameters:[pathId],get:operation("getScript","Read script including full content",ref("Script")),patch:operation("updateScript","Save a script with optimistic revision locking",ref("Script"),{requestBody:body({...scriptInput,required:["revision"],properties:{...scriptInput.properties,revision:{type:"integer",minimum:1,description:"Revision from the latest GET; required for every update."}}})}),delete:{operationId:"deleteScript",summary:"Delete script; characters and images remain with scriptId null",responses:{"200":response(ok),...errors}}},
        "/api/studio/scripts/import":{post:create("importScript","Import TXT / Markdown as a new script",ref("Script"),{type:"object",required:["file"],properties:{file:{type:"string",format:"binary",description:".txt, .md, .markdown; at most 2 MiB; UTF-8 or GB18030; at most 200000 characters"},title:string(120)}},"multipart/form-data")},
        "/api/studio/scripts/{id}/export":{parameters:[pathId],get:{operationId:"exportScript",summary:"Download current script content",parameters:[{name:"format",in:"query",schema:{type:"string",enum:["txt","md"],default:"txt"}}],responses:{"200":{description:"UTF-8 attachment",content:{"text/plain":{schema:string()},"text/markdown":{schema:string()}}},...errors}}},
        "/api/studio/characters":{get:operation("listCharacters","List characters",collection("Character"),{parameters:[queryId("scriptId")]}),post:create("createCharacter","Create a character",ref("Character"),{...characterInput,required:["name"],description:"New characters must omit coverAssetId or set it null; upload images after creation."})},
        "/api/studio/characters/{id}":{parameters:[pathId],get:operation("getCharacter","Read character profile",ref("Character")),patch:operation("updateCharacter","Update character profile, script association or cover",ref("Character"),{requestBody:body(characterInput)}),delete:{operationId:"deleteCharacter",summary:"Delete character and all associated images permanently",responses:{"200":response(ok),...errors}}},
        "/api/studio/assets":{get:operation("listAssets","List character asset images",collection("Asset"),{parameters:[queryId("characterId"),queryId("scriptId")]}),post:create("uploadAsset","Upload an image for an existing character",ref("Asset"),{type:"object",required:["file","characterId"],properties:{file:{type:"string",format:"binary",description:"Static PNG, JPEG, or WebP; at most 10 MiB / 25 million pixels. Stored as WebP with metadata removed."},characterId:id,name:string(120)}},"multipart/form-data")},
        "/api/studio/assets/{id}":{parameters:[pathId],get:operation("getAsset","Read image metadata",ref("Asset")),patch:operation("renameAsset","Rename an image",ref("Asset"),{requestBody:body({type:"object",required:["name"],properties:{name:string(120)}})}),delete:{operationId:"deleteAsset",summary:"Delete image; if it was the cover, choose another available image",responses:{"200":response(ok),...errors}}},
        "/api/studio/assets/{id}/file":{parameters:[pathId],get:{operationId:"downloadAsset",summary:"Read private image bytes (authenticated)",responses:{"200":{description:"WebP image; Content-Disposition inline; private no-store",content:{"image/webp":{schema:{type:"string",format:"binary"}}}},...errors}}},
        "/api/studio/overview":{get:operation("getOverview","Read real studio counts and recent work",ref("Overview"))},
        "/api/studio/activities":{get:operation("listActivities","Read latest 100 studio audit events",collection("Activity"))},
        "/api/studio/agent-keys":{
          get:operation("listAgentKeys","Browser administrator only: list keys without secrets",collection("AgentKey"),{security:[{cookieAuth:[]}]}),
          post:{...create("createAgentKey","Browser administrator only: create a key (secret returned once)",{type:"object",required:["token","key"],properties:{token:string(),key:ref("AgentKey")}}, {type:"object",required:["name","permission","expiresInDays"],properties:{name:string(60),permission:{type:"string",enum:["read","write"]},expiresInDays:{type:"integer",enum:[30,90,365]}}}),security:[{cookieAuth:[]}],parameters:[{name:"Origin",in:"header",required:true,schema:string(),description:"Exact origin of the authenticated website"}]}
        },
        "/api/studio/agent-keys/{id}":{parameters:[pathId],delete:{operationId:"revokeAgentKey",summary:"Browser administrator only: immediately revoke a key",security:[{cookieAuth:[]}],parameters:[{name:"Origin",in:"header",required:true,schema:string()}],responses:{"200":response(ok),...errors}}},
        "/api/studio/openapi":{get:{operationId:"getOpenApi",summary:"Read this OpenAPI document (no data wrapper)",responses:{"200":response({type:"object"}),...errors}}}
      },
      components:{securitySchemes:{bearerAuth:{type:"http",scheme:"bearer",bearerFormat:"fg_agent_<64 hex characters>"},cookieAuth:{type:"apiKey",in:"cookie",name:"forge_admin_session"}},schemas:{
        Script:{type:"object",required:["id","title","synopsis","genre","status","content","wordCount","revision","sourceName","createdAt","updatedAt","characterCount","assetCount"],properties:{...scriptInput.properties,id,wordCount:{type:"integer",description:"Unicode code points excluding whitespace"},revision:{type:"integer"},sourceName:{type:"string",nullable:true},createdAt:date,updatedAt:date,characterCount:{type:"integer"},assetCount:{type:"integer"}}},
        Character:{type:"object",required:["id","scriptId","scriptTitle","name","role","description","appearance","personality","createdAt","updatedAt","coverAssetId","assetCount"],properties:{...characterInput.properties,id,scriptTitle:{type:"string",nullable:true},createdAt:date,updatedAt:date,assetCount:{type:"integer"}}},
        Asset:{type:"object",required:["id","characterId","characterName","scriptId","scriptTitle","name","originalName","mimeType","size","width","height","createdAt"],properties:{id,characterId:id,characterName:string(),scriptId:nullableId,scriptTitle:{type:"string",nullable:true},name:string(120),originalName:string(255),mimeType:{type:"string",enum:["image/webp"]},size:{type:"integer",description:"Stored image size in bytes"},width:{type:"integer"},height:{type:"integer"},createdAt:date}},
        Activity:{type:"object",properties:{id,actor:string(),action:string(),target:string(),type:{type:"string",enum:["project","user","system"]},createdAt:date}},
        AgentKey:{type:"object",required:["id","name","prefix","permission","createdAt","lastUsedAt","expiresAt"],properties:{id,name:string(60),prefix:string(),permission:{type:"string",enum:["read","write"]},createdAt:date,lastUsedAt:{...date,nullable:true},expiresAt:date}},
        Overview:{type:"object",properties:{stats:{type:"object",properties:Object.fromEntries(["scripts","writing","characters","assets","words"].map(key=>[key,{type:"integer"}]))},recentScripts:collection("Script"),recentAssets:collection("Asset"),activities:collection("Activity")}}
      }}
    };
    return Response.json(spec,{headers:{"Cache-Control":"private, no-store"}});
  },{agent:true});
}
