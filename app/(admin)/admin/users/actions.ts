"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/services/auth-service";
import {
  createManagedStaffAccount,
  updateManagedUserRoleAndStatus,
  updateTeacherPersonalLibraryQuota,
} from "@/lib/services/user-management-service";

function redirectWithFlash(status: "success" | "error", message: string): never {
  redirect(`/admin/users?status=${status}&message=${encodeURIComponent(message)}`);
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
    teacherCode: String(formData.get("teacherCode") ?? "").trim() || undefined,
  });

  if (!result.ok) {
    redirectWithFlash("error", result.error.message);
  }

  revalidatePath("/admin/users");
  redirectWithFlash("success", "Đã tạo tài khoản nhân sự mới.");
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
