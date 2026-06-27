import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAssessmentAttemptRepository,
  findStudentAssessmentAttemptRepository,
  getAssessmentAttemptGradingRepository,
  getInternalAssessmentDefinitionRepository,
  listAssessmentAttemptsForGradingRepository,
  upsertAssessmentAnswerRepository,
  upsertAssessmentAnswerScoreRepository,
  updateAssessmentAttemptStatusRepository,
} from "@/lib/repositories/assessment-runtime-repository";
import { getAssessmentSummaryRepository } from "@/lib/repositories/assessment-repository";
import { upsertCourseAssessmentResultRepository } from "@/lib/repositories/question-bank-repository";
import { findStudentProfilesByIdsServiceRepository, upsertSubmissionRepository } from "@/lib/repositories/submission-repository";
import {
  finalizeAssessmentSubmission,
  getAssessmentAttemptForStudent,
  getStudentAssessmentReview,
  listAssessmentAttemptsForGrading,
  saveAssessmentAnswer,
  startExternalAssessmentAttempt,
  startAssessmentAttempt,
  submitAssessmentAttempt,
} from "@/lib/services/assessment-runtime-service";

vi.mock("@/lib/repositories/assessment-runtime-repository", () => ({
  createAssessmentAttemptRepository: vi.fn(),
  findStudentAssessmentAttemptRepository: vi.fn(),
  getAssessmentAttemptGradingRepository: vi.fn(),
  getInternalAssessmentDefinitionRepository: vi.fn(),
  listAssessmentAttemptsForGradingRepository: vi.fn(),
  upsertAssessmentAnswerRepository: vi.fn(),
  upsertAssessmentAnswerScoreRepository: vi.fn(),
  updateAssessmentAttemptStatusRepository: vi.fn(),
}));

vi.mock("@/lib/repositories/question-bank-repository", () => ({
  upsertCourseAssessmentResultRepository: vi.fn(),
}));

vi.mock("@/lib/repositories/assessment-repository", () => ({
  getAssessmentSummaryRepository: vi.fn(),
}));

vi.mock("@/lib/repositories/submission-repository", () => ({
  findStudentProfilesByIdsServiceRepository: vi.fn(),
  upsertSubmissionRepository: vi.fn(),
}));

const mockedCreateAssessmentAttemptRepository = vi.mocked(createAssessmentAttemptRepository);
const mockedFindStudentAssessmentAttemptRepository = vi.mocked(findStudentAssessmentAttemptRepository);
const mockedGetAssessmentAttemptGradingRepository = vi.mocked(getAssessmentAttemptGradingRepository);
const mockedGetInternalAssessmentDefinitionRepository = vi.mocked(getInternalAssessmentDefinitionRepository);
const mockedListAssessmentAttemptsForGradingRepository = vi.mocked(listAssessmentAttemptsForGradingRepository);
const mockedUpsertAssessmentAnswerRepository = vi.mocked(upsertAssessmentAnswerRepository);
const mockedUpsertAssessmentAnswerScoreRepository = vi.mocked(upsertAssessmentAnswerScoreRepository);
const mockedUpdateAssessmentAttemptStatusRepository = vi.mocked(updateAssessmentAttemptStatusRepository);
const mockedGetAssessmentSummaryRepository = vi.mocked(getAssessmentSummaryRepository);
const mockedUpsertCourseAssessmentResultRepository = vi.mocked(upsertCourseAssessmentResultRepository);
const mockedFindStudentProfilesByIdsServiceRepository = vi.mocked(findStudentProfilesByIdsServiceRepository);
const mockedUpsertSubmissionRepository = vi.mocked(upsertSubmissionRepository);

