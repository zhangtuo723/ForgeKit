import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createNextProcessEnv } from "./next-runtime-env.mjs";

const probeKeys = ["FORGE_ENV_TEST_EXISTING", "FORGE_ENV_TEST_ADDED", "FORGE_ENV_TEST_OVERRIDE", "FORGE_ENV_TEST_REMOVABLE"];
const runFile = promisify(execFile);

if (process.argv[2] === "--probe") {
  // A fresh process is important: @next/env intentionally caches initialEnv.
  // Only the synthetic fixture is read, never the project's credential files.
  const { default: nextEnv } = await import("@next/env");
  nextEnv.loadEnvConfig(process.argv[3], true, { info() {}, error() {} });
  const values = Object.fromEntries(probeKeys.map(key => [key, process.env[key] ?? null]));
  process.stdout.write(JSON.stringify({ processed: process.env.__NEXT_PROCESSED_ENV === "true", values }));
} else {
  await main();
}

async function main() {
  let fixture;
  let completed = 0;
  let current = "fixture setup";
  const pass = label => { completed++; console.log(`PASS ${label}`); };
  try {
    const shell = Object.freeze({
      __NEXT_PROCESSED_ENV: "true", NODE_ENV: "development", NEXT_BUILD_DIR: ".next-shell",
      MYSQL_DATABASE: "synthetic_qa", COS_PREFIX: "forge-studio/_qa/synthetic/",
      MYSQL_HOST: "localhost", MYSQL_PORT: "3307", MYSQL_SSL: "true",
    });
    const resolved = Object.freeze({
      ...shell, NODE_ENV: "development", NEXT_BUILD_DIR: ".next-fixture",
      MYSQL_HOST: "127.0.0.1", MYSQL_PORT: "13306", MYSQL_SSL: "false",
      MYSQL_DATABASE: "synthetic_file_database", MYSQL_USER: "synthetic-file-user",
      MYSQL_PASSWORD: "synthetic-not-a-secret", COS_SECRET_KEY: "synthetic-not-a-secret",
      COS_PREFIX: "forge-studio/synthetic-file-prefix/", FORGE_ENV_TEST_EXISTING: "initial",
    });

    current = "direct child environment preserves shell overrides without file-loaded values";
    const direct = createNextProcessEnv(shell, resolved, { useTunnel: false });
    const expectedDirect = { ...shell, NEXT_BUILD_DIR: ".next-fixture" };
    delete expectedDirect.__NEXT_PROCESSED_ENV;
    assert.deepEqual(direct, expectedDirect);
    assert.equal(Object.hasOwn(direct, "__NEXT_PROCESSED_ENV"), false);
    assert.equal(shell.__NEXT_PROCESSED_ENV, "true");
    assert.equal(resolved.COS_SECRET_KEY, "synthetic-not-a-secret");
    pass(current);

    current = "tunnel forwards only its resolved host, port and SSL settings";
    const tunneled = createNextProcessEnv(shell, resolved, { useTunnel: true });
    assert.deepEqual(tunneled, { ...expectedDirect, MYSQL_HOST: "127.0.0.1", MYSQL_PORT: "13306", MYSQL_SSL: "false" });
    assert.equal(Object.hasOwn(tunneled, "MYSQL_PASSWORD"), false);
    assert.equal(Object.hasOwn(tunneled, "COS_SECRET_KEY"), false);
    pass(current);

    fixture = await mkdtemp(join(tmpdir(), "forge-next-env-test-"));
    const fixtureEnv = join(fixture, ".env.local");
    const launchShell = { ...process.env, NODE_ENV: "development", NEXT_BUILD_DIR: ".next-fixture" };
    delete launchShell.__NEXT_PROCESSED_ENV;
    for (const key of probeKeys) delete launchShell[key];
    launchShell.FORGE_ENV_TEST_OVERRIDE = "shell-qa";
    const probe = async env => {
      const result = await runFile(process.execPath, [fileURLToPath(import.meta.url), "--probe", fixture], {
        cwd: fixture, env, windowsHide: true, timeout: 10000, maxBuffer: 8192,
      });
      return JSON.parse(result.stdout);
    };

    current = "fresh @next/env process reads initial fixture and keeps shell QA override";
    await writeFile(fixtureEnv, "FORGE_ENV_TEST_EXISTING=initial\nFORGE_ENV_TEST_OVERRIDE=file-qa\nFORGE_ENV_TEST_REMOVABLE=present\n", "utf8");
    const initial = await probe(launchShell);
    assert.equal(initial.processed, true);
    assert.deepEqual(initial.values, {
      FORGE_ENV_TEST_EXISTING: "initial", FORGE_ENV_TEST_ADDED: null,
      FORGE_ENV_TEST_OVERRIDE: "shell-qa", FORGE_ENV_TEST_REMOVABLE: "present",
    });
    pass(current);

    // Reproduce the old wrapper: parsed values and the processed flag are
    // forwarded as if the user supplied them in the shell. No real env is read.
    const oldWrapperEnv = { ...launchShell, __NEXT_PROCESSED_ENV: "true" };
    for (const [key, value] of Object.entries(initial.values)) {
      if (value !== null) oldWrapperEnv[key] = value;
    }
    await writeFile(fixtureEnv, "FORGE_ENV_TEST_EXISTING=updated\nFORGE_ENV_TEST_ADDED=present\nFORGE_ENV_TEST_OVERRIDE=file-updated\nFORGE_ENV_TEST_REMOVABLE=present\n", "utf8");

    current = "regression reproduces inherited processed flag skipping new file configuration";
    const brokenRestart = await probe(oldWrapperEnv);
    assert.equal(brokenRestart.values.FORGE_ENV_TEST_EXISTING, "initial");
    assert.equal(brokenRestart.values.FORGE_ENV_TEST_ADDED, null);
    pass(current);

    current = "regression proves deleting only the flag still freezes existing file values";
    const flagOnlyEnv = { ...oldWrapperEnv };
    delete flagOnlyEnv.__NEXT_PROCESSED_ENV;
    const flagOnly = await probe(flagOnlyEnv);
    assert.equal(flagOnly.values.FORGE_ENV_TEST_EXISTING, "initial");
    assert.equal(flagOnly.values.FORGE_ENV_TEST_ADDED, "present");
    pass(current);

    current = "clean child reloads added and changed file configuration with shell precedence";
    const cleanChild = createNextProcessEnv(launchShell, oldWrapperEnv, { useTunnel: false });
    assert.equal(Object.hasOwn(cleanChild, "__NEXT_PROCESSED_ENV"), false);
    assert.equal(Object.hasOwn(cleanChild, "FORGE_ENV_TEST_EXISTING"), false);
    const cleanRestart = await probe(cleanChild);
    assert.deepEqual(cleanRestart.values, {
      FORGE_ENV_TEST_EXISTING: "updated", FORGE_ENV_TEST_ADDED: "present",
      FORGE_ENV_TEST_OVERRIDE: "shell-qa", FORGE_ENV_TEST_REMOVABLE: "present",
    });
    pass(current);

    current = "subsequent worker restart observes further updates and removed file values";
    await writeFile(fixtureEnv, "FORGE_ENV_TEST_EXISTING=latest\nFORGE_ENV_TEST_ADDED=present\nFORGE_ENV_TEST_OVERRIDE=file-latest\n", "utf8");
    const laterRestart = await probe(cleanChild);
    assert.deepEqual(laterRestart.values, {
      FORGE_ENV_TEST_EXISTING: "latest", FORGE_ENV_TEST_ADDED: "present",
      FORGE_ENV_TEST_OVERRIDE: "shell-qa", FORGE_ENV_TEST_REMOVABLE: null,
    });
    pass(current);
    console.log(`Next environment regression: ${completed} checks passed.`);
  } catch {
    // Do not include arbitrary child stderr or environment values in failures.
    console.error(`FAIL ${current}`);
    process.exitCode = 1;
  } finally {
    if (fixture) {
      await unlink(join(fixture, ".env.local")).catch(error => { if (error.code !== "ENOENT") throw error; });
      await rmdir(fixture);
    }
  }
}
