import {
  completeImportJobRepository,
  createImportJobRepository,
  findAssessmentByIdServiceRepository,
  findManageableAssessmentRepository,
  findStudentForExternalSubmissionServiceRepository,
  findStudentsForSubmissionImportRepository,
  listAssessmentResultsRepository,
  upsertExternalSubmissionServiceRepository,
  upsertSubmissionRepository,
} from "@/lib/repositories/submission-repository";
import { syncAssessmentResultLifecycle } from "@/lib/services/assessment-result-lifecycle-service";
import { upsertCourseAssessmentResultRepository } from "@/lib/repositories/question-bank-repository";
import { createSystemActivityLogRepository } from "@/lib/repositories/activity-log-repository";
import {
  normalizeGoogleFormWebhookPayload,
  normalizeMicrosoftFormWebhookPayload,
} from "@/lib/integrations";
import { normalizeSpreadsheetHeader, readSpreadsheetMatrixFromBase64, readSpreadsheetMatrixFromCsv } from "@/lib/spreadsheets/spreadsheet-utils";
import type { Paginated } from "@/lib/types/pagination";
import type { ServiceResult } from "@/lib/types/service-result";
import type { ImportJobStatus, SubmissionImportResult, SubmissionImportRowError, SubmissionSummary } from "@/lib/types/submission";
import {
  getAssessmentResultsSchema,
  importSubmissionsFromCsvSchema,
  importSubmissionsFromSpreadsheetSchema,
  upsertExternalSubmissionSchema,
} from "@/lib/validators/submission-validator";

type SubmissionImportRow = {
  row: number;
  email?: string;
  studentCode?: string;
  fullName?: string;
  rawScore?: number;
  maxScore?: number;
  submittedAt?: string;
  sourceLabel?: string;
  note?: string;
  attemptNumber: number;
  externalResponseId?: string;
};

const emailHeaderAliases = new Set(["email", "e-mail", "mail"]);
const studentCodeHeaderAliases = new Set(["student code", "student_code", "studentcode", "student id", "student_id", "ma sinh vien", "ma_sv"]);
const fullNameHeaderAliases = new Set(["full name", "full_name", "fullname", "ho ten", "ho ten sinh vien", "ho_ten", "name"]);
const rawScoreHeaderAliases = new Set(["score", "raw score", "raw_score", "diem"]);
const maxScoreHeaderAliases = new Set(["max score", "max_score", "diem toi da", "total"]);
const submittedAtHeaderAliases = new Set(["submitted at", "submitted_at", "submittedat", "submit time", "thoi gian nop", "nop luc"]);
const sourceLabelHeaderAliases = new Set(["source", "nguon"]);
const noteHeaderAliases = new Set(["note", "notes", "ghi chu"]);
const attemptHeaderAliases = new Set(["attempt", "attempt_number", "attempt number", "lan nop", "lan_nop"]);
const externalResponseIdHeaderAliases = new Set(["external response id", "external_response_id", "response id", "response_id"]);

function parseNumber(input: string): number | undefined {
  const normalized = input.trim();

  if (!normalized) {
    return undefined;
  }

  const maybeNumber = Number(normalized.replace(/,/g, "."));
  if (Number.isNaN(maybeNumber)) {
    return undefined;
  }

  return maybeNumber;
}

