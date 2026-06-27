import { afterEach, describe, expect, it, vi } from "vitest";

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getHealthStatus } from "@/lib/services/health-service";

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleSupabaseClient: vi.fn(),
}));

const mockedCreateServiceRoleSupabaseClient = vi.mocked(createServiceRoleSupabaseClient);
const originalEnv = { ...process.env };

describe("getHealthStatus", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    mockedCreateServiceRoleSupabaseClient.mockReset();
  });

  it("returns degraded response when required env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.APP_URL;
    delete process.env.GOOGLE_FORM_WEBHOOK_SECRET;
    delete process.env.MICROSOFT_FORM_WEBHOOK_SECRET;

    const result = await getHealthStatus();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("degraded");
      expect(result.data.checks.env.state).toBe("missing");
      expect(result.data.checks.database.state).toBe("skipped");
    }
  });

  it("returns ok response when env vars and database check pass", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.APP_URL = "https://example.com";
    process.env.GOOGLE_FORM_WEBHOOK_SECRET = "google-secret";
    process.env.MICROSOFT_FORM_WEBHOOK_SECRET = "microsoft-secret";

    mockedCreateServiceRoleSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      }),
    } as never);

    const result = await getHealthStatus();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("ok");
      expect(result.data.version).toBe("1.0.0");
      expect(result.data.checks.env.state).toBe("ok");
      expect(result.data.checks.database.state).toBe("ok");
    }
  });
});
