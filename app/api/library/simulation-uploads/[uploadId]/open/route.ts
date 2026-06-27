import { NextResponse } from "next/server";

import { requireRole } from "@/lib/services/auth-service";
import { getSimulationUploadOpenUrl } from "@/lib/services/library-service";

type RouteContext = {
  params: Promise<{
    uploadId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { uploadId } = await context.params;
  const profileResult = await requireRole(["teacher", "moderator", "admin", "student"]);

  if (!profileResult.ok) {
    return NextResponse.json({ error: profileResult.error.message }, { status: 401 });
  }

  const openUrlResult = await getSimulationUploadOpenUrl({
    uploadId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!openUrlResult.ok) {
    const status = openUrlResult.error.code === "FORBIDDEN" ? 403 : openUrlResult.error.code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: openUrlResult.error.message }, { status });
  }

  const storageResponse = await fetch(openUrlResult.data, { cache: "no-store" });

  if (!storageResponse.ok) {
    return NextResponse.json({ error: "Không thể tải nội dung mô phỏng từ kho lưu trữ." }, { status: 502 });
  }

  const content = await storageResponse.arrayBuffer();

  return new Response(content, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "Content-Security-Policy":
        "sandbox allow-scripts allow-forms allow-popups allow-modals; default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; style-src 'self' https: 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:;",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