function parseIsoDatetime(input: string): string | undefined {
  const normalized = input.trim();

  if (!normalized) {
    return undefined;
  }

  const normalizedDateTime = normalized
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const monthFirstMatch = normalizedDateTime.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2})(?::(\d{2}))(?::(\d{2}))?)?$/,
  );

  if (monthFirstMatch) {
    const [, month, day, year, hours = "0", minutes = "0", seconds = "0"] = monthFirstMatch;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
    );

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  const dayFirstMatch = normalizedDateTime.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4})(?:[ T](\d{1,2})(?::(\d{2}))(?::(\d{2}))?)?$/,
  );

  if (dayFirstMatch) {
    const [, day, month, year, hours = "0", minutes = "0", seconds = "0"] = dayFirstMatch;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
    );

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function parseSubmissionRowsFromMatrix(
  matrix: string[][],
): { rows: SubmissionImportRow[]; errors: SubmissionImportRowError[] } {
  const headerRow = matrix[0]?.map((cell) => normalizeSpreadsheetHeader(String(cell ?? ""))) ?? [];
  const emailIndex = headerRow.findIndex((value) => emailHeaderAliases.has(value));
  const studentCodeIndex = headerRow.findIndex((value) => studentCodeHeaderAliases.has(value));
  const fullNameIndex = headerRow.findIndex((value) => fullNameHeaderAliases.has(value));
  const rawScoreIndex = headerRow.findIndex((value) => rawScoreHeaderAliases.has(value));
  const maxScoreIndex = headerRow.findIndex((value) => maxScoreHeaderAliases.has(value));
  const submittedAtIndex = headerRow.findIndex((value) => submittedAtHeaderAliases.has(value));
  const sourceLabelIndex = headerRow.findIndex((value) => sourceLabelHeaderAliases.has(value));
  const noteIndex = headerRow.findIndex((value) => noteHeaderAliases.has(value));
  const attemptIndex = headerRow.findIndex((value) => attemptHeaderAliases.has(value));
  const externalResponseIdIndex = headerRow.findIndex((value) => externalResponseIdHeaderAliases.has(value));

  const expectedOrderedIndexes = [
    { index: studentCodeIndex, label: "Mã sinh viên" },
    { index: fullNameIndex, label: "Họ tên sinh viên" },
    { index: emailIndex, label: "Email" },
    { index: rawScoreIndex, label: "Điểm" },
    { index: submittedAtIndex, label: "Nộp lúc" },
    { index: sourceLabelIndex, label: "Nguồn" },
    { index: noteIndex, label: "Ghi chú" },
  ];

  const missingHeader = expectedOrderedIndexes.find((item) => item.index === -1);
  if (missingHeader) {
    throw new Error("Tệp import phải có đủ các cột theo thứ tự: Mã sinh viên, Họ tên sinh viên, Email, Điểm, Nộp lúc, Nguồn, Ghi chú.");
  }

  for (let idx = 1; idx < expectedOrderedIndexes.length; idx += 1) {
    if (expectedOrderedIndexes[idx - 1]!.index > expectedOrderedIndexes[idx]!.index) {
      throw new Error("Thứ tự cột import không hợp lệ. Vui lòng sắp xếp theo: Mã sinh viên, Họ tên sinh viên, Email, Điểm, Nộp lúc, Nguồn, Ghi chú.");
    }
  }

  if (rawScoreIndex === -1) {
    throw new Error("CSV phải có cột điểm: score, raw_score hoặc diem.");
  }

  const rows: SubmissionImportRow[] = [];
  const errors: SubmissionImportRowError[] = [];

  for (let idx = 1; idx < matrix.length; idx += 1) {
    const sourceRow = matrix[idx] ?? [];
    const rowNumber = idx + 1;

    const email = emailIndex === -1 ? undefined : String(sourceRow[emailIndex] ?? "").trim().toLowerCase() || undefined;
    const studentCode = studentCodeIndex === -1 ? undefined : String(sourceRow[studentCodeIndex] ?? "").trim() || undefined;
    const fullName = fullNameIndex === -1 ? undefined : String(sourceRow[fullNameIndex] ?? "").trim() || undefined;
    const rawScoreValue = String(sourceRow[rawScoreIndex] ?? "").trim();
    const sourceLabel = sourceLabelIndex === -1 ? undefined : String(sourceRow[sourceLabelIndex] ?? "").trim() || undefined;
    const note = noteIndex === -1 ? undefined : String(sourceRow[noteIndex] ?? "").trim() || undefined;

    if (!email && !studentCode && !fullName && !rawScoreValue && !sourceLabel && !note) {
      continue;
    }

    if (!studentCode) {
      errors.push({
        row: rowNumber,
        reason: "Thiếu mã sinh viên. Hệ thống dùng mã sinh viên làm khóa đối chiếu cố định khi import.",
        email,
        studentCode,
        fullName,
      });
      continue;
    }

    const rawScore = parseNumber(rawScoreValue);
    if (rawScore === undefined) {
      errors.push({
        row: rowNumber,
        reason: "Giá trị điểm không hợp lệ.",
        email,
        studentCode,
        fullName,
      });
      continue;
    }

    const maxScoreValue = maxScoreIndex === -1 ? "" : String(sourceRow[maxScoreIndex] ?? "").trim();
    const maxScore = maxScoreValue ? parseNumber(maxScoreValue) : undefined;

    if (maxScoreValue && maxScore === undefined) {
      errors.push({
        row: rowNumber,
        reason: "Giá trị điểm tối đa không hợp lệ.",
        email,
        studentCode,
        fullName,
      });
      continue;
    }

    const submittedAtValue = submittedAtIndex === -1 ? "" : String(sourceRow[submittedAtIndex] ?? "").trim();
    const submittedAt = submittedAtValue ? parseIsoDatetime(submittedAtValue) : undefined;

    if (submittedAtValue && !submittedAt) {
      errors.push({
        row: rowNumber,
        reason: "Giá trị thời gian nộp không hợp lệ.",
        email,
        studentCode,
        fullName,
      });
      continue;
    }

    const attemptValue = attemptIndex === -1 ? "" : String(sourceRow[attemptIndex] ?? "").trim();
    const attemptNumber = attemptValue ? Number.parseInt(attemptValue, 10) : 1;

    if (!Number.isFinite(attemptNumber) || attemptNumber < 1) {
      errors.push({
        row: rowNumber,
        reason: "Giá trị lần nộp không hợp lệ.",
        email,
        studentCode,
        fullName,
      });
      continue;
    }

    const externalResponseId = externalResponseIdIndex === -1
      ? undefined
      : String(sourceRow[externalResponseIdIndex] ?? "").trim() || undefined;

    rows.push({
      row: rowNumber,
      email,
      studentCode,
      fullName,
      rawScore,
      maxScore,
      submittedAt,
      sourceLabel,
      note,
      attemptNumber,
      externalResponseId,
    });
  }

  return { rows, errors };
}

