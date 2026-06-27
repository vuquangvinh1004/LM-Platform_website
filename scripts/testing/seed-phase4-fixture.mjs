import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

function readLocalEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    return {};
  }

  const raw = fs.readFileSync(envPath, "utf8");
  const env = {};

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

async function ensureAuthUser(adminClient, input) {
  const { email, password, role, fullName, studentCode, teacherCode, accessStatus } = input;

  const listResult = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listResult.error) {
    throw listResult.error;
  }

  const existing = listResult.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    const updateResult = await adminClient.auth.admin.updateUserById(existing.id, {
      password,
      app_metadata: { role },
      user_metadata: { role, full_name: fullName },
      email_confirm: true,
    });

    if (updateResult.error) {
      throw updateResult.error;
    }

    const profileUpsert = await adminClient.from("profiles").upsert(
      {
        id: existing.id,
        email,
        full_name: fullName,
        role,
        status: "active",
        access_status: accessStatus,
        student_code: studentCode ?? null,
        teacher_code: teacherCode ?? null,
      },
      { onConflict: "id" },
    );

    if (profileUpsert.error) {
      throw profileUpsert.error;
    }

    return existing.id;
  }

  const createResult = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { role, full_name: fullName },
  });

  if (createResult.error || !createResult.data.user) {
    throw createResult.error ?? new Error("Cannot create user");
  }

  const profileUpsert = await adminClient.from("profiles").upsert(
    {
      id: createResult.data.user.id,
      email,
      full_name: fullName,
      role,
      status: "active",
      access_status: accessStatus,
      student_code: studentCode ?? null,
      teacher_code: teacherCode ?? null,
    },
    { onConflict: "id" },
  );

  if (profileUpsert.error) {
    throw profileUpsert.error;
  }

  return createResult.data.user.id;
}

async function main() {
  const env = readLocalEnvFile();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SUPABASE_SECRET_KEY
    ?? env.SUPABASE_SERVICE_ROLE_KEY
    ?? env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY");
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fixturePassword = process.env.FIXTURE_DEFAULT_PASSWORD ?? "Passw0rd!";

  const teacherEmail = "teacher.fixture.phase4@local.test";
  const teacherId = await ensureAuthUser(adminClient, {
    email: teacherEmail,
    password: fixturePassword,
    role: "teacher",
    fullName: "Teacher Fixture Phase 4",
    teacherCode: "GV-FIX-01",
    accessStatus: "active",
  });

  const studentIds = [];

  for (let index = 1; index <= 5; index += 1) {
    const studentEmail = `student${index}.fixture.phase4@local.test`;
    const studentId = await ensureAuthUser(adminClient, {
      email: studentEmail,
      password: fixturePassword,
      role: "student",
      fullName: `Student Fixture ${index}`,
      studentCode: `SV-FIX-0${index}`,
      accessStatus: "active",
    });

    studentIds.push({
      id: studentId,
      email: studentEmail,
      studentCode: `SV-FIX-0${index}`,
      fullName: `Student Fixture ${index}`,
    });
  }

  const nowTag = Date.now().toString().slice(-6);
  const courseCode = `FIX4-${nowTag}`;
  const classCode = `CL-FIX4-${nowTag}`;

  const courseInsert = await adminClient
    .from("courses")
    .insert({
      owner_id: teacherId,
      code: courseCode,
      title: "Course Fixture Phase 4",
      description: "Du lieu gia lap cho test Phase 4",
      visibility: "private",
      status: "active",
    })
    .select("id")
    .single();

  if (courseInsert.error) {
    throw courseInsert.error;
  }

  const classInsert = await adminClient
    .from("classes")
    .insert({
      course_id: courseInsert.data.id,
      teacher_id: teacherId,
      class_code: classCode,
      title: "Class Fixture Phase 4",
      semester: "HK1",
      academic_year: "2026-2027",
      status: "active",
    })
    .select("id")
    .single();

  if (classInsert.error) {
    throw classInsert.error;
  }

  const memberInsert = await adminClient
    .from("class_members")
    .insert(
      studentIds.map((student) => ({
        class_id: classInsert.data.id,
        student_id: student.id,
        student_code_snapshot: student.studentCode,
        full_name_snapshot: student.fullName,
        status: "active",
      })),
    );

  if (memberInsert.error) {
    throw memberInsert.error;
  }

  const assessmentInsert = await adminClient
    .from("assessments")
    .insert({
      class_id: classInsert.data.id,
      course_id: courseInsert.data.id,
      created_by: teacherId,
      title: "Assessment Fixture Phase 4",
      description: "Assessment gia lap de test webhook/result dashboard",
      provider: "google_form",
      form_url: "https://docs.google.com/forms/d/e/demo/viewform",
      embed_mode: "new_tab",
      status: "open",
    })
    .select("id")
    .single();

  if (assessmentInsert.error) {
    throw assessmentInsert.error;
  }

  console.log("FIXTURE_CREATED");
  console.log(JSON.stringify({
    teacher: {
      email: teacherEmail,
      password: fixturePassword,
    },
    students: studentIds.map((student) => ({
      email: student.email,
      password: fixturePassword,
      studentCode: student.studentCode,
    })),
    courseCode,
    classCode,
    assessmentId: assessmentInsert.data.id,
  }, null, 2));
}

main().catch((error) => {
  console.error("FIXTURE_FAILED", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
