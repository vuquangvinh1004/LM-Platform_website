import { requireRole } from "@/lib/services/auth-service";
import { reviewEnrollmentRequestsBatch } from "@/lib/services/enrollment-service";
import { toApiResponse } from "@/lib/utils/api-service-response";

type ReviewEnrollmentRequestsBatchBody = {
  decision: "approved" | "rejected";
  note?: string;
  requests: Array<{ requestId: string }>;
};

export async function POST(request: Request) {
  const profileResult = await requireRole(["teacher"]);

  if (!profileResult.ok) {
    return toApiResponse(profileResult);
  }

  let body: ReviewEnrollmentRequestsBatchBody;
  try {
    body = (await request.json()) as ReviewEnrollmentRequestsBatchBody;
  } catch {
    return toApiResponse({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Body JSON không hợp lệ.",
      },
    });
  }

  const result = await reviewEnrollmentRequestsBatch({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    decision: body.decision,
    note: body.note,
    requests: body.requests,
  });

  return toApiResponse(result);
}