function parseSubmissionRowsFromCsv(csvContent: string): { rows: SubmissionImportRow[]; errors: SubmissionImportRowError[] } {
  const matrix = readSpreadsheetMatrixFromCsv(csvContent, "Tệp CSV không hợp lệ hoặc không có dữ liệu.");
  return parseSubmissionRowsFromMatrix(matrix);
}

function parseSubmissionRowsFromSpreadsheet(fileContentBase64: string): { rows: SubmissionImportRow[]; errors: SubmissionImportRowError[] } {
  const matrix = readSpreadsheetMatrixFromBase64(fileContentBase64, "Tệp XLS/XLSX không hợp lệ hoặc không có dữ liệu.");
  return parseSubmissionRowsFromMatrix(matrix);
}

function resolveImportStatus(successRows: number, errorRows: number): ImportJobStatus {
  if (successRows === 0 && errorRows > 0) {
    return "failed";
  }

  if (errorRows > 0) {
    return "partial";
  }

  return "completed";
}

function getExpectedWebhookSecret(provider: "google_form" | "microsoft_form"): string | undefined {
  if (provider === "google_form") {
    return process.env.GOOGLE_FORM_WEBHOOK_SECRET;
  }

  return process.env.MICROSOFT_FORM_WEBHOOK_SECRET;
}

async function logWebhookEvent(input: {
  action: string;
  assessmentId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  try {
    await createSystemActivityLogRepository({
      action: input.action,
      entityType: "submission",
      entityId: input.assessmentId,
      metadata: input.metadata,
    });
  } catch {
    // Do not fail webhook flow due to activity log errors.
  }
}

async function logSubmissionImportEvent(input: {
  actorId: string;
  assessmentId: string;
  importJobId: string;
  status: ImportJobStatus;
  totalRows: number;
  successRows: number;
  errorRows: number;
}): Promise<void> {
  try {
    await createSystemActivityLogRepository({
      actorId: input.actorId,
      action: "submission.import_csv.completed",
      entityType: "submission",
      entityId: input.assessmentId,
      metadata: {
        importJobId: input.importJobId,
        status: input.status,
        totalRows: input.totalRows,
        successRows: input.successRows,
        errorRows: input.errorRows,
      },
    });
  } catch {
    // Activity log failure must not block import flow.
  }
}

/**
 * Imports CSV submissions with row-level error reporting and idempotent upsert semantics.
 */
export async function importSubmissionsFromCsv(
  input: Parameters<typeof importSubmissionsFromCsvSchema.parse>[0],
): Promise<ServiceResult<SubmissionImportResult>> {
  const parsedInput = importSubmissionsFromCsvSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu nhập bài nộp không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole !== "teacher" && parsedInput.data.actorRole !== "moderator" && parsedInput.data.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền nhập bài nộp.",
      },
    };
  }

  const manageableAssessment = await findManageableAssessmentRepository({
    assessmentId: parsedInput.data.assessmentId,
  });

  if (!manageableAssessment) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Không tìm thấy bài kiểm tra hoặc bạn không có quyền nhập bài nộp.",
      },
    };
  }

  let parsedRows: SubmissionImportRow[] = [];
  let rowErrors: SubmissionImportRowError[] = [];

  try {
    const parseResult = parseSubmissionRowsFromCsv(parsedInput.data.csvContent);
    parsedRows = parseResult.rows;
    rowErrors = parseResult.errors;
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error instanceof Error ? error.message : "Không thể phân tích tệp CSV.",
      },
    };
  }

  return importParsedSubmissionRows({
    assessmentId: parsedInput.data.assessmentId,
    actorId: parsedInput.data.actorId,
    actorRole: parsedInput.data.actorRole,
    parsedRows,
    rowErrors,
  });
}

