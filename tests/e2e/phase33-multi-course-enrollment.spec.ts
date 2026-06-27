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

function resolveServiceRoleKey(localEnvInput: Record<string, string>): string | undefined {
  const existing = process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnvInput.SUPABASE_SERVICE_ROLE_KEY;

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
  test.skip(true, "Supabase local env is required for Phase 3.3 multi-course E2E tests.");
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

async function teacherCreatesCourseAndClass(page: Page, input: {
  courseCode: string;
  courseTitle: string;
  classCode: string;
  classTitle: string;
}) {
  await page.goto("/courses");
  await page.getByTestId("create-course-code").fill(input.courseCode);
  await page.getByTestId("create-course-title").fill(input.courseTitle);
  await page.getByTestId("create-course-submit").click();
  await expect(page.getByTestId("create-course-message")).toContainText("Tạo học phần thành công.");

  await page.goto("/classes");
  await page.getByTestId("create-class-course-id").selectOption({
    label: `${input.courseCode} - ${input.courseTitle}`,
  });
  await page.getByTestId("create-class-code").fill(input.classCode);
  await page.getByTestId("create-class-title").fill(input.classTitle);
  await page.getByTestId("create-class-semester").fill("HK1");
  await page.getByTestId("create-class-academic-year").fill("2026-2027");
  await page.getByTestId("create-class-status").selectOption("active");
  await page.getByTestId("create-class-submit").click();
  await expect(page.getByTestId("create-class-message")).toContainText("Tạo lớp học phần thành công.");
}

test("student submits multi-course enrollment and receives per-course review outcomes", async ({ browser }) => {
  const password = "Passw0rd!";
  const teacherEmail = uniqueEmail("teacher.phase33.multicourse");
  const studentEmail = uniqueEmail("student.phase33.multicourse");

  const courseCodeA = uniqueCode("MCA");
  const classCodeA = uniqueCode("CLA");
  const courseTitleA = "Multi Course A";
  const classTitleA = "Multi Class A";

  const courseCodeB = uniqueCode("MCB");
  const classCodeB = uniqueCode("CLB");
  const courseTitleB = "Multi Course B";
  const classTitleB = "Multi Class B";

  const bootstrap = await createIsolatedPage(browser);
  const teacherBrowser = await createIsolatedPage(browser);
  const studentBrowser = await createIsolatedPage(browser);
  const finalStudentBrowser = await createIsolatedPage(browser);

  try {
    await signUpViaBrowser(bootstrap.page, "Teacher Multi Course", teacherEmail, password, "teacher");
    await signUpViaBrowser(bootstrap.page, "Student Multi Course", studentEmail, password, "student");

    await signInViaBrowser(teacherBrowser.page, teacherEmail, password);
    await expect(teacherBrowser.page).toHaveURL(/\/dashboard/);

    await teacherCreatesCourseAndClass(teacherBrowser.page, {
      courseCode: courseCodeA,
      courseTitle: courseTitleA,
      classCode: classCodeA,
      classTitle: classTitleA,
    });

    await teacherCreatesCourseAndClass(teacherBrowser.page, {
      courseCode: courseCodeB,
      courseTitle: courseTitleB,
      classCode: classCodeB,
      classTitle: classTitleB,
    });

    const teacherClient = await createScopedClient(teacherEmail, password);
    const studentClient = await createScopedClient(studentEmail, password);

    const { data: studentUserData } = await studentClient.auth.getUser();
    const studentId = studentUserData.user?.id;
    expect(studentId).toBeTruthy();

    const { data: classRows, error: classRowsError } = await teacherClient
      .from("classes")
      .select("id,course_id,title")
      .in("class_code", [classCodeA, classCodeB]);

    expect(classRowsError).toBeNull();
    expect(classRows?.length).toBe(2);

    const classA = (classRows ?? []).find((row) => row.title === classTitleA);
    const classB = (classRows ?? []).find((row) => row.title === classTitleB);

    expect(classA?.id).toBeTruthy();
    expect(classA?.course_id).toBeTruthy();
    expect(classB?.id).toBeTruthy();
    expect(classB?.course_id).toBeTruthy();

    await signInViaBrowser(studentBrowser.page, studentEmail, password);
    await expect(studentBrowser.page).toHaveURL(/\/my-classes/);

    const createRequestResponse = await studentBrowser.page.evaluate(
      async ({ firstCourseId, firstClassId, secondCourseId, secondClassId }) => {
        const response = await fetch("/api/enrollment/requests", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                courseId: firstCourseId,
                classId: firstClassId,
              },
              {
                courseId: secondCourseId,
                classId: secondClassId,
              },
            ],
          }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      {
        firstCourseId: classA!.course_id,
        firstClassId: classA!.id,
        secondCourseId: classB!.course_id,
        secondClassId: classB!.id,
      },
    );

    expect(createRequestResponse.status).toBe(201);
    expect(createRequestResponse.body.created).toBe(2);
    expect(createRequestResponse.body.skipped).toBe(0);

    const { data: enrollmentRequests, error: enrollmentReadError } = await teacherClient
      .from("enrollment_requests")
      .select("id,course_id,status")
      .eq("student_id", studentId!)
      .in("course_id", [classA!.course_id, classB!.course_id]);

    expect(enrollmentReadError).toBeNull();
    expect((enrollmentRequests ?? []).length).toBe(2);

    const requestA = (enrollmentRequests ?? []).find((row) => row.course_id === classA!.course_id);
    const requestB = (enrollmentRequests ?? []).find((row) => row.course_id === classB!.course_id);

    expect(requestA?.id).toBeTruthy();
    expect(requestB?.id).toBeTruthy();

    const reviewApprovedResponse = await teacherBrowser.page.evaluate(
      async ({ requestId }) => {
        const response = await fetch(`/api/enrollment/requests/${requestId}/review`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            decision: "approved",
            note: "Approve course A",
          }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      {
        requestId: requestA!.id,
      },
    );

    expect(reviewApprovedResponse.status).toBe(200);
    expect(reviewApprovedResponse.body.requestId).toBe(requestA!.id);
    expect(reviewApprovedResponse.body.status).toBe("approved");

    const reviewRejectedResponse = await teacherBrowser.page.evaluate(
      async ({ requestId }) => {
        const response = await fetch(`/api/enrollment/requests/${requestId}/review`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            decision: "rejected",
            note: "Reject course B",
          }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      {
        requestId: requestB!.id,
      },
    );

    expect(reviewRejectedResponse.status).toBe(200);
    expect(reviewRejectedResponse.body.requestId).toBe(requestB!.id);
    expect(reviewRejectedResponse.body.status).toBe("rejected");

    const { data: reviewedRows, error: reviewedRowsError } = await teacherClient
      .from("enrollment_requests")
      .select("course_id,status")
      .eq("student_id", studentId!)
      .in("course_id", [classA!.course_id, classB!.course_id]);

    expect(reviewedRowsError).toBeNull();
    expect((reviewedRows ?? []).length).toBe(2);

    const statusA = (reviewedRows ?? []).find((row) => row.course_id === classA!.course_id)?.status;
    const statusB = (reviewedRows ?? []).find((row) => row.course_id === classB!.course_id)?.status;

    expect(statusA).toBe("approved");
    expect(statusB).toBe("rejected");

    const { data: approvedMembership, error: approvedMembershipError } = await teacherClient
      .from("class_members")
      .select("id,status")
      .eq("class_id", classA!.id)
      .eq("student_id", studentId!)
      .maybeSingle();

    expect(approvedMembershipError).toBeNull();
    expect(approvedMembership?.status).toBe("active");

    const { data: rejectedMembership, error: rejectedMembershipError } = await teacherClient
      .from("class_members")
      .select("id")
      .eq("class_id", classB!.id)
      .eq("student_id", studentId!)
      .maybeSingle();

    expect(rejectedMembershipError).toBeNull();
    expect(rejectedMembership).toBeNull();

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

    await signInViaBrowser(finalStudentBrowser.page, studentEmail, password);
    await expect(finalStudentBrowser.page).toHaveURL(/\/my-classes/);
    await expect(finalStudentBrowser.page.getByText(classTitleA)).toBeVisible();
    await expect(finalStudentBrowser.page.getByText(classTitleB)).not.toBeVisible();
  } finally {
    await teacherBrowser.dispose();
    await studentBrowser.dispose();
    await finalStudentBrowser.dispose();
    await bootstrap.dispose();
  }
});

test("moderator reviews enrollment requests in batch with scope-aware outcomes", async ({ browser }) => {
  if (!serviceRoleKey) {
    test.skip(true, "SUPABASE_SERVICE_ROLE_KEY is required to provision moderator and scope.");
    return;
  }

  const password = "Passw0rd!";
  const teacherEmail = uniqueEmail("teacher.phase33.batch.moderator");
  const studentEmail = uniqueEmail("student.phase33.batch.moderator");
  const moderatorEmail = uniqueEmail("moderator.phase33.batch");

  const courseCodeInScope = uniqueCode("MSC");
  const classCodeInScope = uniqueCode("MSCL");
  const courseCodeOutScope = uniqueCode("MOC");
  const classCodeOutScope = uniqueCode("MOCL");

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

  let moderatorId: string | undefined;

  try {
    await signUpViaBrowser(bootstrap.page, "Teacher Batch Moderator", teacherEmail, password, "teacher");
    await signUpViaBrowser(bootstrap.page, "Student Batch Moderator", studentEmail, password, "student");

    const { data: moderatorUser, error: moderatorCreateError } = await adminClient.auth.admin.createUser({
      email: moderatorEmail,
      password,
      email_confirm: true,
      app_metadata: {
        role: "moderator",
      },
      user_metadata: {
        role: "moderator",
        full_name: "Moderator Batch Scope",
      },
    });

    expect(moderatorCreateError).toBeNull();
    moderatorId = moderatorUser.user?.id;
    expect(moderatorId).toBeTruthy();

    await signInViaBrowser(teacherBrowser.page, teacherEmail, password);
    await expect(teacherBrowser.page).toHaveURL(/\/dashboard/);

    await teacherCreatesCourseAndClass(teacherBrowser.page, {
      courseCode: courseCodeInScope,
      courseTitle: "Moderator Batch In Scope",
      classCode: classCodeInScope,
      classTitle: "Moderator Batch Class In Scope",
    });

    await teacherCreatesCourseAndClass(teacherBrowser.page, {
      courseCode: courseCodeOutScope,
      courseTitle: "Moderator Batch Out Scope",
      classCode: classCodeOutScope,
      classTitle: "Moderator Batch Class Out Scope",
    });

    const teacherClient = await createScopedClient(teacherEmail, password);

    const { data: classRows, error: classRowsError } = await teacherClient
      .from("classes")
      .select("id,course_id,class_code")
      .in("class_code", [classCodeInScope, classCodeOutScope]);

    expect(classRowsError).toBeNull();
    expect(classRows?.length).toBe(2);

    const classInScope = (classRows ?? []).find((row) => row.class_code === classCodeInScope);
    const classOutScope = (classRows ?? []).find((row) => row.class_code === classCodeOutScope);

    expect(classInScope?.id).toBeTruthy();
    expect(classOutScope?.id).toBeTruthy();

    const { data: teacherUserData } = await teacherClient.auth.getUser();
    const teacherId = teacherUserData.user?.id;
    expect(teacherId).toBeTruthy();

    const { error: scopeError } = await adminClient.from("permission_scopes").insert({
      actor_id: moderatorId,
      scope_type: "course",
      scope_id: classInScope!.course_id,
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
      async ({ inScopeCourseId, inScopeClassId, outScopeCourseId, outScopeClassId }) => {
        const response = await fetch("/api/enrollment/requests", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              { courseId: inScopeCourseId, classId: inScopeClassId },
              { courseId: outScopeCourseId, classId: outScopeClassId },
            ],
          }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      {
        inScopeCourseId: classInScope!.course_id,
        inScopeClassId: classInScope!.id,
        outScopeCourseId: classOutScope!.course_id,
        outScopeClassId: classOutScope!.id,
      },
    );

    expect(createRequestResponse.status).toBe(201);
    expect(createRequestResponse.body.created).toBe(2);

    const { data: requests, error: requestsError } = await teacherClient
      .from("enrollment_requests")
      .select("id,course_id,status")
      .in("course_id", [classInScope!.course_id, classOutScope!.course_id]);

    expect(requestsError).toBeNull();
    expect((requests ?? []).length).toBe(2);

    await signInViaBrowser(moderatorBrowser.page, moderatorEmail, password);
    await expect(moderatorBrowser.page).toHaveURL(/\/dashboard/);

    const batchReviewResponse = await moderatorBrowser.page.evaluate(
      async ({ requestIds }) => {
        const response = await fetch("/api/enrollment/requests/review-batch", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            decision: "approved",
            note: "Moderator batch approval",
            requests: requestIds.map((requestId: string) => ({ requestId })),
          }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      {
        requestIds: (requests ?? []).map((request) => request.id),
      },
    );

    expect(batchReviewResponse.status).toBe(200);
    expect(batchReviewResponse.body.reviewed).toBe(1);
    expect(batchReviewResponse.body.failed).toBe(1);

    const { data: reviewedRows, error: reviewedRowsError } = await teacherClient
      .from("enrollment_requests")
      .select("course_id,status")
      .in("course_id", [classInScope!.course_id, classOutScope!.course_id]);

    expect(reviewedRowsError).toBeNull();

    const inScopeStatus = (reviewedRows ?? []).find((row) => row.course_id === classInScope!.course_id)?.status;
    const outScopeStatus = (reviewedRows ?? []).find((row) => row.course_id === classOutScope!.course_id)?.status;

    expect(inScopeStatus).toBe("approved");
    expect(outScopeStatus).toBe("pending");
  } finally {
    await teacherBrowser.dispose();
    await studentBrowser.dispose();
    await moderatorBrowser.dispose();
    await bootstrap.dispose();

    if (moderatorId) {
      await adminClient.auth.admin.deleteUser(moderatorId);
    }
  }
});
