import { execSync, spawn, spawnSync } from "node:child_process";

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

function run(command, label) {
  const result = spawnSync(command, {
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
    },
  });

  if (result.status !== 0) {
    console.error(`[local:start] ${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

function resolveSupabaseEnv() {
  const statusEnvOutput = execSync("pnpm dlx supabase@latest status -o env", {
    encoding: "utf8",
    stdio: "pipe",
  });

  return parseEnvPairs(statusEnvOutput);
}

function buildRuntimeEnv(supabaseEnv) {
  const runtimeEnv = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? supabaseEnv.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? supabaseEnv.PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseEnv.SECRET_KEY,
  };

  if (!runtimeEnv.NEXT_PUBLIC_SUPABASE_URL || !runtimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || !runtimeEnv.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[local:start] Missing required Supabase env. Check .env.local or Supabase local status.");
    process.exit(1);
  }

  return runtimeEnv;
}

try {
  console.log("[local:start] Starting Supabase local stack...");
  run("pnpm supabase:start", "supabase:start");

  console.log("[local:start] Reading Supabase runtime env...");
  const supabaseEnv = resolveSupabaseEnv();
  const runtimeEnv = buildRuntimeEnv(supabaseEnv);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  console.log(`[local:start] Launching website at ${appUrl} ...`);

  const nextDevProcess = spawn("pnpm", ["dev"], {
    shell: true,
    stdio: "inherit",
    env: runtimeEnv,
  });

  const shutdown = (signal) => {
    if (!nextDevProcess.killed) {
      nextDevProcess.kill(signal);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  nextDevProcess.on("exit", (code) => {
    if (typeof code === "number") {
      process.exit(code);
    }

    process.exit(0);
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[local:start] Failed: ${message}`);
  process.exit(1);
}
