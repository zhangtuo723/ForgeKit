import { execute, first, type Connection } from "./db";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ApiError, text } from "./api";
import {stageCosUpload,uploadStagedObject,attachCosObject,queueAssetCleanup,tryCleanup,abandonUpload,readAssetBytes} from "./asset-storage";
import { findAsset, findCharacter, findScript, getAssets, getStudioDb, studioActivity, studioTransaction } from "./studio-db";
import type { Script, ScriptStatus, Character } from "./studio-types";

export const SCRIPT_BODY_LIMIT = 1024 * 1024;
export const MAX_SCRIPT_CHARACTERS = 200000;
export async function scriptById(id:string,connection?:Connection) { const record=await findScript(id,connection); if(!record) throw new ApiError(404,"剧本不存在或已被删除"); return record; }
export async function characterById(id:string,connection?:Connection) { const record=await findCharacter(id,connection); if(!record) throw new ApiError(404,"角色不存在或已被删除"); return record; }
export async function assetById(id:string,connection?:Connection) { const record=await findAsset(id,connection); if(!record) throw new ApiError(404,"图片不存在或已被删除"); return record; }

export async function saveScript(input:Record<string,unknown>, actor:string, existing?:Script, sourceName:string|null=null) {
  if(existing && (!Number.isSafeInteger(input.revision) || input.revision!==existing.revision)) throw new ApiError(409,"剧本已有更新，请先保留当前草稿，再重新加载最新版本");
  const data={synopsis:"",genre:"",status:"草稿",content:"",...existing,...input};
  if(!["草稿","创作中","已定稿","已归档"].includes(data.status as string)) throw new ApiError(400,"剧本状态无效");
  if(typeof data.content!=="string" || data.content.length>MAX_SCRIPT_CHARACTERS || data.content.includes("\0")) throw new ApiError(400,"剧本正文须为文本，最多200000个字符，不能含空字符");
  const content=data.content.replace(/\r\n?/g,"\n");
  const record={ id:existing?.id||randomUUID(), title:text(data,"title","剧本标题",120), synopsis:text(data,"synopsis","剧本简介",2000,false), genre:text(data,"genre","类型",40,false), status:data.status as ScriptStatus, content, wordCount:Array.from(content.replace(/\s/g,"")).length, revision:(existing?.revision||0)+1, sourceName:existing?.sourceName||sourceName, createdAt:existing?.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString() };
  return studioTransaction(async db=>{
    if(existing) {
      const change=(await execute("UPDATE studio_scripts SET title=?,synopsis=?,genre=?,status=?,content=?,wordCount=?,revision=?,updatedAt=? WHERE id=? AND revision=?",[record.title,record.synopsis,record.genre,record.status,record.content,record.wordCount,record.revision,record.updatedAt,record.id,existing.revision],db));
      if(!change.affectedRows) throw new ApiError(409,"剧本已有更新，请重新加载最新版本");
    } else (await execute("INSERT INTO studio_scripts VALUES (?,?,?,?,?,?,?,?,?,?,?)",[record.id,record.title,record.synopsis,record.genre,record.status,record.content,record.wordCount,record.revision,record.sourceName,record.createdAt,record.updatedAt],db));
    await studioActivity(existing?"保存了剧本":sourceName?"导入了剧本":"创建了剧本",record.title,"project",actor,db);
    return scriptById(record.id,db);
  });
}
export async function deleteScript(id:string,actor:string) {
  await studioTransaction(async db=>{
    await first("SELECT id FROM studio_scripts WHERE id=? FOR UPDATE",[id],db);
    const record=await scriptById(id,db);
    (await execute("UPDATE studio_characters SET updatedAt=? WHERE scriptId=?",[new Date().toISOString(),id],db));
    (await execute("DELETE FROM studio_scripts WHERE id=?",[id],db));
    await studioActivity("删除了剧本",record.title,"project",actor,db);
  });
}

