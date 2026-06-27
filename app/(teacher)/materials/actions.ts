"use server";

import { revalidatePath } from "next/cache";

import type { MaterialActionState } from "@/app/(teacher)/materials/material-action-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/services/auth-service";
import { parseLibraryTags } from "@/lib/services/library-service";
import { createUploadIntent, registerUploadedMaterial } from "@/lib/services/material-service";

function resolveCourseIdForUpload(rawCourseId: FormDataEntryValue | null, actorRole: string): string | undefined {
  const courseId = String(rawCourseId ?? "").trim();

  if (courseId === "__other") {
    return undefined;
  }

  if (actorRole !== "teacher" && !courseId) {
    throw new Error("Mod/Admin cần chọn học phần hoặc Khác khi tải tài nguyên lên Thư viện.");
  }

  return courseId || undefined;
}

/**
 * Uploads a material file for the current teacher/admin and registers metadata atomically enough
 * to clean up the storage object if metadata persistence fails.
 */
export async function uploadMaterialAction(
  _prevState: MaterialActionState,
  formData: FormData,
): Promise<MaterialActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
    return {
      status: "error",
      message: "Bạn cần chọn một tệp hợp lệ để tải lên.",
    };
  }

  let courseId: string | undefined;

  try {
    courseId = resolveCourseIdForUpload(formData.get("courseId"), profileResult.data.role);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Học phần không hợp lệ.",
    };
  }

  const uploadIntentResult = await createUploadIntent({
    courseId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    fileName: fileEntry.name,
    fileType: fileEntry.type,
    fileSize: fileEntry.size,
  });

  if (!uploadIntentResult.ok) {
    return {
      status: "error",
      message: uploadIntentResult.error.message,
    };
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
      message: "Không thể tải tệp lên kho lưu trữ.",
    };
  }

  const registerResult = await registerUploadedMaterial({
    courseId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    categoryId: String(formData.get("categoryId") ?? "").trim() || undefined,
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    sectionLabel: String(formData.get("sectionLabel") ?? "").trim() || undefined,
    tags: parseLibraryTags(String(formData.get("tags") ?? "")),
    storageBucket,
    storagePath,
    fileName,
    fileType,
    fileSize,
    allowDownload: String(formData.get("allowDownload") ?? "") === "on",
  });

  if (!registerResult.ok) {
    await supabase.storage.from(storageBucket).remove([storagePath]);

    return {
      status: "error",
      message: registerResult.error.message,
    };
  }

  revalidatePath("/materials");
  revalidatePath("/library");

  return {
    status: "success",
    message:
      registerResult.data.reviewStatus === "pending_review"
        ? `Tài liệu ${registerResult.data.title} đã được tải lên và đang chờ Mod/Admin duyệt vào Thư viện dùng chung.`
        : profileResult.data.role === "teacher"
          ? `Tài liệu ${registerResult.data.title} đã được tải lên Thư viện cá nhân.`
          : `Tài liệu ${registerResult.data.title} đã được tải thẳng vào Thư viện.`,
  };
}
