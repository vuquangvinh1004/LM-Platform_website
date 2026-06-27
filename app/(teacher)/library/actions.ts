"use server";

import { revalidatePath } from "next/cache";

import type { LibraryActionState } from "@/app/(teacher)/library/library-action-state";
import {
  applyAdminLibraryResourceActionCommand,
  archiveLibraryCategoryCommand,
  createLibraryArchiveRequestCommand,
  deletePersonalLibraryResourceCommand,
  linkSimulationUploadToCourseCommand,
  resolveLibraryCourseId,
  uploadSimulationPackageCommand,
  requestNativeSimulationIntegrationCommand,
  reviewLibraryArchiveRequestCommand,
  reviewMaterialCommand,
  reviewNativeSimulationIntegrationCommand,
  reviewSimulationUploadCommand,
  upsertLibraryCategoryCommand,
} from "@/lib/commands/library-commands";
import { requireRole } from "@/lib/services/auth-service";

export async function uploadSimulationPackageAction(
  _prevState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
    return { status: "error", message: "Bạn cần chọn một tệp mô phỏng HTML hợp lệ." };
  }

  let courseId: string | undefined;

  try {
    courseId = resolveLibraryCourseId(formData.get("courseId"), profileResult.data.role);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Học phần không hợp lệ.",
    };
  }

  const result = await uploadSimulationPackageCommand({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    fileEntry,
    courseId,
    categoryId: String(formData.get("categoryId") ?? "").trim() || undefined,
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    tagsText: String(formData.get("tags") ?? ""),
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/library");

  return { status: "success", message: result.message };
}

export async function reviewMaterialAction(
  _prevState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const profileResult = await requireRole(["moderator", "admin"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const reviewStatus = String(formData.get("reviewStatus") ?? "");

  if (reviewStatus !== "approved" && reviewStatus !== "rejected") {
    return { status: "error", message: "Trạng thái duyệt tài liệu không hợp lệ." };
  }

  const result = await reviewMaterialCommand({
    materialId: String(formData.get("materialId") ?? ""),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    reviewStatus,
    reviewNote: String(formData.get("reviewNote") ?? "").trim() || undefined,
  });

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }

  revalidatePath("/library");

  return {
    status: "success",
    message:
      reviewStatus === "approved"
        ? "Tài liệu đã được duyệt."
        : "Tài liệu đã bị từ chối và đã được xóa khỏi Thư viện.",
  };
}

export async function upsertLibraryCategoryAction(
  _prevState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const profileResult = await requireRole(["moderator", "admin"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const sortOrderValue = Number(String(formData.get("sortOrder") ?? "0"));
  const result = await upsertLibraryCategoryCommand({
    categoryId: String(formData.get("categoryId") ?? "").trim() || undefined,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "").trim() || undefined,
    sortOrder: Number.isFinite(sortOrderValue) ? sortOrderValue : 0,
  });

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }

  revalidatePath("/library");
  revalidatePath("/materials");

  return {
    status: "success",
    message: `Đã lưu danh mục ${result.data.name}.`,
  };
}

export async function archiveLibraryCategoryAction(
  _prevState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const profileResult = await requireRole(["moderator", "admin"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const result = await archiveLibraryCategoryCommand({
    categoryId: String(formData.get("categoryId") ?? ""),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }

  revalidatePath("/library");
  revalidatePath("/materials");

  return {
    status: "success",
    message: `Đã lưu trữ danh mục ${result.data.name}.`,
  };
}

export async function reviewSimulationUploadAction(
  _prevState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const profileResult = await requireRole(["moderator", "admin"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const reviewStatus = String(formData.get("reviewStatus") ?? "");

  if (reviewStatus !== "approved" && reviewStatus !== "rejected") {
    return { status: "error", message: "Trạng thái duyệt không hợp lệ." };
  }

  const result = await reviewSimulationUploadCommand({
    uploadId: String(formData.get("uploadId") ?? ""),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    reviewStatus,
    reviewNote: String(formData.get("reviewNote") ?? "").trim() || undefined,
  });

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }

  revalidatePath("/library");

  return {
    status: "success",
    message: reviewStatus === "approved" ? "Mô phỏng đã được duyệt." : "Mô phỏng đã bị từ chối.",
  };
}

export async function linkSimulationUploadToCourseAction(
  _prevState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const result = await linkSimulationUploadToCourseCommand({
    uploadId: String(formData.get("uploadId") ?? ""),
    courseId: String(formData.get("courseId") ?? ""),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }

  revalidatePath("/library");
  revalidatePath(`/courses/${result.data.courseId}/simulations`);

  return {
    status: "success",
    message: `Đã gắn mô phỏng vào học phần ${result.data.courseCode || result.data.courseId}.`,
  };
}

export async function requestNativeSimulationIntegrationAction(
  _prevState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const result = await requestNativeSimulationIntegrationCommand({
    uploadId: String(formData.get("uploadId") ?? ""),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }

  revalidatePath("/library");

  return {
    status: "success",
    message: "Đã gửi đề xuất tích hợp native cho mô phỏng này.",
  };
}

export async function acceptNativeSimulationIntegrationAction(
  _prevState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const result = await reviewNativeSimulationIntegrationCommand({
    uploadId: String(formData.get("uploadId") ?? ""),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    nativeIntegrationStatus: "accepted",
    reviewNote: "Admin tích hợp native trực tiếp.",
  });

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }

  revalidatePath("/library");

  return {
    status: "success",
    message: `Đã nhận xử lý tích hợp native cho ${result.data.title}.`,
  };
}

export async function reviewNativeSimulationIntegrationAction(
  _prevState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const profileResult = await requireRole(["moderator", "admin"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const nativeIntegrationStatus = String(formData.get("nativeIntegrationStatus") ?? "");

  if (nativeIntegrationStatus !== "accepted" && nativeIntegrationStatus !== "rejected") {
    return { status: "error", message: "Trạng thái duyệt native không hợp lệ." };
  }

  const result = await reviewNativeSimulationIntegrationCommand({
    uploadId: String(formData.get("uploadId") ?? ""),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    nativeIntegrationStatus,
    reviewNote: String(formData.get("reviewNote") ?? "").trim() || undefined,
  });

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }

  revalidatePath("/library");

  return {
    status: "success",
    message:
      nativeIntegrationStatus === "accepted"
        ? `Đã nhận xử lý tích hợp native cho ${result.data.title}.`
        : `Đã từ chối tích hợp native cho ${result.data.title}.`,
  };
}

export async function applyAdminLibraryResourceActionForm(
  _prevState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const targetType = String(formData.get("targetType") ?? "");
  const action = String(formData.get("action") ?? "") === "delete" ? "delete" : "archive";

  if (targetType !== "material" && targetType !== "simulation") {
    return { status: "error", message: "Loại tài nguyên không hợp lệ." };
  }

  const result = await applyAdminLibraryResourceActionCommand({
    targetType,
    targetId: String(formData.get("targetId") ?? ""),
    action,
    actorRole: profileResult.data.role,
  });

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }

  revalidatePath("/library");

  return {
    status: "success",
    message: `Admin đã ${action === "delete" ? "xóa" : "ẩn"} tài nguyên trực tiếp.`,
  };
}

export async function createLibraryArchiveRequestAction(
  _prevState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const targetType = String(formData.get("targetType") ?? "");

  if (targetType !== "material" && targetType !== "simulation") {
    return { status: "error", message: "Loại tài nguyên cần ẩn không hợp lệ." };
  }

  const result = await createLibraryArchiveRequestCommand({
    targetType,
    targetId: String(formData.get("targetId") ?? ""),
    action: String(formData.get("action") ?? "") === "delete" ? "delete" : "archive",
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    reason: String(formData.get("reason") ?? "").trim() || undefined,
  });

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }

  revalidatePath("/library");

  return {
    status: "success",
    message: `Đã gửi yêu cầu ${result.data.action === "delete" ? "xóa" : "ẩn"} tài nguyên ${result.data.targetTitleSnapshot}.`,
  };
}

export async function deletePersonalLibraryResourceAction(
  _prevState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const profileResult = await requireRole(["teacher"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const targetType = String(formData.get("targetType") ?? "");

  if (targetType !== "material" && targetType !== "simulation_upload") {
    return { status: "error", message: "Loại tài nguyên cá nhân không hợp lệ." };
  }

  const result = await deletePersonalLibraryResourceCommand({
    targetType,
    targetId: String(formData.get("targetId") ?? ""),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }

  revalidatePath("/library");

  return {
    status: "success",
    message: "Đã xóa tài nguyên khỏi Thư viện cá nhân.",
  };
}

export async function reviewLibraryArchiveRequestAction(
  _prevState: LibraryActionState,
  formData: FormData,
): Promise<LibraryActionState> {
  const profileResult = await requireRole(["moderator", "admin"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const status = String(formData.get("status") ?? "");

  if (status !== "approved" && status !== "rejected") {
    return { status: "error", message: "Trạng thái duyệt không hợp lệ." };
  }

  const result = await reviewLibraryArchiveRequestCommand({
    requestId: String(formData.get("requestId") ?? ""),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    status,
    reviewNote: String(formData.get("reviewNote") ?? "").trim() || undefined,
  });

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }

  revalidatePath("/library");

  return {
    status: "success",
    message:
      status === "approved"
        ? `Đã duyệt và ${result.data.action === "delete" ? "xóa" : "ẩn"} tài nguyên ${result.data.targetTitleSnapshot}.`
        : `Đã từ chối yêu cầu ${result.data.action === "delete" ? "xóa" : "ẩn"} tài nguyên ${result.data.targetTitleSnapshot}.`,
  };
}
