export type EnrollmentRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type EnrollmentRequest = {
  id: string;
  studentId: string;
  courseId: string;
  classId: string | null;
  status: EnrollmentRequestStatus;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type EnrollmentRequestCreateItem = {
  courseId: string;
  classId?: string;
};

export type EnrollmentRequestBatchCreateResult = {
  created: number;
  skipped: number;
  duplicates: Array<{ courseId: string; classId?: string }>;
};

export type EnrollmentRequestBatchReviewResult = {
  reviewed: number;
  failed: number;
  results: Array<{
    requestId: string;
    ok: boolean;
    status?: "approved" | "rejected";
    errorCode?: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "UNKNOWN_ERROR";
    message?: string;
  }>;
};

export type EnrollmentRequestSummary = EnrollmentRequest & {
  studentFullName: string | null;
  studentEmail: string | null;
  studentCode: string | null;
  courseCode: string | null;
  courseTitle: string | null;
  classCode: string | null;
  classTitle: string | null;
};
