import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const localEnv = readLocalEnvFile();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

const hasRequiredEnv = Boolean(url && anonKey && serviceRoleKey);
const testSuite = hasRequiredEnv ? describe : describe.skip;

const createdUserIds: string[] = [];

let anonClient: SupabaseClient;
let adminClient: SupabaseClient;

function readLocalEnvFile(): Record<string, string> {
  const localEnvPath = path.resolve(process.cwd(), ".env.local");

  if (!existsSync(localEnvPath)) {
    return {};
  }

  const content = readFileSync(localEnvPath, "utf8");
  const env: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    env[key] = rawValue.replace(/^"|"$/g, "");
  }

  return env;
}

testSuite("local supabase auth flow", () => {
  beforeAll(() => {
    anonClient = createClient(url!, anonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: "vitest-anon-auth",
      },
    });

    adminClient = createClient(url!, serviceRoleKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: "vitest-service-auth",
      },
    });
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await adminClient.auth.admin.deleteUser(userId);
    }
  });

  it("creates profile row automatically after sign up", async () => {
    const email = `teacher.${Date.now()}@local.test`;

    const { data, error } = await anonClient.auth.signUp({
      email,
      password: "Passw0rd!",
      options: {
        data: {
          full_name: "Teacher Test",
          role: "teacher",
        },
      },
    });

    expect(error).toBeNull();
    expect(data.user?.id).toBeTruthy();

    const userId = data.user!.id;
    createdUserIds.push(userId);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id,email,full_name,role,status")
      .eq("id", userId)
      .maybeSingle();

    expect(profileError).toBeNull();
    expect(profile).toBeTruthy();
    expect(profile?.email).toBe(email);
    expect(profile?.full_name).toBe("Teacher Test");
    expect(profile?.role).toBe("teacher");
    expect(profile?.status).toBe("active");
  });

  it("enforces profile RLS for student and allows admin read-all", async () => {
    const studentEmail = `student.${Date.now()}.${randomUUID()}@local.test`;
    const adminEmail = `admin.${Date.now()}.${randomUUID()}@local.test`;

    const { data: studentUser, error: studentCreateError } = await adminClient.auth.admin.createUser({
      email: studentEmail,
      password: "Passw0rd!",
      email_confirm: true,
      app_metadata: {
        role: "student",
      },
      user_metadata: {
        full_name: "Student Policy",
        role: "student",
      },
    });

    expect(studentCreateError).toBeNull();
    expect(studentUser.user?.id).toBeTruthy();

    const studentId = studentUser.user!.id;
    createdUserIds.push(studentId);

    const { data: adminUser, error: adminCreateError } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: "Passw0rd!",
      email_confirm: true,
      app_metadata: {
        role: "admin",
      },
      user_metadata: {
        full_name: "Admin Policy",
      },
    });

    expect(adminCreateError).toBeNull();
    expect(adminUser.user?.id).toBeTruthy();

    const adminId = adminUser.user!.id;
    createdUserIds.push(adminId);

    const { data: createdProfiles, error: createdProfilesError } = await adminClient
      .from("profiles")
      .select("id, role")
      .in("id", [studentId, adminId]);

    expect(createdProfilesError).toBeNull();
    expect(createdProfiles?.length).toBe(2);

    const { data: studentSessionData, error: studentSignInError } = await anonClient.auth.signInWithPassword({
      email: studentEmail,
      password: "Passw0rd!",
    });

    expect(studentSignInError).toBeNull();
    expect(studentSessionData.session?.access_token).toBeTruthy();

    const studentScopedClient = createClient(url!, anonKey!, {
      global: {
        headers: {
          Authorization: `Bearer ${studentSessionData.session!.access_token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: "vitest-student-scoped-auth",
      },
    });

    const { data: studentVisibleProfiles, error: studentProfilesError } = await studentScopedClient
      .from("profiles")
      .select("id");

    expect(studentProfilesError).toBeNull();
    expect(studentVisibleProfiles?.map((item) => item.id)).toEqual([studentId]);

    const { data: adminSessionData, error: adminSignInError } = await anonClient.auth.signInWithPassword({
      email: adminEmail,
      password: "Passw0rd!",
    });

    expect(adminSignInError).toBeNull();
    expect(adminSessionData.session?.access_token).toBeTruthy();

    const adminScopedClient = createClient(url!, anonKey!, {
      global: {
        headers: {
          Authorization: `Bearer ${adminSessionData.session!.access_token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: "vitest-admin-scoped-auth",
      },
    });

    const { data: adminVisibleProfiles, error: adminProfilesError } = await adminScopedClient
      .from("profiles")
      .select("id, role")
      .in("id", [studentId, adminId]);

    expect(adminProfilesError).toBeNull();
    expect(adminVisibleProfiles?.length).toBe(2);
  });
});
