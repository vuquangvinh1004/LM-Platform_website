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
  test.skip(true, "Supabase local env is required for enrollment approval E2E tests.");
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

async function signUpViaBrowser(page: Page, fullName: string, email: string, password: string, role: "teacher" | "student") {
  await ensureLoggedOutAtLogin(page);
  await page.goto("/login");
  await page.fill("#sign-up-full-name", fullName);
  await page.fill("#sign-up-email", email);
  await page.fill("#sign-up-password", password);
  await page.selectOption("#sign-up-role", role);
  await page.getByRole("button", { name: "Đăng ký" }).click();

  const successMessage = page.getByText("Đăng ký thành công. Bạn có thể đăng nhập ngay.");
  const signOutButton = page.getByRole("button", { name: "Đăng xuất" });

  await Promise.race([
    successMessage.waitFor({ state: "visible" }),
    signOutButton.waitFor({ state: "visible" }),
  ]);

  if (await signOutButton.isVisible()) {
    await signOutButton.click();
    await expect(page).toHaveURL(/\/login/);
  } else {
    await expect(successMessage).toBeVisible();
  }
}

async function signInViaBrowser(page: Page, email: string, password: string) {
  await ensureLoggedOutAtLogin(page);
  await page.goto("/login");
  await page.fill("#sign-in-email", email);
  await page.fill("#sign-in-password", password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
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
    await expect(page.locator("#sign-up-full-name")).toBeVisible();
  }
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

test("teacher reviews enrollment and student can access class after approval", async ({ browser }) => {
  const password = "Passw0rd!";
  const teacherEmail = uniqueEmail("teacher.enrollment.e2e");
  const studentEmail = uniqueEmail("student.enrollment.e2e");
  const courseCode = uniqueCode("ENR");
  const classCode = uniqueCode("ECLS");

  const bootstrap = await createIsolatedPage(browser);

  try {
    await signUpViaBrowser(bootstrap.page, "Teacher Enrollment E2E", teacherEmail, password, "teacher");
    await signUpViaBrowser(bootstrap.page, "Student Enrollment E2E", studentEmail, password, "student");
  } finally {
    await bootstrap.dispose();
  }

  const teacherBrowser = await createIsolatedPage(browser);
  const studentBrowser = await createIsolatedPage(browser);
  const finalStudentBrowser = await createIsolatedPage(browser);

  try {
    await signInViaBrowser(teacherBrowser.page, teacherEmail, password);
    await expect(teacherBrowser.page).toHaveURL(/\/dashboard/);

    await teacherBrowser.page.goto("/courses");
    await teacherBrowser.page.getByTestId("create-course-code").fill(courseCode);
    await teacherBrowser.page.getByTestId("create-course-title").fill("Enrollment Approval Course");
    await teacherBrowser.page.getByTestId("create-course-submit").click();
    await expect(teacherBrowser.page.getByTestId("create-course-message")).toContainText("Tạo học phần thành công.");

    await teacherBrowser.page.goto("/classes");
    await teacherBrowser.page.getByTestId("create-class-course-id").selectOption({
      label: `${courseCode} - Enrollment Approval Course`,
    });
    await teacherBrowser.page.getByTestId("create-class-code").fill(classCode);
    await teacherBrowser.page.getByTestId("create-class-title").fill("Enrollment Approval Class");
    await teacherBrowser.page.getByTestId("create-class-semester").fill("HK1");
    await teacherBrowser.page.getByTestId("create-class-academic-year").fill("2026-2027");
    await teacherBrowser.page.getByTestId("create-class-status").selectOption("active");
    await teacherBrowser.page.getByTestId("create-class-submit").click();
    await expect(teacherBrowser.page.getByTestId("create-class-message")).toContainText("Tạo lớp học phần thành công.");

    const teacherClient = await createScopedClient(teacherEmail, password);
    const studentClient = await createScopedClient(studentEmail, password);

    const { data: teacherUserData } = await teacherClient.auth.getUser();
    const { data: studentUserData } = await studentClient.auth.getUser();

    const teacherId = teacherUserData.user?.id;
    const studentId = studentUserData.user?.id;

    expect(teacherId).toBeTruthy();
    expect(studentId).toBeTruthy();

    const { data: createdClass, error: classReadError } = await teacherClient
      .from("classes")
      .select("id, course_id")
      .eq("class_code", classCode)
      .maybeSingle();

    expect(classReadError).toBeNull();
    expect(createdClass?.id).toBeTruthy();
    expect(createdClass?.course_id).toBeTruthy();

    await signInViaBrowser(studentBrowser.page, studentEmail, password);
    await expect(studentBrowser.page).toHaveURL(/\/my-classes/);

    const createRequestResponse = await studentBrowser.page.evaluate(
      async ({ targetCourseId, targetClassId }) => {
        const response = await fetch("/api/enrollment/requests", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            requests: [{
              courseId: targetCourseId,
              classId: targetClassId,
            }],
          }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      {
        targetCourseId: createdClass!.course_id,
        targetClassId: createdClass!.id,
      },
    );

    expect(createRequestResponse.status).toBe(201);
    expect(createRequestResponse.body.created).toBe(1);

    const { data: enrollmentRequest, error: requestError } = await teacherClient
      .from("enrollment_requests")
      .select("id,status")
      .eq("student_id", studentId!)
      .eq("course_id", createdClass!.course_id)
      .eq("class_id", createdClass!.id)
      .maybeSingle();

    expect(requestError).toBeNull();
    expect(enrollmentRequest?.status).toBe("pending");

    const reviewResponse = await teacherBrowser.page.evaluate(
      async ({ requestId }) => {
        const response = await fetch(`/api/enrollment/requests/${requestId}/review`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            decision: "approved",
            note: "Approved from E2E",
          }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      {
        requestId: enrollmentRequest!.id,
      },
    );

    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.status).toBe("approved");

    const approveAccessResponse = await teacherBrowser.page.evaluate(
      async ({ targetStudentId }) => {
        const response = await fetch(`/api/access/students/${targetStudentId}/approve`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({}),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      {
        targetStudentId: studentId,
      },
    );

    expect(approveAccessResponse.status).toBe(200);
    expect(approveAccessResponse.body.accessStatus).toBe("active");

    const { data: studentSelfProfile, error: studentSelfProfileError } = await studentClient
      .from("profiles")
      .select("access_status")
      .eq("id", studentId!)
      .maybeSingle();

    expect(studentSelfProfileError).toBeNull();
    expect(studentSelfProfile?.access_status).toBe("active");

    const { data: membership, error: membershipError } = await teacherClient
      .from("class_members")
      .select("status")
      .eq("class_id", createdClass!.id)
      .eq("student_id", studentId!)
      .maybeSingle();

    expect(membershipError).toBeNull();
    expect(membership?.status).toBe("active");

    const { data: studentOwnMembership, error: studentOwnMembershipError } = await studentClient
      .from("class_members")
      .select("id,status")
      .eq("class_id", createdClass!.id)
      .eq("student_id", studentId!)
      .maybeSingle();

    expect(studentOwnMembershipError).toBeNull();
    expect(studentOwnMembership?.status).toBe("active");

    const { data: studentVisibleClass, error: studentVisibleClassError } = await studentClient
      .from("classes")
      .select("id,title")
      .eq("id", createdClass!.id)
      .maybeSingle();

    expect(studentVisibleClassError).toBeNull();
    expect(studentVisibleClass?.id).toBe(createdClass!.id);

    const { data: activityLogs, error: activityLogError } = await teacherClient
      .from("activity_logs")
      .select("action")
      .in("action", ["enrollment.request.approved", "student.access.approved"])
      .eq("actor_id", teacherId!);

    expect(activityLogError).toBeNull();
    expect((activityLogs ?? []).map((log) => log.action)).toEqual(
      expect.arrayContaining(["enrollment.request.approved", "student.access.approved"]),
    );

    await signInViaBrowser(finalStudentBrowser.page, studentEmail, password);
    await expect(finalStudentBrowser.page).toHaveURL(/\/my-classes/);
    await expect(finalStudentBrowser.page.getByText("Enrollment Approval Class")).toBeVisible();
  } finally {
    await teacherBrowser.dispose();
    await studentBrowser.dispose();
    await finalStudentBrowser.dispose();
  }
});
