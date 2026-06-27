import { execSync } from "node:child_process";
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

function parseEnvPairs(raw: string): Record<string, string> {
  const entries = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.includes("="));

  const env: Record<string, string> = {};

  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");
    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim().replace(/^"|"$/g, "");
    env[key] = value;
  }

  return env;
}

function resolveServiceRoleKey(localEnv: Record<string, string>): string | undefined {
  const existing = process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (existing) {
    return existing;
  }

  try {
    const statusEnvOutput = execSync("pnpm dlx supabase@latest status -o env", {
      encoding: "utf8",
      stdio: "pipe",
    });
    const statusEnv = parseEnvPairs(statusEnvOutput);
    return statusEnv.SECRET_KEY;
  } catch {
    return undefined;
  }
}

const localEnv = readLocalEnvFile();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = resolveServiceRoleKey(localEnv);

if (!url || !anonKey) {
  test.skip(true, "Supabase local env is required for Phase 3.3 E2E tests.");
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

async function signUpViaBrowser(page: Page, fullName: string, email: string, password: string, role: "teacher" | "student") {
  await ensureLoggedOutAtLogin(page);
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

test("moderator can review scoped enrollment request and approve student access", async ({ browser }) => {
  if (!serviceRoleKey) {
    test.skip(true, "SUPABASE_SERVICE_ROLE_KEY is required to provision moderator and scope for this E2E.");
    return;
  }

  const password = "Passw0rd!";
  const teacherEmail = uniqueEmail("teacher.phase33.moderator");
  const studentEmail = uniqueEmail("student.phase33.moderator");
  const moderatorEmail = uniqueEmail("moderator.phase33");
  const courseCode = uniqueCode("MDR");
  const classCode = uniqueCode("MCLS");

  const adminClient = createClient(url!, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const bootstrap = await createIsolatedPage(browser);
  const teacherBrowser = await createIsolatedPage(browser);
  const studentBrowser = await createIsolatedPage(browser);
  const moderatorBrowser = await createIsolatedPage(browser);
  const finalStudentBrowser = await createIsolatedPage(browser);

  let moderatorId: string | undefined;

  try {
    await signUpViaBrowser(bootstrap.page, "Teacher Moderator Scope", teacherEmail, password, "teacher");
    await signUpViaBrowser(bootstrap.page, "Student Moderator Scope", studentEmail, password, "student");

    const { data: moderatorUser, error: moderatorCreateError } = await adminClient.auth.admin.createUser({
      email: moderatorEmail,
      password,
      email_confirm: true,
      app_metadata: {
        role: "moderator",
      },
      user_metadata: {
        role: "moderator",
        full_name: "Moderator Scope E2E",
      },
    });

    expect(moderatorCreateError).toBeNull();
    moderatorId = moderatorUser.user?.id;
    expect(moderatorId).toBeTruthy();

    await signInViaBrowser(teacherBrowser.page, teacherEmail, password);
    await expect(teacherBrowser.page).toHaveURL(/\/dashboard/);

    await teacherBrowser.page.goto("/courses");
    await teacherBrowser.page.getByTestId("create-course-code").fill(courseCode);
    await teacherBrowser.page.getByTestId("create-course-title").fill("Moderator Scope Course");
    await teacherBrowser.page.getByTestId("create-course-submit").click();
    await expect(teacherBrowser.page.getByTestId("create-course-message")).toContainText("Tạo học phần thành công.");

    await teacherBrowser.page.goto("/classes");
    await teacherBrowser.page.getByTestId("create-class-course-id").selectOption({
      label: `${courseCode} - Moderator Scope Course`,
    });
    await teacherBrowser.page.getByTestId("create-class-code").fill(classCode);
    await teacherBrowser.page.getByTestId("create-class-title").fill("Moderator Scope Class");
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
      .select("id,course_id")
      .eq("class_code", classCode)
      .maybeSingle();

    expect(classReadError).toBeNull();
    expect(createdClass?.id).toBeTruthy();
    expect(createdClass?.course_id).toBeTruthy();

    const { error: scopeError } = await adminClient.from("permission_scopes").insert({
      actor_id: moderatorId,
      scope_type: "course",
      scope_id: createdClass!.course_id,
      permissions: {
        manage_course: true,
        manage_class: true,
      },
      status: "active",
      granted_by: teacherId,
    });

    expect(scopeError).toBeNull();

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

    await signInViaBrowser(moderatorBrowser.page, moderatorEmail, password);
    await expect(moderatorBrowser.page).toHaveURL(/\/dashboard/);

    const reviewResponse = await moderatorBrowser.page.evaluate(
      async ({ requestId }) => {
        const response = await fetch(`/api/enrollment/requests/${requestId}/review`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            decision: "approved",
            note: "Approved by moderator",
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

    const approveAccessResponse = await moderatorBrowser.page.evaluate(
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

    const { data: moderatorLogs, error: moderatorLogsError } = await adminClient
      .from("activity_logs")
      .select("action")
      .eq("actor_id", moderatorId!)
      .in("action", ["enrollment.request.approved", "student.access.approved"]);

    expect(moderatorLogsError).toBeNull();
    expect((moderatorLogs ?? []).map((row) => row.action)).toEqual(
      expect.arrayContaining(["enrollment.request.approved", "student.access.approved"]),
    );

    await signInViaBrowser(finalStudentBrowser.page, studentEmail, password);
    await expect(finalStudentBrowser.page).toHaveURL(/\/my-classes/);
    await expect(finalStudentBrowser.page.getByText("Moderator Scope Class")).toBeVisible();
  } finally {
    await teacherBrowser.dispose();
    await studentBrowser.dispose();
    await moderatorBrowser.dispose();
    await finalStudentBrowser.dispose();
    await bootstrap.dispose();

    if (moderatorId) {
      await adminClient.auth.admin.deleteUser(moderatorId);
    }
  }
});

test("expired student is blocked and can access again after renew", async ({ browser }) => {
  const password = "Passw0rd!";
  const teacherEmail = uniqueEmail("teacher.phase33.renew");
  const studentEmail = uniqueEmail("student.phase33.renew");
  const courseCode = uniqueCode("REN");
  const classCode = uniqueCode("RCLS");

  const bootstrap = await createIsolatedPage(browser);
  const teacherBrowser = await createIsolatedPage(browser);
  const studentBrowser = await createIsolatedPage(browser);
  const finalStudentBrowser = await createIsolatedPage(browser);

  try {
    await signUpViaBrowser(bootstrap.page, "Teacher Renew E2E", teacherEmail, password, "teacher");
    await signUpViaBrowser(bootstrap.page, "Student Renew E2E", studentEmail, password, "student");

    await signInViaBrowser(teacherBrowser.page, teacherEmail, password);
    await expect(teacherBrowser.page).toHaveURL(/\/dashboard/);

    await teacherBrowser.page.goto("/courses");
    await teacherBrowser.page.getByTestId("create-course-code").fill(courseCode);
    await teacherBrowser.page.getByTestId("create-course-title").fill("Renew Access Course");
    await teacherBrowser.page.getByTestId("create-course-submit").click();
    await expect(teacherBrowser.page.getByTestId("create-course-message")).toContainText("Tạo học phần thành công.");

    await teacherBrowser.page.goto("/classes");
    await teacherBrowser.page.getByTestId("create-class-course-id").selectOption({
      label: `${courseCode} - Renew Access Course`,
    });
    await teacherBrowser.page.getByTestId("create-class-code").fill(classCode);
    await teacherBrowser.page.getByTestId("create-class-title").fill("Renew Access Class");
    await teacherBrowser.page.getByTestId("create-class-semester").fill("HK1");
    await teacherBrowser.page.getByTestId("create-class-academic-year").fill("2026-2027");
    await teacherBrowser.page.getByTestId("create-class-status").selectOption("active");
    await teacherBrowser.page.getByTestId("create-class-submit").click();
    await expect(teacherBrowser.page.getByTestId("create-class-message")).toContainText("Tạo lớp học phần thành công.");

    await teacherBrowser.page.getByTestId(`add-student-full-name-${classCode}`).fill("Student Renew E2E");
    await teacherBrowser.page.getByTestId(`add-student-email-${classCode}`).fill(studentEmail);
    await teacherBrowser.page.getByTestId(`add-student-submit-${classCode}`).click();
    await expect(teacherBrowser.page.getByTestId("add-student-message")).toContainText("Thêm sinh viên vào lớp thành công.");

    const studentClient = await createScopedClient(studentEmail, password);
    const { data: studentUserData } = await studentClient.auth.getUser();
    const studentId = studentUserData.user?.id;

    expect(studentId).toBeTruthy();

    const pastExpiresAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const approveWithPastResponse = await teacherBrowser.page.evaluate(
      async ({ targetStudentId, expiresAt }) => {
        const response = await fetch(`/api/access/students/${targetStudentId}/approve`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ expiresAt }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      {
        targetStudentId: studentId,
        expiresAt: pastExpiresAt,
      },
    );

    expect(approveWithPastResponse.status).toBe(200);

    await signInViaBrowser(studentBrowser.page, studentEmail, password);
    await expect(studentBrowser.page).toHaveURL(/\/my-classes/);
    await expect(studentBrowser.page.getByText("Tài khoản sinh viên đã hết hạn truy cập. Vui lòng liên hệ giảng viên hoặc quản trị viên.")).toBeVisible();

    const futureExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const renewResponse = await teacherBrowser.page.evaluate(
      async ({ targetStudentId, expiresAt }) => {
        const response = await fetch(`/api/access/students/${targetStudentId}/renew`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ expiresAt }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      {
        targetStudentId: studentId,
        expiresAt: futureExpiresAt,
      },
    );

    expect(renewResponse.status).toBe(200);

    await signInViaBrowser(finalStudentBrowser.page, studentEmail, password);
    await expect(finalStudentBrowser.page).toHaveURL(/\/my-classes/);
    await expect(finalStudentBrowser.page.getByText("Renew Access Class")).toBeVisible();
  } finally {
    await teacherBrowser.dispose();
    await studentBrowser.dispose();
    await finalStudentBrowser.dispose();
    await bootstrap.dispose();
  }
});
