"use server";

import { revalidatePath } from "next/cache";

import type { MaterialActionState } from "@/app/(teacher)/materials/material-action-state";
import { resolveMaterialCourseId, uploadMaterialCommand } from "@/lib/commands/material-commands";
import { requireRole } from "@/lib/services/auth-service";

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
    courseId = resolveMaterialCourseId(formData.get("courseId"), profileResult.data.role);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Học phần không hợp lệ.",
    };
  }

  const result = await uploadMaterialCommand({
    courseId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    fileEntry,
    categoryId: String(formData.get("categoryId") ?? "").trim() || undefined,
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    sectionLabel: String(formData.get("sectionLabel") ?? "").trim() || undefined,
    tagsText: String(formData.get("tags") ?? ""),
    allowDownload: String(formData.get("allowDownload") ?? "") === "on",
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/materials");
  revalidatePath("/library");

  return {
    status: "success",
    message: result.message,
  };
}
