import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const KEEP_EMAILS = [
  "admin@local.test",
  "mod123@local.test",
  "lec123@local.test",
  "stu123@local.test",
  "stu321@local.test",
];

const KEEP_CLASS_CODE = "A-Test";
const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

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

function formatInFilter(values) {
  return `(${values.join(",")})`;
}

async function runDelete(label, operation) {
  const { error } = await operation;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  console.log(`[cleanup] ${label}`);
}

async function runUpdate(label, operation) {
  const { error } = await operation;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  console.log(`[cleanup] ${label}`);
}

async function main() {
  const adminClient = createAdminClient();
  const usersResult = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (usersResult.error) {
    throw usersResult.error;
  }

  const authUsers = usersResult.data.users;
  const keepAuthUsers = authUsers.filter((user) => KEEP_EMAILS.includes(user.email?.toLowerCase() ?? ""));
  const removableAuthUsers = authUsers.filter((user) => !KEEP_EMAILS.includes(user.email?.toLowerCase() ?? ""));

  if (keepAuthUsers.length !== KEEP_EMAILS.length) {
    throw new Error("Missing one or more required keep-auth accounts.");
  }

  const { data: keepProfiles, error: keepProfilesError } = await adminClient
    .from("profiles")
    .select("id,email,role")
    .in("email", KEEP_EMAILS);

  if (keepProfilesError) {
    throw keepProfilesError;
  }

  if ((keepProfiles ?? []).length !== KEEP_EMAILS.length) {
    throw new Error("Missing one or more required keep profiles.");
  }

  const keepProfileIds = keepProfiles.map((profile) => profile.id);
  const keepTeacherIds = keepProfiles
    .filter((profile) => profile.role === "teacher")
    .map((profile) => profile.id);

  const { data: removableProfiles, error: removableProfilesError } = await adminClient
    .from("profiles")
    .select("id,email")
    .not("email", "in", formatInFilter(KEEP_EMAILS));

  if (removableProfilesError) {
    throw removableProfilesError;
  }

  const removableProfileIds = (removableProfiles ?? []).map((profile) => profile.id);

  const { data: keepClass, error: keepClassError } = await adminClient
    .from("classes")
    .select("id,class_code,title,course_id,teacher_id")
    .eq("class_code", KEEP_CLASS_CODE)
    .maybeSingle();

  if (keepClassError) {
    throw keepClassError;
  }

  if (!keepClass) {
    throw new Error("Keep class A-Test was not found.");
  }

  const keepClassId = keepClass.id;
  const keepCourseId = keepClass.course_id;

  await runDelete(
    "delete all permission scopes",
    adminClient.from("permission_scopes").delete().not("actor_id", "is", null),
  );

  await runDelete(
    "delete all activity logs",
    adminClient.from("activity_logs").delete().not("entity_type", "is", null),
  );

  await runDelete(
    "delete all library change requests",
    adminClient.from("library_change_requests").delete().not("target_type", "is", null),
  );

  await runDelete(
    "delete all simulation uploads",
    adminClient.from("simulation_uploads").delete().not("uploaded_by", "is", null),
  );

  await runDelete(
    "delete materials outside A-Test course",
    adminClient.from("materials").delete().neq("course_id", keepCourseId),
  );

  if (removableProfileIds.length > 0) {
    await runDelete(
      "delete A-Test materials uploaded by removable users",
      adminClient.from("materials").delete().eq("course_id", keepCourseId).in("uploaded_by", removableProfileIds),
    );
  }

  await runDelete(
    "delete class members outside A-Test",
    adminClient.from("class_members").delete().neq("class_id", keepClassId),
  );

  if (removableProfileIds.length > 0) {
    await runDelete(
      "delete removable students from A-Test class",
      adminClient.from("class_members").delete().eq("class_id", keepClassId).in("student_id", removableProfileIds),
    );
  }

  await runDelete(
    "delete direct messages outside A-Test",
    adminClient.from("direct_messages").delete().neq("class_id", keepClassId),
  );

  if (removableProfileIds.length > 0) {
    await runDelete(
      "delete A-Test direct messages sent by removable users",
      adminClient.from("direct_messages").delete().eq("class_id", keepClassId).in("sender_id", removableProfileIds),
    );
    await runDelete(
      "delete A-Test direct messages received by removable users",
      adminClient.from("direct_messages").delete().eq("class_id", keepClassId).in("recipient_id", removableProfileIds),
    );
  }

  await runDelete(
    "delete classes outside A-Test",
    adminClient.from("classes").delete().neq("id", keepClassId),
  );

  const { data: keepAssessments, error: keepAssessmentsError } = await adminClient
    .from("assessments")
    .select("id")
    .eq("class_id", keepClassId);

  if (keepAssessmentsError) {
    throw keepAssessmentsError;
  }

  const keepAssessmentIds = (keepAssessments ?? []).map((assessment) => assessment.id);

  if (keepAssessmentIds.length === 0) {
    await runDelete(
      "delete all assessment question links",
      adminClient.from("assessment_question_links").delete().not("assessment_id", "is", null),
    );
    await runDelete(
      "delete all import jobs",
      adminClient.from("import_jobs").delete().not("assessment_id", "is", null),
    );
    await runDelete(
      "delete all submissions",
      adminClient.from("submissions").delete().not("assessment_id", "is", null),
    );
    await runDelete(
      "delete all course assessment results",
      adminClient.from("course_assessment_results").delete().not("class_id", "is", null),
    );
  } else {
    await runDelete(
      "delete assessment question links outside A-Test",
      adminClient.from("assessment_question_links").delete().not("assessment_id", "in", formatInFilter(keepAssessmentIds)),
    );
    await runDelete(
      "delete import jobs outside A-Test",
      adminClient.from("import_jobs").delete().not("assessment_id", "in", formatInFilter(keepAssessmentIds)),
    );
    await runDelete(
      "delete submissions outside A-Test",
      adminClient.from("submissions").delete().not("assessment_id", "in", formatInFilter(keepAssessmentIds)),
    );
    if (removableProfileIds.length > 0) {
      await runDelete(
        "delete A-Test submissions of removable students",
        adminClient.from("submissions").delete().in("assessment_id", keepAssessmentIds).in("student_id", removableProfileIds),
      );
    }

    await runDelete(
      "delete course assessment results outside A-Test",
      adminClient.from("course_assessment_results").delete().neq("class_id", keepClassId),
    );
    if (removableProfileIds.length > 0) {
      await runDelete(
        "delete A-Test assessment results of removable students",
        adminClient
          .from("course_assessment_results")
          .delete()
          .eq("class_id", keepClassId)
          .in("student_id", removableProfileIds),
      );
    }
  }

  await runDelete(
    "delete enrollment requests outside A-Test course",
    adminClient.from("enrollment_requests").delete().neq("course_id", keepCourseId),
  );

  if (removableProfileIds.length > 0) {
    await runDelete(
      "delete A-Test enrollment requests of removable students",
      adminClient.from("enrollment_requests").delete().eq("course_id", keepCourseId).in("student_id", removableProfileIds),
    );
  }

  await runDelete(
    "delete student course stats outside A-Test course",
    adminClient.from("student_course_stats").delete().neq("course_id", keepCourseId),
  );

  if (removableProfileIds.length > 0) {
    await runDelete(
      "delete A-Test course stats of removable students",
      adminClient.from("student_course_stats").delete().eq("course_id", keepCourseId).in("student_id", removableProfileIds),
    );
  }

  if (removableProfileIds.length > 0) {
    await runDelete(
      "delete removable student profile stats",
      adminClient.from("student_profile_stats").delete().in("student_id", removableProfileIds),
    );
  }

  await runDelete(
    "delete question bank items outside A-Test course",
    adminClient.from("question_bank_items").delete().neq("course_id", keepCourseId),
  );

  if (removableProfileIds.length > 0) {
    await runDelete(
      "delete A-Test question bank items by removable users",
      adminClient.from("question_bank_items").delete().eq("course_id", keepCourseId).in("created_by", removableProfileIds),
    );
  }

  await runDelete(
    "delete simulations outside A-Test course",
    adminClient.from("simulations").delete().neq("course_id", keepCourseId),
  );

  await runDelete(
    "delete class change requests outside A-Test course",
    adminClient.from("class_change_requests").delete().neq("course_id", keepCourseId),
  );

  await runDelete(
    "delete course change requests outside A-Test course",
    adminClient.from("course_change_requests").delete().neq("target_course_id", keepCourseId),
  );

  await runDelete(
    "delete courses outside A-Test course",
    adminClient.from("courses").delete().neq("id", keepCourseId),
  );

  await runUpdate(
    "clear personal library settings updated_by of removable users",
    adminClient.from("personal_library_settings").update({ updated_by: null }).not("updated_by", "in", formatInFilter(keepProfileIds)),
  );

  await runDelete(
    "delete personal library settings of removable teachers",
    adminClient.from("personal_library_settings").delete().not("teacher_id", "in", formatInFilter(keepTeacherIds.length > 0 ? keepTeacherIds : [EMPTY_UUID])),
  );

  await runUpdate(
    "clear approved_by on kept profiles pointing to removable users",
    adminClient.from("profiles").update({ approved_by: null }).not("id", "in", formatInFilter(removableProfileIds.length > 0 ? removableProfileIds : [EMPTY_UUID])).not("approved_by", "in", formatInFilter(keepProfileIds)),
  );

  if (removableProfileIds.length > 0) {
    await runDelete(
      "delete removable profiles",
      adminClient.from("profiles").delete().in("id", removableProfileIds),
    );
  }

  for (const user of removableAuthUsers) {
    const deleteResult = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteResult.error) {
      throw deleteResult.error;
    }

    console.log(`[cleanup] deleted auth user ${user.email ?? user.id}`);
  }

  const { data: remainingProfiles, error: remainingProfilesError } = await adminClient
    .from("profiles")
    .select("email,role")
    .order("role")
    .order("email");

  if (remainingProfilesError) {
    throw remainingProfilesError;
  }

  const { data: remainingClasses, error: remainingClassesError } = await adminClient
    .from("classes")
    .select("class_code,title,status")
    .order("class_code");

  if (remainingClassesError) {
    throw remainingClassesError;
  }

  console.log("[cleanup] complete");
  console.log(JSON.stringify({
    remainingProfiles,
    remainingClasses,
  }, null, 2));
}

main().catch((error) => {
  console.error("[cleanup] failed", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
