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
  const adminClient = createAdminClient();

  const usersResult = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (usersResult.error) {
    throw usersResult.error;
  }

  const fixtureUsers = usersResult.data.users.filter((user) => user.email?.includes(".course.results.") && user.email?.endsWith("@local.test"));
  const fixtureUserIds = fixtureUsers.map((user) => user.id);
  const fixtureEmails = fixtureUsers.map((user) => user.email).filter(Boolean);

  if (fixtureUserIds.length === 0) {
    console.log("[cleanup-course-results] No fixture auth users found.");
    return;
  }

  const { data: fixtureCourses, error: fixtureCoursesError } = await adminClient
    .from("courses")
    .select("id")
    .in("owner_id", fixtureUserIds);

  if (fixtureCoursesError) {
    throw fixtureCoursesError;
  }

  const courseIds = (fixtureCourses ?? []).map((row) => row.id);

  const { data: fixtureClasses, error: fixtureClassesError } = await adminClient
    .from("classes")
    .select("id,course_id")
    .or(`teacher_id.in.(${fixtureUserIds.join(",")}),course_id.in.(${courseIds.length > 0 ? courseIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);

  if (fixtureClassesError) {
    throw fixtureClassesError;
  }

  const classIds = (fixtureClasses ?? []).map((row) => row.id);
  const allCourseIds = Array.from(new Set([...(courseIds ?? []), ...(fixtureClasses ?? []).map((row) => row.course_id)]));

  const { data: fixtureAssessments, error: fixtureAssessmentsError } = await adminClient
    .from("assessments")
    .select("id")
    .or(
      [
        classIds.length > 0 ? `class_id.in.(${classIds.join(",")})` : null,
        allCourseIds.length > 0 ? `course_id.in.(${allCourseIds.join(",")})` : null,
      ].filter(Boolean).join(","),
    );

  if (fixtureAssessmentsError) {
    throw fixtureAssessmentsError;
  }

  const assessmentIds = (fixtureAssessments ?? []).map((row) => row.id);

  if (assessmentIds.length > 0) {
    await adminClient.from("course_assessment_results").delete().in("assessment_id", assessmentIds);
    await adminClient.from("submissions").delete().in("assessment_id", assessmentIds);
    await adminClient.from("import_jobs").delete().in("assessment_id", assessmentIds);
    await adminClient.from("assessment_question_links").delete().in("assessment_id", assessmentIds);
    await adminClient.from("assessments").delete().in("id", assessmentIds);
  }

  if (classIds.length > 0) {
    await adminClient.from("class_members").delete().in("class_id", classIds);
    await adminClient.from("direct_messages").delete().in("class_id", classIds);
    await adminClient.from("classes").delete().in("id", classIds);
  }

  if (allCourseIds.length > 0) {
    await adminClient.from("permission_scopes").delete().in("scope_id", allCourseIds);
    await adminClient.from("materials").delete().in("course_id", allCourseIds);
    await adminClient.from("simulations").delete().in("course_id", allCourseIds);
    await adminClient.from("question_bank_items").delete().in("course_id", allCourseIds);
    await adminClient.from("student_course_stats").delete().in("course_id", allCourseIds);
    await adminClient.from("enrollment_requests").delete().in("course_id", allCourseIds);
    await adminClient.from("class_change_requests").delete().in("course_id", allCourseIds);
    await adminClient.from("course_change_requests").delete().in("target_course_id", allCourseIds);
    await adminClient.from("courses").delete().in("id", allCourseIds);
  }

  await adminClient.from("permission_scopes").delete().in("actor_id", fixtureUserIds);
  await adminClient.from("personal_library_settings").delete().in("teacher_id", fixtureUserIds);
  await adminClient.from("profiles").delete().in("id", fixtureUserIds);

  for (const userId of fixtureUserIds) {
    const deleteResult = await adminClient.auth.admin.deleteUser(userId);

    if (deleteResult.error) {
      throw deleteResult.error;
    }
  }

  console.log("[cleanup-course-results] Deleted fixture users:");
  console.log(JSON.stringify(fixtureEmails, null, 2));
}

main().catch((error) => {
  console.error("[cleanup-course-results] failed", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
