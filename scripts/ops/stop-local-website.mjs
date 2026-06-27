import { spawnSync } from "node:child_process";

function run(command) {
  return spawnSync(command, {
    shell: true,
    stdio: "pipe",
    encoding: "utf8",
    env: {
      ...process.env,
    },
  });
}

try {
  console.log("[local:stop] Stopping Supabase local stack...");
  const result = run("pnpm supabase:stop");

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.toLowerCase();
    const missingDockerEngine =
      combinedOutput.includes("dockerdesktoplinuxengine")
      || combinedOutput.includes("docker desktop is a prerequisite")
      || combinedOutput.includes("system cannot find the file specified");

    if (missingDockerEngine) {
      console.log("[local:stop] Docker Desktop is not running, no local Supabase containers to stop.");
      process.exit(0);
    }

    console.error("[local:stop] supabase:stop failed.");
    process.exit(result.status ?? 1);
  }

  console.log("[local:stop] Done. If a Next.js dev server is still running, stop it with Ctrl+C.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[local:stop] Failed: ${message}`);
  process.exit(1);
}
