import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createQaAdmin, qaBaseUrl, qaConnection } from "./qa-admin.mjs";


const base = qaBaseUrl();
let qa;
const prefix = `studio-test-${randomUUID().slice(0,8)}`;
let cookie="", writeToken="", readToken="", writeKeyId="", completed=0;
const scripts=new Set(), characters=new Set(), keys=new Set();
async function req(path, {method="GET",data,form,token=writeToken,session="",origin,raw,contentType="application/json"}={}) {
  const response=await fetch(new URL(path,base),{method,redirect:"manual",signal:AbortSignal.timeout(30000),headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(session?{Cookie:session}:{}),...(origin?{Origin:origin}:{}),...(!form && (data!==undefined||raw!==undefined)?{"Content-Type":contentType}:{})},...(form?{body:form}:data!==undefined?{body:JSON.stringify(data)}:raw!==undefined?{body:raw}:{})});
  const value=await response.text();let body;try{body=JSON.parse(value);}catch{}
  return {response,body,text:value};
}
async function expect(path,status,options={}) {
  const result=await req(path,options);
  assert.equal(result.response.status,status,`${options.method||"GET"} ${path}: expected ${status}, received ${result.response.status}${result.body?.error?` (${result.body.error})`:""}`);
  return result;
}
async function check(name,work){await work();completed++;console.log(`PASS ${name}`);}
async function createKey(name,permission="write") {
  const result=await expect("/api/studio/agent-keys",201,{method:"POST",token:"",session:cookie,origin:base.origin,data:{name:`${prefix}-${name}`,permission,expiresInDays:30}});
  const value=result.body.data;keys.add(value.key.id);assert.match(value.token,/^fg_agent_[a-f0-9]{64}$/);assert.ok(!("tokenHash" in value.key));return value;
}
async function newScript(title,content="第一场\n夜。街道。\n人物：你好。",extra={}){
  const record=(await expect("/api/studio/scripts",201,{method:"POST",data:{title:`${prefix}-${title}`,content,...extra}})).body.data;scripts.add(record.id);return record;
}
async function newCharacter(scriptId,name="character"){
  const record=(await expect("/api/studio/characters",201,{method:"POST",data:{scriptId,name:`${prefix}-${name}`,appearance:"黑色风衣",personality:"谨慎",role:"主角"}})).body.data;characters.add(record.id);return record;
}
async function imageUpload(characterId,name="portrait.png"){
  const bytes=await sharp({create:{width:12,height:8,channels:3,background:{r:23,g:100,b:88}}}).png().toBuffer();
  const form=new FormData();form.set("characterId",characterId);form.set("file",new Blob([bytes],{type:"image/png"}),name);
  return (await expect("/api/studio/assets",201,{method:"POST",form})).body.data;
}
try {
  qa=await createQaAdmin(base);
  const login=await expect("/api/studio/auth/login",200,{method:"POST",token:"",origin:base.origin,data:{username:qa.username,password:qa.password}});
  cookie=login.response.headers.get("set-cookie").split(";")[0];
  await check("private endpoints and session write Origin protection",async()=>{
    for(const path of ["/api/studio/scripts","/api/studio/characters","/api/studio/assets","/api/studio/overview","/api/studio/activities","/api/studio/openapi","/api/studio/agent-keys"]) await expect(path,401,{token:""});
    await expect("/api/studio/scripts",403,{method:"POST",token:"",session:cookie,data:{title:"blocked"}});
    await expect("/api/studio/agent-keys",403,{method:"POST",token:"",session:cookie,data:{name:"blocked",permission:"write",expiresInDays:30}});
  });
  await check("key creation, redacted listings, scope separation and invalid credentials",async()=>{
    const writer=await createKey("writer"),reader=await createKey("reader","read");writeToken=writer.token;writeKeyId=writer.key.id;readToken=reader.token;
    const list=(await expect("/api/studio/agent-keys",200,{token:"",session:cookie})).body.data;
    assert.ok(list.some(key=>key.id===writeKeyId));assert.ok(list.every(key=>!("token" in key)&&!("tokenHash" in key)));
    await expect("/api/studio/scripts",200,{token:readToken});
    await expect("/api/studio/scripts",403,{method:"POST",token:readToken,data:{title:"blocked"}});
    await expect("/api/studio/scripts",401,{token:"fg_agent_"+"0".repeat(64)});
    await expect("/api/studio/scripts",401,{token:"invalid"});
    await expect("/api/studio/agent-keys",401);await expect("/api/studio/settings",401);
    await expect("/api/studio/agent-keys",401,{method:"POST",data:{name:"blocked",permission:"write",expiresInDays:30}});
    await expect("/api/studio/agent-keys/unknown",401,{method:"DELETE"});
  });
  await check("SQL pagination, stable pages, literal search, combined filters and boundary validation",async()=>{
    const records=[];
    for(let i=0;i<15;i++) records.push(await newScript(`paging-${i.toString().padStart(2,"0")}`,"分页正文",{status:i%2?"创作中":"草稿",genre:i===14?"唯一类型":"剧情",synopsis:i===13?"唯一梗概":""}));
    // Same timestamps exercise the ID tie-breaker rather than relying on insertion timing.
    await qa.db.execute(`UPDATE studio_scripts SET updatedAt=? WHERE id IN (${records.map(()=>"?").join(",")})`,["2026-01-01T00:00:00.000Z",...records.map(x=>x.id)]);
    const query=new URLSearchParams({q:`${prefix}-paging-`,pageSize:"5"});
    const seen=[];
    for(let page=1;page<=3;page++) {
      query.set("page",String(page));const body=(await expect(`/api/studio/scripts?${query}`,200)).body;
      assert.deepEqual(body.pagination,{page,pageSize:5,total:15,totalPages:3});assert.equal(body.data.length,5);
      assert.ok(body.data.every(item=>item.content===""));seen.push(...body.data.map(item=>item.id));
    }
    assert.equal(new Set(seen).size,15);assert.deepEqual(new Set(seen),new Set(records.map(item=>item.id)));
    query.set("page","999999");assert.equal((await expect(`/api/studio/scripts?${query}`,200)).body.pagination.page,3);
    query.set("page","1");query.set("status","创作中");
    const writing=(await expect(`/api/studio/scripts?${query}`,200)).body;assert.equal(writing.pagination.total,7);assert.ok(writing.data.every(item=>item.status==="创作中"));
    for(const keyword of ["唯一类型","唯一梗概"])assert.equal((await expect(`/api/studio/scripts?q=${encodeURIComponent(keyword)}`,200)).body.pagination.total,1);
    const literal=await newScript("literal-%_!");await newScript("literal-abcX!");
    const escaped=(await expect(`/api/studio/scripts?q=${encodeURIComponent(`${prefix}-literal-%_!`)}`,200)).body;
    assert.equal(escaped.pagination.total,1);assert.equal(escaped.data[0].id,literal.id);
    for(let i=0;i<5;i++)await newCharacter(i<4?records[0].id:null,`paging-林雾${i}`);
    const peopleQuery=new URLSearchParams({q:`${prefix}-paging-林雾`,page:"2",pageSize:"2",scriptId:records[0].id});
    const people=(await expect(`/api/studio/characters?${peopleQuery}`,200)).body;
    assert.deepEqual(people.pagination,{page:2,pageSize:2,total:4,totalPages:2});assert.equal(people.data.length,2);assert.ok(people.data.every(item=>item.name.includes("林雾")&&item.scriptId===records[0].id));
    peopleQuery.set("scriptId","unlinked");const independent=(await expect(`/api/studio/characters?${peopleQuery}`,200)).body;assert.equal(independent.pagination.total,1);assert.equal(independent.data[0].scriptId,null);
    const assetOwner=await newCharacter(records[0].id,"asset-paging");
    const assetRecords=[];
    for(let i=0;i<15;i++)assetRecords.push(await imageUpload(assetOwner.id,`${prefix}-asset-paging-${i===0?"%_!":i===1?"abcX!":String(i)}.png`));
    const imageQuery=new URLSearchParams({characterId:assetOwner.id,scriptId:records[0].id,pageSize:"5"});
    const imageIds=[];
    for(let page=1;page<=3;page++) {
      imageQuery.set("page",String(page));const body=(await expect(`/api/studio/assets?${imageQuery}`,200)).body;
      assert.deepEqual(body.pagination,{page,pageSize:5,total:15,totalPages:3});assert.equal(body.data.length,5);
      assert.deepEqual(body.summary,{characters:1,bytes:assetRecords.reduce((sum,asset)=>sum+asset.size,0)});
      imageIds.push(...body.data.map(asset=>asset.id));
    }
    assert.equal(new Set(imageIds).size,15);assert.deepEqual(new Set(imageIds),new Set(assetRecords.map(asset=>asset.id)));
    imageQuery.set("q",`${prefix}-asset-paging-%_!`);
    const literalImage=(await expect(`/api/studio/assets?${imageQuery}`,200)).body;
    assert.equal(literalImage.pagination.total,1);assert.equal(literalImage.data[0].id,assetRecords[0].id);
    imageQuery.delete("q");imageQuery.set("scriptId","unlinked");
    assert.equal((await expect(`/api/studio/assets?${imageQuery}`,200)).body.pagination.total,0);
    await expect(`/api/studio/characters/${assetOwner.id}`,200,{method:"PATCH",data:{scriptId:null}});
    assert.equal((await expect(`/api/studio/assets?${imageQuery}`,200)).body.pagination.total,15);
    for(const resource of ["scripts","characters","assets"]) {
      const first=(await expect(`/api/studio/${resource}`,200)).body;assert.equal(first.pagination.pageSize,12);assert.ok(first.data.length<=12);
      const empty=(await expect(`/api/studio/${resource}?q=${encodeURIComponent(`${prefix}-not-found-' OR 1=1 --`)}`,200)).body;assert.deepEqual(empty.pagination,{page:1,pageSize:12,total:0,totalPages:1});assert.deepEqual(empty.data,[]);
      for(const invalid of ["page=0","page=-1","page=1.2","page=oops","pageSize=0","pageSize=101","pageSize=1e2","page=1000001"])await expect(`/api/studio/${resource}?${invalid}`,400);
    }
    await expect("/api/studio/scripts?status=unknown",400);
  });
  let script;
  await check("script create/read, large text, preserved whitespace and revision conflicts",async()=>{
    const content="第一场\n人物：这是一份超过64KB的剧本。\n".repeat(3000)+"  保留空格  \n";
    script=await newScript("large",content);assert.equal(script.content,content);assert.equal(script.revision,1);
    const editor=await expect(`/studio/scripts/${script.id}`,200,{token:"",session:cookie});
    assert.match(editor.response.headers.get("content-type")||"",/text\/html/);
    assert.equal(editor.response.headers.get("location"),null,"Canonical script editor should render directly");
    assert.equal((await expect(`/api/studio/scripts/${script.id}`,200)).body.data.content,content);
    const list=(await expect("/api/studio/scripts",200)).body.data;assert.equal(list.find(s=>s.id===script.id).content,"");
    script=(await expect(`/api/studio/scripts/${script.id}`,200,{method:"PATCH",data:{revision:1,content:"# 第一幕\n\n你好，世界。",status:"创作中"}})).body.data;
    assert.equal(script.revision,2);assert.equal(script.wordCount,10);
    await expect(`/api/studio/scripts/${script.id}`,409,{method:"PATCH",data:{revision:1,content:"stale overwrite"}});
    await expect(`/api/studio/scripts/${script.id}`,409,{method:"PATCH",data:{title:"no revision"}});
    assert.equal((await expect(`/api/studio/scripts/${script.id}`,200)).body.data.content,script.content);
    const competing=await Promise.all(["悬疑","科幻"].map(genre=>req(`/api/studio/scripts/${script.id}`,{method:"PATCH",data:{revision:script.revision,genre}})));
    assert.deepEqual(competing.map(item=>item.response.status).sort(),[200,409],"Only one concurrent revision update may commit");
    script=competing.find(item=>item.response.status===200).body.data;
    assert.equal(script.revision,3);
    const exported=await expect(`/api/studio/scripts/${script.id}/export?format=md`,200);assert.equal(exported.text,script.content);assert.match(exported.response.headers.get("content-disposition"),/attachment/);
  });
  await check("script input limits and valid not-found responses",async()=>{
    await expect("/api/studio/scripts",400,{method:"POST",data:{title:"",content:""}});
    await expect("/api/studio/scripts",400,{method:"POST",data:{title:"x",status:"unknown"}});
    await expect("/api/studio/scripts",400,{method:"POST",data:{title:"x",content:"x".repeat(200001)}});
    await expect("/api/studio/scripts",413,{method:"POST",data:{title:"x",content:"x".repeat(1100000)}});
    await expect("/api/studio/scripts",400,{method:"POST",raw:"{"});
    await expect("/api/studio/scripts/unknown",404);
    await expect(`/api/studio/scripts/${script.id}/export?format=pdf`,400);
  });
  await check("UTF-8 BOM Chinese TXT and Markdown imports plus file validation",async()=>{
    for(const extension of ["txt","md"]) {
      const form=new FormData();form.set("file",new Blob(["\ufeff第一场\r\n人物：这是中文。"],{type:"text/plain"}),`${prefix}.${extension}`);
      const record=(await expect("/api/studio/scripts/import",201,{method:"POST",form})).body.data;scripts.add(record.id);assert.equal(record.content,"第一场\n人物：这是中文。");assert.equal(record.sourceName,`${prefix}.${extension}`);
    }
    const bad=new FormData();bad.set("file",new Blob(["fake doc"]),"document.docx");await expect("/api/studio/scripts/import",415,{method:"POST",form:bad});
    const binary=new FormData();binary.set("file",new Blob([new Uint8Array([0,1,2,3])]),"binary.txt");await expect("/api/studio/scripts/import",400,{method:"POST",form:binary});
    const large=new FormData();large.set("file",new Blob([new Uint8Array(2*1024*1024+1)]),"big.txt");await expect("/api/studio/scripts/import",413,{method:"POST",form:large});
  });
  let character,asset;
  await check("character CRUD and script association",async()=>{
    character=await newCharacter(script.id);assert.equal(character.scriptTitle,script.title);
    character=(await expect(`/api/studio/characters/${character.id}`,200,{method:"PATCH",data:{description:"主人公在雨夜寻找失踪的朋友。"}})).body.data;assert.match(character.description,/主人公/);
    assert.ok((await expect(`/api/studio/characters?scriptId=${script.id}`,200)).body.data.some(c=>c.id===character.id));
    await Promise.all([
      expect(`/api/studio/characters/${character.id}`,200,{method:"PATCH",data:{appearance:"并发写入：银色长发"}}),
      expect(`/api/studio/characters/${character.id}`,200,{method:"PATCH",data:{personality:"并发写入：外冷内热"}})
    ]);
    const combined=(await expect(`/api/studio/characters/${character.id}`,200)).body.data;
    assert.equal(combined.appearance,"并发写入：银色长发");assert.equal(combined.personality,"并发写入：外冷内热");
    await expect("/api/studio/characters",400,{method:"POST",data:{name:"x",scriptId:"unknown"}});
    await expect(`/api/studio/characters/${character.id}`,400,{method:"PATCH",data:{coverAssetId:"unknown"}});
  });
  await check("real PNG upload, private WebP retrieval, metadata and cover selection",async()=>{
    asset=await imageUpload(character.id);assert.equal(asset.mimeType,"image/webp");assert.equal(asset.width,12);assert.equal(asset.height,8);
    const bytes=await fetch(new URL(`/api/studio/assets/${asset.id}/file`,base),{redirect:"manual",signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${readToken}`}});assert.equal(bytes.status,200);assert.equal(bytes.headers.get("content-type"),"image/webp");assert.equal(bytes.headers.get("location"),null);
    const meta=await sharp(Buffer.from(await bytes.arrayBuffer())).metadata();assert.equal(meta.format,"webp");assert.equal(meta.width,12);
    await expect(`/api/studio/assets/${asset.id}/file`,401,{token:""});
    assert.equal((await expect(`/api/studio/characters/${character.id}`,200)).body.data.coverAssetId,asset.id);
    assert.ok((await expect(`/api/studio/assets?scriptId=${script.id}`,200)).body.data.some(a=>a.id===asset.id));
    const renamed=(await expect(`/api/studio/assets/${asset.id}`,200,{method:"PATCH",data:{name:"人物正面参考"}})).body.data;assert.equal(renamed.name,"人物正面参考");
    const other=await newCharacter(null,"other");await expect(`/api/studio/characters/${other.id}`,400,{method:"PATCH",data:{coverAssetId:asset.id}});
    const second=await imageUpload(character.id,"second.png");
    await expect(`/api/studio/assets/${asset.id}`,200,{method:"DELETE"});await expect(`/api/studio/assets/${asset.id}/file`,404);
    assert.equal((await expect(`/api/studio/characters/${character.id}`,200)).body.data.coverAssetId,second.id);asset=second;
    if(process.env.STUDIO_QA_DATABASE) {
      const racing=await newCharacter(null,"upload-patch-race"),blocker=await qaConnection();
      let upload,rename;
      try {
        await blocker.beginTransaction();
        await blocker.execute("SELECT id FROM studio_characters WHERE id=? FOR UPDATE",[racing.id]);
        upload=imageUpload(racing.id,"concurrent-cover.png");
        // Queue the upload first, then overlap a partial profile update while
        // the character lock is held. Both requests must preserve each other.
        await new Promise(resolve=>setTimeout(resolve,350));
        rename=expect(`/api/studio/characters/${racing.id}`,200,{method:"PATCH",data:{name:`${prefix}-renamed-concurrently`}});
        await new Promise(resolve=>setTimeout(resolve,350));
        await blocker.commit();
      } finally {await blocker.rollback().catch(()=>{});await blocker.end();}
      const [uploaded]=await Promise.all([upload,rename]);
      const final=(await expect(`/api/studio/characters/${racing.id}`,200)).body.data;
      assert.equal(final.name,`${prefix}-renamed-concurrently`);assert.equal(final.coverAssetId,uploaded.id);assert.equal(final.assetCount,1);
    }
  });
  await check("invalid image bytes, disguised SVG, oversized payload and read-only writes",async()=>{
    for(const bytes of ["not an image",'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>']) {
      const form=new FormData();form.set("characterId",character.id);form.set("file",new Blob([bytes],{type:"image/png"}),"fake.png");const result=await req("/api/studio/assets",{method:"POST",form});assert.ok([400,415].includes(result.response.status));
    }
    const huge=new FormData();huge.set("characterId",character.id);huge.set("file",new Blob([new Uint8Array(10*1024*1024+1)]),"huge.png");await expect("/api/studio/assets",413,{method:"POST",form:huge});
    await expect(`/api/studio/assets/${asset.id}`,403,{method:"DELETE",token:readToken});
    await expect(`/api/studio/characters/${character.id}`,403,{method:"PATCH",token:readToken,data:{name:"blocked"}});
    await expect(`/api/studio/scripts/${script.id}`,403,{method:"PATCH",token:readToken,data:{revision:script.revision,content:"blocked"}});
  });
  await check("overview counts, filtered lists, Agent attribution and OpenAPI schema",async()=>{
    const overview=(await expect("/api/studio/overview",200)).body.data;
    const allScripts=(await expect("/api/studio/scripts",200)).body,allCharacters=(await expect("/api/studio/characters",200)).body,allAssets=(await expect("/api/studio/assets",200)).body;
    assert.equal(overview.stats.scripts,allScripts.pagination.total);assert.equal(overview.stats.characters,allCharacters.pagination.total);assert.equal(overview.stats.assets,allAssets.pagination.total);
    assert.ok(overview.recentScripts.length<=6);assert.ok(overview.recentAssets.length<=8);
    const [wordCount]=await qa.db.execute("SELECT SUM(wordCount) AS n FROM studio_scripts");assert.equal(overview.stats.words,Number(wordCount[0].n));
    const activities=(await expect("/api/studio/activities",200)).body.data;assert.ok(activities.some(a=>a.actor===`Agent · ${prefix}-writer`&&a.target.includes(prefix)));
    const doc=(await expect("/api/studio/openapi",200,{token:readToken})).body;assert.equal(doc.openapi,"3.0.3");assert.ok(doc.paths["/api/studio/scripts/{id}"].patch.requestBody);assert.ok(doc.paths["/api/studio/assets/{id}/file"]);assert.ok(doc.components.securitySchemes.bearerAuth);
    assert.ok(doc.paths["/api/studio/overview"]);assert.ok(doc.paths["/api/studio/activities"]);
    assert.ok(Object.keys(doc.paths).every(path=>path.startsWith("/api/studio/")&&!path.startsWith("/api/studio/studio/")),"OpenAPI must advertise only canonical module paths");
    assert.ok(Array.isArray(doc.servers)&&doc.servers.length>0);
    for(const server of doc.servers)assert.equal(new URL(server.url).pathname,"/","OpenAPI server remains an origin; paths include the module prefix");
  });
  await check("delete script detaches characters, delete character removes images",async()=>{
    await expect(`/api/studio/scripts/${script.id}`,200,{method:"DELETE"});scripts.delete(script.id);
    const detached=(await expect(`/api/studio/characters/${character.id}`,200)).body.data;assert.equal(detached.scriptId,null);assert.equal(detached.scriptTitle,null);assert.equal(detached.assetCount,1);
    await expect(`/api/studio/characters/${character.id}`,200,{method:"DELETE"});characters.delete(character.id);
    await expect(`/api/studio/assets/${asset.id}`,404);await expect(`/api/studio/assets/${asset.id}/file`,404);await expect(`/api/studio/characters/${character.id}`,404);
  });
  if(process.env.STUDIO_QA_DATABASE) await check("expired API key is rejected",async()=>{
    const expired=await createKey("expired");
    const db=await qaConnection();
    try{const [changed]=await db.execute("UPDATE studio_agent_keys SET expiresAt=? WHERE id=? AND name=?",["2000-01-01T00:00:00.000Z",expired.key.id,`${prefix}-expired`]);assert.equal(changed.affectedRows,1);}finally{await db.end();}
    await expect("/api/studio/scripts",401,{token:expired.token});
  });
  await check("revocation immediately rejects token and access timestamps are recorded",async()=>{
    const list=(await expect("/api/studio/agent-keys",200,{token:"",session:cookie})).body.data;assert.ok(list.find(key=>key.id===writeKeyId).lastUsedAt);
    const revoked=await createKey("revoked");await expect("/api/studio/scripts",200,{token:revoked.token});
    await expect(`/api/studio/agent-keys/${revoked.key.id}`,200,{method:"DELETE",token:"",session:cookie,origin:base.origin});keys.delete(revoked.key.id);
    await expect("/api/studio/scripts",401,{token:revoked.token});
  });
  console.log(`PASS all ${completed} studio integration groups; no credentials printed.`);
} finally {
  for(const id of characters) await req(`/api/studio/characters/${id}`,{method:"DELETE",token:"",session:cookie,origin:base.origin}).catch(()=>{});
  for(const id of scripts) await req(`/api/studio/scripts/${id}`,{method:"DELETE",token:"",session:cookie,origin:base.origin}).catch(()=>{});
  for(const id of keys) await req(`/api/studio/agent-keys/${id}`,{method:"DELETE",token:"",session:cookie,origin:base.origin}).catch(()=>{});
  if(cookie) await req("/api/studio/auth/logout",{method:"POST",token:"",session:cookie,origin:base.origin}).catch(()=>{});
  await qa?.cleanup();
}
