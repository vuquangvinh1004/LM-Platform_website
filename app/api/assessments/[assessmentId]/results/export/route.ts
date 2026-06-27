import { requireRole } from "@/lib/services/auth-service";
import { exportAssessmentResults } from "@/lib/services/export-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ assessmentId: string }> },
) {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return new Response(JSON.stringify({ error: profileResult.error }), {
      status: profileResult.error.code === "UNAUTHORIZED" ? 401 : 403,
      headers: {
        "content-type": "application/json",
      },
    });
  }

  const { assessmentId } = await context.params;
  const url = new URL(request.url);
  const formatParam = url.searchParams.get("format") ?? "csv";
  const statusParam = url.searchParams.get("status") ?? undefined;
  const sortByParam = url.searchParams.get("sortBy") ?? undefined;
  const sortDirectionParam = url.searchParams.get("sortDirection") ?? undefined;

  const exportResult = await exportAssessmentResults({
    assessmentId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    format: formatParam === "xlsx" ? "xlsx" : "csv",
    status: statusParam === "submitted" || statusParam === "late" || statusParam === "missing" || statusParam === "ignored"
      ? statusParam
      : undefined,
    sortBy: sortByParam === "studentCode"
      || sortByParam === "studentFullName"
      || sortByParam === "studentEmail"
      || sortByParam === "rawScore"
      || sortByParam === "submittedAt"
      || sortByParam === "sourceLabel"
      || sortByParam === "note"
      ? sortByParam
      : undefined,
    sortDirection: sortDirectionParam === "asc" || sortDirectionParam === "desc" ? sortDirectionParam : undefined,
  });

  if (!exportResult.ok) {
    const statusCode = exportResult.error.code === "VALIDATION_ERROR"
      ? 400
      : exportResult.error.code === "FORBIDDEN"
        ? 403
        : exportResult.error.code === "NOT_FOUND"
          ? 404
          : 500;

    return new Response(JSON.stringify({ error: exportResult.error }), {
      status: statusCode,
      headers: {
        "content-type": "application/json",
      },
    });
  }

  return new Response(new Uint8Array(exportResult.data.content), {
    status: 200,
    headers: {
      "content-type": exportResult.data.contentType,
      "content-disposition": `attachment; filename="${exportResult.data.fileName}"`,
      "cache-control": "no-store",
    },
  });
}
