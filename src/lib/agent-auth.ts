import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ApiError, text } from "./api";
import { first, rows, execute } from "./db";
import { studioActivity, studioTransaction } from "./studio-db";
import type { SessionUser } from "./types";
export type AgentKey={id:string;name:string;prefix:string;permission:"read"|"write";createdAt:string;lastUsedAt:string|null;expiresAt:string};
const columns="id,name,prefix,permission,createdAt,lastUsedAt,expiresAt";
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
export async function listAgentKeys(){return rows<AgentKey>(`SELECT ${columns} FROM studio_agent_keys ORDER BY createdAt DESC`);}
export async function createAgentKey(input:Record<string,unknown>,actor:string){
  const name=text(input,"name","密钥名称",60);
  if(input.permission!=="read"&&input.permission!=="write")throw new ApiError(400,"请选择只读或读写权限");
  if(![30,90,365].includes(input.expiresInDays as number))throw new ApiError(400,"有效期仅支持30、90或365天");
  const now=new Date(),token=`fg_agent_${randomBytes(32).toString("hex")}`;
  const key:AgentKey={id:randomUUID(),name,prefix:token.slice(0,17),permission:input.permission,createdAt:now.toISOString(),lastUsedAt:null,expiresAt:new Date(now.getTime()+Number(input.expiresInDays)*86400000).toISOString()};
  return studioTransaction(async connection=>{
    await first("SELECT id FROM settings WHERE id=1 FOR UPDATE",[],connection);
    const count=await first<{n:number}>("SELECT COUNT(*) n FROM studio_agent_keys WHERE expiresAt>?",[now.toISOString()],connection);
    if(count!.n>=20)throw new ApiError(400,"最多保留20个有效密钥，请先撤销不再使用的密钥");
    await execute("INSERT INTO studio_agent_keys(id,name,prefix,tokenHash,permission,createdAt,lastUsedAt,expiresAt) VALUES (?,?,?,?,?,?,?,?)",[key.id,key.name,key.prefix,hash(token),key.permission,key.createdAt,null,key.expiresAt],connection);
    await studioActivity("创建了 Agent API 密钥",name,"system",actor,connection);
    return{token,key};
  });
}
export async function revokeAgentKey(id:string,actor:string){
  return studioTransaction(async connection=>{
    const key=await first<{name:string}>("SELECT name FROM studio_agent_keys WHERE id=? FOR UPDATE",[id],connection);
    if(!key)throw new ApiError(404,"密钥不存在或已撤销");
    await execute("DELETE FROM studio_agent_keys WHERE id=?",[id],connection);
    await studioActivity("撤销了 Agent API 密钥",key.name,"system",actor,connection);
  });
}
export async function authenticateAgent(request:Request,write:boolean):Promise<SessionUser>{
  const match=/^Bearer (fg_agent_[a-f0-9]{64})$/i.exec(request.headers.get("authorization")||"");
  if(!match)throw new ApiError(401,"Agent API 密钥无效");
  const key=await first<AgentKey>(`SELECT ${columns} FROM studio_agent_keys WHERE tokenHash=?`,[hash(match[1])]);
  if(!key||Date.parse(key.expiresAt)<=Date.now())throw new ApiError(401,"Agent API 密钥无效、已过期或已撤销");
  if(write&&key.permission!=="write")throw new ApiError(403,"此 API 密钥只有读取权限");
  const updated=await execute("UPDATE studio_agent_keys SET lastUsedAt=? WHERE id=? AND expiresAt>?",[new Date().toISOString(),key.id,new Date().toISOString()]);
  if(!updated.affectedRows)throw new ApiError(401,"Agent API 密钥已撤销或过期");
  return{username:`agent:${key.id}`,name:`Agent · ${key.name}`,role:key.permission};
}

