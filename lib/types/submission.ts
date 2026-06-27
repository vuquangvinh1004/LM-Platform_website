export type SubmissionStatus = "submitted" | "late" | "missing" | "ignored";

export type SubmissionSource = "manual" | "internal" | "csv_import" | "google_webhook" | "microsoft_webhook" | "lifecycle";

export type ImportJobStatus = "pending" | "completed" | "partial" | "failed";

export type SubmissionImportRowError = {
  row: number;
  reason: string;
  email?: string;
  studentCode?: string;
  fullName?: string;
};

export type SubmissionImportResult = {
  importJobId: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  status: ImportJobStatus;
  errors: SubmissionImportRowError[];
};

export type SubmissionSummary = {
  id: string;
  assessmentId: string;
  studentId: string;
  studentFullName: string;
  studentEmail?: string;
  studentCode?: string;
  studentIdentifier: string;
  rawScore?: number;
  maxScore?: number;
  normalizedScore?: number;
  submittedAt?: string;
  status: SubmissionStatus;
  source: SubmissionSource;
  sourceLabel?: string;
  attemptNumber: number;
  externalResponseId?: string;
  note?: string;
  createdAt: string;
};

export type AssessmentResultsSortField =
  | "studentCode"
  | "studentFullName"
  | "studentEmail"
  | "rawScore"
  | "submittedAt"
  | "sourceLabel"
  | "note";

export type AssessmentResultsSortDirection = "asc" | "desc";
