import type { ServiceResult } from "@/lib/types/service-result";

import type { NormalizedExternalSubmission } from "@/lib/integrations/google-form-adapter";

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
 * Normalizes a Microsoft Form webhook payload to internal submission shape.
 */
export function normalizeMicrosoftFormWebhookPayload(payload: unknown): ServiceResult<NormalizedExternalSubmission> {
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu webhook Microsoft không hợp lệ.",
      },
    };
  }

  const raw = payload as {
    id?: unknown;
    submittedAt?: unknown;
    respondentEmail?: unknown;
    studentCode?: unknown;
    studentName?: unknown;
    score?: unknown;
    maxScore?: unknown;
    attempt?: unknown;
  };

  const studentEmail = typeof raw.respondentEmail === "string" ? raw.respondentEmail.trim().toLowerCase() : undefined;
  const studentCode = typeof raw.studentCode === "string" ? raw.studentCode.trim() : undefined;
  const fullName = typeof raw.studentName === "string" ? raw.studentName.trim() : undefined;

  const studentIdentifier = studentCode || studentEmail;

  if (!studentIdentifier) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu webhook Microsoft thiếu mã sinh viên hoặc email.",
      },
    };
  }

  const rawScore = parseNumber(raw.score);
  const maxScore = parseNumber(raw.maxScore);
  const submittedAt = parseIsoDatetime(raw.submittedAt);
  const attemptNumberRaw = parseNumber(raw.attempt);
  const attemptNumber = attemptNumberRaw && attemptNumberRaw >= 1 ? Math.floor(attemptNumberRaw) : 1;

  return {
    ok: true,
    data: {
      studentEmail,
      studentCode,
      fullName,
      studentIdentifier,
      externalResponseId: typeof raw.id === "string" ? raw.id.trim() || undefined : undefined,
      attemptNumber,
      rawScore,
      maxScore,
      submittedAt,
      metadata: {
        provider: "microsoft_form",
      },
    },
  };
}
