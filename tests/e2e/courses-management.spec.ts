import { expect, test } from "@playwright/test";

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}@local.test`;
}

function uniqueCourseCode() {
  return `COURSE${Date.now().toString().slice(-8)}`;
}

test("teacher can create, update, archive course via service-backed actions", async ({ page }) => {
  const email = uniqueEmail("teacher.course.e2e");
  const password = "Passw0rd!";
  const courseCode = uniqueCourseCode();
  const updatedTitle = "Updated Course Title";

  await page.goto("/login");

  await page.fill("#sign-up-full-name", "Teacher Course E2E");
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
  await page.getByTestId("create-course-title").fill("Initial Course Title");
  await page.getByTestId("create-course-description").fill("Initial description");
  await page.getByTestId("create-course-submit").click();

  await expect(page.getByTestId("create-course-message")).toContainText("Tạo học phần thành công.");
  await expect(page.getByTestId(`course-card-${courseCode}`)).toBeVisible();

  await page.getByTestId(`course-title-${courseCode}`).fill(updatedTitle);
  await page.getByTestId(`course-status-${courseCode}`).selectOption("active");
  await page.getByTestId(`update-course-submit-${courseCode}`).click();

  await expect(page.getByTestId("update-course-message")).toContainText("Cập nhật học phần thành công.");
  await expect(page.getByTestId(`course-title-${courseCode}`)).toHaveValue(updatedTitle);

  await page.getByTestId(`archive-course-submit-${courseCode}`).click();

  await expect(page.getByTestId("archive-course-message")).toContainText("Lưu trữ học phần thành công.");
});

test("teacher sees conflict when creating duplicate course code", async ({ page }) => {
  const email = uniqueEmail("teacher.course.duplicate.e2e");
  const password = "Passw0rd!";
  const courseCode = uniqueCourseCode();

  await page.goto("/login");

  await page.fill("#sign-up-full-name", "Teacher Duplicate E2E");
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
  await page.getByTestId("create-course-title").fill("First Title");
  await page.getByTestId("create-course-submit").click();
  await expect(page.getByTestId("create-course-message")).toContainText("Tạo học phần thành công.");

  await page.getByTestId("create-course-code").fill(courseCode);
  await page.getByTestId("create-course-title").fill("Second Title");
  await page.getByTestId("create-course-submit").click();
  await expect(page.getByTestId("create-course-message")).toContainText("Ma hoc phan da ton tai voi giang vien nay.");
});
