import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const CRITICAL_TABLES = [
  { name: "profiles", orderBy: "created_at" },
  { name: "courses", orderBy: "created_at" },
  { name: "classes", orderBy: "created_at" },
  { name: "class_members", orderBy: "joined_at" },
  { name: "materials", orderBy: "created_at" },
  { name: "assessments", orderBy: "created_at" },
  { name: "submissions", orderBy: "created_at" },
  { name: "simulations", orderBy: "created_at" },
  { name: "class_announcements", orderBy: "created_at" },
  { name: "direct_messages", orderBy: "created_at" },
  { name: "import_jobs", orderBy: "created_at" },
  { name: "activity_logs", orderBy: "created_at" },
  { name: "enrollment_requests", orderBy: "requested_at" },
  { name: "permission_scopes", orderBy: "created_at" },
];

const PAGE_SIZE = 1000;

function readEnvFromDotEnvLocal() {
  const dotEnvPath = path.resolve(process.cwd(), ".env.local");

  try {
    const raw = readFileSync(dotEnvPath, "utf8");
    const pairs = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="));

    const env = {};
    for (const pair of pairs) {
      const separator = pair.indexOf("=");
      const key = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim().replace(/^"|"$/g, "");
      env[key] = value;
    }

    return env;
  } catch {
    return {};
  }
}

function getCliOption(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  if (!arg) {
    return fallback;
  }

  return arg.slice(prefix.length);
}

async function ensureSupabaseReachable(url) {
  const healthUrl = `${url}/auth/v1/health`;

  try {
    const response = await fetch(healthUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchTableRows(client, tableName, orderBy) {
  const rows = [];
  let from = 0;

  while (true) {
    let query = client
      .from(tableName)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    if (orderBy) {
      query = query.order(orderBy, { ascending: true, nullsFirst: true });
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const chunk = data ?? [];
    rows.push(...chunk);

    if (chunk.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

function normalizeError(error) {
  if (error instanceof Error) {
    return {
      code: undefined,
      message: error.message,
    };
  }

  if (error && typeof error === "object") {
    const errorLike = error;
    const code = typeof errorLike.code === "string" ? errorLike.code : undefined;
    const details = typeof errorLike.details === "string" ? errorLike.details : undefined;
    const hint = typeof errorLike.hint === "string" ? errorLike.hint : undefined;
    const baseMessage = typeof errorLike.message === "string"
      ? errorLike.message
      : JSON.stringify(errorLike);

    const messageParts = [baseMessage, details, hint].filter(Boolean);
    return {
      code,
      message: messageParts.join(" | "),
    };
  }

  return {
    code: undefined,
    message: String(error),
  };
}

function timestampForFolder(date) {
  const iso = date.toISOString();
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function main() {
  const envFromFile = readEnvFromDotEnvLocal();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFromFile.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFromFile.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[ops:export:critical] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const isReachable = await ensureSupabaseReachable(supabaseUrl);
  if (!isReachable) {
    console.error("[ops:export:critical] Supabase is not reachable. Start local stack or point env to reachable project.");
    process.exit(1);
  }

  const outputRoot = getCliOption("outputDir", "backups");
  const runTimestamp = new Date();
  const backupFolder = path.resolve(process.cwd(), outputRoot, timestampForFolder(runTimestamp));

  mkdirSync(backupFolder, { recursive: true });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        "x-edumanage-operation": "ops-export-critical-data",
      },
    },
  });

  const summary = {
    generatedAt: runTimestamp.toISOString(),
    tables: [],
    skippedTables: [],
  };

  for (const table of CRITICAL_TABLES) {
    try {
      const rows = await fetchTableRows(supabase, table.name, table.orderBy);
      const tablePath = path.join(backupFolder, `${table.name}.json`);
      writeFileSync(tablePath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");

      summary.tables.push({
        name: table.name,
        rowCount: rows.length,
        file: `${table.name}.json`,
      });

      console.log(`[ops:export:critical] Exported ${table.name}: ${rows.length} rows.`);
    } catch (error) {
      const normalizedError = normalizeError(error);
      const code = normalizedError.code;
      const message = normalizedError.message;

      if (code === "42P01") {
        summary.skippedTables.push({
          name: table.name,
          reason: "table does not exist in current environment",
        });
        console.warn(`[ops:export:critical] Skipped ${table.name}: table not found.`);
        continue;
      }

      console.error(`[ops:export:critical] Failed on ${table.name}: ${message}`);
      process.exit(1);
    }
  }

  writeFileSync(path.join(backupFolder, "manifest.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`[ops:export:critical] Done. Backup folder: ${backupFolder}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ops:export:critical] Unexpected failure: ${message}`);
  process.exit(1);
});
