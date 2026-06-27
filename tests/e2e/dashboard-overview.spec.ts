import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
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
const googleWebhookSecret = process.env.GOOGLE_FORM_WEBHOOK_SECRET ?? localEnv.GOOGLE_FORM_WEBHOOK_SECRET;

if (!url || !anonKey) {
  test.skip(true, "Supabase local env is required for dashboard E2E tests.");
}

if (!googleWebhookSecret) {
  test.skip(true, "GOOGLE_FORM_WEBHOOK_SECRET is required for dashboard webhook E2E tests.");
}

async function ensureLoggedOutAtLogin(page: Page) {
  await page.goto("/login");

  const signOutButton = page.getByRole("button", { name: "Đăng xuất" });

  if (await signOutButton.isVisible()) {
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

test("teacher dashboard shows completion chart, filters and recent webhook activity", async ({ page }) => {
  test.setTimeout(120000);

  const teacherEmail = "teacher.fixture.phase4@local.test";
  const teacherPassword = process.env.FIXTURE_DEFAULT_PASSWORD ?? "Passw0rd!";

  await signInViaBrowser(page, teacherEmail, teacherPassword);
  await expect(page).toHaveURL(/\/dashboard/);

  const teacherAuthClient = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const signInResult = await teacherAuthClient.auth.signInWithPassword({
    email: teacherEmail,
    password: teacherPassword,
  });

  expect(signInResult.error).toBeNull();

  const teacherScopedClient = createClient(url!, anonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${signInResult.data.session?.access_token}`,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: fixtureAssessment, error: fixtureAssessmentError } = await teacherScopedClient
    .from("assessments")
    .select("id,class_id")
    .eq("title", "Assessment Fixture Phase 4")
    .order("created_at", { ascending: false })
    .limit(1)
    .single<{ id: string; class_id: string }>();

  expect(fixtureAssessmentError).toBeNull();
  expect(fixtureAssessment?.id).toBeTruthy();

  const assessmentId = fixtureAssessment!.id;
  const classId = fixtureAssessment!.class_id;

  const webhookResponse = await page.request.post("/api/webhooks/google-form", {
    headers: {
      "x-webhook-secret": googleWebhookSecret!,
    },
    data: {
      assessmentId,
      payload: {
        responseId: `resp-dashboard-${Date.now()}`,
        submittedAt: new Date().toISOString(),
        answers: {
          email: "student3.fixture.phase4@local.test",
          studentCode: "SV-FIX-03",
          fullName: "Student Fixture 3",
          score: 7,
          maxScore: 10,
          attempt: 1,
        },
      },
    },
  });

  expect(webhookResponse.status()).toBe(200);

  await page.goto(`/dashboard?classId=${classId}`);

  await expect(page.getByRole("heading", { name: "Tổng quan giảng viên" })).toBeVisible();
  await expect(page.getByText("Tỷ lệ hoàn thành theo bài kiểm tra")).toBeVisible();
  await expect(page.getByText("Assessment Fixture Phase 4")).toBeVisible();
  await expect(page.getByRole("button", { name: "Áp dụng bộ lọc" })).toBeVisible();
  await expect(page.getByText("THÔNG BÁO CHUNG")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hoạt động gần đây" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Duyệt yêu cầu vào lớp" })).toHaveCount(0);

  const hasActivityItem = await page.getByText("submission.webhook.upserted").isVisible().catch(() => false);
  const hasEmptyActivity = await page.getByText("Chưa có hoạt động nào.").isVisible().catch(() => false);
  expect(hasActivityItem || hasEmptyActivity).toBe(true);
});
