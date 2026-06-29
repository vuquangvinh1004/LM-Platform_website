import { NextResponse } from "next/server";

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/services/auth-service";
import { parseLibraryTags } from "@/lib/services/library-service";
import { createUploadIntent, registerUploadedMaterial } from "@/lib/services/material-service";

function resolveCourseIdForUpload(rawCourseId: FormDataEntryValue | null, actorRole: string): string | undefined {
  const courseId = String(rawCourseId ?? "").trim();

  if (courseId === "__other") {
    return undefined;
  }

  if (actorRole !== "teacher" && !courseId) {
    throw new Error("GIÁM SÁT VIÊN/QUẢN TRỊ VIÊN cần chọn một học phần khi tải tài nguyên lên Thư viện.");
  }

  return courseId || undefined;
}

export async function POST(request: Request) {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return NextResponse.json({ status: "error", message: profileResult.error.message }, { status: 403 });
  }

  const formData = await request.formData();
  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
    return NextResponse.json({ status: "error", message: "Bạn cần chọn một tệp hợp lệ để tải lên." }, { status: 400 });
  }

  let courseId: string | undefined;

  try {
    courseId = resolveCourseIdForUpload(formData.get("courseId"), profileResult.data.role);
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Học phần không hợp lệ." },
      { status: 400 },
    );
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
    return NextResponse.json({ status: "error", message: uploadIntentResult.error.message }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();
  const { storageBucket, storagePath, fileName, fileType, fileSize } = uploadIntentResult.data;

  const { error: uploadError } = await supabase.storage.from(storageBucket).upload(storagePath, fileEntry, {
    contentType: fileType,
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json(
      {
        status: "error",
        message: "Không thể tải tệp lên kho lưu trữ.",
        details: uploadError.message,
      },
      { status: 500 },
    );
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

    return NextResponse.json({ status: "error", message: registerResult.error.message }, { status: 400 });
  }

  return NextResponse.json({
    status: "success",
    message:
      registerResult.data.reviewStatus === "pending_review"
        ? `Tài liệu ${registerResult.data.title} đã được tải lên và đang chờ GIÁM SÁT VIÊN/QUẢN TRỊ VIÊN duyệt vào Thư viện dùng chung.`
        : profileResult.data.role === "teacher"
          ? `Tài liệu ${registerResult.data.title} đã được tải lên Thư viện cá nhân.`
          : `Tài liệu ${registerResult.data.title} đã được tải thẳng vào Thư viện.`,
  });
}
