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

function createAdminClient() {
  const env = readLocalEnvFile();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SUPABASE_SECRET_KEY
    ?? env.SUPABASE_SERVICE_ROLE_KEY
    ?? env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function main() {
  const supabase = createAdminClient();
  const { data: materials, error } = await supabase
    .from("materials")
    .select("id,title,review_status,storage_bucket,storage_path,status,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const targetMaterials = (materials ?? []).filter((row) => {
    const missingStorage = !row.storage_bucket || !row.storage_path;
    return row.review_status === "rejected" || missingStorage;
  });

  const summary = [];

  for (const material of targetMaterials) {
    if (material.storage_bucket && material.storage_path) {
      const { error: storageError } = await supabase.storage.from(material.storage_bucket).remove([material.storage_path]);

      if (storageError) {
        throw storageError;
      }
    }

    const { error: linkError } = await supabase
      .from("class_resource_links")
      .delete()
      .eq("target_type", "material")
      .eq("target_id", material.id);

    if (linkError) {
      throw linkError;
    }

    const { error: deleteError } = await supabase.from("materials").delete().eq("id", material.id);

    if (deleteError) {
      throw deleteError;
    }

    summary.push({
      id: material.id,
      title: material.title,
      reviewStatus: material.review_status,
      storageBucket: material.storage_bucket,
      storagePath: material.storage_path,
    });
  }

  console.log(JSON.stringify({ removed: summary }, null, 2));
}

await main();
