import type { Pool } from "mysql2/promise";
export function localAssetPath(id:string):string;
export function drainStorageCleanup(pool:Pool,options?:{limit?:number;ids?:string[];apply?:boolean}):Promise<{considered:number;removed:number;retained:number;failed:number}>;
