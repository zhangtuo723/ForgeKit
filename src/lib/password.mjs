import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// OWASP's scrypt trade-off: N=2^15, r=8, p=3 (32 MiB working memory).
// Node needs maxmem above approximately 128*N*r; allow 64 MiB overhead.
const parameters=Object.freeze({N:32768,r:8,p:3,maxmem:64*1024*1024});
const keyLength=64;
export function validateUsername(username) {
  return typeof username==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.@+-]{2,79}$/.test(username);
}
export function validatePassword(password) {
  return typeof password==="string"&&password.length>=8&&password.length<=256&&!/[\0\r\n]/.test(password);
}
function derive(password,salt) {
  return new Promise((resolve,reject)=>scrypt(password,salt,keyLength,parameters,(error,key)=>error?reject(error):resolve(key)));
}
export async function hashPassword(password) {
  if(!validatePassword(password))throw new Error("Password must contain 8..256 characters without NUL or line breaks");
  const salt=randomBytes(16),key=await derive(password,salt);
  return `scrypt$v1$32768$8$3$64$${salt.toString("hex")}$${key.toString("hex")}`;
}
export async function verifyPassword(password,encoded) {
  if(!validatePassword(password)||typeof encoded!=="string")return false;
  // Version 1 fixes resource costs. Never execute arbitrary parameters from a
  // malformed stored hash; later parameter changes require a new version.
  const match=/^scrypt\$v1\$32768\$8\$3\$64\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded);
  if(!match)return false;
  const actual=await derive(password,Buffer.from(match[1],"hex"));
  return timingSafeEqual(actual,Buffer.from(match[2],"hex"));
}
