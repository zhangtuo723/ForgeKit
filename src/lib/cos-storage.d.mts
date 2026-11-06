export type CosLocation={bucket:string;region:string;objectKey:string;versionId:string|null};
export class CosStorageError extends Error {code:string;statusCode:number;constructor(code:string,statusCode?:number);}
export function safeStorageError(error:unknown):string;
export function readCosConfig():{bucket:string;region:string;prefix:string};
export function validateCosLocation(location:CosLocation):CosLocation;
export function createCosLocation(assetId:string):CosLocation;
export function putPrivateObject(location:CosLocation,buffer:Buffer):Promise<CosLocation>;
export function getPrivateObject(location:CosLocation):Promise<Buffer>;
export function deletePrivateObject(location:CosLocation):Promise<void>;
