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
  test.skip(true, "Supabase env is required for simulation widget E2E tests.");
}

test("teacher can open course simulations page and use Sprint 5.2 widgets", async ({ page }) => {
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

  test.skip(!supabaseReachable, "Supabase local stack is not reachable for simulation widget E2E test.");
  if (!supabaseReachable) {
    return;
  }

  const adminClient = createClient(url!, serviceRoleKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const teacherEmail = `teacher.sim.widgets.${Date.now()}@local.test`;
  const teacherPassword = "Passw0rd!";

  const createdTeacherResult = await adminClient.auth.admin
    .createUser({
      email: teacherEmail,
      password: teacherPassword,
      email_confirm: true,
      app_metadata: {
        role: "teacher",
      },
      user_metadata: {
        role: "teacher",
        full_name: "Teacher Simulation Widgets",
      },
    })
    .catch((error) => {
      throw error;
    });

  if (createdTeacherResult.error?.message?.toLowerCase().includes("fetch failed")) {
    test.skip(true, "Supabase local stack is not reachable for simulation widget E2E test.");
  }

  expect(createdTeacherResult.error).toBeNull();
  expect(createdTeacherResult.data.user?.id).toBeTruthy();

  const teacherId = createdTeacherResult.data.user!.id;

  const createdCourse = await adminClient
    .from("courses")
    .insert({
      owner_id: teacherId,
      code: `SIM-${Date.now().toString().slice(-6)}`,
      title: "Simulation Course Sprint 5.2",
      visibility: "private",
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();

  expect(createdCourse.error).toBeNull();
  expect(createdCourse.data?.id).toBeTruthy();

  const courseId = createdCourse.data!.id;

  const seededSimulations = await adminClient.from("simulations").upsert(
    [
      {
        course_id: courseId,
        slug: "moving-average-basic",
        title: "MA Widget",
        description: "Moving average widget",
        sort_order: 1,
        status: "published",
      },
      {
        course_id: courseId,
        slug: "simple-exponential-smoothing",
        title: "SES Widget",
        description: "Simple exponential smoothing widget",
        sort_order: 2,
        status: "published",
      },
      {
        course_id: courseId,
        slug: "normal-distribution-linear-regression",
        title: "Normal Regression Widget",
        description: "Normal distribution and regression widget",
        sort_order: 3,
        status: "published",
      },
    ],
    { onConflict: "course_id,slug" },
  );

  expect(seededSimulations.error).toBeNull();

  await page.goto("/login");
  await page.fill("#sign-in-email", teacherEmail);
  await page.fill("#sign-in-password", teacherPassword);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto(`/courses/${courseId}/simulations`);

  await expect(page.getByRole("heading", { name: "Mô phỏng của học phần" })).toBeVisible();
  await expect(page.getByText("Slug: moving-average-basic")).toBeVisible();
  await expect(page.getByText("Slug: simple-exponential-smoothing")).toBeVisible();
  await expect(page.getByText("Slug: normal-distribution-linear-regression")).toBeVisible();

  const movingAverageWidget = page.getByTestId("simulation-moving-average-widget");
  await expect(movingAverageWidget).toBeVisible();
  await movingAverageWidget.getByLabel("Kích thước cửa sổ").fill("2");
  await expect(movingAverageWidget.getByText(/Giá trị MA mới nhất:/)).toBeVisible();

  const sesWidget = page.getByTestId("simulation-exponential-smoothing-widget");
  await expect(sesWidget).toBeVisible();
  await sesWidget.getByLabel("Hệ số α").fill("0.3");
  await expect(sesWidget.getByText(/Dự báo kỳ tiếp theo:/)).toBeVisible();

  const normalRegressionWidget = page.getByTestId("simulation-normal-regression-widget");
  await expect(normalRegressionWidget).toBeVisible();
  await normalRegressionWidget.getByLabel("Độ lệch chuẩn").fill("0");
  await expect(normalRegressionWidget.getByText("Thông số phân phối chuẩn không hợp lệ.")).toBeVisible();

  await normalRegressionWidget.getByLabel("Độ lệch chuẩn").fill("1");
  await expect(normalRegressionWidget.getByText(/z-score:/)).toBeVisible();

  await adminClient.from("simulations").delete().eq("course_id", courseId);
  await adminClient.from("courses").delete().eq("id", courseId);
  await adminClient.auth.admin.deleteUser(teacherId);

});
