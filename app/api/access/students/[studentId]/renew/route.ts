import { requireRole } from "@/lib/services/auth-service";
import { renewStudentAccess } from "@/lib/services/access-control-service";
import { toApiResponse } from "@/lib/utils/api-service-response";

type RenewRequestBody = {
  expiresAt: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  const profileResult = await requireRole(["admin", "moderator", "teacher"]);

  if (!profileResult.ok) {
    return toApiResponse(profileResult);
  }

  const { studentId } = await context.params;

  let body: RenewRequestBody;
  try {
    body = (await request.json()) as RenewRequestBody;
  } catch {
    return toApiResponse({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Body JSON không hợp lệ.",
      },
    });
  }

  const result = await renewStudentAccess({
    studentId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    expiresAt: body.expiresAt,
  });

  return toApiResponse(result);
}
