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
  test.skip(true, "Supabase local env is required for student material viewer E2E tests.");
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${randomUUID()}@local.test`;
}

function uniqueCode(prefix: string) {
  return `${prefix}${Date.now().toString().slice(-8)}`;
}

async function createTeacherScopedClient(email: string, password: string): Promise<SupabaseClient> {
  const authClient = createClient(url!, anonKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });

  if (error || !data.session?.access_token) {
    throw new Error(`Cannot sign in teacher client: ${error?.message}`);
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
  const client = await createTeacherScopedClient(email, password);
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

async function createMaterialForCourse(
  teacherClient: SupabaseClient,
  courseCode: string,
  title: string,
  allowDownload: boolean,
): Promise<string> {
  const { data: course, error: courseError } = await teacherClient
    .from("courses")
    .select("id")
    .eq("code", courseCode)
    .maybeSingle();

  if (courseError || !course) {
    throw new Error(`Cannot find course for material creation: ${courseError?.message}`);
  }

  const { data: teacherUserResult } = await teacherClient.auth.getUser();
  if (!teacherUserResult.user?.id) {
    throw new Error("Cannot resolve teacher identity for material creation.");
  }

  const storagePath = `${course.id}/${randomUUID()}/viewer.pdf`;
  const { error: uploadError } = await teacherClient.storage
    .from("course-materials")
    .upload(storagePath, Buffer.from("%PDF-1.4\nviewer\n"), {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Cannot upload material object: ${uploadError.message}`);
  }

  const { data: material, error: materialError } = await teacherClient
    .from("materials")
    .insert({
      course_id: course.id,
      uploaded_by: teacherUserResult.user.id,
      title,
      file_name: "viewer.pdf",
      file_type: "application/pdf",
      file_size: 64,
      storage_bucket: "course-materials",
      storage_path: storagePath,
      allow_download: allowDownload,
      status: "published",
    })
    .select("id")
    .single();

  if (materialError || !material) {
    throw new Error(`Cannot create material metadata: ${materialError?.message}`);
  }

  return material.id;
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

async function teacherCreatesClassAndAddsStudent(
  page: Page,
  input: {
    courseCode: string;
    courseTitle: string;
    classCode: string;
    classTitle: string;
    studentFullName: string;
    studentEmail: string;
  },
) {
  await page.goto("/classes");
  await page.getByTestId("create-class-course-id").selectOption({ label: `${input.courseCode} - ${input.courseTitle}` });
  await page.getByTestId("create-class-code").fill(input.classCode);
  await page.getByTestId("create-class-title").fill(input.classTitle);
  await page.getByTestId("create-class-semester").fill("HK1");
  await page.getByTestId("create-class-academic-year").fill("2026-2027");
  await page.getByTestId("create-class-status").selectOption("active");
  await page.getByTestId("create-class-submit").click();
  await expect(page.getByTestId("create-class-message")).toContainText("Tạo lớp học phần thành công.");

  await page.getByTestId(`add-student-full-name-${input.classCode}`).fill(input.studentFullName);
  await page.getByTestId(`add-student-email-${input.classCode}`).fill(input.studentEmail);
  await page.getByTestId(`add-student-submit-${input.classCode}`).click();
  await expect(page.getByTestId("add-student-message")).toContainText("Thêm sinh viên vào lớp thành công.");
}

test("student with official class membership flow can open viewer and see download link when allowed", async ({ page }) => {
  const teacherEmail = uniqueEmail("teacher.viewer.e2e");
  const studentEmail = uniqueEmail("student.viewer.e2e");
  const password = "Passw0rd!";
  const courseCode = uniqueCode("VIEW");
  const classCode = uniqueCode("CLS");

  await signUpViaBrowser(page, "Teacher Viewer E2E", teacherEmail, password, "teacher");
  await signUpViaBrowser(page, "Student Viewer E2E", studentEmail, password, "student");
  await signInViaBrowser(page, teacherEmail, password, /\/dashboard/);

  await teacherCreatesCourse(page, courseCode, "Viewer Course");
  const teacherClient = await createTeacherScopedClient(teacherEmail, password);
  const materialId = await createMaterialForCourse(teacherClient, courseCode, "Material Download On", true);

  await teacherCreatesClassAndAddsStudent(page, {
    courseCode,
    courseTitle: "Viewer Course",
    classCode,
    classTitle: "Viewer Class",
    studentFullName: "Student Viewer E2E",
    studentEmail,
  });

  await signOutViaBrowser(page);

  await signInViaBrowser(page, studentEmail, password, /\/my-classes/);
  await expect(page.getByTestId(`student-class-card-${classCode}`)).toContainText("Viewer Class");

  await page.goto(`/my-classes/materials/${materialId}`);
  await expect(page.getByTestId("student-material-title")).toContainText("Material Download On");
  await expect(page.getByTestId("student-material-viewer")).toHaveAttribute("src", /object\/sign\/course-materials/);
  await expect(page.getByTestId("student-material-download-link")).toHaveAttribute("href", /object\/sign\/course-materials/);
});

