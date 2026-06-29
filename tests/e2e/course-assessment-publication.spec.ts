import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { utils, write } from "xlsx";

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
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? process.env.SUPABASE_SECRET_KEY
  ?? localEnv.SUPABASE_SERVICE_ROLE_KEY
  ?? localEnv.SUPABASE_SECRET_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  test.skip(true, "Supabase local env is required for course assessment publication E2E test.");
}

type FixtureUserInput = {
  email: string;
  password: string;
  role: "admin" | "moderator" | "teacher" | "student";
  fullName: string;
  studentCode?: string;
  teacherCode?: string;
};

async function ensureAuthUser(
  adminClient: ReturnType<typeof createClient<any>>,
  input: FixtureUserInput,
): Promise<string> {
  const listResult = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  expect(listResult.error).toBeNull();

  const existingUser = listResult.data.users.find((user) => user.email?.toLowerCase() === input.email.toLowerCase());

  if (existingUser) {
    const updateResult = await adminClient.auth.admin.updateUserById(existingUser.id, {
      password: input.password,
      email_confirm: true,
      app_metadata: { role: input.role },
      user_metadata: { role: input.role, full_name: input.fullName },
    });

    expect(updateResult.error).toBeNull();

    const profileUpsert = await adminClient.from("profiles").upsert(
      {
        id: existingUser.id,
        email: input.email,
        full_name: input.fullName,
        role: input.role,
        status: "active",
        access_status: "active",
        student_code: input.studentCode ?? null,
        teacher_code: input.teacherCode ?? null,
      } as Record<string, unknown>,
      { onConflict: "id" },
    );

    expect(profileUpsert.error).toBeNull();
    return existingUser.id;
  }

  const createResult = await adminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: { role: input.role },
    user_metadata: { role: input.role, full_name: input.fullName },
  });

  expect(createResult.error).toBeNull();
  expect(createResult.data.user?.id).toBeTruthy();

  const userId = createResult.data.user!.id;
  const profileUpsert = await adminClient.from("profiles").upsert(
    {
      id: userId,
      email: input.email,
      full_name: input.fullName,
      role: input.role,
      status: "active",
      access_status: "active",
      student_code: input.studentCode ?? null,
      teacher_code: input.teacherCode ?? null,
    } as Record<string, unknown>,
    { onConflict: "id" },
  );

  expect(profileUpsert.error).toBeNull();
  return userId;
}

async function ensureLoggedOutAtLogin(page: Page) {
  await page.goto("/login");

  const signOutButton = page.getByRole("button", { name: "Đăng xuất" });

  if (await signOutButton.isVisible().catch(() => false)) {
    await signOutButton.click();
    await expect(page).toHaveURL(/\/login/);
  }
}

