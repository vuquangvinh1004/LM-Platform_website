import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

const localEnv = readLocalEnvFile();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

const hasRequiredEnv = Boolean(url && anonKey && serviceRoleKey);
const testSuite = hasRequiredEnv ? describe : describe.skip;

const createdUserIds: string[] = [];

let anonClient: SupabaseClient;
let adminClient: SupabaseClient;

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${randomUUID()}@local.test`;
}

async function createUser(input: {
  email: string;
  password: string;
  role: "admin" | "moderator" | "teacher" | "student";
  fullName: string;
}): Promise<{ id: string; email: string }> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: {
      role: input.role,
    },
    user_metadata: {
      role: input.role,
      full_name: input.fullName,
    },
  });

  if (error || !data.user?.id) {
    throw new Error(`createUser failed: ${error?.message}`);
  }

  createdUserIds.push(data.user.id);

  return {
    id: data.user.id,
    email: input.email,
  };
}

async function createScopedClient(email: string, password: string): Promise<SupabaseClient> {
  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });

  if (error || !data.session?.access_token) {
    throw new Error(`Cannot sign in scoped client: ${error?.message}`);
  }

  return createClient(url!, anonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

testSuite("phase 4.1 assessment visibility by membership", () => {
  beforeAll(() => {
    anonClient = createClient(url!, anonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    adminClient = createClient(url!, serviceRoleKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await adminClient.auth.admin.deleteUser(userId);
    }
  });

  it("student can read assessments only for classes with active membership", async () => {
    const password = "Passw0rd!";

    const teacher = await createUser({
      email: uniqueEmail("phase41.teacher"),
      password,
      role: "teacher",
      fullName: "Phase41 Teacher",
    });

    const memberStudent = await createUser({
      email: uniqueEmail("phase41.member"),
      password,
      role: "student",
      fullName: "Phase41 Member Student",
    });

    const outsiderStudent = await createUser({
      email: uniqueEmail("phase41.outsider"),
      password,
      role: "student",
      fullName: "Phase41 Outsider Student",
    });

    const { error: activateMemberError } = await adminClient
      .from("profiles")
      .update({ access_status: "active" })
      .eq("id", memberStudent.id);

    expect(activateMemberError).toBeNull();

    const { error: activateOutsiderError } = await adminClient
      .from("profiles")
      .update({ access_status: "active" })
      .eq("id", outsiderStudent.id);

    expect(activateOutsiderError).toBeNull();

    const { data: course, error: courseError } = await adminClient
      .from("courses")
      .insert({
        owner_id: teacher.id,
        code: `P41-${Date.now().toString().slice(-6)}`,
        title: "Phase 4.1 Visibility Course",
        visibility: "private",
        status: "active",
      })
      .select("id")
      .single();

    expect(courseError).toBeNull();
    expect(course?.id).toBeTruthy();

    const { data: courseClass, error: classError } = await adminClient
      .from("classes")
      .insert({
        course_id: course!.id,
        teacher_id: teacher.id,
        class_code: `P41CLS-${Date.now().toString().slice(-5)}`,
        title: "Phase 4.1 Visibility Class",
        status: "active",
      })
      .select("id")
      .single();

    expect(classError).toBeNull();
    expect(courseClass?.id).toBeTruthy();

    const { error: memberInsertError } = await adminClient.from("class_members").insert({
      class_id: courseClass!.id,
      student_id: memberStudent.id,
      status: "active",
    });

    expect(memberInsertError).toBeNull();

    const { data: assessment, error: assessmentError } = await adminClient
      .from("assessments")
      .insert({
        class_id: courseClass!.id,
        course_id: course!.id,
        created_by: teacher.id,
        title: "Phase 4.1 Visible Assessment",
        provider: "google_form",
        form_url: "https://docs.google.com/forms/d/e/demo/viewform",
        embed_mode: "iframe",
        status: "open",
      })
      .select("id")
      .single();

    expect(assessmentError).toBeNull();
    expect(assessment?.id).toBeTruthy();

    const memberClient = await createScopedClient(memberStudent.email, password);
    const outsiderClient = await createScopedClient(outsiderStudent.email, password);

    const { data: memberAssessments, error: memberReadError } = await memberClient
      .from("assessments")
      .select("id,title")
      .eq("id", assessment!.id);

    expect(memberReadError).toBeNull();
    expect(memberAssessments?.length).toBe(1);

    const { data: outsiderAssessments, error: outsiderReadError } = await outsiderClient
      .from("assessments")
      .select("id,title")
      .eq("id", assessment!.id);

    expect(outsiderReadError).toBeNull();
    expect(outsiderAssessments ?? []).toHaveLength(0);
  });
});
