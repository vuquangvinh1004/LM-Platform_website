import { requireRole } from "@/lib/services/auth-service";
import { reviewEnrollmentRequest } from "@/lib/services/enrollment-service";
import { toApiResponse } from "@/lib/utils/api-service-response";

type ReviewEnrollmentRequestBody = {
  decision: "approved" | "rejected";
  note?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const profileResult = await requireRole(["teacher"]);

  if (!profileResult.ok) {
    return toApiResponse(profileResult);
  }

  const { requestId } = await context.params;

  let body: ReviewEnrollmentRequestBody;
  try {
    body = (await request.json()) as ReviewEnrollmentRequestBody;
  } catch {
    return toApiResponse({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Body JSON không hợp lệ.",
      },
    });
  }

  const result = await reviewEnrollmentRequest({
    requestId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    decision: body.decision,
    note: body.note,
  });

  return toApiResponse(result);
}
