import { expect, test } from "@playwright/test";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

async function isSupabaseReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/health`);
    return response.ok;
  } catch {
    return false;
  }
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}@local.test`;
}

test("teacher auth flow redirects and blocks admin route", async ({ page }) => {
  const reachable = await isSupabaseReachable();
  test.skip(!reachable, "Supabase local stack is not reachable for auth-flow E2E test.");

  const email = uniqueEmail("teacher.e2e");
  const password = "Passw0rd!";

  await page.goto("/login");

  await page.fill("#sign-up-full-name", "Teacher E2E");
  await page.fill("#sign-up-email", email);
  await page.fill("#sign-up-password", password);
  await page.selectOption("#sign-up-role", "teacher");
  await page.getByRole("button", { name: "Đăng ký" }).click();

  await expect(page.getByText("Đăng ký thành công. Bạn có thể đăng nhập ngay.")).toBeVisible();

  await page.fill("#sign-in-email", email);
  await page.fill("#sign-in-password", password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  await expect(page.getByRole("heading", { name: "Tổng quan giảng viên" })).toBeVisible();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("student auth flow is blocked pending approval", async ({ page }) => {
  const reachable = await isSupabaseReachable();
  test.skip(!reachable, "Supabase local stack is not reachable for auth-flow E2E test.");

  const email = uniqueEmail("student.e2e");
  const password = "Passw0rd!";

  await page.goto("/login");

  await page.fill("#sign-up-full-name", "Student E2E");
  await page.fill("#sign-up-email", email);
  await page.fill("#sign-up-password", password);
  await page.selectOption("#sign-up-role", "student");
  await page.getByRole("button", { name: "Đăng ký" }).click();

  await expect(page.getByText("Đăng ký thành công. Bạn có thể đăng nhập ngay.")).toBeVisible();

  await page.fill("#sign-in-email", email);
  await page.fill("#sign-in-password", password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  await expect(page.getByRole("heading", { name: "Lớp của tôi" })).toBeVisible();
  await expect(page.getByText("Tài khoản sinh viên đang chờ duyệt hoặc đã bị tạm dừng.")).toBeVisible();

  await page.goto("/login");
  await expect(page).toHaveURL(/\/my-classes/);
});
