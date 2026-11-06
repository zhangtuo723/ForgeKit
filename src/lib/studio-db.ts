import { randomUUID } from "node:crypto";
import { getDb, rows, first, execute, transaction, type Connection } from "./db";
import type { Activity } from "./types";
import type { Script, Character, CharacterAsset, StudioOverview } from "./studio-types";
export const getStudioDb=getDb;
export const studioTransaction=transaction;
export async function studioActivity(action:string,target:string,type:Activity["type"],actor="管理员",connection?:Connection) {
  await execute("INSERT INTO studio_activities(id,actor,action,target,type,createdAt) VALUES (?,?,?,?,?,?)",[randomUUID(),actor,action,target,type,new Date().toISOString()],connection);
}
export async function getStudioActivities(limit=100) { return rows<Activity>(`SELECT * FROM studio_activities ORDER BY createdAt DESC,id DESC LIMIT ${Math.max(1,Math.min(1000,Math.trunc(limit)))}`); }
const scriptSelect=(full:boolean)=>`SELECT s.id,s.title,s.synopsis,s.genre,s.status,${full?"s.content":"'' AS content"},s.wordCount,s.revision,s.sourceName,s.createdAt,s.updatedAt,
(SELECT COUNT(*) FROM studio_characters c WHERE c.scriptId=s.id) AS characterCount,
(SELECT COUNT(*) FROM studio_assets a JOIN studio_characters c ON a.characterId=c.id WHERE c.scriptId=s.id) AS assetCount FROM studio_scripts s`;
export async function getScripts(connection?:Connection) { return rows<Script>(`${scriptSelect(false)} ORDER BY s.updatedAt DESC,s.id`,[],connection); }
export async function findScript(id:string,connection?:Connection) { return first<Script>(`${scriptSelect(true)} WHERE s.id=?`,[id],connection); }
const characterSelect=`SELECT c.*,s.title AS scriptTitle,(SELECT COUNT(*) FROM studio_assets a WHERE a.characterId=c.id) AS assetCount FROM studio_characters c LEFT JOIN studio_scripts s ON s.id=c.scriptId`;
export async function getCharacters(scriptId?:string,connection?:Connection) { return rows<Character>(`${characterSelect} ${scriptId?"WHERE c.scriptId=?":""} ORDER BY c.updatedAt DESC,c.id`,scriptId?[scriptId]:[],connection); }
export async function findCharacter(id:string,connection?:Connection) { return first<Character>(`${characterSelect} WHERE c.id=?`,[id],connection); }
const assetSelect=`SELECT a.*,c.name AS characterName,c.scriptId,s.title AS scriptTitle FROM studio_assets a JOIN studio_characters c ON c.id=a.characterId LEFT JOIN studio_scripts s ON s.id=c.scriptId`;
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
    getScripts(),getAssets(),getStudioActivities(8)
  ]);
  return {stats:counts!,recentScripts:recentScripts.slice(0,6),recentAssets:recentAssets.slice(0,8),activities};
}

