"use server";

import { revalidatePath } from "next/cache";

import type { LibraryActionState } from "@/app/(teacher)/library/library-action-state";
import { requireRole } from "@/lib/services/auth-service";
import {
  applyAdminLibraryResourceAction,
  archiveLibraryCategory,
  createLibraryArchiveRequest,
  createSimulationUploadIntent,
  deletePersonalLibraryResource,
  linkSimulationUploadToCourse,
  parseLibraryTags,
  registerSimulationUpload,
  reviewMaterial,
  requestNativeSimulationIntegration,
  reviewLibraryArchiveRequest,
  reviewNativeSimulationIntegration,
  reviewSimulationUpload,
  upsertLibraryCategory,
} from "@/lib/services/library-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function resolveCourseIdForLibraryUpload(rawCourseId: FormDataEntryValue | null, actorRole: string): string | undefined {
  const courseId = String(rawCourseId ?? "").trim();

  if (courseId === "__other") {
    return undefined;
  }

  if (actorRole !== "teacher" && !courseId) {
    throw new Error("Mod/Admin cần chọn học phần hoặc Khác khi tải tài nguyên lên Thư viện.");
  }

  return courseId || undefined;
}

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
    courseId = resolveCourseIdForLibraryUpload(formData.get("courseId"), profileResult.data.role);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Học phần không hợp lệ.",
    };
  }

  const uploadIntentResult = await createSimulationUploadIntent({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    fileName: fileEntry.name,
    fileType: fileEntry.type,
    fileSize: fileEntry.size,
  });

  if (!uploadIntentResult.ok) {
    return { status: "error", message: uploadIntentResult.error.message };
  }

  const supabase = await createServerSupabaseClient();
  const { storageBucket, storagePath, fileName, fileType, fileSize } = uploadIntentResult.data;
  const { error: uploadError } = await supabase.storage.from(storageBucket).upload(storagePath, fileEntry, {
    contentType: fileType,
    upsert: false,
  });

  if (uploadError) {
    return {
      status: "error",
      message:
        uploadError.message.includes("Bucket not found") || uploadError.message.includes("not found")
          ? "Chưa có bucket simulation-packages. Hãy áp dụng migration Supabase mới trước khi tải mô phỏng."
          : "Không thể tải tệp mô phỏng lên kho lưu trữ.",
    };
  }

  const registerResult = await registerSimulationUpload({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    fileName,
    fileType,
    fileSize,
    courseId,
    categoryId: String(formData.get("categoryId") ?? "").trim() || undefined,
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    tags: parseLibraryTags(String(formData.get("tags") ?? "")),
    storageBucket,
    storagePath,
  });

  if (!registerResult.ok) {
    await supabase.storage.from(storageBucket).remove([storagePath]);
    return { status: "error", message: registerResult.error.message };
  }

  revalidatePath("/library");

  return {
    status: "success",
    message:
      registerResult.data.reviewStatus === "pending_review"
        ? `Mô phỏng ${registerResult.data.title} đã được tải lên và đang chờ Mod/Admin duyệt vào Thư viện dùng chung.`
        : profileResult.data.role === "teacher"
          ? `Mô phỏng ${registerResult.data.title} đã được tải lên Thư viện cá nhân.`
          : `Mô phỏng ${registerResult.data.title} đã được tải thẳng vào Thư viện.`,
  };
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

  const result = await reviewMaterial({
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
  const result = await upsertLibraryCategory({
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

  const result = await archiveLibraryCategory({
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

  const result = await reviewSimulationUpload({
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

  const result = await linkSimulationUploadToCourse({
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

  const result = await requestNativeSimulationIntegration({
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

  const result = await reviewNativeSimulationIntegration({
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

  const result = await reviewNativeSimulationIntegration({
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

  const result = await applyAdminLibraryResourceAction({
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

  const result = await createLibraryArchiveRequest({
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

  const result = await deletePersonalLibraryResource({
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

  const result = await reviewLibraryArchiveRequest({
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
