import { NextResponse } from "next/server";

import { requireRole } from "@/lib/services/auth-service";
import { createUploadIntent } from "@/lib/services/material-service";

export async function POST(request: Request) {
  try {
    const profileResult = await requireRole(["teacher", "moderator", "admin"]);

    if (!profileResult.ok) {
      return NextResponse.json({ status: "error", message: profileResult.error.message }, { status: 403 });
    }

    const body = (await request.json()) as {
      courseId?: string;
      fileName?: string;
      fileType?: string;
      fileSize?: number;
    };

    const result = await createUploadIntent({
      courseId: body.courseId?.trim() || undefined,
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
      fileName: body.fileName ?? "",
      fileType: body.fileType ?? "",
      fileSize: body.fileSize ?? 0,
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

    return NextResponse.json({ status: "success", data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "Không thể tạo yêu cầu tải tài liệu.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
