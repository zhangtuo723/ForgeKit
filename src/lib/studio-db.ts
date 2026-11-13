import { randomUUID } from "node:crypto";
import { getDb, rows, first, execute, transaction, type Connection } from "./db";
import type { Activity } from "./types";
import type { Script, Character, CharacterAsset, StudioOverview } from "./studio-types";
import { containsPattern, paginationFor, type ListOptions } from "./pagination";
export const getStudioDb=getDb;
export const studioTransaction=transaction;
export async function studioActivity(action:string,target:string,type:Activity["type"],actor="管理员",connection?:Connection) {
  await execute("INSERT INTO studio_activities(id,actor,action,target,type,createdAt) VALUES (?,?,?,?,?,?)",[randomUUID(),actor,action,target,type,new Date().toISOString()],connection);
}
export async function getStudioActivities(limit=100) { return rows<Activity>(`SELECT * FROM studio_activities ORDER BY createdAt DESC,id DESC LIMIT ${Math.max(1,Math.min(1000,Math.trunc(limit)))}`); }
const scriptSelect=(full:boolean)=>`SELECT s.id,s.title,s.synopsis,s.genre,s.status,${full?"s.content":"'' AS content"},s.wordCount,s.revision,s.sourceName,s.createdAt,s.updatedAt,
(SELECT COUNT(*) FROM studio_characters c WHERE c.scriptId=s.id) AS characterCount,
(SELECT COUNT(*) FROM studio_assets a JOIN studio_characters c ON a.characterId=c.id WHERE c.scriptId=s.id) AS assetCount FROM studio_scripts s`;
export async function getScripts(options: ListOptions) {
  const filters: string[] = [], values: string[] = [];
  if (options.q) { filters.push("(s.title LIKE ? ESCAPE '!' OR s.genre LIKE ? ESCAPE '!' OR s.synopsis LIKE ? ESCAPE '!')"); values.push(...Array(3).fill(containsPattern(options.q))); }
  if (options.status) { filters.push("s.status=?"); values.push(options.status); }
  const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
  return transaction(async connection => {
    const count = await first<{ total: number }>(`SELECT COUNT(*) AS total FROM studio_scripts s${where}`, values, connection);
    const pagination = paginationFor(count!.total, options);
    const data = await rows<Script>(`${scriptSelect(false)}${where} ORDER BY s.updatedAt DESC,s.id LIMIT ${pagination.pageSize} OFFSET ${(pagination.page - 1) * pagination.pageSize}`, values, connection);
    return { data, pagination };
  });
}
export async function findScript(id:string,connection?:Connection) { return first<Script>(`${scriptSelect(true)} WHERE s.id=?`,[id],connection); }
const characterSelect=`SELECT c.*,s.title AS scriptTitle,(SELECT COUNT(*) FROM studio_assets a WHERE a.characterId=c.id) AS assetCount FROM studio_characters c LEFT JOIN studio_scripts s ON s.id=c.scriptId`;
export async function getCharacters(options: ListOptions) {
  const filters: string[] = [], values: string[] = [];
  if (options.q) { filters.push("(c.name LIKE ? ESCAPE '!' OR c.role LIKE ? ESCAPE '!' OR c.description LIKE ? ESCAPE '!' OR s.title LIKE ? ESCAPE '!')"); values.push(...Array(4).fill(containsPattern(options.q))); }
  if (options.scriptId === "unlinked") filters.push("c.scriptId IS NULL");
  else if (options.scriptId) { filters.push("c.scriptId=?"); values.push(options.scriptId); }
  const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
  return transaction(async connection => {
    const count = await first<{ total: number }>(`SELECT COUNT(*) AS total FROM studio_characters c LEFT JOIN studio_scripts s ON s.id=c.scriptId${where}`, values, connection);
    const pagination = paginationFor(count!.total, options);
    const data = await rows<Character>(`${characterSelect}${where} ORDER BY c.updatedAt DESC,c.id LIMIT ${pagination.pageSize} OFFSET ${(pagination.page - 1) * pagination.pageSize}`, values, connection);
    return { data, pagination };
  });
}
export async function findCharacter(id:string,connection?:Connection) { return first<Character>(`${characterSelect} WHERE c.id=?`,[id],connection); }
const assetSelect=`SELECT a.*,c.name AS characterName,c.scriptId,s.title AS scriptTitle FROM studio_assets a JOIN studio_characters c ON c.id=a.characterId LEFT JOIN studio_scripts s ON s.id=c.scriptId`;
export async function listAssets(options: ListOptions) {
  const filters: string[] = [], values: string[] = [];
  if (options.q) { filters.push("(a.name LIKE ? ESCAPE '!' OR a.originalName LIKE ? ESCAPE '!' OR c.name LIKE ? ESCAPE '!' OR s.title LIKE ? ESCAPE '!')"); values.push(...Array(4).fill(containsPattern(options.q))); }
  if (options.characterId) { filters.push("a.characterId=?"); values.push(options.characterId); }
  if (options.scriptId === "unlinked") filters.push("c.scriptId IS NULL");
  else if (options.scriptId) { filters.push("c.scriptId=?"); values.push(options.scriptId); }
  const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
  return transaction(async connection => {
    const count = await first<{ total: number; characters: number; bytes: number }>(`SELECT COUNT(*) AS total,COUNT(DISTINCT c.id) AS characters,COALESCE(SUM(a.size),0) AS bytes FROM studio_assets a JOIN studio_characters c ON c.id=a.characterId LEFT JOIN studio_scripts s ON s.id=c.scriptId${where}`, values, connection);
    const pagination = paginationFor(count!.total, options);
    const data = await rows<CharacterAsset>(`${assetSelect}${where} ORDER BY a.createdAt DESC,a.id LIMIT ${pagination.pageSize} OFFSET ${(pagination.page - 1) * pagination.pageSize}`, values, connection);
    return { data, pagination, summary: { characters: count!.characters, bytes: count!.bytes } };
  });
}
// Internal deletion workflows must enumerate every image to enqueue all storage cleanup jobs.
// HTTP lists use listAssets instead, including character profile galleries.
export async function getAssets(characterId?:string,scriptId?:string,connection?:Connection) {
  const filters:string[]=[],values:string[]=[];
  if(characterId) {filters.push("a.characterId=?");values.push(characterId);}
  if(scriptId) {filters.push("c.scriptId=?");values.push(scriptId);}
  return rows<CharacterAsset>(`${assetSelect} ${filters.length?"WHERE "+filters.join(" AND "):""} ORDER BY a.createdAt DESC,a.id`,values,connection);
}
export async function findAsset(id:string,connection?:Connection) { return first<CharacterAsset>(`${assetSelect} WHERE a.id=?`,[id],connection); }
export async function getOverview():Promise<StudioOverview> {
  const [counts,recentScripts,recentAssets,activities]=await Promise.all([
    first<StudioOverview["stats"]>("SELECT (SELECT COUNT(*) FROM studio_scripts) AS scripts,(SELECT COUNT(*) FROM studio_scripts WHERE status='创作中') AS writing,(SELECT COUNT(*) FROM studio_characters) AS characters,(SELECT COUNT(*) FROM studio_assets) AS assets,(SELECT COALESCE(SUM(wordCount),0) FROM studio_scripts) AS words"),
    rows<Script>(`${scriptSelect(false)} ORDER BY s.updatedAt DESC,s.id LIMIT 6`),rows<CharacterAsset>(`${assetSelect} ORDER BY a.createdAt DESC,a.id LIMIT 8`),getStudioActivities(8)
  ]);
  return {stats:counts!,recentScripts,recentAssets,activities};
}