export async function importSubmissionsFromSpreadsheet(
  input: Parameters<typeof importSubmissionsFromSpreadsheetSchema.parse>[0],
): Promise<ServiceResult<SubmissionImportResult>> {
  const parsedInput = importSubmissionsFromSpreadsheetSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu nhập bài nộp không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  let parsedRows: SubmissionImportRow[] = [];
  let rowErrors: SubmissionImportRowError[] = [];

  try {
    const parseResult = parseSubmissionRowsFromSpreadsheet(parsedInput.data.fileContentBase64);
    parsedRows = parseResult.rows;
    rowErrors = parseResult.errors;
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error instanceof Error ? error.message : "Không thể phân tích tệp CSV/XLSX.",
      },
    };
  }

  return importParsedSubmissionRows({
    assessmentId: parsedInput.data.assessmentId,
    actorId: parsedInput.data.actorId,
    actorRole: parsedInput.data.actorRole,
    parsedRows,
    rowErrors,
  });
}

async function importParsedSubmissionRows(input: {
  assessmentId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  parsedRows: SubmissionImportRow[];
  rowErrors: SubmissionImportRowError[];
}): Promise<ServiceResult<SubmissionImportResult>> {
  if (input.actorRole !== "teacher" && input.actorRole !== "moderator" && input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền nhập bài nộp.",
      },
    };
  }

  const manageableAssessment = await findManageableAssessmentRepository({
    assessmentId: input.assessmentId,
  });

  if (!manageableAssessment) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Không tìm thấy bài kiểm tra hoặc bạn không có quyền nhập bài nộp.",
      },
    };
  }

  const importJob = await createImportJobRepository({
    assessmentId: input.assessmentId,
    actorId: input.actorId,
    totalRows: input.parsedRows.length,
  });

  const studentProfiles = await findStudentsForSubmissionImportRepository({
    classId: manageableAssessment.classId,
    emails: input.parsedRows.map((row) => row.email ?? ""),
    studentCodes: input.parsedRows.map((row) => row.studentCode ?? ""),
  });

  const studentsByStudentCode = new Map<string, { id: string; email?: string }>();

  for (const profile of studentProfiles) {
    if (profile.studentCode) {
      studentsByStudentCode.set(profile.studentCode.toLowerCase(), { id: profile.id, email: profile.email });
    }
  }

  let successRows = 0;

  for (const row of input.parsedRows) {
    const studentByCode = row.studentCode ? studentsByStudentCode.get(row.studentCode.toLowerCase()) : undefined;
    const resolvedStudentId = studentByCode?.id;

    if (!resolvedStudentId) {
      input.rowErrors.push({
        row: row.row,
        reason: "Không tìm thấy sinh viên theo mã sinh viên trong danh sách lớp của bài kiểm tra.",
        email: row.email,
        studentCode: row.studentCode,
        fullName: row.fullName,
      });
      continue;
    }

    const studentIdentifier = row.studentCode ?? row.email ?? `student:${resolvedStudentId}`;
    const normalizedScore = row.maxScore && row.maxScore > 0
      ? Number(((row.rawScore ?? 0) / row.maxScore * 100).toFixed(4))
      : undefined;

    try {
      const submissionResult = await upsertSubmissionRepository({
        assessmentId: input.assessmentId,
        studentId: resolvedStudentId,
        studentIdentifier,
        attemptNumber: row.attemptNumber,
        rawScore: row.rawScore,
        maxScore: row.maxScore,
        normalizedScore,
        submittedAt: row.submittedAt,
        status: "submitted",
        source: "csv_import",
        importJobId: importJob.id,
        externalResponseId: row.externalResponseId,
        metadata: {
          importedFrom: "csv",
          row: row.row,
          email: row.email,
          studentCode: row.studentCode,
          fullName: row.fullName,
          sourceLabel: row.sourceLabel,
          importedSourceLabel: row.sourceLabel,
          note: row.note,
          importNote: row.note,
        },
      });

      await upsertCourseAssessmentResultRepository({
        courseId: manageableAssessment.courseId,
        classId: manageableAssessment.classId,
        assessmentId: input.assessmentId,
        submissionId: submissionResult.id,
        studentId: resolvedStudentId,
        studentIdentifier,
        attemptNumber: row.attemptNumber,
        rawScore: row.rawScore,
        maxScore: row.maxScore,
        normalizedScore,
        status: "submitted",
        source: "csv_import",
        submittedAt: row.submittedAt,
      });

      successRows += 1;
    } catch (error) {
      input.rowErrors.push({
        row: row.row,
        reason: error instanceof Error ? error.message : "Không thể ghi nhận bài nộp.",
        email: row.email,
        studentCode: row.studentCode,
        fullName: row.fullName,
      });
    }
  }

  const errorRows = input.rowErrors.length;
  const finalStatus = resolveImportStatus(successRows, errorRows);

  await completeImportJobRepository({
    importJobId: importJob.id,
    status: finalStatus,
    successRows,
    errorRows,
    errorReport: input.rowErrors,
  });

  await logSubmissionImportEvent({
    actorId: input.actorId,
    assessmentId: input.assessmentId,
    importJobId: importJob.id,
    status: finalStatus,
    totalRows: input.parsedRows.length,
    successRows,
    errorRows,
  });

  return {
    ok: true,
    data: {
      importJobId: importJob.id,
      totalRows: input.parsedRows.length,
      successRows,
      errorRows,
      status: finalStatus,
      errors: input.rowErrors,
    },
  };
}

