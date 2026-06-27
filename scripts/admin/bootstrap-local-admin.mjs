import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

function readLocalEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    return {};
  }

  const env = {};
  const raw = fs.readFileSync(envPath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^"|"$/g, "");
    env[key] = value;
  }

  return env;
}

async function bootstrapLocalAdmin() {
  const localEnv = readLocalEnvFile();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SUPABASE_SECRET_KEY
    ?? localEnv.SUPABASE_SERVICE_ROLE_KEY
    ?? localEnv.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
  }

  const adminEmail = process.env.LOCAL_ADMIN_EMAIL ?? localEnv.LOCAL_ADMIN_EMAIL ?? "admin@local.test";
  const adminPassword = process.env.LOCAL_ADMIN_DEFAULT_PASSWORD ?? localEnv.LOCAL_ADMIN_DEFAULT_PASSWORD ?? "Admin";

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const createUserResult = await adminClient.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    app_metadata: {
      role: "admin",
    },
    user_metadata: {
      role: "admin",
      full_name: "Local Admin",
    },
  });

  if (createUserResult.error && !createUserResult.error.message.toLowerCase().includes("already")) {
    throw createUserResult.error;
  }

  let adminUserId = createUserResult.data.user?.id;

  if (!adminUserId) {
    const usersResult = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });

    if (usersResult.error) {
      throw usersResult.error;
    }

    adminUserId = usersResult.data.users.find((user) => user.email?.toLowerCase() === adminEmail.toLowerCase())?.id;
  }

  if (!adminUserId) {
    throw new Error("LOCAL_ADMIN_USER_NOT_FOUND");
  }

  const upsertProfileResult = await adminClient.from("profiles").upsert(
    {
      id: adminUserId,
      email: adminEmail,
      full_name: "Local Admin",
      role: "admin",
      status: "active",
      access_status: "active",
      access_expires_at: null,
    },
    { onConflict: "id" },
  );

  if (upsertProfileResult.error) {
    throw upsertProfileResult.error;
  }

  console.log("LOCAL_ADMIN_READY");
}

bootstrapLocalAdmin().catch((error) => {
  console.error("LOCAL_ADMIN_BOOTSTRAP_FAILED", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
