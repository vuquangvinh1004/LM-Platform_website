import { execSync, spawnSync } from "node:child_process";

function parseEnvPairs(raw) {
  const entries = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.includes("="));

  const env = {};
  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");
    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim().replace(/^"|"$/g, "");
    env[key] = value;
  }

  return env;
}

function run(command) {
  const result = spawnSync(command, {
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

try {
  console.log("[test:integration] Ensure Supabase local stack is running...");
  run("pnpm supabase:start");

  const statusEnvOutput = execSync("pnpm dlx supabase@latest status -o env", {
    encoding: "utf8",
    stdio: "pipe",
  });

  const supabaseEnv = parseEnvPairs(statusEnvOutput);

  const mergedEnv = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? supabaseEnv.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? supabaseEnv.PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseEnv.SECRET_KEY,
    RUN_INTEGRATION_TESTS: "true",
  };

  if (!mergedEnv.NEXT_PUBLIC_SUPABASE_URL || !mergedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || !mergedEnv.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[test:integration] Missing required Supabase env after status resolution.");
    process.exit(1);
  }

  console.log("[test:integration] Run integration tests...");
  const testResult = spawnSync("pnpm vitest run --config vitest.integration.config.ts", {
    shell: true,
    stdio: "inherit",
    env: mergedEnv,
  });

  if (testResult.status !== 0) {
    process.exit(testResult.status ?? 1);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[test:integration] Failed: ${message}`);
  process.exit(1);
}