async function signInViaBrowser(page: Page, email: string, password: string) {
  await ensureLoggedOutAtLogin(page);
  await page.goto("/login");
  await page.fill("#sign-in-email", email);
  await page.fill("#sign-in-password", password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

async function seedFixture() {
  const adminClient = createClient<any>(url!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tag = Date.now().toString().slice(-6);
  const fixturePassword = "Passw0rd!";
  const moderatorEmail = `moderator.course.results.${tag}@local.test`;
  const teacherEmail = `teacher.course.results.${tag}@local.test`;
  const student1Email = `student1.course.results.${tag}@local.test`;
  const student2Email = `student2.course.results.${tag}@local.test`;

  const moderatorId = await ensureAuthUser(adminClient, {
    email: moderatorEmail,
    password: fixturePassword,
    role: "moderator",
    fullName: "Moderator Course Results",
  });

  const teacherId = await ensureAuthUser(adminClient, {
    email: teacherEmail,
    password: fixturePassword,
    role: "teacher",
    fullName: "Teacher Course Results",
    teacherCode: `GV-RS-${tag}`,
  });

  const student1Id = await ensureAuthUser(adminClient, {
    email: student1Email,
    password: fixturePassword,
    role: "student",
    fullName: "Student Result One",
    studentCode: `RS${tag}01`,
  });

  const student2Id = await ensureAuthUser(adminClient, {
    email: student2Email,
    password: fixturePassword,
    role: "student",
    fullName: "Student Result Two",
    studentCode: `RS${tag}02`,
  });

  const courseCode = `BA${tag}`;
  const classCode = `LMS_${tag}`;
  const courseTitle = `Du bao nhu cau ${tag}`;
  const classTitle = `LMS_D24 - ${courseTitle}`;

  const courseInsert = await adminClient
    .from("courses")
    .insert({
      owner_id: moderatorId,
      code: courseCode,
      title: courseTitle,
      description: "Hoc phan test luong nop ket qua cap hoc phan.",
      visibility: "private",
      status: "active",
      credits: 3,
      knowledge_block: "major",
      course_type: "required",
      clo_items: [
        { code: "CLO_1", description: "Mo ta 1" },
        { code: "CLO_2", description: "Mo ta 2" },
        { code: "CLO_3", description: "Mo ta 3" },
        { code: "CLO_4", description: "Mo ta 4" },
      ],
      assessment_components: [
        { type: "frequent", weight: 40, cloCodes: ["CLO_1", "CLO_2"] },
        { type: "final", weight: 60, cloCodes: ["CLO_3", "CLO_4"] },
      ],
    })
    .select("id")
    .single<{ id: string }>();

  expect(courseInsert.error).toBeNull();
  const courseId = courseInsert.data!.id;

  const permissionUpsert = await adminClient.from("permission_scopes").upsert({
    actor_id: teacherId,
    scope_type: "course",
    scope_id: courseId,
    status: "active",
    granted_by: moderatorId,
    permissions: {
      manage_course: false,
      manage_class: true,
      manage_members: true,
    },
  });

  expect(permissionUpsert.error).toBeNull();

  const classInsert = await adminClient
    .from("classes")
    .insert({
      course_id: courseId,
      teacher_id: teacherId,
      class_code: classCode,
      title: classTitle,
      semester: "HK1",
      academic_year: "2026-2027",
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();

  expect(classInsert.error).toBeNull();
  const classId = classInsert.data!.id;

  const classMembersInsert = await adminClient.from("class_members").insert([
    {
      class_id: classId,
      student_id: student1Id,
      student_code_snapshot: `RS${tag}01`,
      full_name_snapshot: "Student Result One",
      status: "active",
    },
    {
      class_id: classId,
      student_id: student2Id,
      student_code_snapshot: `RS${tag}02`,
      full_name_snapshot: "Student Result Two",
      status: "active",
    },
  ]);

  expect(classMembersInsert.error).toBeNull();

  const assessmentInsert = await adminClient
    .from("assessments")
    .insert({
      class_id: classId,
      course_id: courseId,
      created_by: teacherId,
      title: `Kiem tra Tong ket ${tag}`,
      description: "Assessment test import + publish + moderator aggregate view",
      delivery_mode: "external",
      provider: "other",
      form_url: "https://example.test/form",
      embed_mode: "new_tab",
      assessment_component_type: "final",
      assessment_clo_codes: ["CLO_3", "CLO_4"],
      attempt_limit: 1,
      shuffle_questions: false,
      show_feedback_after_submit: false,
      status: "open",
    })
    .select("id")
    .single<{ id: string }>();

  expect(assessmentInsert.error).toBeNull();

  return {
    ids: {
      moderatorId,
      teacherId,
      student1Id,
      student2Id,
      courseId,
      classId,
      assessmentId: assessmentInsert.data!.id,
    },
    moderator: { email: moderatorEmail, password: fixturePassword },
    teacher: { email: teacherEmail, password: fixturePassword },
    courseCode,
    courseTitle,
    classCode,
    assessmentId: assessmentInsert.data!.id,
    studentCodes: [`RS${tag}01`, `RS${tag}02`],
  };
}

async function cleanupFixture(fixture: Awaited<ReturnType<typeof seedFixture>>) {
  const adminClient = createClient<any>(url!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userIds = [
    fixture.ids.moderatorId,
    fixture.ids.teacherId,
    fixture.ids.student1Id,
    fixture.ids.student2Id,
  ];

  await adminClient.from("course_assessment_results").delete().eq("assessment_id", fixture.ids.assessmentId);
  await adminClient.from("submissions").delete().eq("assessment_id", fixture.ids.assessmentId);
  await adminClient.from("import_jobs").delete().eq("assessment_id", fixture.ids.assessmentId);
  await adminClient.from("assessment_question_links").delete().eq("assessment_id", fixture.ids.assessmentId);
  await adminClient.from("assessments").delete().eq("id", fixture.ids.assessmentId);
  await adminClient.from("class_members").delete().eq("class_id", fixture.ids.classId);
  await adminClient.from("direct_messages").delete().eq("class_id", fixture.ids.classId);
  await adminClient.from("permission_scopes").delete().eq("scope_id", fixture.ids.courseId);
  await adminClient.from("permission_scopes").delete().in("actor_id", userIds);
  await adminClient.from("classes").delete().eq("id", fixture.ids.classId);
  await adminClient.from("simulations").delete().eq("course_id", fixture.ids.courseId);
  await adminClient.from("materials").delete().eq("course_id", fixture.ids.courseId);
  await adminClient.from("question_bank_items").delete().eq("course_id", fixture.ids.courseId);
  await adminClient.from("student_course_stats").delete().eq("course_id", fixture.ids.courseId);
  await adminClient.from("enrollment_requests").delete().eq("course_id", fixture.ids.courseId);
  await adminClient.from("class_change_requests").delete().eq("course_id", fixture.ids.courseId);
  await adminClient.from("course_change_requests").delete().eq("target_course_id", fixture.ids.courseId);
  await adminClient.from("courses").delete().eq("id", fixture.ids.courseId);
  await adminClient.from("personal_library_settings").delete().eq("teacher_id", fixture.ids.teacherId);
  await adminClient.from("profiles").delete().in("id", userIds);

  for (const userId of userIds) {
    const result = await adminClient.auth.admin.deleteUser(userId);
    expect(result.error).toBeNull();
  }
}

test("teacher imports results, submits them to course, and moderator sees course aggregate board", async ({ page, browser }) => {
  test.setTimeout(120000);

  const fixture = await seedFixture();
  let moderatorContext: BrowserContext | null = null;

  try {
    await signInViaBrowser(page, fixture.teacher.email, fixture.teacher.password);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/assessments/${fixture.assessmentId}/results`);
    await expect(page.getByText("Kết quả bài")).toBeVisible();
    await expect(page.getByRole("button", { name: "NỘP KẾT QUẢ" })).toBeVisible();

    const workbook = utils.book_new();
    const worksheet = utils.aoa_to_sheet([
      ["Mã sinh viên", "Họ tên sinh viên", "Email", "Điểm", "CLO_3", "CLO_4", "Nộp lúc", "Nguồn", "Ghi chú"],
      [fixture.studentCodes[0], "Student Result One", "student-one@local.test", 8, 4, 4, "2026-06-29 10:00:00", "Google Form", "Da nop"],
      [fixture.studentCodes[1], "Student Result Two", "student-two@local.test", 9, 5, 4, "2026-06-29 10:05:00", "Google Form", "Da nop"],
    ]);
    utils.book_append_sheet(workbook, worksheet, "Results");
    const workbookBuffer = write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    await page.setInputFiles('input[name="resultsFile"]', {
      name: "assessment-results.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: workbookBuffer,
    });

    await page.getByRole("button", { name: "Tải kết quả lên" }).click();
    await expect(page.getByText("Student Result One")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Student Result Two")).toBeVisible({ timeout: 20000 });

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "KHÓA KẾT QUẢ" }).click();
    await expect(page.getByRole("button", { name: "MỞ KẾT QUẢ" })).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "NỘP KẾT QUẢ" }).click();
    await page.waitForTimeout(2000);

    moderatorContext = await browser.newContext();
    const moderatorPage = await moderatorContext.newPage();

    await signInViaBrowser(moderatorPage, fixture.moderator.email, fixture.moderator.password);
    await expect(moderatorPage).toHaveURL(/\/dashboard/);

    await expect(moderatorPage.getByRole("link", { name: "Quản lý học phần" })).toBeVisible();
    await expect(moderatorPage.getByRole("link", { name: "Giám sát lớp" })).toHaveCount(0);
    await expect(moderatorPage.getByRole("link", { name: "Thư viện" })).toBeVisible();
    await expect(moderatorPage.getByRole("link", { name: "Duyệt truy cập" })).toHaveCount(0);

    await moderatorPage.goto("/courses");
    await expect(moderatorPage.getByText(`${fixture.courseCode} - ${fixture.courseTitle}`)).toBeVisible();
    await moderatorPage.getByRole("link", { name: "Xem kết quả" }).click();

    await expect(moderatorPage).toHaveURL(/\/courses\/.*\/results/);
    await expect(moderatorPage.getByRole("heading", { name: "Kết quả đánh giá học phần" })).toBeVisible();
    await expect(moderatorPage.getByText("Mã sinh viên")).toBeVisible();
    await expect(moderatorPage.getByText("Năm học")).toBeVisible();
    await expect(moderatorPage.getByText("Lớp")).toBeVisible();
    await expect(moderatorPage.getByText("Tổng kết")).toBeVisible();
    await expect(moderatorPage.getByText("CLO_3")).toBeVisible();
    await expect(moderatorPage.getByText("CLO_4")).toBeVisible();
    await expect(moderatorPage.getByText("2026-2027")).toHaveCount(2);
    await expect(moderatorPage.getByText(fixture.classCode)).toHaveCount(2);
    await expect(moderatorPage.getByText(fixture.studentCodes[0])).toBeVisible();
    await expect(moderatorPage.getByText(fixture.studentCodes[1])).toBeVisible();
  } finally {
    if (moderatorContext) {
      await moderatorContext.close();
    }

    await cleanupFixture(fixture);
  }
});