test("student viewer hides download link when allowDownload is false", async ({ page }) => {
  const teacherEmail = uniqueEmail("teacher.viewer.nodownload.e2e");
  const studentEmail = uniqueEmail("student.viewer.nodownload.e2e");
  const password = "Passw0rd!";
  const courseCode = uniqueCode("VIEW");
  const classCode = uniqueCode("CLS");

  await signUpViaBrowser(page, "Teacher Viewer E2E", teacherEmail, password, "teacher");
  await signUpViaBrowser(page, "Student Viewer E2E", studentEmail, password, "student");
  await signInViaBrowser(page, teacherEmail, password, /\/dashboard/);

  await teacherCreatesCourse(page, courseCode, "Viewer Course No Download");
  const teacherClient = await createTeacherScopedClient(teacherEmail, password);
  const materialId = await createMaterialForCourse(teacherClient, courseCode, "Material Download Off", false);

  await teacherCreatesClassAndAddsStudent(page, {
    courseCode,
    courseTitle: "Viewer Course No Download",
    classCode,
    classTitle: "Viewer Class No Download",
    studentFullName: "Student Viewer E2E",
    studentEmail,
  });

  await signOutViaBrowser(page);

  await signInViaBrowser(page, studentEmail, password, /\/my-classes/);
  await expect(page.getByTestId(`student-class-card-${classCode}`)).toContainText("Viewer Class No Download");

  await page.goto(`/my-classes/materials/${materialId}`);
  await expect(page.getByTestId("student-material-title")).toContainText("Material Download Off");
  await expect(page.getByTestId("student-material-viewer")).toHaveAttribute("src", /object\/sign\/course-materials/);
  await expect(page.getByTestId("student-material-download-disabled")).toContainText("Tải xuống đã bị tắt.");
});

test("student without class membership cannot open material viewer", async ({ page }) => {
  const teacherEmail = uniqueEmail("teacher.viewer.blocked.e2e");
  const memberStudentEmail = uniqueEmail("student.viewer.member.e2e");
  const outsiderStudentEmail = uniqueEmail("student.viewer.outsider.e2e");
  const password = "Passw0rd!";
  const courseCode = uniqueCode("VIEW");
  const classCode = uniqueCode("CLS");

  await signUpViaBrowser(page, "Teacher Viewer E2E", teacherEmail, password, "teacher");
  await signUpViaBrowser(page, "Student Member E2E", memberStudentEmail, password, "student");
  await signUpViaBrowser(page, "Student Outsider E2E", outsiderStudentEmail, password, "student");
  await signInViaBrowser(page, teacherEmail, password, /\/dashboard/);

  await teacherCreatesCourse(page, courseCode, "Blocked Viewer Course");
  const teacherClient = await createTeacherScopedClient(teacherEmail, password);
  const materialId = await createMaterialForCourse(teacherClient, courseCode, "Blocked Viewer Material", true);

  await teacherCreatesClassAndAddsStudent(page, {
    courseCode,
    courseTitle: "Blocked Viewer Course",
    classCode,
    classTitle: "Blocked Viewer Class",
    studentFullName: "Student Member E2E",
    studentEmail: memberStudentEmail,
  });

  await signOutViaBrowser(page);

  await signInViaBrowser(page, outsiderStudentEmail, password, /\/my-classes/);
  await expect(page.getByTestId("student-classes-empty")).toContainText("Bạn chưa có lớp học phần nào.");

  await page.goto(`/my-classes/materials/${materialId}`);
  await expect(page.getByTestId("student-material-error")).toContainText("Không tìm thấy tài liệu hoặc bạn không được phép xem.");
});
