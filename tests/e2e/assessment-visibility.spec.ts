import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";
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

if (!url || !anonKey) {
  test.skip(true, "Supabase local env is required for assessment visibility E2E tests.");
}

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${randomUUID()}@local.test`;
}

function uniqueCode(prefix: string): string {
  return `${prefix}${Date.now().toString().slice(-8)}`;
}

async function createScopedClient(email: string, password: string): Promise<SupabaseClient> {
  const authClient = createClient(url!, anonKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });

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

async function ensureLoggedOutAtLogin(page: Page) {
  await page.goto("/login");

  if (await page.locator("#sign-up-full-name").isVisible()) {
    return;
  }

  const signOutButton = page.getByRole("button", { name: "Đăng xuất" });

  if (await signOutButton.isVisible()) {
    await signOutButton.click();
    await expect(page).toHaveURL(/\/login/);
  }
}

async function signInViaBrowser(page: Page, email: string, password: string) {
  await ensureLoggedOutAtLogin(page);
  await page.fill("#sign-in-email", email);
  await page.fill("#sign-in-password", password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

async function createIsolatedPage(browser: Browser): Promise<{ page: Page; dispose: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();

  return {
    page,
    dispose: async () => {
      await context.close();
    },
  };
}

/**
 * Sprint 4.1 acceptance: "Student chỉ thấy assessment của lớp mình."
 *
 * Setup:
 *   - 3 SDK signUps: teacher (auto-active), member student, outsider student
 *   - teacher SDK creates course, class, adds member to class, inserts assessment
 *   - teacher BROWSER logs in then calls /api/access/students/{id}/approve for both students
 *     (teacher is already active from trigger — no bootstrap needed)
 *
 * Assertions:
 *   - member browser → /my-classes/assessments → sees "Assessment Visibility Test"
 *   - outsider browser → /my-classes/assessments → does NOT see it
 */
test("student sees assessment only when class membership is active", async ({ browser }) => {
  test.setTimeout(120000);

  const password = "Passw0rd!";
  const teacherEmail = uniqueEmail("teacher.assessment.visibility");
  const memberEmail = uniqueEmail("student.member.assessment.visibility");
  const outsiderEmail = uniqueEmail("student.outsider.assessment.visibility");
  const courseCode = uniqueCode("ASV");
  const classCode = uniqueCode("ASVC");

  const authClient = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Create all 3 users via SDK (trigger creates profiles: teacher=active, students=pending_approval)
  const { error: teacherSignUpError } = await authClient.auth.signUp({
    email: teacherEmail,
    password,
    options: { data: { full_name: "Teacher Assessment Visibility", role: "teacher" } },
  });
  expect(teacherSignUpError).toBeNull();

  const { error: memberSignUpError } = await authClient.auth.signUp({
    email: memberEmail,
    password,
    options: { data: { full_name: "Student Member Visibility", role: "student" } },
  });
  expect(memberSignUpError).toBeNull();

  const { error: outsiderSignUpError } = await authClient.auth.signUp({
    email: outsiderEmail,
    password,
    options: { data: { full_name: "Student Outsider Visibility", role: "student" } },
  });
  expect(outsiderSignUpError).toBeNull();

  // Resolve user IDs via scoped SDK clients
  const teacherClient = await createScopedClient(teacherEmail, password);
  const memberClient = await createScopedClient(memberEmail, password);
  const outsiderClient = await createScopedClient(outsiderEmail, password);

  const { data: { user: teacherUser } } = await teacherClient.auth.getUser();
  const { data: { user: memberUser } } = await memberClient.auth.getUser();
  const { data: { user: outsiderUser } } = await outsiderClient.auth.getUser();

  const teacherId = teacherUser?.id;
  const memberId = memberUser?.id;
  const outsiderId = outsiderUser?.id;

  expect(teacherId).toBeTruthy();
  expect(memberId).toBeTruthy();
  expect(outsiderId).toBeTruthy();

  // Teacher SDK: create course, class, add member, insert assessment
  const { data: createdCourse, error: courseError } = await teacherClient
    .from("courses")
    .insert({
      owner_id: teacherId,
      code: courseCode,
      title: "Assessment Visibility Course",
      visibility: "private",
      status: "active",
    })
    .select("id")
    .single();
  expect(courseError).toBeNull();

  const { data: createdClass, error: classError } = await teacherClient
    .from("classes")
    .insert({
      course_id: createdCourse!.id,
      teacher_id: teacherId,
      class_code: classCode,
      title: "Assessment Visibility Class",
      semester: "HK1",
      academic_year: "2026-2027",
      status: "active",
    })
    .select("id,course_id")
    .single();
  expect(classError).toBeNull();

  const { error: classMemberError } = await teacherClient
    .from("class_members")
    .insert({ class_id: createdClass!.id, student_id: memberId, status: "active" });
  expect(classMemberError).toBeNull();

  const { data: assessment, error: assessmentError } = await teacherClient
    .from("assessments")
    .insert({
      class_id: createdClass!.id,
      course_id: createdClass!.course_id,
      created_by: teacherId,
      title: "Assessment Visibility Test",
      provider: "google_form",
      form_url: "https://docs.google.com/forms/d/e/demo/viewform",
      embed_mode: "iframe",
      status: "open",
    })
    .select("id")
    .single();
  expect(assessmentError).toBeNull();
  expect(assessment?.id).toBeTruthy();

  // Teacher browser: login and approve access for member + outsider
  // Teacher has access_status='active' (trigger sets active for non-student roles)
  const teacherBrowser = await createIsolatedPage(browser);
  const memberBrowser = await createIsolatedPage(browser);
  const outsiderBrowser = await createIsolatedPage(browser);

  try {
    await signInViaBrowser(teacherBrowser.page, teacherEmail, password);
    await expect(teacherBrowser.page).toHaveURL(/\/dashboard/);

    const approveStudent = async (studentId: string) => {
      const response = await teacherBrowser.page.evaluate(
        async ({ id }) => {
          const res = await fetch(`/api/access/students/${id}/approve`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });
          return { status: res.status, body: await res.json() };
        },
        { id: studentId },
      );
      expect(response.status).toBe(200);
      expect(response.body.accessStatus).toBe("active");
    };

    await approveStudent(memberId!);
    await approveStudent(outsiderId!);

    // Member: should see the assessment (has active class membership)
    await signInViaBrowser(memberBrowser.page, memberEmail, password);
    await expect(memberBrowser.page).toHaveURL(/\/my-classes/);
    await memberBrowser.page.goto("/my-classes/assessments");
    await expect(memberBrowser.page.getByText("Assessment Visibility Test")).toBeVisible();

    // Outsider: should NOT see the assessment (no class membership)
    await signInViaBrowser(outsiderBrowser.page, outsiderEmail, password);
    await expect(outsiderBrowser.page).toHaveURL(/\/my-classes/);
    await outsiderBrowser.page.goto("/my-classes/assessments");
    await expect(outsiderBrowser.page.getByText("Assessment Visibility Test")).not.toBeVisible();
  } finally {
    await teacherBrowser.dispose();
    await memberBrowser.dispose();
    await outsiderBrowser.dispose();
  }
});
