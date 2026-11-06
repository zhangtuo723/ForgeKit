/**
 * Keep the caller's overrides, but let each Next worker load current .env files.
 * resolvedEnv belongs to the wrapper after loadEnvConfig / ensureTunnel; copying
 * all of it would freeze file values in Next's initialEnv and skip later loads.
 */
export function createNextProcessEnv(shellEnv, resolvedEnv, { useTunnel = false } = {}) {
  const childEnv = { ...shellEnv };
  delete childEnv.__NEXT_PROCESSED_ENV;

  const forwarded = ["NODE_ENV", "NEXT_BUILD_DIR"];
  if (useTunnel) forwarded.push("MYSQL_HOST", "MYSQL_PORT", "MYSQL_SSL");
  for (const key of forwarded) {
    if (resolvedEnv[key] !== undefined) childEnv[key] = resolvedEnv[key];
  }
  return childEnv;
}
