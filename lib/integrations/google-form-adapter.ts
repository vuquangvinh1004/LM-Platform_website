import type { ServiceResult } from "@/lib/types/service-result";

export type NormalizedExternalSubmission = {
  studentEmail?: string;
  studentCode?: string;
  fullName?: string;
  studentIdentifier: string;
  externalResponseId?: string;
  attemptNumber: number;
  rawScore?: number;
  maxScore?: number;
  submittedAt?: string;
  metadata?: Record<string, unknown>;
};

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function parseIsoDatetime(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

/**
 * Normalizes a Google Form webhook payload to internal submission shape.
 */
export function normalizeGoogleFormWebhookPayload(payload: unknown): ServiceResult<NormalizedExternalSubmission> {
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu webhook Google không hợp lệ.",
      },
    };
  }

  const raw = payload as {
    responseId?: unknown;
    submittedAt?: unknown;
    answers?: {
      email?: unknown;
      studentCode?: unknown;
      fullName?: unknown;
      score?: unknown;
      maxScore?: unknown;
      attempt?: unknown;
    };
  };

  const answers = raw.answers ?? {};
  const studentEmail = typeof answers.email === "string" ? answers.email.trim().toLowerCase() : undefined;
  const studentCode = typeof answers.studentCode === "string" ? answers.studentCode.trim() : undefined;
  const fullName = typeof answers.fullName === "string" ? answers.fullName.trim() : undefined;

  const studentIdentifier = studentCode || studentEmail;

  if (!studentIdentifier) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu webhook Google thiếu mã sinh viên hoặc email.",
      },
    };
  }

  const rawScore = parseNumber(answers.score);
  const maxScore = parseNumber(answers.maxScore);
  const submittedAt = parseIsoDatetime(raw.submittedAt);
  const attemptNumberRaw = parseNumber(answers.attempt);
  const attemptNumber = attemptNumberRaw && attemptNumberRaw >= 1 ? Math.floor(attemptNumberRaw) : 1;

  return {
    ok: true,
    data: {
      studentEmail,
      studentCode,
      fullName,
      studentIdentifier,
      externalResponseId: typeof raw.responseId === "string" ? raw.responseId.trim() || undefined : undefined,
      attemptNumber,
      rawScore,
      maxScore,
      submittedAt,
      metadata: {
        provider: "google_form",
      },
    },
  };
}
