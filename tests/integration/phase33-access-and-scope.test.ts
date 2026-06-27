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

testSuite("phase 3.3 access lifecycle and scope", () => {
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

  it("blocks pending/expired students from class, material, and assessment reads", async () => {
    const password = "Passw0rd!";

    const teacher = await createUser({
      email: uniqueEmail("phase33.teacher"),
      password,
      role: "teacher",
      fullName: "Phase33 Teacher",
    });

    const student = await createUser({
      email: uniqueEmail("phase33.student"),
      password,
      role: "student",
      fullName: "Phase33 Student",
    });

    const { data: course, error: courseError } = await adminClient
      .from("courses")
      .insert({
        owner_id: teacher.id,
        code: `P33-${Date.now().toString().slice(-6)}`,
        title: "Phase 3.3 Access Course",
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
        class_code: `P33CLS-${Date.now().toString().slice(-5)}`,
        title: "Phase 3.3 Access Class",
        status: "active",
      })
      .select("id")
      .single();

    expect(classError).toBeNull();
    expect(courseClass?.id).toBeTruthy();

    const { error: memberError } = await adminClient.from("class_members").insert({
      class_id: courseClass!.id,
      student_id: student.id,
      status: "active",
    });

    expect(memberError).toBeNull();

    const { data: material, error: materialError } = await adminClient
      .from("materials")
      .insert({
        course_id: course!.id,
        uploaded_by: teacher.id,
        title: "Phase 3.3 Material",
        file_name: "phase33.pdf",
        file_type: "application/pdf",
        file_size: 128,
        storage_bucket: "course-materials",
        storage_path: `${course!.id}/${randomUUID()}/phase33.pdf`,
        allow_download: true,
        status: "published",
      })
      .select("id")
      .single();

    expect(materialError).toBeNull();
    expect(material?.id).toBeTruthy();

    const { data: assessment, error: assessmentError } = await adminClient
      .from("assessments")
      .insert({
        class_id: courseClass!.id,
        course_id: course!.id,
        created_by: teacher.id,
        title: "Phase 3.3 Assessment",
        provider: "manual",
        embed_mode: "new_tab",
        status: "open",
      })
      .select("id")
      .single();

    expect(assessmentError).toBeNull();
    expect(assessment?.id).toBeTruthy();

    const studentClient = await createScopedClient(student.email, password);

    const { error: activeStatusError } = await adminClient
      .from("profiles")
      .update({ access_status: "active", access_expires_at: null })
      .eq("id", student.id);

    expect(activeStatusError).toBeNull();

    const { data: activeClasses, error: activeClassReadError } = await studentClient
      .from("classes")
      .select("id")
      .eq("id", courseClass!.id);

    expect(activeClassReadError).toBeNull();
    expect(activeClasses?.length).toBe(1);

    const { data: activeMaterials, error: activeMaterialReadError } = await studentClient
      .from("materials")
      .select("id")
      .eq("id", material!.id);

    expect(activeMaterialReadError).toBeNull();
    expect(activeMaterials?.length).toBe(1);

    const { data: activeAssessments, error: activeAssessmentReadError } = await studentClient
      .from("assessments")
      .select("id")
      .eq("id", assessment!.id);

    expect(activeAssessmentReadError).toBeNull();
    expect(activeAssessments?.length).toBe(1);

    const { error: pendingStatusError } = await adminClient
      .from("profiles")
      .update({ access_status: "pending_approval" })
      .eq("id", student.id);

    expect(pendingStatusError).toBeNull();

    const { data: pendingClasses, error: pendingClassReadError } = await studentClient
      .from("classes")
      .select("id")
      .eq("id", courseClass!.id);

    expect(pendingClassReadError).toBeNull();
    expect(pendingClasses ?? []).toHaveLength(0);

    const { data: pendingMaterials, error: pendingMaterialReadError } = await studentClient
      .from("materials")
      .select("id")
      .eq("id", material!.id);

    expect(pendingMaterialReadError).toBeNull();
    expect(pendingMaterials ?? []).toHaveLength(0);

    const { data: pendingAssessments, error: pendingAssessmentReadError } = await studentClient
      .from("assessments")
      .select("id")
      .eq("id", assessment!.id);

    expect(pendingAssessmentReadError).toBeNull();
    expect(pendingAssessments ?? []).toHaveLength(0);

    const { error: expiredStatusError } = await adminClient
      .from("profiles")
      .update({
        access_status: "expired",
        access_expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", student.id);

    expect(expiredStatusError).toBeNull();

    const { data: expiredClasses, error: expiredClassReadError } = await studentClient
      .from("classes")
      .select("id")
      .eq("id", courseClass!.id);

    expect(expiredClassReadError).toBeNull();
    expect(expiredClasses ?? []).toHaveLength(0);

    const { data: expiredMaterials, error: expiredMaterialReadError } = await studentClient
      .from("materials")
      .select("id")
      .eq("id", material!.id);

    expect(expiredMaterialReadError).toBeNull();
    expect(expiredMaterials ?? []).toHaveLength(0);

    const { data: expiredAssessments, error: expiredAssessmentReadError } = await studentClient
      .from("assessments")
      .select("id")
      .eq("id", assessment!.id);

    expect(expiredAssessmentReadError).toBeNull();
    expect(expiredAssessments ?? []).toHaveLength(0);
  });

  it("renew_student_access keeps active status while extending expiry", async () => {
    const password = "Passw0rd!";

    const teacher = await createUser({
      email: uniqueEmail("phase33.renew.teacher"),
      password,
      role: "teacher",
      fullName: "Phase33 Renew Teacher",
    });

    const student = await createUser({
      email: uniqueEmail("phase33.renew.student"),
      password,
      role: "student",
      fullName: "Phase33 Renew Student",
    });

    const teacherClient = await createScopedClient(teacher.email, password);

    const initialExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const renewedExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: initialUpdateError } = await adminClient
      .from("profiles")
      .update({
        access_status: "active",
        approved_by: teacher.id,
        approved_at: new Date().toISOString(),
        access_expires_at: initialExpiry,
      })
      .eq("id", student.id);

    expect(initialUpdateError).toBeNull();

    const { data: renewResult, error: renewError } = await teacherClient.rpc("renew_student_access", {
      target_student_id: student.id,
      target_expires_at: renewedExpiry,
    });

    expect(renewError).toBeNull();
    expect(Boolean(renewResult)).toBe(true);

    const { data: updatedProfile, error: updatedProfileError } = await adminClient
      .from("profiles")
      .select("access_status,access_expires_at")
      .eq("id", student.id)
      .single();

    expect(updatedProfileError).toBeNull();
    expect(updatedProfile?.access_status).toBe("active");
    expect(new Date(String(updatedProfile?.access_expires_at)).toISOString()).toBe(new Date(renewedExpiry).toISOString());
  });

  it("enforces moderator scope for can_manage_course and can_manage_class", async () => {
    const password = "Passw0rd!";

    const teacher = await createUser({
      email: uniqueEmail("phase33.scope.teacher"),
      password,
      role: "teacher",
      fullName: "Phase33 Scope Teacher",
    });

    const moderator = await createUser({
      email: uniqueEmail("phase33.scope.moderator"),
      password,
      role: "moderator",
      fullName: "Phase33 Scope Moderator",
    });

    const { data: courseA } = await adminClient
      .from("courses")
      .insert({
        owner_id: teacher.id,
        code: `P33A-${Date.now().toString().slice(-6)}`,
        title: "Scoped Course A",
        visibility: "private",
        status: "active",
      })
      .select("id")
      .single();

    const { data: courseB } = await adminClient
      .from("courses")
      .insert({
        owner_id: teacher.id,
        code: `P33B-${Date.now().toString().slice(-6)}`,
        title: "Scoped Course B",
        visibility: "private",
        status: "active",
      })
      .select("id")
      .single();

    const { data: classA } = await adminClient
      .from("classes")
      .insert({
        course_id: courseA!.id,
        teacher_id: teacher.id,
        class_code: `SCPA-${Date.now().toString().slice(-5)}`,
        title: "Scoped Class A",
        status: "active",
      })
      .select("id")
      .single();

    const { data: classB } = await adminClient
      .from("classes")
      .insert({
        course_id: courseB!.id,
        teacher_id: teacher.id,
        class_code: `SCPB-${Date.now().toString().slice(-5)}`,
        title: "Scoped Class B",
        status: "active",
      })
      .select("id")
      .single();

    const { error: scopeInsertError } = await adminClient.from("permission_scopes").insert({
      actor_id: moderator.id,
      scope_type: "course",
      scope_id: courseA!.id,
      permissions: {
        manage_course: true,
        manage_class: true,
      },
      status: "active",
      granted_by: teacher.id,
    });

    expect(scopeInsertError).toBeNull();

    const moderatorClient = await createScopedClient(moderator.email, password);

    const { data: canManageCourseA, error: canManageCourseAError } = await moderatorClient.rpc("can_manage_course", {
      target_course_id: courseA!.id,
    });

    expect(canManageCourseAError).toBeNull();
    expect(Boolean(canManageCourseA)).toBe(true);

    const { data: canManageCourseB, error: canManageCourseBError } = await moderatorClient.rpc("can_manage_course", {
      target_course_id: courseB!.id,
    });

    expect(canManageCourseBError).toBeNull();
    expect(Boolean(canManageCourseB)).toBe(false);

    const { data: canManageClassA, error: canManageClassAError } = await moderatorClient.rpc("can_manage_class", {
      target_class_id: classA!.id,
    });

    expect(canManageClassAError).toBeNull();
    expect(Boolean(canManageClassA)).toBe(true);

    const { data: canManageClassB, error: canManageClassBError } = await moderatorClient.rpc("can_manage_class", {
      target_class_id: classB!.id,
    });

    expect(canManageClassBError).toBeNull();
    expect(Boolean(canManageClassB)).toBe(false);

    const { error: revokeError } = await adminClient
      .from("permission_scopes")
      .update({ status: "revoked" })
      .eq("actor_id", moderator.id)
      .eq("scope_type", "course")
      .eq("scope_id", courseA!.id);

    expect(revokeError).toBeNull();

    const { data: canManageCourseAfterRevoke, error: canManageCourseAfterRevokeError } = await moderatorClient.rpc("can_manage_course", {
      target_course_id: courseA!.id,
    });

    expect(canManageCourseAfterRevokeError).toBeNull();
    expect(Boolean(canManageCourseAfterRevoke)).toBe(false);
  });
});
