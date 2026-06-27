import { upsertExternalSubmission } from "@/lib/services/submission-service";
import { toApiResponse } from "@/lib/utils/api-service-response";

type GoogleWebhookBody = {
  assessmentId?: string;
  payload?: unknown;
  sharedSecret?: string;
};

export async function POST(request: Request) {
  let body: GoogleWebhookBody;

  try {
    body = (await request.json()) as GoogleWebhookBody;
  } catch {
    return toApiResponse({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Body JSON không hợp lệ.",
      },
    });
  }

  const sharedSecretHeader = request.headers.get("x-webhook-secret") ?? undefined;

  const result = await upsertExternalSubmission({
    assessmentId: body.assessmentId ?? "",
    provider: "google_form",
    sharedSecret: sharedSecretHeader ?? body.sharedSecret ?? "",
    payload: body.payload,
  });

  return toApiResponse(result);
}
