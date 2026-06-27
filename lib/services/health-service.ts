import packageJson from "@/package.json";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { ServiceResult } from "@/lib/types/service-result";

type HealthCheckState = "ok" | "skipped" | "missing" | "failed";

export type HealthStatus = {
  status: "ok" | "degraded";
  version: string;
  timestamp: string;
  checks: {
    env: {
      state: "ok" | "missing";
      missingKeys: string[];
    };
    database: {
      state: HealthCheckState;
      details?: string;
    };
  };
};

const requiredEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_URL",
  "GOOGLE_FORM_WEBHOOK_SECRET",
  "MICROSOFT_FORM_WEBHOOK_SECRET",
] as const;

export async function getHealthStatus(): Promise<ServiceResult<HealthStatus>> {
  const missingKeys = requiredEnvKeys.filter((key) => !process.env[key]);
  const timestamp = new Date().toISOString();

  if (missingKeys.length > 0) {
    return {
      ok: true,
      data: {
        status: "degraded",
        version: packageJson.version,
        timestamp,
        checks: {
          env: {
            state: "missing",
            missingKeys,
          },
          database: {
            state: "skipped",
            details: "Skipped because required production environment variables are missing.",
          },
        },
      },
    };
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase.from("profiles").select("id", { head: true, count: "exact" }).limit(1);

    if (error) {
      return {
        ok: true,
        data: {
          status: "degraded",
          version: packageJson.version,
          timestamp,
          checks: {
            env: {
              state: "ok",
              missingKeys: [],
            },
            database: {
              state: "failed",
              details: error.message,
            },
          },
        },
      };
    }

    return {
      ok: true,
      data: {
        status: "ok",
        version: packageJson.version,
        timestamp,
        checks: {
          env: {
            state: "ok",
            missingKeys: [],
          },
          database: {
            state: "ok",
          },
        },
      },
    };
  } catch (error) {
    return {
      ok: true,
      data: {
        status: "degraded",
        version: packageJson.version,
        timestamp,
        checks: {
          env: {
            state: "ok",
            missingKeys: [],
          },
          database: {
            state: "failed",
            details: error instanceof Error ? error.message : "Unknown database health check error.",
          },
        },
      },
    };
  }
}