export async function saveCharacter(input:Record<string,unknown>,actor:string,existing?:Character) {
  // Only an explicit association change needs a parent lock. Always acquire
  // parent script -> character -> asset, matching deletion and upload paths.
  const changesScript=Object.prototype.hasOwnProperty.call(input,"scriptId");
  const requestedScript=changesScript?input.scriptId:null;
  if(changesScript && requestedScript!==null && typeof requestedScript!=="string") throw new ApiError(400,"请选择有效的关联剧本");
  return studioTransaction(async db=>{
    if(typeof requestedScript==="string") {
      const script=await first("SELECT id FROM studio_scripts WHERE id=? FOR SHARE",[requestedScript],db);
      if(!script) throw new ApiError(400,"请选择有效的关联剧本");
    }
    let current:Character|undefined;
    if(existing) {
      current=await first<Character>("SELECT * FROM studio_characters WHERE id=? FOR UPDATE",[existing.id],db);
      if(!current) throw new ApiError(404,"角色不存在或已被删除");
    }
    // Route-level reads are only used to locate the record. Merge partial input
    // with the locked latest row so other agents' edits and uploads survive.
    const data={scriptId:null,role:"",description:"",appearance:"",personality:"",coverAssetId:null,...current,...input};
    if(data.coverAssetId!==null) {
      if(typeof data.coverAssetId!=="string" || !current) throw new ApiError(400,"封面必须是此角色已上传的图片");
      const cover=await first<{characterId:string}>("SELECT characterId FROM studio_assets WHERE id=? FOR UPDATE",[data.coverAssetId],db);
      if(cover?.characterId!==current.id) throw new ApiError(400,"封面图片已被删除或属于其他角色，请重新选择");
    }
    const record={id:current?.id||randomUUID(),scriptId:data.scriptId as string|null,name:text(data,"name","角色姓名",80),role:text(data,"role","角色定位",40,false),description:text(data,"description","角色介绍",2000,false),appearance:text(data,"appearance","外貌设定",2000,false),personality:text(data,"personality","性格设定",2000,false),createdAt:current?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),coverAssetId:data.coverAssetId as string|null};
    if(current) {
      const association=changesScript?"scriptId=?,":"";
      const values=[...(changesScript?[record.scriptId]:[]),record.name,record.role,record.description,record.appearance,record.personality,record.updatedAt,record.coverAssetId,record.id];
      await execute(`UPDATE studio_characters SET ${association}name=?,role=?,description=?,appearance=?,personality=?,updatedAt=?,coverAssetId=? WHERE id=?`,values,db);
    } else await execute("INSERT INTO studio_characters VALUES (?,?,?,?,?,?,?,?,?,?)",[record.id,record.scriptId,record.name,record.role,record.description,record.appearance,record.personality,record.createdAt,record.updatedAt,record.coverAssetId],db);
    await studioActivity(current?"更新了角色":"创建了角色",record.name,"user",actor,db);
    return characterById(record.id,db);
  });
}
export async function deleteCharacter(id:string,actor:string) {
  const ids=await studioTransaction(async db=>{
    await first("SELECT id FROM studio_characters WHERE id=? FOR UPDATE",[id],db);
    const record=await characterById(id,db), assets=await getAssets(id,undefined,db);
    const jobs:string[]=[];
    for(const asset of assets)jobs.push(await queueAssetCleanup(asset.id,db));
    (await execute("DELETE FROM studio_characters WHERE id=?",[id],db));
    await studioActivity("删除了角色及其图片",record.name,"user",actor,db);
    return jobs;
  });
  await tryCleanup(ids);
}
export async function deleteAsset(id:string,actor:string) {
  const initial=await assetById(id);
  const cleanupId=await studioTransaction(async db=>{
    await first("SELECT id FROM studio_characters WHERE id=? FOR UPDATE",[initial.characterId],db);
    const asset=await assetById(id,db);
    const jobId=await queueAssetCleanup(id,db);
    (await execute("DELETE FROM studio_assets WHERE id=?",[id],db));
    const next=(await first("SELECT id FROM studio_assets WHERE characterId=? ORDER BY createdAt DESC LIMIT 1",[asset.characterId],db)) as {id:string}|undefined;
    (await execute("UPDATE studio_characters SET coverAssetId=CASE WHEN coverAssetId=? THEN ? ELSE coverAssetId END,updatedAt=? WHERE id=?",[id,next?.id||null,new Date().toISOString(),asset.characterId],db));
    await studioActivity("删除了人物资产图",`${asset.characterName} · ${asset.name}`,"user",actor,db);
    return jobId;
  });
  await tryCleanup([cleanupId]);
}
export async function renameAsset(id:string,input:Record<string,unknown>,actor:string) {
  const initial=await assetById(id);
  return studioTransaction(async db=>{
    await first("SELECT id FROM studio_characters WHERE id=? FOR UPDATE",[initial.characterId],db);
    const asset=await assetById(id,db), name=text(input,"name","图片名称",120);
    (await execute("UPDATE studio_assets SET name=? WHERE id=?",[name,id],db));
    await studioActivity("重命名了人物资产图",`${asset.characterName} · ${name}`,"user",actor,db);
    return assetById(id,db);
  });
}

