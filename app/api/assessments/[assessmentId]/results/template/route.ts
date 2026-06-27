import { requireRole } from "@/lib/services/auth-service";
import { exportAssessmentResultsImportTemplate } from "@/lib/services/export-service";

export async function GET(request: Request) {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return new Response(JSON.stringify({ error: profileResult.error }), {
      status: profileResult.error.code === "UNAUTHORIZED" ? 401 : 403,
      headers: {
        "content-type": "application/json",
      },
    });
  }

  const url = new URL(request.url);
  const formatParam = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const template = exportAssessmentResultsImportTemplate(formatParam);

  return new Response(new Uint8Array(template.content), {
    status: 200,
    headers: {
      "content-type": template.contentType,
      "content-disposition": `attachment; filename="${template.fileName}"`,
      "cache-control": "no-store",
    },
  });
}
