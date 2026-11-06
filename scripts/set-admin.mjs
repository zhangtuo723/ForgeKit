import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import nextEnv from "@next/env";
import { ensureTunnel } from "./db-tunnel.mjs";
import { hashPassword, validatePassword, validateUsername } from "../src/lib/password.mjs";

class SetupError extends Error {}
function options() {
  const args=process.argv.slice(2);let username,stdin=false,reset=false;
  for(let index=0;index<args.length;index++) {
    if(args[index]==="--username"&&!username) username=args[++index];
    else if(args[index]==="--password-stdin"&&!stdin)stdin=true;
    else if(args[index]==="--reset-password"&&!reset)reset=true;
    else throw new SetupError("参数无效。用法：--username <账号> --password-stdin [--reset-password]");
  }
  if(!stdin||!validateUsername(username))throw new SetupError("请指定 --username 和 --password-stdin；账号须为3至80位字母、数字或 _ . @ + -。");
  if(process.stdin.isTTY)throw new SetupError("密码仅接受非交互 stdin 管道；不要将密码放入命令行参数。");
  return {username,reset};
}
async function readPassword() {
  const chunks=[];let size=0;
  try {
    for await(const chunk of process.stdin) {
      const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=bytes.length;
      if(size>4096){bytes.fill(0);throw new SetupError("密码输入超过大小限制。");}
      chunks.push(bytes);
    }
    const bytes=Buffer.concat(chunks);let password;
    try {password=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes).replace(/\r?\n$/,"");}
    catch {throw new SetupError("密码输入必须是有效的 UTF-8 文本。");}
    finally {bytes.fill(0);}
    if(!validatePassword(password))throw new SetupError("密码须为8至256个字符，不能包含空字符或换行；其余空格会保留。");
    return password;
  } finally {for(const chunk of chunks)chunk.fill(0);}
}
const controller=new AbortController();let connection,tunnel;
const stop=()=>controller.abort();process.on("SIGINT",stop);process.on("SIGTERM",stop);
try {
  const {username,reset}=options();
  const passwordHash=await hashPassword(await readPassword());
  nextEnv.loadEnvConfig(process.cwd(),process.env.NODE_ENV!=="production",{info(){},error(){throw new SetupError("本地环境配置无法加载。");}});
  const {MYSQL_HOST,MYSQL_USER,MYSQL_PASSWORD,MYSQL_DATABASE}=process.env;
  if(!MYSQL_HOST||!MYSQL_USER||MYSQL_PASSWORD===undefined||!MYSQL_DATABASE)throw new SetupError("MySQL 连接配置不完整。");
  tunnel=await ensureTunnel({signal:controller.signal});
  if(controller.signal.aborted)throw new SetupError("操作已取消。");
  connection=await mysql.createConnection({host:MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),user:MYSQL_USER,password:MYSQL_PASSWORD,database:MYSQL_DATABASE,charset:"utf8mb4",timezone:"Z",connectTimeout:10000,ssl:process.env.MYSQL_SSL==="true"?{rejectUnauthorized:true,...(process.env.MYSQL_SSL_CA_FILE?{ca:readFileSync(process.env.MYSQL_SSL_CA_FILE,"utf8")}:{})}:undefined});
  const schema=JSON.parse(readFileSync(new URL("../src/lib/mysql-schema.json",import.meta.url),"utf8"));
  // Auth bootstrap initializes only the two account tables; it never creates a
  // default account, imports old sessions, or changes unrelated user data.
  for(const sql of schema.filter(sql=>/^CREATE TABLE IF NOT EXISTS admin_(accounts|sessions)\s/.test(sql)))await connection.query(sql);
  await connection.beginTransaction();
  try {
    const [accounts]=await connection.execute("SELECT id FROM admin_accounts WHERE username=? FOR UPDATE",[username]);
    const current=accounts[0],now=new Date().toISOString();
    if(current&&!reset)throw new SetupError("账号已存在；如需重置，必须显式使用 --reset-password。");
    if(!current&&reset)throw new SetupError("账号不存在；首次创建不要使用 --reset-password。");
    if(current) {
      await connection.execute("UPDATE admin_accounts SET passwordHash=?,updatedAt=? WHERE id=?",[passwordHash,now,current.id]);
      await connection.execute("DELETE FROM admin_sessions WHERE userId=?",[current.id]);
    } else await connection.execute("INSERT INTO admin_accounts(id,username,passwordHash,name,role,isActive,createdAt,updatedAt) VALUES (?,?,?,'管理员','超级管理员',1,?,?)",[randomUUID(),username,passwordHash,now,now]);
    if(controller.signal.aborted)throw new SetupError("操作已取消。");
    await connection.commit();
    console.log(reset?"管理员密码已重置，此账号的全部旧会话已撤销。":"管理员账号已创建。密码未输出，也未写入本地文件。");
  } catch(error){await connection.rollback();throw error;}
} catch(error) {
  console.error(error instanceof SetupError?error.message:"账号设置失败；请检查数据库连接和权限。未输出任何凭证。");
  process.exitCode=controller.signal.aborted?130:1;
} finally {
  await connection?.end();await tunnel?.close();process.removeListener("SIGINT",stop);process.removeListener("SIGTERM",stop);
}
