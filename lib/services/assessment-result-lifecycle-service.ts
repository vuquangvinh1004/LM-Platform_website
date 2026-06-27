import { upsertCourseAssessmentResultRepository } from "@/lib/repositories/question-bank-repository";
import {
  getAssessmentResultLifecycleContextRepository,
  upsertSubmissionRepository,
} from "@/lib/repositories/submission-repository";
import type { SubmissionSource, SubmissionStatus } from "@/lib/types/submission";

function getLatestSubmissionByStudent<T extends {
  studentId: string;
  attemptNumber: number;
  submittedAt?: string;
  createdAt: string;
}>(rows: T[]): Map<string, T> {
  const latestByStudent = new Map<string, T>();

  for (const row of rows) {
    const current = latestByStudent.get(row.studentId);

    if (!current) {
      latestByStudent.set(row.studentId, row);
      continue;
    }

    if (row.attemptNumber > current.attemptNumber) {
      latestByStudent.set(row.studentId, row);
      continue;
    }

    if (row.attemptNumber < current.attemptNumber) {
      continue;
    }

    const rowTime = new Date(row.submittedAt ?? row.createdAt).getTime();
    const currentTime = new Date(current.submittedAt ?? current.createdAt).getTime();

    if (rowTime > currentTime) {
      latestByStudent.set(row.studentId, row);
    }
  }

  return latestByStudent;
}

function hasLifecycleIgnoreFlag(metadata: Record<string, unknown>): boolean {
  return metadata.lifecycleIgnored === true || metadata.excludedFromStats === true;
}

function normalizeExistingSubmissionStatus(input: {
  status: SubmissionStatus;
  submittedAt?: string;
  dueAt?: string;
  metadata: Record<string, unknown>;
}): SubmissionStatus {
  if (input.status === "ignored" || hasLifecycleIgnoreFlag(input.metadata)) {
    return "ignored";
  }

  if (!input.submittedAt) {
    return "missing";
  }

  if (input.dueAt && new Date(input.submittedAt).getTime() > new Date(input.dueAt).getTime()) {
    return "late";
  }

  return "submitted";
}

function getLifecycleSource(deliveryMode: "external" | "internal"): SubmissionSource {
  return deliveryMode === "internal" ? "internal" : "lifecycle";
}

/**
 * Synchronizes one assessment result set against the active class roster.
 * This keeps final reporting rows aligned for teacher results, dashboard and export.
 */
export async function syncAssessmentResultLifecycle(input: {
  assessmentId: string;
}): Promise<{
  assessmentId: string;
  createdMissingCount: number;
  updatedStatusCount: number;
  ignoredCount: number;
}> {
  const context = await getAssessmentResultLifecycleContextRepository({
    assessmentId: input.assessmentId,
  });

  if (!context) {
    return {
      assessmentId: input.assessmentId,
      createdMissingCount: 0,
      updatedStatusCount: 0,
      ignoredCount: 0,
    };
  }

  const dueAt = context.assessment.dueAt;
  const now = Date.now();
  const isPastDue = dueAt ? now > new Date(dueAt).getTime() : false;
  const latestByStudent = getLatestSubmissionByStudent(context.submissions);

  let createdMissingCount = 0;
  let updatedStatusCount = 0;
  let ignoredCount = 0;

  for (const member of context.roster) {
    const latestSubmission = latestByStudent.get(member.studentId);

    if (!latestSubmission) {
      if (!isPastDue) {
        continue;
      }

      const createdSubmission = await upsertSubmissionRepository({
        assessmentId: context.assessment.id,
        studentId: member.studentId,
        studentIdentifier: member.studentIdentifier,
        attemptNumber: 1,
        rawScore: 0,
        maxScore: context.assessment.maxScore,
        normalizedScore: 0,
        submittedAt: undefined,
        status: "missing",
        source: getLifecycleSource(context.assessment.deliveryMode),
        metadata: {
          lifecycleGenerated: true,
          lifecycleReason: "missing_after_due_at",
        },
      });

      await upsertCourseAssessmentResultRepository({
        courseId: context.assessment.courseId,
        classId: context.assessment.classId,
        assessmentId: context.assessment.id,
        submissionId: createdSubmission.id,
        studentId: member.studentId,
        studentIdentifier: member.studentIdentifier,
        attemptNumber: 1,
        rawScore: 0,
        maxScore: context.assessment.maxScore,
        normalizedScore: 0,
        status: "missing",
        source: getLifecycleSource(context.assessment.deliveryMode),
      });

      createdMissingCount += 1;
      continue;
    }

    const normalizedStatus = normalizeExistingSubmissionStatus({
      status: latestSubmission.status,
      submittedAt: latestSubmission.submittedAt,
      dueAt,
      metadata: latestSubmission.metadata,
    });

    if (normalizedStatus === "ignored") {
      ignoredCount += 1;
    }

    const desiredMetadata = {
      ...latestSubmission.metadata,
      lifecycleNormalized: true,
      lifecycleNormalizedAt: new Date().toISOString(),
    };

    if (
      normalizedStatus !== latestSubmission.status
      || desiredMetadata.lifecycleNormalized !== latestSubmission.metadata.lifecycleNormalized
    ) {
      await upsertSubmissionRepository({
        assessmentId: latestSubmission.assessmentId,
        studentId: latestSubmission.studentId,
        studentIdentifier: latestSubmission.studentIdentifier,
        attemptNumber: latestSubmission.attemptNumber,
        rawScore: latestSubmission.rawScore,
        maxScore: latestSubmission.maxScore,
        normalizedScore: latestSubmission.normalizedScore,
        submittedAt: latestSubmission.submittedAt,
        status: normalizedStatus,
        source: latestSubmission.source,
        externalResponseId: latestSubmission.externalResponseId,
        metadata: desiredMetadata,
      });

      updatedStatusCount += 1;
    }

    await upsertCourseAssessmentResultRepository({
      courseId: context.assessment.courseId,
      classId: context.assessment.classId,
      assessmentId: context.assessment.id,
      submissionId: latestSubmission.id,
      studentId: latestSubmission.studentId,
      studentIdentifier: latestSubmission.studentIdentifier,
      attemptNumber: latestSubmission.attemptNumber,
      rawScore: latestSubmission.rawScore,
      maxScore: latestSubmission.maxScore,
      normalizedScore: latestSubmission.normalizedScore,
      status: normalizedStatus,
      source: latestSubmission.source,
      submittedAt: latestSubmission.submittedAt,
    });
  }

  return {
    assessmentId: context.assessment.id,
    createdMissingCount,
    updatedStatusCount,
    ignoredCount,
  };
}
