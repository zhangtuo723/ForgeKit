import { createPool, type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import schema from "./mysql-schema.json";
import type { Activity, Project, Settings, User } from "./types";

export type Connection = PoolConnection;
type Executor = Pool | PoolConnection;
const state = globalThis as typeof globalThis & { forgeMysqlPool?: Pool; forgeMysqlReady?: Promise<void> };
export const defaultSettings: Settings = { workspaceName:"我的创作空间",workspaceDescription:"让故事从文字出发，连接每一位角色与每一份创作资产。",contactEmail:"hello@example.com",timezone:"Asia/Shanghai" };
function pool() {
  if(state.forgeMysqlPool) return state.forgeMysqlPool;
  const { MYSQL_HOST,MYSQL_USER,MYSQL_PASSWORD,MYSQL_DATABASE }=process.env;
  if(!MYSQL_HOST || !MYSQL_USER || MYSQL_PASSWORD===undefined || !MYSQL_DATABASE) throw new Error("MySQL configuration is incomplete");
  const port=Number(process.env.MYSQL_PORT||3306);
  if(!Number.isInteger(port)||port<1||port>65535) throw new Error("MySQL port is invalid");
  const ssl=process.env.MYSQL_SSL==="true"?{rejectUnauthorized:true,...(process.env.MYSQL_SSL_CA_FILE?{ca:readFileSync(process.env.MYSQL_SSL_CA_FILE,"utf8")}:{})}:undefined;
  state.forgeMysqlPool=createPool({host:MYSQL_HOST,port,user:MYSQL_USER,password:MYSQL_PASSWORD,database:MYSQL_DATABASE,charset:"utf8mb4",timezone:"Z",ssl,connectionLimit:4,waitForConnections:true,queueLimit:100,connectTimeout:10000,decimalNumbers:true,supportBigNumbers:true,bigNumberStrings:false,multipleStatements:false});
  return state.forgeMysqlPool;
}
async function initialize(db:Pool) {
  const connection=await db.getConnection();
  const lock="forge_schema_"+(process.env.MYSQL_DATABASE||"").slice(0,40);
  let locked=false;
  try {
    const [result]=await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?,30) acquired",[lock]);
    if(result[0]?.acquired!==1) throw new Error("Database schema initialization lock timed out");
    locked=true;
    for(const sql of schema) await connection.query(sql);
    await connection.execute("INSERT IGNORE INTO settings(id,value) VALUES (1,?)",[JSON.stringify(defaultSettings)]);
    await connection.execute("INSERT IGNORE INTO studio_migrations(id) VALUES (1)");
  } finally {
    if(locked) await connection.query("SELECT RELEASE_LOCK(?)",[lock]).catch(()=>{});
    connection.release();
  }
}
export async function getDb():Promise<Pool> {
  const db=pool();
  state.forgeMysqlReady ||= initialize(db).catch(error=>{state.forgeMysqlReady=undefined;throw error;});
  await state.forgeMysqlReady;
  return db;
}
export async function rows<T>(sql:string,values:(string|number|boolean|null|Buffer|Date)[]=[],connection?:Executor):Promise<T[]> {
  const db=connection||await getDb();
  const [result]=await db.execute<RowDataPacket[]>(sql,values);
  return result as T[];
}
export async function first<T>(sql:string,values:(string|number|boolean|null|Buffer|Date)[]=[],connection?:Executor):Promise<T|undefined> { return (await rows<T>(sql,values,connection))[0]; }
export async function execute(sql:string,values:(string|number|boolean|null|Buffer|Date)[]=[],connection?:Executor):Promise<ResultSetHeader> {
  const db=connection||await getDb();
  const [result]=await db.execute<ResultSetHeader>(sql,values);
  return result;
}
export async function transaction<T>(work:(connection:PoolConnection)=>Promise<T>):Promise<T> {
  const connection=await (await getDb()).getConnection();
  try { await connection.beginTransaction(); const result=await work(connection); await connection.commit(); return result; }
  catch(error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
export async function addActivity(action:string,target:string,type:Activity["type"],actor="管理员",connection?:Connection) {
  await execute("INSERT INTO activities(id,actor,action,target,type,createdAt) VALUES (?,?,?,?,?,?)",[randomUUID(),actor,action,target,type,new Date().toISOString()],connection);
}
export async function getUsers():Promise<User[]> { return rows<User>("SELECT * FROM users ORDER BY joinedAt DESC,id"); }
export const PROJECT_COLUMNS="id,name,description,code,category,status,priority,ownerId,progress,dueDate,createdAt,updatedAt,color";
export async function getProjects():Promise<Project[]> { return rows<Project>(`SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY updatedAt DESC,id`); }
export async function getActivities(limit=100):Promise<Activity[]> { return rows<Activity>(`SELECT * FROM activities ORDER BY createdAt DESC,id DESC LIMIT ${Math.max(1,Math.min(1000,Math.trunc(limit)))}`); }
export async function getSettings(connection?:Connection):Promise<Settings> {
  const row=await first<{value:string}>("SELECT value FROM settings WHERE id=1",[],connection);
  if(!row) throw new Error("Workspace settings are missing");
  return JSON.parse(row.value) as Settings;
}


