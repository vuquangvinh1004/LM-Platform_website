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
  test.skip(true, "Supabase local env is required for assessment results E2E tests.");
}

if (!googleWebhookSecret) {
  test.skip(true, "GOOGLE_FORM_WEBHOOK_SECRET is required for webhook E2E tests.");
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

async function isSupabaseReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${url}/auth/v1/health`);
    return response.ok;
  } catch {
    return false;
  }
}

test("teacher sees fixture assessment results after webhook upsert and can export CSV", async ({ page }) => {
  test.setTimeout(120000);

  const reachable = await isSupabaseReachable();
  test.skip(!reachable, "Supabase local stack is not reachable for assessment results E2E test.");

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
    .select("id")
    .eq("title", "Assessment Fixture Phase 4")
    .order("created_at", { ascending: false })
    .limit(1)
    .single<{ id: string }>();

  expect(fixtureAssessmentError).toBeNull();
  expect(fixtureAssessment?.id).toBeTruthy();

  const assessmentId = fixtureAssessment!.id;

  const webhookPayloads = [
    {
      responseId: `resp-fixture-1-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      answers: {
        email: "student1.fixture.phase4@local.test",
        studentCode: "SV-FIX-01",
        fullName: "Student Fixture 1",
        score: 8,
        maxScore: 10,
        attempt: 1,
      },
    },
    {
      responseId: `resp-fixture-2-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      answers: {
        email: "student2.fixture.phase4@local.test",
        studentCode: "SV-FIX-02",
        fullName: "Student Fixture 2",
        score: 9,
        maxScore: 10,
        attempt: 1,
      },
    },
  ];

  for (const payload of webhookPayloads) {
    const response = await page.request.post("/api/webhooks/google-form", {
      headers: {
        "x-webhook-secret": googleWebhookSecret!,
      },
      data: {
        assessmentId,
        payload,
      },
    });

    expect(response.status()).toBe(200);

    const json = await response.json() as { submissionId?: string };
    expect(json.submissionId).toBeTruthy();
  }

  await page.goto(`/assessments/${assessmentId}/results`);
  await expect(page.getByText("Student Fixture 1")).toBeVisible();
  await expect(page.getByText("Student Fixture 2")).toBeVisible();

  const exportResponse = await page.request.get(`/api/assessments/${assessmentId}/results/export?format=csv`);
  expect(exportResponse.status()).toBe(200);

  const contentDisposition = exportResponse.headers()["content-disposition"];
  expect(contentDisposition).toContain("attachment");

  const csvText = await exportResponse.text();
  expect(csvText).toContain("studentFullName");
  expect(csvText).toContain("Student Fixture 1");
});
