import { expect, test } from "@playwright/test";

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}@local.test`;
}

function uniqueCourseCode() {
  return `MAT${Date.now().toString().slice(-8)}`;
}

test("teacher can upload material through server action flow", async ({ page }) => {
  const email = uniqueEmail("teacher.material.e2e");
  const password = "Passw0rd!";
  const courseCode = uniqueCourseCode();

  await page.goto("/login");

  await page.fill("#sign-up-full-name", "Teacher Material E2E");
  await page.fill("#sign-up-email", email);
  await page.fill("#sign-up-password", password);
  await page.selectOption("#sign-up-role", "teacher");
  await page.getByRole("button", { name: "Đăng ký" }).click();

  await expect(page.getByText("Đăng ký thành công. Bạn có thể đăng nhập ngay.")).toBeVisible();

  await page.fill("#sign-in-email", email);
  await page.fill("#sign-in-password", password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("heading", { name: "Tổng quan giảng viên" })).toBeVisible();

  await page.goto("/courses");
  await page.getByTestId("create-course-code").fill(courseCode);
  await page.getByTestId("create-course-title").fill("Course for Material Upload");
  await page.getByTestId("create-course-submit").click();
  await expect(page.getByTestId("create-course-message")).toContainText("Tạo học phần thành công.");

  await page.goto("/materials");
  await page.getByTestId("material-course-id").selectOption({ label: `${courseCode} - Course for Material Upload` });
  await page.getByTestId("material-title").fill("Slide mo dau");
  await page.getByTestId("material-description").fill("Tap tin PDF dau tien");
  await page.getByTestId("material-section-label").fill("Tuan 1");
  await page.getByTestId("material-file").setInputFiles({
    name: "slide-mo-dau.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% Fake PDF for E2E\n", "utf-8"),
  });
  await page.getByTestId("upload-material-submit").click();

  await expect(page.getByTestId("upload-material-message")).toContainText("Tài liệu Slide mo dau đã được tải lên thành công.");
});
