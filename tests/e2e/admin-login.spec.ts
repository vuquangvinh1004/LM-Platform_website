import { expect, test } from "@playwright/test";

test("local Admin alias can sign in with default credentials", async ({ page }) => {
  await page.goto("/login");

  await page.fill("#sign-in-email", "Admin");
  await page.fill("#sign-in-password", "Admin");
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { name: "Khu vực admin" })).toBeVisible();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login/);
});
