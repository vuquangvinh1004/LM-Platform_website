import { beforeEach, describe, expect, it, vi } from "vitest";

import { upsertCourseAssessmentResultRepository } from "@/lib/repositories/question-bank-repository";
import {
  getAssessmentResultLifecycleContextRepository,
  upsertSubmissionRepository,
} from "@/lib/repositories/submission-repository";
import { syncAssessmentResultLifecycle } from "@/lib/services/assessment-result-lifecycle-service";

vi.mock("@/lib/repositories/submission-repository", () => ({
  getAssessmentResultLifecycleContextRepository: vi.fn(),
  upsertSubmissionRepository: vi.fn(),
}));

vi.mock("@/lib/repositories/question-bank-repository", () => ({
  upsertCourseAssessmentResultRepository: vi.fn(),
}));

const mockedGetAssessmentResultLifecycleContextRepository = vi.mocked(getAssessmentResultLifecycleContextRepository);
const mockedUpsertSubmissionRepository = vi.mocked(upsertSubmissionRepository);
const mockedUpsertCourseAssessmentResultRepository = vi.mocked(upsertCourseAssessmentResultRepository);

describe("assessment-result-lifecycle-service", () => {
  beforeEach(() => {
    mockedGetAssessmentResultLifecycleContextRepository.mockReset();
    mockedUpsertSubmissionRepository.mockReset();
    mockedUpsertCourseAssessmentResultRepository.mockReset();
  });

  it("creates missing rows for active roster members after due date", async () => {
    mockedGetAssessmentResultLifecycleContextRepository.mockResolvedValue({
      assessment: {
        id: "assessment-1",
        classId: "class-1",
        courseId: "course-1",
        title: "Quiz 1",
        deliveryMode: "external",
        dueAt: "2026-06-18T00:00:00.000Z",
        maxScore: 10,
      },
      roster: [
        {
          studentId: "student-1",
          studentIdentifier: "STU123",
          studentFullName: "Student One",
          studentCode: "STU123",
          studentEmail: "stu123@local.test",
        },
      ],
      submissions: [],
    });
    mockedUpsertSubmissionRepository.mockResolvedValue({ id: "submission-missing-1" });
    mockedUpsertCourseAssessmentResultRepository.mockResolvedValue();

    const result = await syncAssessmentResultLifecycle({
      assessmentId: "assessment-1",
    });

    expect(result.createdMissingCount).toBe(1);
    expect(mockedUpsertSubmissionRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentId: "assessment-1",
        studentId: "student-1",
        studentIdentifier: "STU123",
        status: "missing",
        source: "lifecycle",
      }),
    );
    expect(mockedUpsertCourseAssessmentResultRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: "submission-missing-1",
        status: "missing",
        source: "lifecycle",
      }),
    );
  });

  it("normalizes a late submission and mirrors it to aggregated results", async () => {
    mockedGetAssessmentResultLifecycleContextRepository.mockResolvedValue({
      assessment: {
        id: "assessment-1",
        classId: "class-1",
        courseId: "course-1",
        title: "Quiz 1",
        deliveryMode: "internal",
        dueAt: "2026-06-18T00:00:00.000Z",
        maxScore: 10,
      },
      roster: [
        {
          studentId: "student-1",
          studentIdentifier: "STU123",
          studentFullName: "Student One",
        },
      ],
      submissions: [
        {
          id: "submission-1",
          assessmentId: "assessment-1",
          studentId: "student-1",
          studentIdentifier: "STU123",
          rawScore: 8,
          maxScore: 10,
          normalizedScore: 80,
          submittedAt: "2026-06-19T00:00:00.000Z",
          status: "submitted",
          source: "internal",
          attemptNumber: 2,
          createdAt: "2026-06-19T00:00:00.000Z",
          metadata: {},
        },
      ],
    });
    mockedUpsertSubmissionRepository.mockResolvedValue({ id: "submission-1" });
    mockedUpsertCourseAssessmentResultRepository.mockResolvedValue();

    const result = await syncAssessmentResultLifecycle({
      assessmentId: "assessment-1",
    });

    expect(result.updatedStatusCount).toBe(1);
    expect(mockedUpsertSubmissionRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentId: "assessment-1",
        studentId: "student-1",
        attemptNumber: 2,
        status: "late",
        source: "internal",
      }),
    );
    expect(mockedUpsertCourseAssessmentResultRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: "submission-1",
        status: "late",
        source: "internal",
      }),
    );
  });
});
