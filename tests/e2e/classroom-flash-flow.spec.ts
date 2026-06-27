import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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

if (!url || !anonKey || !serviceRoleKey) {
  test.skip(true, "Supabase env is required for classroom flash E2E tests.");
}

test("teacher sees flash messages after posting announcement and sending direct message", async ({ page }) => {
  test.setTimeout(120000);

  const authHealthUrl = `${url}/auth/v1/health`;
  let supabaseReachable = true;

  try {
    const healthResponse = await fetch(authHealthUrl, {
      headers: {
        apikey: anonKey!,
      },
    });

    supabaseReachable = healthResponse.ok;
  } catch {
    supabaseReachable = false;
  }

  test.skip(!supabaseReachable, "Supabase local stack is not reachable for classroom flash E2E test.");
  if (!supabaseReachable) {
    return;
  }

  const adminClient = createClient(url!, serviceRoleKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const teacherEmail = `teacher.class.flash.${Date.now()}@local.test`;
  const studentEmail = `student.class.flash.${Date.now()}@local.test`;
  const password = "Passw0rd!";

  const teacherUser = await adminClient.auth.admin.createUser({
    email: teacherEmail,
    password,
    email_confirm: true,
    app_metadata: { role: "teacher" },
    user_metadata: { role: "teacher", full_name: "Teacher Classroom Flash" },
  });

  expect(teacherUser.error).toBeNull();
  expect(teacherUser.data.user?.id).toBeTruthy();

  const studentUser = await adminClient.auth.admin.createUser({
    email: studentEmail,
    password,
    email_confirm: true,
    app_metadata: { role: "student" },
    user_metadata: { role: "student", full_name: "Student Classroom Flash" },
  });

  expect(studentUser.error).toBeNull();
  expect(studentUser.data.user?.id).toBeTruthy();

  const teacherId = teacherUser.data.user!.id;
  const studentId = studentUser.data.user!.id;

  const course = await adminClient
    .from("courses")
    .insert({
      owner_id: teacherId,
      code: `CF-${Date.now().toString().slice(-6)}`,
      title: "Classroom Flash Course",
      visibility: "private",
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();

  expect(course.error).toBeNull();
  expect(course.data?.id).toBeTruthy();

  const courseId = course.data!.id;

  const courseClass = await adminClient
    .from("classes")
    .insert({
      course_id: courseId,
      teacher_id: teacherId,
      class_code: `CFLASH-${Date.now().toString().slice(-5)}`,
      title: "Classroom Flash Class",
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();

  expect(courseClass.error).toBeNull();
  expect(courseClass.data?.id).toBeTruthy();

  const classId = courseClass.data!.id;

  const membership = await adminClient.from("class_members").insert({
    class_id: classId,
    student_id: studentId,
    status: "active",
  });

  expect(membership.error).toBeNull();

  await page.goto("/login");
  await page.fill("#sign-in-email", teacherEmail);
  await page.fill("#sign-in-password", password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto(`/classes/${classId}/room`);

  await page.getByPlaceholder("Tieu de thong bao").fill("Thong bao E2E");
  await page.getByPlaceholder("Noi dung thong bao").fill("Noi dung thong bao E2E");
  await page.getByRole("button", { name: "Đăng thông báo" }).click();

  await expect(page.getByRole("status").getByText("Đăng thông báo thành công.")).toBeVisible();

  const messageInput = page.getByPlaceholder("Nhan tin nhanh cho sinh vien nay").first();
  await messageInput.fill("Tin nhan E2E cho sinh vien");
  await page.getByRole("button", { name: "Gui tin nhan" }).first().click();

  await expect(page.getByRole("status").getByText("Gui tin nhan thanh cong.")).toBeVisible();

  await adminClient.from("direct_messages").delete().eq("class_id", classId);
  await adminClient.from("class_announcements").delete().eq("class_id", classId);
  await adminClient.from("class_members").delete().eq("class_id", classId);
  await adminClient.from("classes").delete().eq("id", classId);
  await adminClient.from("courses").delete().eq("id", courseId);

  await adminClient.auth.admin.deleteUser(studentId);
  await adminClient.auth.admin.deleteUser(teacherId);
});
