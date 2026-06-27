import { z } from "zod";

export const importSubmissionsFromCsvSchema = z.object({
  assessmentId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  csvContent: z.string().min(1),
});

export const importSubmissionsFromSpreadsheetSchema = z.object({
  assessmentId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  fileName: z.string().trim().min(1),
  fileContentBase64: z.string().min(1),
});

export const upsertExternalSubmissionSchema = z.object({
  assessmentId: z.string().uuid(),
  provider: z.enum(["google_form", "microsoft_form"]),
  sharedSecret: z.string().min(1),
  payload: z.unknown(),
});

export const getAssessmentResultsSchema = z.object({
  assessmentId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(20),
  status: z.enum(["submitted", "late", "missing", "ignored"]).optional(),
  sortBy: z.enum(["studentCode", "studentFullName", "studentEmail", "rawScore", "submittedAt", "sourceLabel", "note"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
});