const internalDefinition = {
  assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  classId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  classCode: "CLS-A",
  classTitle: "A-Test",
  courseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  courseCode: "COURSE-A",
  courseTitle: "Course A",
  title: "Internal Quiz",
  status: "open" as const,
  attemptLimit: 2,
  shuffleQuestions: false,
  showFeedbackAfterSubmit: false,
  timeLimitMinutes: 30,
  openAt: "2026-06-19T00:00:00.000Z",
  dueAt: "2099-06-20T00:00:00.000Z",
  questions: [
    {
      questionBankItemId: "11111111-1111-4111-8111-111111111111",
      sortOrder: 1,
      prompt: "2 + 2 = ?",
      questionType: "multiple_choice" as const,
      choices: ["3", "4", "5"],
      answerKey: "4",
      explanation: null,
      points: 2,
    },
    {
      questionBankItemId: "22222222-2222-4222-8222-222222222222",
      sortOrder: 2,
      prompt: "Viết ngắn cảm nhận",
      questionType: "essay" as const,
      choices: [],
      answerKey: null,
      explanation: null,
      points: 3,
    },
  ],
};

describe("assessment-runtime-service", () => {
  beforeEach(() => {
    mockedCreateAssessmentAttemptRepository.mockReset();
    mockedFindStudentAssessmentAttemptRepository.mockReset();
    mockedGetAssessmentAttemptGradingRepository.mockReset();
    mockedGetInternalAssessmentDefinitionRepository.mockReset();
    mockedListAssessmentAttemptsForGradingRepository.mockReset();
    mockedUpsertAssessmentAnswerRepository.mockReset();
    mockedUpsertAssessmentAnswerScoreRepository.mockReset();
    mockedUpdateAssessmentAttemptStatusRepository.mockReset();
    mockedGetAssessmentSummaryRepository.mockReset();
    mockedUpsertCourseAssessmentResultRepository.mockReset();
    mockedFindStudentProfilesByIdsServiceRepository.mockReset();
    mockedUpsertSubmissionRepository.mockReset();

    mockedGetInternalAssessmentDefinitionRepository.mockResolvedValue(internalDefinition);
    mockedGetAssessmentSummaryRepository.mockResolvedValue({
      id: internalDefinition.assessmentId,
      classId: internalDefinition.classId,
      courseId: internalDefinition.courseId,
      classCode: internalDefinition.classCode,
      classTitle: internalDefinition.classTitle,
      courseCode: internalDefinition.courseCode,
      courseTitle: internalDefinition.courseTitle,
      title: internalDefinition.title,
      deliveryMode: "external",
      provider: "google_form",
      embedMode: "new_tab",
      attemptLimit: 1,
      shuffleQuestions: false,
      showFeedbackAfterSubmit: false,
      timeLimitMinutes: 15,
      status: "open",
      openAt: internalDefinition.openAt,
      dueAt: internalDefinition.dueAt,
      createdAt: "2026-06-19T00:00:00.000Z",
      formUrl: "https://docs.google.com/forms/d/e/demo/viewform",
    });
  });

  it("resumes existing in-progress attempt", async () => {
    mockedFindStudentAssessmentAttemptRepository.mockResolvedValue({
      attempt: {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        assessmentId: internalDefinition.assessmentId,
        studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        attemptNumber: 1,
        status: "in_progress",
        startedAt: "2026-06-19T01:00:00.000Z",
        metadata: {},
      },
      answers: [],
    });

    const result = await startAssessmentAttempt({
      assessmentId: internalDefinition.assessmentId,
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.attempt?.id).toBe("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    }
    expect(mockedCreateAssessmentAttemptRepository).not.toHaveBeenCalled();
  });

  it("marks expired in-progress attempt before blocking a new start when attempts are exhausted", async () => {
    mockedGetInternalAssessmentDefinitionRepository.mockResolvedValue({
      ...internalDefinition,
      attemptLimit: 1,
      timeLimitMinutes: 5,
    });
    mockedFindStudentAssessmentAttemptRepository.mockResolvedValue({
      attempt: {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        assessmentId: internalDefinition.assessmentId,
        studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        attemptNumber: 1,
        status: "in_progress",
        startedAt: "2026-06-19T01:00:00.000Z",
        expiresAt: "2026-06-19T01:05:00.000Z",
        metadata: {},
      },
      answers: [],
    });
    mockedUpdateAssessmentAttemptStatusRepository.mockResolvedValue({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      assessmentId: internalDefinition.assessmentId,
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      attemptNumber: 1,
      status: "expired",
      startedAt: "2026-06-19T01:00:00.000Z",
      expiresAt: "2026-06-19T01:05:00.000Z",
      metadata: {},
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-19T01:10:00.000Z"));

    const result = await startAssessmentAttempt({
      assessmentId: internalDefinition.assessmentId,
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    });

    expect(result.ok).toBe(false);
    expect(mockedUpdateAssessmentAttemptStatusRepository).toHaveBeenCalledWith(expect.objectContaining({
      attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      status: "expired",
    }));
    vi.useRealTimers();
  });

  it("creates draft attempt without expiration timestamp", async () => {
    mockedGetInternalAssessmentDefinitionRepository.mockResolvedValue({
      ...internalDefinition,
      status: "draft",
      attemptLimit: 3,
      timeLimitMinutes: 10,
      dueAt: undefined,
      openAt: undefined,
    });
    mockedFindStudentAssessmentAttemptRepository.mockResolvedValue({
      attempt: {
        id: "old-attempt",
        assessmentId: internalDefinition.assessmentId,
        studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        attemptNumber: 1,
        status: "graded",
        startedAt: "2026-06-19T01:00:00.000Z",
        submittedAt: "2026-06-19T01:10:00.000Z",
        metadata: {},
      },
      answers: [],
    });
    mockedCreateAssessmentAttemptRepository.mockResolvedValue({
      id: "new-attempt",
      assessmentId: internalDefinition.assessmentId,
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      attemptNumber: 2,
      status: "in_progress",
      startedAt: "2026-06-19T02:00:00.000Z",
      metadata: {},
    });

    const result = await startAssessmentAttempt({
      assessmentId: internalDefinition.assessmentId,
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    });

    expect(result.ok).toBe(true);
    expect(mockedCreateAssessmentAttemptRepository).toHaveBeenCalledWith(expect.objectContaining({
      expiresAt: undefined,
    }));
  });

  it("starts external assessment attempt and persists expiration in database-backed attempt", async () => {
    mockedFindStudentAssessmentAttemptRepository.mockResolvedValue({
      attempt: null,
      answers: [],
    });
    mockedCreateAssessmentAttemptRepository.mockResolvedValue({
      id: "external-attempt-1",
      assessmentId: internalDefinition.assessmentId,
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      attemptNumber: 1,
      status: "in_progress",
      startedAt: "2026-06-19T01:00:00.000Z",
      expiresAt: "2026-06-19T01:15:00.000Z",
      metadata: {
        deliveryMode: "external",
      },
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-19T01:00:00.000Z"));

    const result = await startExternalAssessmentAttempt({
      assessmentId: internalDefinition.assessmentId,
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    });

    expect(result.ok).toBe(true);
    expect(mockedCreateAssessmentAttemptRepository).toHaveBeenCalledWith(expect.objectContaining({
      assessmentId: internalDefinition.assessmentId,
      expiresAt: "2026-06-19T01:15:00.000Z",
      metadata: {
        deliveryMode: "external",
      },
    }));
    vi.useRealTimers();
  });

  it("saves one answer when attempt is active", async () => {
    mockedFindStudentAssessmentAttemptRepository.mockResolvedValue({
      attempt: {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        assessmentId: internalDefinition.assessmentId,
        studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        attemptNumber: 1,
        status: "in_progress",
        startedAt: "2026-06-19T01:00:00.000Z",
        metadata: {},
      },
      answers: [],
    });
    mockedUpsertAssessmentAnswerRepository.mockResolvedValue({
      attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      assessmentId: internalDefinition.assessmentId,
      questionBankItemId: "11111111-1111-4111-8111-111111111111",
      sortOrder: 1,
      answerPayload: { value: "4" },
      isFinal: false,
    });

    const result = await saveAssessmentAnswer({
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      assessmentId: internalDefinition.assessmentId,
      questionBankItemId: "11111111-1111-4111-8111-111111111111",
      sortOrder: 1,
      answerPayload: { value: "4" },
    });

    expect(result.ok).toBe(true);
    expect(mockedUpsertAssessmentAnswerRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        questionBankItemId: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });

  it("submits internal attempt and mirrors result to submissions", async () => {
    mockedFindStudentAssessmentAttemptRepository.mockResolvedValue({
      attempt: {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        assessmentId: internalDefinition.assessmentId,
        studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        attemptNumber: 1,
        status: "in_progress",
        startedAt: "2026-06-19T01:00:00.000Z",
        metadata: {},
      },
      answers: [
        {
          attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          assessmentId: internalDefinition.assessmentId,
          questionBankItemId: "11111111-1111-4111-8111-111111111111",
          sortOrder: 1,
          answerPayload: { value: "4" },
          isFinal: true,
        },
        {
          attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          assessmentId: internalDefinition.assessmentId,
          questionBankItemId: "22222222-2222-4222-8222-222222222222",
          sortOrder: 2,
          answerPayload: { text: "Bai lam tu luan" },
          isFinal: true,
        },
      ],
    });
    mockedUpdateAssessmentAttemptStatusRepository.mockResolvedValue({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      assessmentId: internalDefinition.assessmentId,
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      attemptNumber: 1,
      status: "submitted",
      startedAt: "2026-06-19T01:00:00.000Z",
      submittedAt: "2026-06-19T01:10:00.000Z",
      metadata: {},
    });
    mockedFindStudentProfilesByIdsServiceRepository.mockResolvedValue([
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        email: "stu1@local.test",
        student_code: "STU1",
        full_name: "Student One",
      },
    ]);
    mockedUpsertSubmissionRepository.mockResolvedValue({ id: "submission-1" });

    const result = await submitAssessmentAttempt({
      assessmentId: internalDefinition.assessmentId,
      attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rawScore).toBe(2);
      expect(result.data.maxScore).toBe(5);
      expect(result.data.pendingManualReview).toBe(true);
    }

    expect(mockedUpsertAssessmentAnswerScoreRepository).toHaveBeenCalledTimes(2);
    expect(mockedUpsertSubmissionRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "internal",
        rawScore: 2,
        maxScore: 5,
      }),
    );
    expect(mockedUpsertCourseAssessmentResultRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "internal",
        submissionId: "submission-1",
      }),
    );
  });

  it("returns latest attempt snapshot for student", async () => {
    mockedFindStudentAssessmentAttemptRepository.mockResolvedValue({
      attempt: null,
      answers: [],
    });

    const result = await getAssessmentAttemptForStudent({
      assessmentId: internalDefinition.assessmentId,
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.attempt).toBeNull();
    }
  });

  it("marks expired external attempt when student loads it again", async () => {
    mockedFindStudentAssessmentAttemptRepository.mockResolvedValue({
      attempt: {
        id: "external-attempt-1",
        assessmentId: internalDefinition.assessmentId,
        studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        attemptNumber: 1,
        status: "in_progress",
        startedAt: "2026-06-19T01:00:00.000Z",
        expiresAt: "2026-06-19T01:15:00.000Z",
        metadata: {
          deliveryMode: "external",
        },
      },
      answers: [],
    });
    mockedUpdateAssessmentAttemptStatusRepository.mockResolvedValue({
      id: "external-attempt-1",
      assessmentId: internalDefinition.assessmentId,
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      attemptNumber: 1,
      status: "expired",
      startedAt: "2026-06-19T01:00:00.000Z",
      expiresAt: "2026-06-19T01:15:00.000Z",
      metadata: {
        reason: "time_limit_reached",
      },
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-19T01:20:00.000Z"));

    const result = await getAssessmentAttemptForStudent({
      assessmentId: internalDefinition.assessmentId,
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.attempt?.status).toBe("expired");
    }
    vi.useRealTimers();
  });

  it("grades essay answer and syncs final score back to submissions", async () => {
    mockedGetAssessmentAttemptGradingRepository
      .mockResolvedValueOnce({
        attempt: {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          assessmentId: internalDefinition.assessmentId,
          studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          attemptNumber: 1,
          status: "submitted",
          startedAt: "2026-06-19T01:00:00.000Z",
          submittedAt: "2026-06-19T01:10:00.000Z",
          metadata: {},
        },
        studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        studentFullName: "Student One",
        studentEmail: "stu1@local.test",
        studentCode: "STU1",
        studentIdentifier: "STU1",
        answers: [
          {
            attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            assessmentId: internalDefinition.assessmentId,
            questionBankItemId: "11111111-1111-4111-8111-111111111111",
            sortOrder: 1,
            answerPayload: { value: "4" },
            isFinal: true,
          },
          {
            attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            assessmentId: internalDefinition.assessmentId,
            questionBankItemId: "22222222-2222-4222-8222-222222222222",
            sortOrder: 2,
            answerPayload: { text: "Bai lam tu luan" },
            isFinal: true,
          },
        ],
        scores: [
          {
            attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            questionBankItemId: "11111111-1111-4111-8111-111111111111",
            autoScore: 2,
            finalScore: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        attempt: {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          assessmentId: internalDefinition.assessmentId,
          studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          attemptNumber: 1,
          status: "submitted",
          startedAt: "2026-06-19T01:00:00.000Z",
          submittedAt: "2026-06-19T01:10:00.000Z",
          metadata: {},
        },
        studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        studentFullName: "Student One",
        studentEmail: "stu1@local.test",
        studentCode: "STU1",
        studentIdentifier: "STU1",
        answers: [
          {
            attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            assessmentId: internalDefinition.assessmentId,
            questionBankItemId: "11111111-1111-4111-8111-111111111111",
            sortOrder: 1,
            answerPayload: { value: "4" },
            isFinal: true,
          },
          {
            attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            assessmentId: internalDefinition.assessmentId,
            questionBankItemId: "22222222-2222-4222-8222-222222222222",
            sortOrder: 2,
            answerPayload: { text: "Bai lam tu luan" },
            isFinal: true,
          },
        ],
        scores: [
          {
            attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            questionBankItemId: "11111111-1111-4111-8111-111111111111",
            autoScore: 2,
            finalScore: 2,
          },
          {
            attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            questionBankItemId: "22222222-2222-4222-8222-222222222222",
            manualScore: 2.5,
            finalScore: 2.5,
            feedback: "Lap luan on",
          },
        ],
      });
    mockedUpdateAssessmentAttemptStatusRepository.mockResolvedValue({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      assessmentId: internalDefinition.assessmentId,
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      attemptNumber: 1,
      status: "graded",
      startedAt: "2026-06-19T01:00:00.000Z",
      submittedAt: "2026-06-19T01:10:00.000Z",
      gradedAt: "2026-06-19T01:20:00.000Z",
      metadata: {},
    });
    mockedUpsertSubmissionRepository.mockResolvedValue({ id: "submission-graded-1" });

    const result = await finalizeAssessmentSubmission({
      attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      questionBankItemId: "22222222-2222-4222-8222-222222222222",
      actorId: "99999999-9999-4999-8999-999999999999",
      actorRole: "teacher",
      manualScore: 2.5,
      finalScore: 2.5,
      feedback: "Lap luan on",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rawScore).toBe(4.5);
      expect(result.data.maxScore).toBe(5);
      expect(result.data.pendingManualReview).toBe(false);
    }

    expect(mockedUpsertAssessmentAnswerScoreRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        questionBankItemId: "22222222-2222-4222-8222-222222222222",
        finalScore: 2.5,
      }),
    );
    expect(mockedUpsertSubmissionRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        rawScore: 4.5,
        maxScore: 5,
        source: "internal",
      }),
    );
  });

  it("lists grading attempts for internal assessment managers", async () => {
    mockedListAssessmentAttemptsForGradingRepository.mockResolvedValue([]);

    const result = await listAssessmentAttemptsForGrading({
      assessmentId: internalDefinition.assessmentId,
      actorId: "99999999-9999-4999-8999-999999999999",
      actorRole: "teacher",
    });

    expect(result.ok).toBe(true);
    expect(mockedListAssessmentAttemptsForGradingRepository).toHaveBeenCalledWith(internalDefinition.assessmentId);
  });

  it("returns personal review for student when feedback display is enabled", async () => {
    mockedGetInternalAssessmentDefinitionRepository.mockResolvedValue({
      ...internalDefinition,
      showFeedbackAfterSubmit: true,
    });
    mockedFindStudentAssessmentAttemptRepository.mockResolvedValue({
      attempt: {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        assessmentId: internalDefinition.assessmentId,
        studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        attemptNumber: 1,
        status: "graded",
        startedAt: "2026-06-19T01:00:00.000Z",
        submittedAt: "2026-06-19T01:10:00.000Z",
        gradedAt: "2026-06-19T01:20:00.000Z",
        metadata: {},
      },
      answers: [
        {
          attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          assessmentId: internalDefinition.assessmentId,
          questionBankItemId: "11111111-1111-4111-8111-111111111111",
          sortOrder: 1,
          answerPayload: { value: "4" },
          isFinal: true,
        },
        {
          attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          assessmentId: internalDefinition.assessmentId,
          questionBankItemId: "22222222-2222-4222-8222-222222222222",
          sortOrder: 2,
          answerPayload: { text: "Bai lam tu luan" },
          isFinal: true,
        },
      ],
    });
    mockedGetAssessmentAttemptGradingRepository.mockResolvedValue({
      attempt: {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        assessmentId: internalDefinition.assessmentId,
        studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        attemptNumber: 1,
        status: "graded",
        startedAt: "2026-06-19T01:00:00.000Z",
        submittedAt: "2026-06-19T01:10:00.000Z",
        gradedAt: "2026-06-19T01:20:00.000Z",
        metadata: {},
      },
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      studentFullName: "Student One",
      studentEmail: "stu1@local.test",
      studentCode: "STU1",
      studentIdentifier: "STU1",
      answers: [
        {
          attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          assessmentId: internalDefinition.assessmentId,
          questionBankItemId: "11111111-1111-4111-8111-111111111111",
          sortOrder: 1,
          answerPayload: { value: "4" },
          isFinal: true,
        },
        {
          attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          assessmentId: internalDefinition.assessmentId,
          questionBankItemId: "22222222-2222-4222-8222-222222222222",
          sortOrder: 2,
          answerPayload: { text: "Bai lam tu luan" },
          isFinal: true,
        },
      ],
      scores: [
        {
          attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          questionBankItemId: "11111111-1111-4111-8111-111111111111",
          autoScore: 2,
          finalScore: 2,
        },
        {
          attemptId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          questionBankItemId: "22222222-2222-4222-8222-222222222222",
          manualScore: 2.5,
          finalScore: 2.5,
          feedback: "Lap luan on",
        },
      ],
    });

    const result = await getStudentAssessmentReview({
      assessmentId: internalDefinition.assessmentId,
      studentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rawScore).toBe(4.5);
      expect(result.data.maxScore).toBe(5);
      expect(result.data.questions[1]?.feedback).toBe("Lap luan on");
    }
  });
});
