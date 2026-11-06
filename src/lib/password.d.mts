export function validateUsername(username:unknown):username is string;
export function validatePassword(password:unknown):password is string;
export function hashPassword(password:string):Promise<string>;
export function verifyPassword(password:string,encoded:string):Promise<boolean>;