export async function boundedForm(request:Request, maxBytes:number) {
  const contentType=request.headers.get("content-type")||"";
  if(!contentType.toLowerCase().startsWith("multipart/form-data;")) throw new ApiError(415,"请使用 multipart/form-data 上传文件");
  const declared=Number(request.headers.get("content-length"));
  if(Number.isFinite(declared)&&declared>maxBytes) throw new ApiError(413,"上传文件过大");
  const reader=request.body?.getReader(); if(!reader) throw new ApiError(400,"未收到上传内容");
  const chunks:Uint8Array[]=[]; let total=0;
  while(true) {
    const {value,done}=await reader.read(); if(done) break;
    total+=value.length;
    if(total>maxBytes) { await reader.cancel(); throw new ApiError(413,"上传文件过大"); }
    chunks.push(value);
  }
  try { return await new Response(Buffer.concat(chunks),{headers:{"Content-Type":contentType}}).formData(); }
  catch { throw new ApiError(400,"上传内容格式不正确"); }
}
export function uploadedFile(form:FormData, limit:number) {
  const files=form.getAll("file");
  if(files.length!==1 || !(files[0] instanceof File)) throw new ApiError(400,"请选择一个文件上传");
  const file=files[0];
  if(!file.size) throw new ApiError(400,"文件为空");
  if(file.size>limit) throw new ApiError(413,"文件超过大小限制");
  if(file.name.length>255) throw new ApiError(400,"文件名过长");
  return file;
}
export async function importScript(request:Request,actor:string) {
  const form=await boundedForm(request,2*1024*1024+65536);
  const file=uploadedFile(form,2*1024*1024);
  if(!/\.(txt|md|markdown)$/i.test(file.name)) throw new ApiError(415,"仅支持 TXT、MD 或 Markdown 剧本");
  const bytes=await file.arrayBuffer(); let content:string;
  try { content=new TextDecoder("utf-8",{fatal:true}).decode(bytes); }
  catch { try { content=new TextDecoder("gb18030",{fatal:true}).decode(bytes); } catch { throw new ApiError(400,"无法识别文本编码，请另存为 UTF-8 后导入"); } }
  if(!content.trim() || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content)) throw new ApiError(400,"文件不包含有效剧本文本");
  const givenTitle=form.get("title");
  if(givenTitle!==null && typeof givenTitle!=="string") throw new ApiError(400,"标题格式无效");
  const title=givenTitle?.trim() || file.name.replace(/\.(txt|md|markdown)$/i,"").slice(0,120);
  return saveScript({title,content},actor,undefined,file.name);
}
export async function uploadAsset(request:Request,actor:string) {
  const form=await boundedForm(request,10*1024*1024+65536);
  const file=uploadedFile(form,10*1024*1024);
  const characterId=form.get("characterId"); if(typeof characterId!=="string") throw new ApiError(400,"请选择图片所属角色");
  await characterById(characterId);
  const supplied=form.get("name");
  if(supplied!==null && typeof supplied!=="string") throw new ApiError(400,"图片名称格式无效");
  const name=text({name:supplied?.trim()||file.name.replace(/\.[^.]+$/,"").slice(0,120)},"name","图片名称",120);
  const bytes=Buffer.from(await file.arrayBuffer());
  const png=bytes.length>=8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  const webp=bytes.length>=12 && bytes.toString("ascii",0,4)==="RIFF" && bytes.toString("ascii",8,12)==="WEBP";
  if(!png && !jpeg && !webp) throw new ApiError(415,"仅支持有效的 PNG、JPEG 或 WebP 图片");
  let output:Buffer, width:number, height:number;
  try {
    const image=sharp(bytes,{limitInputPixels:25000000,failOn:"warning"});
    const meta=await image.metadata();
    if(!meta.format || !["png","jpeg","webp"].includes(meta.format) || (meta.pages||1)>1) throw new ApiError(415,"仅支持静态 PNG、JPEG、WebP 图片");
    const result=await image.rotate().webp({quality:90}).toBuffer({resolveWithObject:true});
    output=result.data; width=result.info.width; height=result.info.height;
  } catch(error) { if(error instanceof ApiError) throw error; throw new ApiError(400,"图片无法读取，请使用有效的 PNG、JPEG 或 WebP 图片（最多2500万像素）"); }
  const id=randomUUID();
  const staged=await stageCosUpload(id);
  let putConfirmed=false;
  try {
    const location=await uploadStagedObject(staged.jobId,staged.location,output);
    putConfirmed=true;
    return await studioTransaction(async db=>{
      await first("SELECT id FROM studio_characters WHERE id=? FOR UPDATE",[characterId],db);
      const character=await characterById(characterId,db), now=new Date().toISOString();
      (await execute("INSERT INTO studio_assets VALUES (?,?,?,?,?,?,?,?,?)",[id,characterId,name,file.name,"image/webp",output.length,width,height,now],db));
      await attachCosObject(id,staged.jobId,location,db);
      (await execute("UPDATE studio_characters SET coverAssetId=COALESCE(coverAssetId,?),updatedAt=? WHERE id=?",[id,now,characterId],db));
      await studioActivity("上传了人物资产图",`${character.name} · ${name}`,"user",actor,db);
      return assetById(id,db);
    });
  } catch(error) { await abandonUpload(staged.jobId,putConfirmed); throw error; }
}
export async function assetFile(id:string) {
  const asset=await assetById(id);
  const data=await readAssetBytes(asset.id);
  return new Response(new Uint8Array(data),{headers:{"Content-Type":"image/webp","Content-Length":String(data.length),"Content-Disposition":`inline; filename="${asset.id}.webp"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
