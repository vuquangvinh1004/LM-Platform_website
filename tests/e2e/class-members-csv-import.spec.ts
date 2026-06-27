import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, type Page, test } from "@playwright/test";
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
  test.skip(true, "Supabase local env is required for class CSV import E2E tests.");
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${randomUUID()}@local.test`;
}

function uniqueCode(prefix: string) {
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

async function waitForOwnProfile(email: string, password: string): Promise<void> {
  const client = await createScopedClient(email, password);
  const { data: userResult } = await client.auth.getUser();

  if (!userResult.user?.id) {
    throw new Error("Cannot resolve signed-in user while waiting for profile creation.");
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await client.from("profiles").select("id").eq("id", userResult.user.id).maybeSingle();

    if (!error && data?.id === userResult.user.id) {
      await client.auth.signOut();
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  await client.auth.signOut();
  throw new Error(`Timed out waiting for profile creation for ${email}.`);
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

async function signOutViaBrowser(page: Page) {
  const signOutButton = page.getByRole("button", { name: "Đăng xuất" });

  if (!(await signOutButton.isVisible())) {
    await page.goto("/dashboard");
  }

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login/);
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

  await waitForOwnProfile(email, password);
}

async function signInViaBrowser(page: Page, email: string, password: string, expectedUrl: RegExp) {
  await ensureLoggedOutAtLogin(page);
  await page.fill("#sign-in-email", email);
  await page.fill("#sign-in-password", password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(expectedUrl);
}

async function teacherCreatesCourse(page: Page, courseCode: string, title: string) {
  await page.goto("/courses");
  await page.getByTestId("create-course-code").fill(courseCode);
  await page.getByTestId("create-course-title").fill(title);
  await page.getByTestId("create-course-submit").click();
  await expect(page.getByTestId("create-course-message")).toContainText("Tạo học phần thành công.");
}

async function teacherCreatesClass(page: Page, input: { courseCode: string; courseTitle: string; classCode: string; classTitle: string }) {
  await page.goto("/classes");
  await page.getByTestId("create-class-course-id").selectOption({ label: `${input.courseCode} - ${input.courseTitle}` });
  await page.getByTestId("create-class-code").fill(input.classCode);
  await page.getByTestId("create-class-title").fill(input.classTitle);
  await page.getByTestId("create-class-semester").fill("HK1");
  await page.getByTestId("create-class-academic-year").fill("2026-2027");
  await page.getByTestId("create-class-status").selectOption("active");
  await page.getByTestId("create-class-submit").click();
  await expect(page.getByTestId("create-class-message")).toContainText("Tạo lớp học phần thành công.");
}

test("teacher can import class members from csv and student sees imported class", async ({ page }) => {
  const teacherEmail = uniqueEmail("teacher.classcsv.e2e");
  const studentEmail = uniqueEmail("student.classcsv.e2e");
  const password = "Passw0rd!";
  const courseCode = uniqueCode("CSV");
  const classCode = uniqueCode("CLS");

  await signUpViaBrowser(page, "Teacher CSV Import E2E", teacherEmail, password, "teacher");
  await signUpViaBrowser(page, "Student CSV Import E2E", studentEmail, password, "student");
  await signInViaBrowser(page, teacherEmail, password, /\/dashboard/);

  await teacherCreatesCourse(page, courseCode, "CSV Import Course");
  await teacherCreatesClass(page, {
    courseCode,
    courseTitle: "CSV Import Course",
    classCode,
    classTitle: "CSV Import Class",
  });

  const csvContent = [
    "fullName,email,studentCode",
    `Student CSV Import E2E,${studentEmail},`,
  ].join("\n");

  await page.goto("/classes");
  await page.getByTestId(`import-students-file-${classCode}`).setInputFiles({
    name: "students.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csvContent, "utf8"),
  });
  await page.getByTestId(`import-students-submit-${classCode}`).click();

  await expect(page.getByTestId("import-students-message")).toContainText("Nhập CSV hoàn tất: thêm 1 sinh viên, bỏ qua 0 dòng.");
  await expect(page.getByTestId(`class-card-${classCode}`)).toContainText("1 sinh viên");

  await signOutViaBrowser(page);
  await signInViaBrowser(page, studentEmail, password, /\/my-classes/);
  await expect(page.getByTestId(`student-class-card-${classCode}`)).toContainText("CSV Import Class");
});

test("teacher sees validation error when csv header misses identifiers", async ({ page }) => {
  const teacherEmail = uniqueEmail("teacher.classcsv.invalid.e2e");
  const password = "Passw0rd!";
  const courseCode = uniqueCode("CSV");
  const classCode = uniqueCode("CLS");

  await signUpViaBrowser(page, "Teacher CSV Invalid E2E", teacherEmail, password, "teacher");
  await signInViaBrowser(page, teacherEmail, password, /\/dashboard/);

  await teacherCreatesCourse(page, courseCode, "CSV Invalid Course");
  await teacherCreatesClass(page, {
    courseCode,
    courseTitle: "CSV Invalid Course",
    classCode,
    classTitle: "CSV Invalid Class",
  });

  const csvContent = [
    "fullName",
    "Student Without Identifier",
  ].join("\n");

  await page.goto("/classes");
  await page.getByTestId(`import-students-file-${classCode}`).setInputFiles({
    name: "invalid-students.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csvContent, "utf8"),
  });
  await page.getByTestId(`import-students-submit-${classCode}`).click();

  await expect(page.getByTestId("import-students-message")).toContainText("CSV phải có ít nhất một cột email hoặc mã sinh viên.");
});

test("teacher sees skipped rows for duplicate membership and unresolved student in csv import", async ({ page }) => {
  const teacherEmail = uniqueEmail("teacher.classcsv.review.e2e");
  const studentEmail = uniqueEmail("student.classcsv.review.e2e");
  const password = "Passw0rd!";
  const courseCode = uniqueCode("CSV");
  const classCode = uniqueCode("CLS");

  await signUpViaBrowser(page, "Teacher CSV Review E2E", teacherEmail, password, "teacher");
  await signUpViaBrowser(page, "Student CSV Review E2E", studentEmail, password, "student");
  await signInViaBrowser(page, teacherEmail, password, /\/dashboard/);

  await teacherCreatesCourse(page, courseCode, "CSV Review Course");
  await teacherCreatesClass(page, {
    courseCode,
    courseTitle: "CSV Review Course",
    classCode,
    classTitle: "CSV Review Class",
  });

  const firstCsvContent = [
    "fullName,email,studentCode",
    `Student CSV Review E2E,${studentEmail},`,
  ].join("\n");

  await page.goto("/classes");
  await page.getByTestId(`import-students-file-${classCode}`).setInputFiles({
    name: "students-first.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(firstCsvContent, "utf8"),
  });
  await page.getByTestId(`import-students-submit-${classCode}`).click();

  await expect(page.getByTestId("import-students-message")).toContainText("Nhập CSV hoàn tất: thêm 1 sinh viên, bỏ qua 0 dòng.");
  await expect(page.getByTestId(`class-card-${classCode}`)).toContainText("1 sinh viên");

  const unresolvedEmail = uniqueEmail("student.classcsv.unresolved.e2e");
  const secondCsvContent = [
    "fullName,email,studentCode",
    `Student CSV Review E2E,${studentEmail},`,
    `Unknown Student,${unresolvedEmail},`,
  ].join("\n");

  await page.getByTestId(`import-students-file-${classCode}`).setInputFiles({
    name: "students-second.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(secondCsvContent, "utf8"),
  });
  await page.getByTestId(`import-students-submit-${classCode}`).click();

  await expect(page.getByTestId("import-students-message")).toContainText("Nhập CSV hoàn tất: thêm 0 sinh viên, bỏ qua 2 dòng.");
  await expect(page.getByTestId(`class-card-${classCode}`)).toContainText("1 sinh viên");
});
