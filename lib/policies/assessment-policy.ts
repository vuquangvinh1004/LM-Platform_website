import type { AssessmentStatus, AssessmentSummary, StudentAssessmentSummary } from "@/lib/types/assessment";

export type AssessmentStartGateInput = {
  assessment: Pick<AssessmentSummary, "status" | "openAt" | "dueAt" | "attemptLimit">;
  now: number;
  usedAttempts: number;
  activeAttemptStatus?: string | null;
  activeAttemptExpiresAt?: string | null;
};

export function toTimestamp(value?: string): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isDraftAssessment(status: AssessmentStatus): boolean {
  return status === "draft";
}

export function isArchivedAssessment(status: AssessmentStatus): boolean {
  return status === "archived";
}

export function isClosedAssessment(status: AssessmentStatus): boolean {
  return status === "closed";
}

export function getStudentAssessmentListStatus(input: {
  assessment: AssessmentSummary;
  completedAssessmentIds: Set<string>;
  now: number;
}): StudentAssessmentSummary["studentListStatus"] {
  if (input.completedAssessmentIds.has(input.assessment.id)) {
    return "completed";
  }

  const openAt = toTimestamp(input.assessment.openAt);
  const dueAt = toTimestamp(input.assessment.dueAt);

  if (isDraftAssessment(input.assessment.status)) {
    return "available";
  }

  if (openAt !== null && openAt > input.now) {
    return "upcoming";
  }

  if ((dueAt !== null && dueAt < input.now) || isClosedAssessment(input.assessment.status)) {
    return "overdue";
  }

  return "available";
}

export function getAssessmentStartBlockedReason(input: AssessmentStartGateInput): string | undefined {
  const openAt = toTimestamp(input.assessment.openAt);
  const dueAt = toTimestamp(input.assessment.dueAt);
  const isDraft = isDraftAssessment(input.assessment.status);

  if (isArchivedAssessment(input.assessment.status)) {
    return "Bài kiểm tra này hiện không còn khả dụng.";
  }

  if (isClosedAssessment(input.assessment.status)) {
    return "Bài kiểm tra này đã được giảng viên đóng.";
  }

  if (!isDraft && openAt !== null && openAt > input.now) {
    return "Chưa đến thời điểm mở bài kiểm tra.";
  }

  if (!isDraft && dueAt !== null && dueAt < input.now) {
    return "Đã quá thời hạn làm bài.";
  }

  if (input.usedAttempts >= input.assessment.attemptLimit) {
    return "Bạn đã dùng hết số lượt làm bài.";
  }

  if (input.activeAttemptStatus === "in_progress" && input.activeAttemptExpiresAt) {
    const expiresAt = toTimestamp(input.activeAttemptExpiresAt);
    if (expiresAt !== null && expiresAt <= input.now) {
      return "Đã hết thời gian làm bài.";
    }
  }

  return undefined;
}

export function canStartAssessment(input: AssessmentStartGateInput): boolean {
  return getAssessmentStartBlockedReason(input) === undefined;
}

