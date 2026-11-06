import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import nextEnv from "@next/env";
import { drainStorageCleanup } from "../src/lib/storage-cleanup.mjs";
import { ensureTunnel } from "./db-tunnel.mjs";

nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){console.error("Unable to load local environment configuration");}});
const args=process.argv.slice(2),apply=args.includes("--apply");
const index=args.indexOf("--limit"),limit=index<0?20:Number(args[index+1]);
if((apply&&args.includes("--dry-run"))||!Number.isInteger(limit)||limit<1||limit>100) throw new Error("Usage: node scripts/cleanup-cos.mjs [--dry-run | --apply] [--limit 1..100]");
const {MYSQL_HOST,MYSQL_USER,MYSQL_PASSWORD,MYSQL_DATABASE}=process.env;
if(!MYSQL_HOST||!MYSQL_USER||MYSQL_PASSWORD===undefined||!MYSQL_DATABASE)throw new Error("MySQL configuration is incomplete");
const pool=mysql.createPool({host:MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),user:MYSQL_USER,password:MYSQL_PASSWORD,database:MYSQL_DATABASE,charset:"utf8mb4",timezone:"Z",connectionLimit:2,connectTimeout:10000,ssl:process.env.MYSQL_SSL==="true"?{rejectUnauthorized:true,...(process.env.MYSQL_SSL_CA_FILE?{ca:readFileSync(process.env.MYSQL_SSL_CA_FILE,"utf8")}:{})}:undefined});
const controller=new AbortController();let tunnel;
const stop=()=>controller.abort();process.on("SIGINT",stop);process.on("SIGTERM",stop);
try {
  tunnel=await ensureTunnel({signal:controller.signal});
  // A dry run does not initialize or change schema or contact COS.
  const result=await drainStorageCleanup(pool,{limit,apply});
  const [remaining]=await pool.query("SELECT COUNT(*) count FROM studio_storage_cleanup");
  console.log(JSON.stringify({mode:apply?"apply":"dry-run",...result,pending:Number(remaining[0].count)},null,2));
  if(result.failed)process.exitCode=1;
} catch {console.error("Cleanup could not finish. Pending jobs remain in MySQL; check configuration and retry.");process.exitCode=1;}
finally {await pool.end();await tunnel?.close();process.removeListener("SIGINT",stop);process.removeListener("SIGTERM",stop);}
