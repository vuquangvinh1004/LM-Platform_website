import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createUploadIntent, registerUploadedMaterial } from "@/lib/services/material-service";
import { parseLibraryTags } from "@/lib/services/library-service";
import type { UserRole } from "@/lib/types/auth";

export function resolveMaterialCourseId(rawCourseId: FormDataEntryValue | null, actorRole: UserRole): string | undefined {
  const courseId = String(rawCourseId ?? "").trim();

  if (courseId === "__other") {
    return undefined;
  }

  if (actorRole !== "teacher" && !courseId) {
    throw new Error("GIÁM SÁT VIÊN/QUẢN TRỊ VIÊN cần chọn một học phần khi tải tài nguyên lên Thư viện.");
  }

  return courseId || undefined;
}

export async function uploadMaterialCommand(input: {
  courseId?: string;
  actorId: string;
  actorRole: UserRole;
  fileEntry: File;
  categoryId?: string;
  title: string;
  description?: string;
  sectionLabel?: string;
  tagsText: string;
  allowDownload: boolean;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const uploadIntentResult = await createUploadIntent({
    courseId: input.courseId,
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
    return { ok: false, message: "Không thể tải tệp lên kho lưu trữ." };
  }

  const registerResult = await registerUploadedMaterial({
    courseId: input.courseId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    categoryId: input.categoryId,
    title: input.title,
    description: input.description,
    sectionLabel: input.sectionLabel,
    tags: parseLibraryTags(input.tagsText),
    storageBucket,
    storagePath,
    fileName,
    fileType,
    fileSize,
    allowDownload: input.allowDownload,
  });

  if (!registerResult.ok) {
    await supabase.storage.from(storageBucket).remove([storagePath]);
    return { ok: false, message: registerResult.error.message };
  }

  return {
    ok: true,
    message:
      registerResult.data.reviewStatus === "pending_review"
        ? `Tài liệu ${registerResult.data.title} đã được tải lên và đang chờ GIÁM SÁT VIÊN/QUẢN TRỊ VIÊN duyệt vào Thư viện dùng chung.`
        : input.actorRole === "teacher"
          ? `Tài liệu ${registerResult.data.title} đã được tải lên Thư viện cá nhân.`
          : `Tài liệu ${registerResult.data.title} đã được tải thẳng vào Thư viện.`,
  };
}
