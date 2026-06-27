"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { reviewEnrollmentRequestsBatch } from "@/lib/services/enrollment-service";
import { approveStudentAccess, renewStudentAccess } from "@/lib/services/access-control-service";
import { requireRole } from "@/lib/services/auth-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function redirectWithFlash(status: "success" | "error", message: string): never {
  redirect(`/access-review?status=${status}&message=${encodeURIComponent(message)}`);
}

export async function approveStudentAccessFromReviewAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin", "moderator"]);

  if (!profileResult.ok) {
    redirectWithFlash("error", profileResult.error.message);
  }

  const studentId = String(formData.get("studentId") ?? "").trim();
  const expiresAt = String(formData.get("expiresAt") ?? "").trim() || undefined;

  const result = await approveStudentAccess({
    studentId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    expiresAt,
  });

  if (!result.ok) {
    redirectWithFlash("error", result.error.message);
  }

  revalidatePath("/access-review");
  redirectWithFlash("success", "Duyệt truy cập sinh viên thành công.");
}

export async function renewStudentAccessFromReviewAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin", "moderator"]);

  if (!profileResult.ok) {
    redirectWithFlash("error", profileResult.error.message);
  }

  const studentId = String(formData.get("studentId") ?? "").trim();
  const expiresAt = String(formData.get("expiresAt") ?? "").trim();

  const result = await renewStudentAccess({
    studentId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    expiresAt,
  });

  if (!result.ok) {
    redirectWithFlash("error", result.error.message);
  }

  revalidatePath("/access-review");
  redirectWithFlash("success", "Gia hạn truy cập sinh viên thành công.");
}

export async function reviewEnrollmentBatchAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["teacher"]);

  if (!profileResult.ok) {
    redirectWithFlash("error", profileResult.error.message);
  }

  const decisionRaw = String(formData.get("decision") ?? "").trim();
  const decision = decisionRaw === "rejected" ? "rejected" : "approved";
  const note = String(formData.get("note") ?? "").trim() || undefined;
  const requestIds = formData.getAll("requestId").map((value) => String(value).trim()).filter(Boolean);

  if (requestIds.length === 0) {
    redirectWithFlash("error", "Vui lòng chọn ít nhất một yêu cầu để duyệt.");
  }

  const result = await reviewEnrollmentRequestsBatch({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    decision,
    note,
    requests: requestIds.map((requestId) => ({ requestId })),
  });

  if (!result.ok) {
    redirectWithFlash("error", result.error.message);
  }

  revalidatePath("/access-review");
  redirectWithFlash("success", `Đã xử lý ${result.data.reviewed} yêu cầu, lỗi ${result.data.failed}.`);
}

export async function grantScopeAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    redirectWithFlash("error", profileResult.error.message);
  }

  const actorId = String(formData.get("targetActorId") ?? "").trim();
  const scopeType = String(formData.get("scopeType") ?? "").trim();
  const scopeId = String(formData.get("scopeId") ?? "").trim();

  if (!actorId || !scopeType) {
    redirectWithFlash("error", "Thiếu dữ liệu cấp phạm vi quyền.");
  }

  const permissions = {
    manage_course: formData.get("manageCourse") === "on",
    manage_class: formData.get("manageClass") === "on",
    manage_members: formData.get("manageMembers") === "on",
  };

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("permission_scopes").insert({
    actor_id: actorId,
    scope_type: scopeType,
    scope_id: scopeType === "system" ? null : scopeId,
    permissions,
    status: "active",
    granted_by: profileResult.data.id,
  });

  if (error) {
    redirectWithFlash("error", "Không thể cấp scope: " + error.message);
  }

  revalidatePath("/access-review");
  redirectWithFlash("success", "Cấp scope thành công.");
}

export async function revokeScopeAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    redirectWithFlash("error", profileResult.error.message);
  }

  const scopeId = String(formData.get("scopeId") ?? "").trim();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("permission_scopes")
    .update({ status: "revoked" })
    .eq("id", scopeId)
    .eq("status", "active");

  if (error) {
    redirectWithFlash("error", "Không thể thu hồi scope: " + error.message);
  }

  revalidatePath("/access-review");
  redirectWithFlash("success", "Thu hồi scope thành công.");
}
