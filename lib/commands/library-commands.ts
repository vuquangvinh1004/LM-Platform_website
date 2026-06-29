import {
  applyAdminLibraryResourceAction,
  archiveLibraryCategory,
  createLibraryArchiveRequest,
  createSimulationUploadIntent,
  deletePersonalLibraryResource,
  linkSimulationUploadToCourse,
  parseLibraryTags,
  registerSimulationUpload,
  reviewLibraryArchiveRequest,
  reviewMaterial,
  requestNativeSimulationIntegration,
  reviewNativeSimulationIntegration,
  reviewSimulationUpload,
  upsertLibraryCategory,
} from "@/lib/services/library-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/auth";

export function resolveLibraryCourseId(rawCourseId: FormDataEntryValue | null, actorRole: UserRole): string | undefined {
  const courseId = String(rawCourseId ?? "").trim();

  if (courseId === "__other") {
    return undefined;
  }

  if (actorRole !== "teacher" && !courseId) {
    throw new Error("GIÁM SÁT VIÊN/QUẢN TRỊ VIÊN cần chọn một học phần khi tải tài nguyên lên Thư viện.");
  }

  return courseId || undefined;
}

export async function createSimulationUploadIntentCommand(input: Parameters<typeof createSimulationUploadIntent>[0]) {
  return createSimulationUploadIntent(input);
}

export async function uploadSimulationPackageCommand(input: {
  actorId: string;
  actorRole: UserRole;
  fileEntry: File;
  courseId?: string;
  categoryId?: string;
  title: string;
  description?: string;
  tagsText: string;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const uploadIntentResult = await createSimulationUploadIntent({
    actorId: input.actorId,
    actorRole: input.actorRole,
    fileName: input.fileEntry.name,
    fileType: input.fileEntry.type,
    fileSize: input.fileEntry.size,
  });

  if (!uploadIntentResult.ok) {
    return { ok: false, message: uploadIntentResult.error.message };
  }

  const supabase = await createServerSupabaseClient();
  const { storageBucket, storagePath, fileName, fileType, fileSize } = uploadIntentResult.data;
  const { error: uploadError } = await supabase.storage.from(storageBucket).upload(storagePath, input.fileEntry, {
    contentType: fileType,
    upsert: false,
  });

  if (uploadError) {
    return {
      ok: false,
      message:
        uploadError.message.includes("Bucket not found") || uploadError.message.includes("not found")
          ? "Chưa có bucket simulation-packages. Hãy áp dụng migration Supabase mới trước khi tải mô phỏng."
          : "Không thể tải tệp mô phỏng lên kho lưu trữ.",
    };
  }

  const registerResult = await registerSimulationUpload({
    actorId: input.actorId,
    actorRole: input.actorRole,
    fileName,
    fileType,
    fileSize,
    courseId: input.courseId,
    categoryId: input.categoryId,
    title: input.title,
    description: input.description,
    tags: parseLibraryTags(input.tagsText),
    storageBucket,
    storagePath,
  });

  if (!registerResult.ok) {
    await supabase.storage.from(storageBucket).remove([storagePath]);
    return { ok: false, message: registerResult.error.message };
  }

  return {
    ok: true,
    message:
      registerResult.data.reviewStatus === "pending_review"
        ? `Mô phỏng ${registerResult.data.title} đã được tải lên và đang chờ GIÁM SÁT VIÊN/QUẢN TRỊ VIÊN duyệt vào Thư viện dùng chung.`
        : input.actorRole === "teacher"
          ? `Mô phỏng ${registerResult.data.title} đã được tải lên Thư viện cá nhân.`
          : `Mô phỏng ${registerResult.data.title} đã được tải thẳng vào Thư viện.`,
  };
}

export async function registerSimulationUploadCommand(input: Parameters<typeof registerSimulationUpload>[0]) {
  return registerSimulationUpload(input);
}

export async function reviewMaterialCommand(input: Parameters<typeof reviewMaterial>[0]) {
  return reviewMaterial(input);
}

export async function upsertLibraryCategoryCommand(input: Parameters<typeof upsertLibraryCategory>[0]) {
  return upsertLibraryCategory(input);
}

export async function archiveLibraryCategoryCommand(input: Parameters<typeof archiveLibraryCategory>[0]) {
  return archiveLibraryCategory(input);
}

export async function reviewSimulationUploadCommand(input: Parameters<typeof reviewSimulationUpload>[0]) {
  return reviewSimulationUpload(input);
}

export async function linkSimulationUploadToCourseCommand(input: Parameters<typeof linkSimulationUploadToCourse>[0]) {
  return linkSimulationUploadToCourse(input);
}

export async function requestNativeSimulationIntegrationCommand(input: Parameters<typeof requestNativeSimulationIntegration>[0]) {
  return requestNativeSimulationIntegration(input);
}

export async function reviewNativeSimulationIntegrationCommand(input: Parameters<typeof reviewNativeSimulationIntegration>[0]) {
  return reviewNativeSimulationIntegration(input);
}

export async function applyAdminLibraryResourceActionCommand(input: Parameters<typeof applyAdminLibraryResourceAction>[0]) {
  return applyAdminLibraryResourceAction(input);
}

export async function createLibraryArchiveRequestCommand(input: Parameters<typeof createLibraryArchiveRequest>[0]) {
  return createLibraryArchiveRequest(input);
}

export async function reviewLibraryArchiveRequestCommand(input: Parameters<typeof reviewLibraryArchiveRequest>[0]) {
  return reviewLibraryArchiveRequest(input);
}

export async function deletePersonalLibraryResourceCommand(input: Parameters<typeof deletePersonalLibraryResource>[0]) {
  return deletePersonalLibraryResource(input);
}

export { parseLibraryTags };