/**
 * Upserts one webhook submission from Google/Microsoft forms with shared secret validation.
 */
export async function upsertExternalSubmission(
  input: Parameters<typeof upsertExternalSubmissionSchema.parse>[0],
): Promise<ServiceResult<{ submissionId: string; created: boolean; updated: boolean }>> {
  const parsedInput = upsertExternalSubmissionSchema.safeParse(input);
  const unsafeInput = input as {
    assessmentId?: unknown;
    provider?: unknown;
  };

  if (!parsedInput.success) {
    await logWebhookEvent({
      action: "submission.webhook.validation_failed",
      assessmentId: typeof unsafeInput.assessmentId === "string" ? unsafeInput.assessmentId : "unknown",
      metadata: {
        provider: typeof unsafeInput.provider === "string" ? unsafeInput.provider : "unknown",
        reason: "schema_validation_failed",
      },
    });

    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu webhook bài nộp không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const expectedSecret = getExpectedWebhookSecret(parsedInput.data.provider);

  if (!expectedSecret || parsedInput.data.sharedSecret !== expectedSecret) {
    await logWebhookEvent({
      action: "submission.webhook.rejected",
      assessmentId: parsedInput.data.assessmentId,
      metadata: {
        provider: parsedInput.data.provider,
        reason: "invalid_shared_secret",
      },
    });

    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Webhook secret không hợp lệ.",
      },
    };
  }

  try {
    const assessment = await findAssessmentByIdServiceRepository({
      assessmentId: parsedInput.data.assessmentId,
    });

    if (!assessment) {
      await logWebhookEvent({
        action: "submission.webhook.rejected",
        assessmentId: parsedInput.data.assessmentId,
        metadata: {
          provider: parsedInput.data.provider,
          reason: "assessment_not_found",
        },
      });

      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy bài kiểm tra để ghi nhận bài nộp từ webhook.",
        },
      };
    }

    const normalizedPayload = parsedInput.data.provider === "google_form"
      ? normalizeGoogleFormWebhookPayload(parsedInput.data.payload)
      : normalizeMicrosoftFormWebhookPayload(parsedInput.data.payload);

    if (!normalizedPayload.ok) {
      await logWebhookEvent({
        action: "submission.webhook.normalize_failed",
        assessmentId: parsedInput.data.assessmentId,
        metadata: {
          provider: parsedInput.data.provider,
          reason: normalizedPayload.error.message,
        },
      });

      return normalizedPayload;
    }

    const student = await findStudentForExternalSubmissionServiceRepository({
      studentEmail: normalizedPayload.data.studentEmail,
      studentCode: normalizedPayload.data.studentCode,
    });

    if (!student) {
      await logWebhookEvent({
        action: "submission.webhook.student_not_found",
        assessmentId: parsedInput.data.assessmentId,
        metadata: {
          provider: parsedInput.data.provider,
          studentEmail: normalizedPayload.data.studentEmail,
          studentCode: normalizedPayload.data.studentCode,
        },
      });

      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy sinh viên theo mã sinh viên hoặc email trong dữ liệu webhook.",
        },
      };
    }

    const normalizedScore = normalizedPayload.data.maxScore && normalizedPayload.data.maxScore > 0
      ? Number((((normalizedPayload.data.rawScore ?? 0) / normalizedPayload.data.maxScore) * 100).toFixed(4))
      : undefined;

    const upserted = await upsertExternalSubmissionServiceRepository({
      assessmentId: parsedInput.data.assessmentId,
      studentId: student.id,
      studentIdentifier: normalizedPayload.data.studentIdentifier,
      attemptNumber: normalizedPayload.data.attemptNumber,
      rawScore: normalizedPayload.data.rawScore,
      maxScore: normalizedPayload.data.maxScore,
      normalizedScore,
      submittedAt: normalizedPayload.data.submittedAt,
      source: parsedInput.data.provider === "google_form" ? "google_webhook" : "microsoft_webhook",
      externalResponseId: normalizedPayload.data.externalResponseId,
      metadata: {
        ...(normalizedPayload.data.metadata ?? {}),
        studentEmail: normalizedPayload.data.studentEmail,
        studentCode: normalizedPayload.data.studentCode,
        fullName: normalizedPayload.data.fullName,
        assessmentId: parsedInput.data.assessmentId,
      },
    });

    await upsertCourseAssessmentResultRepository({
      courseId: assessment.courseId,
      classId: assessment.classId,
      assessmentId: parsedInput.data.assessmentId,
      submissionId: upserted.id,
      studentId: student.id,
      studentIdentifier: normalizedPayload.data.studentIdentifier,
      attemptNumber: normalizedPayload.data.attemptNumber,
      rawScore: normalizedPayload.data.rawScore,
      maxScore: normalizedPayload.data.maxScore,
      normalizedScore,
      status: "submitted",
      source: parsedInput.data.provider === "google_form" ? "google_webhook" : "microsoft_webhook",
      submittedAt: normalizedPayload.data.submittedAt,
    });

    await logWebhookEvent({
      action: "submission.webhook.upserted",
      assessmentId: parsedInput.data.assessmentId,
      metadata: {
        provider: parsedInput.data.provider,
        submissionId: upserted.id,
        studentId: student.id,
        externalResponseId: normalizedPayload.data.externalResponseId,
        attemptNumber: normalizedPayload.data.attemptNumber,
      },
    });

    return {
      ok: true,
      data: {
        submissionId: upserted.id,
        created: true,
        updated: true,
      },
    };
  } catch (error) {
    await logWebhookEvent({
      action: "submission.webhook.exception",
      assessmentId: parsedInput.data.assessmentId,
      metadata: {
        provider: parsedInput.data.provider,
        reason: error instanceof Error ? error.message : String(error),
      },
    });

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể xử lý bài nộp từ webhook.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Returns teacher/moderator/admin assessment result rows with pagination.
 */
export async function getAssessmentResults(
  input: Parameters<typeof getAssessmentResultsSchema.parse>[0],
): Promise<ServiceResult<Paginated<SubmissionSummary>>> {
  const parsedInput = getAssessmentResultsSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu xem kết quả bài kiểm tra không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole !== "teacher" && parsedInput.data.actorRole !== "moderator" && parsedInput.data.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền xem kết quả bài kiểm tra.",
      },
    };
  }

  const manageableAssessment = await findManageableAssessmentRepository({
    assessmentId: parsedInput.data.assessmentId,
  });

  if (!manageableAssessment) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Không tìm thấy bài kiểm tra hoặc bạn không có quyền xem.",
      },
    };
  }

  try {
    await syncAssessmentResultLifecycle({
      assessmentId: parsedInput.data.assessmentId,
    });

    const result = await listAssessmentResultsRepository({
      assessmentId: parsedInput.data.assessmentId,
      page: parsedInput.data.page,
      pageSize: parsedInput.data.pageSize,
      status: parsedInput.data.status,
      sortBy: parsedInput.data.sortBy,
      sortDirection: parsedInput.data.sortDirection,
    });

    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải kết quả bài kiểm tra.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
