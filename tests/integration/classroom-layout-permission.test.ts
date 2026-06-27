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
const shouldRunIntegration = ["1", "true", "yes"].includes((process.env.RUN_INTEGRATION_TESTS ?? "").toLowerCase());

const hasRequiredEnv = Boolean(url && anonKey && serviceRoleKey && shouldRunIntegration);
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

testSuite("classroom permission for teacher student moderator", () => {
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

  it("allows classroom access by role and scope with announcement write checks", async () => {
    const password = "Passw0rd!";

    const teacher = await createUser({
      email: uniqueEmail("classroom.teacher"),
      password,
      role: "teacher",
      fullName: "Classroom Teacher",
    });

    const moderator = await createUser({
      email: uniqueEmail("classroom.moderator"),
      password,
      role: "moderator",
      fullName: "Classroom Moderator",
    });

    const studentMember = await createUser({
      email: uniqueEmail("classroom.student.member"),
      password,
      role: "student",
      fullName: "Classroom Student Member",
    });

    const outsiderStudent = await createUser({
      email: uniqueEmail("classroom.student.outsider"),
      password,
      role: "student",
      fullName: "Classroom Student Outsider",
    });

    const { error: activateMemberError } = await adminClient
      .from("profiles")
      .update({ access_status: "active" })
      .eq("id", studentMember.id);

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
        code: `CLS-${Date.now().toString().slice(-6)}`,
        title: "Classroom Permission Course",
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
        class_code: `ROOM-${Date.now().toString().slice(-5)}`,
        title: "Classroom Permission Class",
        status: "active",
      })
      .select("id")
      .single();

    expect(classError).toBeNull();
    expect(courseClass?.id).toBeTruthy();

    const { error: memberInsertError } = await adminClient.from("class_members").insert({
      class_id: courseClass!.id,
      student_id: studentMember.id,
      status: "active",
    });

    expect(memberInsertError).toBeNull();

    const { error: scopeInsertError } = await adminClient.from("permission_scopes").insert({
      actor_id: moderator.id,
      scope_type: "course",
      scope_id: course!.id,
      permissions: {
        manage_class: true,
      },
      status: "active",
      granted_by: teacher.id,
    });

    expect(scopeInsertError).toBeNull();

    const teacherClient = await createScopedClient(teacher.email, password);
    const moderatorClient = await createScopedClient(moderator.email, password);
    const studentMemberClient = await createScopedClient(studentMember.email, password);
    const outsiderStudentClient = await createScopedClient(outsiderStudent.email, password);

    const { data: teacherClassRead, error: teacherClassReadError } = await teacherClient
      .from("classes")
      .select("id")
      .eq("id", courseClass!.id);

    expect(teacherClassReadError).toBeNull();
    expect(teacherClassRead?.length).toBe(1);

    const { data: studentClassRead, error: studentClassReadError } = await studentMemberClient
      .from("classes")
      .select("id")
      .eq("id", courseClass!.id);

    expect(studentClassReadError).toBeNull();
    expect(studentClassRead?.length).toBe(1);

    const { data: moderatorClassRead, error: moderatorClassReadError } = await moderatorClient
      .from("classes")
      .select("id")
      .eq("id", courseClass!.id);

    expect(moderatorClassReadError).toBeNull();
    expect(moderatorClassRead?.length).toBe(1);

    const { data: outsiderClassRead, error: outsiderClassReadError } = await outsiderStudentClient
      .from("classes")
      .select("id")
      .eq("id", courseClass!.id);

    expect(outsiderClassReadError).toBeNull();
    expect(outsiderClassRead ?? []).toHaveLength(0);

    const { error: teacherAnnouncementInsertError } = await teacherClient.from("class_announcements").insert({
      class_id: courseClass!.id,
      created_by: teacher.id,
      title: "Teacher announcement",
      content: "Teacher can post",
      status: "published",
    });

    expect(teacherAnnouncementInsertError).toBeNull();

    const { error: moderatorAnnouncementInsertError } = await moderatorClient.from("class_announcements").insert({
      class_id: courseClass!.id,
      created_by: moderator.id,
      title: "Moderator announcement",
      content: "Moderator can post by scope",
      status: "published",
    });

    expect(moderatorAnnouncementInsertError).toBeNull();

    const { error: studentAnnouncementInsertError } = await studentMemberClient.from("class_announcements").insert({
      class_id: courseClass!.id,
      created_by: studentMember.id,
      title: "Student announcement",
      content: "Student must be blocked",
      status: "published",
    });

    expect(studentAnnouncementInsertError).not.toBeNull();
  });
});
