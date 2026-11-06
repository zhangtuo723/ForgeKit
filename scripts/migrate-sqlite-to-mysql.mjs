import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import nextEnv from "@next/env";

// Run while the application is stopped. This is the only application script
// that reads the old SQLite database; runtime code exclusively uses MySQL.
nextEnv.loadEnvConfig(process.cwd());
const args=process.argv.slice(2);
const option=name=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
const sqlitePath=option("--sqlite"), database=option("--database");
const apply=args.includes("--apply"), dryRun=args.includes("--dry-run")||!apply;
if(!sqlitePath||!database||!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error("Usage: node scripts/migrate-sqlite-to-mysql.mjs --sqlite data/forge-admin.sqlite --database forge_studio --dry-run (replace --dry-run with --apply to import into an empty database)");
if(apply&&args.includes("--dry-run")) throw new Error("Choose --dry-run or --apply, not both.");
const source=resolve(sqlitePath);
if(!existsSync(source)) throw new Error("Source SQLite database does not exist.");
const tables=["users","projects","activities","settings","sessions","login_attempts","studio_scripts","studio_characters","studio_assets","studio_activities","studio_agent_keys","studio_migrations"];
const sqlite=new DatabaseSync(source,{readOnly:true});
let connection;
try {
  sqlite.exec("BEGIN");
  const present=new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
  const snapshot=new Map(tables.map(table=>[table,present.has(table)?sqlite.prepare(`SELECT * FROM "${table}"`).all():[]]));
  const counts=Object.fromEntries([...snapshot].map(([table,records])=>[table,records.length]));
  const assets=snapshot.get("studio_assets");
  for(const asset of assets) {
    if(!/^[a-f0-9-]{36}$/.test(asset.id)||!existsSync(join(dirname(source),"uploads",`${asset.id}.webp`))) throw new Error("A referenced image file is missing; restore the source uploads directory before migration.");
  }
  console.log(JSON.stringify({mode:dryRun?"dry-run":"apply",database,sourceCounts:counts,imageFiles:assets.length},null,2));
  if(!dryRun) {
    const {MYSQL_HOST,MYSQL_USER,MYSQL_PASSWORD}=process.env;
    if(!MYSQL_HOST||!MYSQL_USER||MYSQL_PASSWORD===undefined) throw new Error("MySQL configuration is incomplete.");
    connection=await mysql.createConnection({host:MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),user:MYSQL_USER,password:MYSQL_PASSWORD,database,charset:"utf8mb4",timezone:"Z",connectTimeout:10000,multipleStatements:false,ssl:process.env.MYSQL_SSL==="true"?{rejectUnauthorized:true,...(process.env.MYSQL_SSL_CA_FILE?{ca:readFileSync(process.env.MYSQL_SSL_CA_FILE,"utf8")}:{})}:undefined});
    const schema=JSON.parse(readFileSync(new URL("../src/lib/mysql-schema.json",import.meta.url),"utf8"));
    for(const sql of schema) await connection.query(sql);
    await connection.beginTransaction();
    try {
      for(const table of [...tables,"data_migrations"]) {
        const [records]=await connection.query(`SELECT COUNT(*) n FROM \`${table}\``);
        if(Number(records[0].n)!==0) throw new Error(`Target table ${table} is not empty. Migration refuses to overwrite existing data.`);
      }
      for(const table of tables) {
        for(const row of snapshot.get(table)) {
          // Keep every identifier, revision, credential hash and timestamp.
          if(table==="settings") {
            const settings=JSON.parse(row.value);
            if(settings.workspaceName==="Forge Admin") settings.workspaceName="我的创作空间";
            if(settings.workspaceDescription==="让团队协作更清晰，让每个项目有序推进。") settings.workspaceDescription="让故事从文字出发，连接每一位角色与每一份创作资产。";
            row.value=JSON.stringify(settings);
          }
          const columns=Object.keys(row);
          if(columns.some(column=>!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(column))) throw new Error("Unexpected source column name.");
          await connection.execute(`INSERT INTO \`${table}\` (${columns.map(column=>`\`${column}\``).join(",")}) VALUES (${columns.map(()=>"?").join(",")})`,columns.map(column=>row[column]));
        }
      }
      await connection.execute("INSERT INTO data_migrations(id,completedAt) VALUES (?,?)",["sqlite-to-mysql-v1",new Date().toISOString()]);
      for(const table of tables) {
        const [records]=await connection.query(`SELECT COUNT(*) n FROM \`${table}\``);
        if(Number(records[0].n)!==counts[table]) throw new Error(`Verification failed for table ${table}.`);
      }
      await connection.commit();
      console.log("Migration committed and row counts verified. Source SQLite and uploads were left untouched.");
    } catch(error) { await connection.rollback(); throw error; }
  } else console.log("Dry run only: MySQL was not contacted and no data was changed. Stop the application before --apply.");
  sqlite.exec("COMMIT");
} catch(error) {
  try{sqlite.exec("ROLLBACK");}catch{}
  // Do not expose driver SQL, parameters, credentials, or imported content.
  const safe=error instanceof Error && !('sql' in error) && !('sqlMessage' in error) ? error.message : "MySQL import failed; all transactional imports were rolled back. Check configuration and schema compatibility.";
  console.error(safe);process.exitCode=1;
} finally {sqlite.close();if(connection)await connection.end();}
