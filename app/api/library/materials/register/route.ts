import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/services/auth-service";
import { parseLibraryTags } from "@/lib/services/library-service";
import { registerUploadedMaterial } from "@/lib/services/material-service";

export async function POST(request: Request) {
  try {
    const profileResult = await requireRole(["teacher", "moderator", "admin"]);

    if (!profileResult.ok) {
      return NextResponse.json({ status: "error", message: profileResult.error.message }, { status: 403 });
    }

    const body = (await request.json()) as {
      courseId?: string;
      categoryId?: string;
      title?: string;
      description?: string;
      sectionLabel?: string;
      tags?: string;
      storageBucket?: "course-materials";
      storagePath?: string;
      fileName?: string;
      fileType?: string;
      fileSize?: number;
      allowDownload?: boolean;
    };

    const result = await registerUploadedMaterial({
      courseId: body.courseId?.trim() || undefined,
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
      categoryId: body.categoryId?.trim() || undefined,
      title: body.title?.trim() ?? "",
      description: body.description?.trim() || undefined,
      sectionLabel: body.sectionLabel?.trim() || undefined,
      tags: parseLibraryTags(body.tags ?? ""),
      storageBucket: body.storageBucket ?? "course-materials",
      storagePath: body.storagePath ?? "",
      fileName: body.fileName ?? "",
      fileType: body.fileType ?? "",
      fileSize: body.fileSize ?? 0,
      allowDownload: Boolean(body.allowDownload),
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          status: "error",
          message: result.error.message,
          details: result.error.details ? String(result.error.details) : undefined,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      status: "success",
      message:
        result.data.reviewStatus === "pending_review"
          ? `Tài liệu ${result.data.title} đã được tải lên và đang chờ GIÁM SÁT VIÊN/QUẢN TRỊ VIÊN duyệt vào Thư viện dùng chung.`
          : profileResult.data.role === "teacher"
            ? `Tài liệu ${result.data.title} đã được tải lên Thư viện cá nhân.`
            : `Tài liệu ${result.data.title} đã được tải thẳng vào Thư viện.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "Không thể lưu thông tin tài liệu sau khi tải lên.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
