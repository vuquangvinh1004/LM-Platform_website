"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/services/auth-service";
import {
  createManagedStudentAccount,
  createManagedStudentAccountsBulk,
  createManagedStaffAccount,
  deleteManagedStudentAccount,
  resetManagedStudentPassword,
  updateManagedStudentProfile,
  updateManagedUserRoleAndStatus,
  updateTeacherPersonalLibraryQuota,
} from "@/lib/services/user-management-service";

function redirectWithFlash(status: "success" | "error", message: string): never {
  redirect(`/admin/users?status=${status}&message=${encodeURIComponent(message)}`);
}

function getRedirectTarget(formData: FormData): string {
  const redirectTarget = String(formData.get("redirectTo") ?? "").trim();

  return redirectTarget === "/admin/users/students" ? redirectTarget : "/admin/users";
}

function redirectWithFlashTo(targetPath: string, status: "success" | "error", message: string): never {
  redirect(`${targetPath}?status=${status}&message=${encodeURIComponent(message)}`);
}

export async function createManagedStaffAccountAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    redirectWithFlash("error", profileResult.error.message);
  }

  const roleRaw = String(formData.get("role") ?? "").trim();
  const role = roleRaw === "moderator" ? "moderator" : "teacher";
  const result = await createManagedStaffAccount({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? "").trim(),
    fullName: String(formData.get("fullName") ?? "").trim(),
    role,
    roleCode: String(formData.get("roleCode") ?? "").trim() || undefined,
  });

  if (!result.ok) {
    redirectWithFlash("error", result.error.message);
  }

  revalidatePath("/admin/users");
  redirectWithFlash("success", "Đã tạo tài khoản nhân sự mới.");
}

export async function createManagedStudentAccountAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    redirectWithFlash("error", profileResult.error.message);
  }

  const result = await createManagedStudentAccount({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    studentCode: String(formData.get("studentCode") ?? "").trim(),
    fullName: String(formData.get("fullName") ?? "").trim(),
    password: String(formData.get("password") ?? "").trim(),
  });

  if (!result.ok) {
    redirectWithFlash("error", result.error.message);
  }

  revalidatePath("/admin/users");
  redirectWithFlash("success", "Đã tạo tài khoản sinh viên.");
}

export async function createManagedStudentAccountsBulkAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    redirectWithFlash("error", profileResult.error.message);
  }

  const csvFile = formData.get("csvFile");

  if (!(csvFile instanceof File) || csvFile.size === 0) {
    redirectWithFlash("error", "Vui lòng chọn file CSV để import tài khoản sinh viên.");
  }

  const csvContent = Buffer.from(await csvFile.arrayBuffer()).toString("utf8");
  const result = await createManagedStudentAccountsBulk({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    csvContent,
  });

  if (!result.ok) {
    redirectWithFlash("error", result.error.message);
  }

  revalidatePath("/admin/users");
  redirectWithFlash(
    result.data.errorCount > 0 ? "error" : "success",
    result.data.errorCount > 0
      ? `Đã tạo ${result.data.createdCount} tài khoản, ${result.data.errorCount} dòng lỗi. ${result.data.errors[0] ?? ""}`.trim()
      : `Đã tạo hàng loạt ${result.data.createdCount} tài khoản sinh viên.`,
  );
}

export async function updateManagedUserAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    redirectWithFlash("error", profileResult.error.message);
  }

  const roleRaw = String(formData.get("role") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const role = roleRaw === "admin" || roleRaw === "moderator" || roleRaw === "teacher" || roleRaw === "student" ? roleRaw : "student";
  const status = statusRaw === "inactive" || statusRaw === "archived" ? statusRaw : "active";

  const result = await updateManagedUserRoleAndStatus({
    actorRole: profileResult.data.role,
    userId: String(formData.get("userId") ?? "").trim(),
    role,
    status,
  });

  if (!result.ok) {
    redirectWithFlash("error", result.error.message);
  }

  revalidatePath("/admin/users");
  redirectWithFlash("success", "Đã cập nhật tài khoản.");
}

export async function updateTeacherPersonalLibraryQuotaAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    redirectWithFlash("error", profileResult.error.message);
  }

  const quotaMb = Number(String(formData.get("quotaMb") ?? "").trim());
  const result = await updateTeacherPersonalLibraryQuota({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    teacherId: String(formData.get("teacherId") ?? "").trim(),
    quotaBytes: Math.round(quotaMb * 1024 * 1024),
  });

  if (!result.ok) {
    redirectWithFlash("error", result.error.message);
  }

  revalidatePath("/admin/users");
  redirectWithFlash("success", "Đã cập nhật dung lượng Thư viện cá nhân.");
}

export async function updateManagedStudentProfileAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin"]);
  const redirectTarget = getRedirectTarget(formData);

  if (!profileResult.ok) {
    redirectWithFlashTo(redirectTarget, "error", profileResult.error.message);
  }

  const result = await updateManagedStudentProfile({
    actorRole: profileResult.data.role,
    studentId: String(formData.get("studentId") ?? "").trim(),
    fullName: String(formData.get("fullName") ?? "").trim(),
  });

  if (!result.ok) {
    redirectWithFlashTo(redirectTarget, "error", result.error.message);
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/users/students");
  redirectWithFlashTo(redirectTarget, "success", "Đã cập nhật thông tin sinh viên.");
}

export async function resetManagedStudentPasswordAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin"]);
  const redirectTarget = getRedirectTarget(formData);

  if (!profileResult.ok) {
    redirectWithFlashTo(redirectTarget, "error", profileResult.error.message);
  }

  const result = await resetManagedStudentPassword({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    studentId: String(formData.get("studentId") ?? "").trim(),
    newPassword: String(formData.get("newPassword") ?? "").trim(),
  });

  if (!result.ok) {
    redirectWithFlashTo(redirectTarget, "error", result.error.message);
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/users/students");
  redirectWithFlashTo(redirectTarget, "success", "Đã thay đổi mật khẩu sinh viên.");
}

export async function deleteManagedStudentAccountAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin"]);
  const redirectTarget = getRedirectTarget(formData);

  if (!profileResult.ok) {
    redirectWithFlashTo(redirectTarget, "error", profileResult.error.message);
  }

  const result = await deleteManagedStudentAccount({
    actorRole: profileResult.data.role,
    studentId: String(formData.get("studentId") ?? "").trim(),
  });

  if (!result.ok) {
    redirectWithFlashTo(redirectTarget, "error", result.error.message);
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/users/students");
  redirectWithFlashTo(redirectTarget, "success", "Đã xóa tài khoản sinh viên.");
}
