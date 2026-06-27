import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAssessmentRepository,
  deleteAssessmentRepository,
  getAssessmentSummaryRepository,
  getAssessmentForStudentRepository,
  listCompletedAssessmentIdsForStudentRepository,
  listAssessmentsForManagerRepository,
  listAssessmentsForStudentRepository,
  updateAssessmentStatusRepository,
} from "@/lib/repositories/assessment-repository";
import {
  createAssessment,
  deleteAssessment,
  getAssessmentForStudent,
  listAssessmentsForManager,
  listAssessmentsForStudent,
  updateAssessmentStatus,
} from "@/lib/services/assessment-service";

vi.mock("@/lib/repositories/assessment-repository", () => ({
  createAssessmentRepository: vi.fn(),
  deleteAssessmentRepository: vi.fn(),
  getAssessmentSummaryRepository: vi.fn(),
  listCompletedAssessmentIdsForStudentRepository: vi.fn(),
  listAssessmentsForManagerRepository: vi.fn(),
  listAssessmentsForStudentRepository: vi.fn(),
  getAssessmentForStudentRepository: vi.fn(),
  updateAssessmentStatusRepository: vi.fn(),
}));

const mockedCreateAssessmentRepository = vi.mocked(createAssessmentRepository);
const mockedDeleteAssessmentRepository = vi.mocked(deleteAssessmentRepository);
const mockedGetAssessmentSummaryRepository = vi.mocked(getAssessmentSummaryRepository);
const mockedListCompletedAssessmentIdsForStudentRepository = vi.mocked(listCompletedAssessmentIdsForStudentRepository);
const mockedListAssessmentsForManagerRepository = vi.mocked(listAssessmentsForManagerRepository);
const mockedListAssessmentsForStudentRepository = vi.mocked(listAssessmentsForStudentRepository);
const mockedGetAssessmentForStudentRepository = vi.mocked(getAssessmentForStudentRepository);
const mockedUpdateAssessmentStatusRepository = vi.mocked(updateAssessmentStatusRepository);

describe("assessment-service", () => {
  beforeEach(() => {
    mockedCreateAssessmentRepository.mockReset();
    mockedDeleteAssessmentRepository.mockReset();
    mockedGetAssessmentSummaryRepository.mockReset();
    mockedListCompletedAssessmentIdsForStudentRepository.mockReset();
    mockedListAssessmentsForManagerRepository.mockReset();
    mockedListAssessmentsForStudentRepository.mockReset();
    mockedGetAssessmentForStudentRepository.mockReset();
    mockedUpdateAssessmentStatusRepository.mockReset();
  });

  it("validates google form URL domain", async () => {
    const result = await createAssessment({
      classId: "11111111-1111-4111-8111-111111111111",
      courseId: "22222222-2222-4222-8222-222222222222",
      actorId: "33333333-3333-4333-8333-333333333333",
      actorRole: "teacher",
      title: "Google Assessment",
      provider: "google_form",
      formUrl: "https://example.com/not-form",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXTERNAL_PROVIDER_ERROR");
    }
    expect(mockedCreateAssessmentRepository).not.toHaveBeenCalled();
  });

  it("falls back microsoft iframe request to new_tab", async () => {
    mockedCreateAssessmentRepository.mockResolvedValue({
      id: "assessment-1",
      classId: "11111111-1111-4111-8111-111111111111",
      courseId: "22222222-2222-4222-8222-222222222222",
      classCode: "CLS1",
      classTitle: "Class 1",
      courseCode: "C1",
      courseTitle: "Course 1",
      title: "MS Form",
      deliveryMode: "external",
      provider: "microsoft_form",
      embedMode: "new_tab",
      attemptLimit: 1,
      shuffleQuestions: false,
      showFeedbackAfterSubmit: false,
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      formUrl: "https://forms.office.com/r/demo",
    });

    const result = await createAssessment({
      classId: "11111111-1111-4111-8111-111111111111",
      courseId: "22222222-2222-4222-8222-222222222222",
      actorId: "33333333-3333-4333-8333-333333333333",
      actorRole: "teacher",
      title: "Microsoft Assessment",
      provider: "microsoft_form",
      formUrl: "https://forms.office.com/r/demo",
      embedMode: "iframe",
    });

    expect(result.ok).toBe(true);
    expect(mockedCreateAssessmentRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        embedMode: "new_tab",
      }),
    );
  });

  it("blocks student from manager list API", async () => {
    const result = await listAssessmentsForManager({
      actorId: "11111111-1111-4111-8111-111111111111",
      actorRole: "student",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("returns student list successfully", async () => {
    mockedListAssessmentsForStudentRepository.mockResolvedValue([]);
    mockedListCompletedAssessmentIdsForStudentRepository.mockResolvedValue(new Set());

    const result = await listAssessmentsForStudent({
      studentId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(0);
    }
  });

  it("forces open assessment attempt limit to 1", async () => {
    mockedCreateAssessmentRepository.mockResolvedValue({
      id: "assessment-open",
      classId: "11111111-1111-4111-8111-111111111111",
      courseId: "22222222-2222-4222-8222-222222222222",
      classCode: "CLS1",
      classTitle: "Class 1",
      courseCode: "C1",
      courseTitle: "Course 1",
      title: "Open Assessment",
      deliveryMode: "internal",
      provider: "internal",
      embedMode: "disabled",
      attemptLimit: 1,
      shuffleQuestions: false,
      showFeedbackAfterSubmit: false,
      status: "open",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await createAssessment({
      classId: "11111111-1111-4111-8111-111111111111",
      courseId: "22222222-2222-4222-8222-222222222222",
      actorId: "33333333-3333-4333-8333-333333333333",
      actorRole: "teacher",
      title: "Open Assessment",
      deliveryMode: "internal",
      provider: "internal",
      attemptLimit: 5,
      status: "open",
    });

    expect(result.ok).toBe(true);
    expect(mockedCreateAssessmentRepository).toHaveBeenCalledWith(expect.objectContaining({
      attemptLimit: 1,
    }));
  });

  it("marks open assessment as overdue when dueAt is already past", async () => {
    mockedListAssessmentsForStudentRepository.mockResolvedValue([
      {
        id: "assessment-1",
        classId: "class-1",
        courseId: "course-1",
        classCode: "CLS1",
        classTitle: "Class 1",
        courseCode: "C1",
        courseTitle: "Course 1",
        title: "Past due assessment",
        deliveryMode: "external",
        provider: "google_form",
        embedMode: "new_tab",
        attemptLimit: 1,
        shuffleQuestions: false,
        showFeedbackAfterSubmit: false,
        status: "open",
        openAt: "2026-06-19T00:00:00.000Z",
        dueAt: "2026-06-19T00:01:00.000Z",
        createdAt: "2026-06-18T00:00:00.000Z",
      },
    ]);
    mockedListCompletedAssessmentIdsForStudentRepository.mockResolvedValue(new Set());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T00:00:00.000Z"));

    const result = await listAssessmentsForStudent({
      studentId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0]?.studentListStatus).toBe("overdue");
    }

    vi.useRealTimers();
  });

  it("blocks closed assessment for student detail", async () => {
    mockedGetAssessmentForStudentRepository.mockResolvedValue({
      id: "assessment-1",
      classId: "class-1",
      classCode: "CLS1",
      classTitle: "Class 1",
      title: "Closed assessment",
      deliveryMode: "external",
      provider: "manual",
      embedMode: "disabled",
      attemptLimit: 1,
      shuffleQuestions: false,
      showFeedbackAfterSubmit: false,
      status: "closed",
    });

    const result = await getAssessmentForStudent({
      assessmentId: "11111111-1111-4111-8111-111111111111",
      studentId: "22222222-2222-4222-8222-222222222222",
    });

    expect(result.ok).toBe(true);
  });

  it("blocks moving draft assessment to another status", async () => {
    mockedGetAssessmentSummaryRepository.mockResolvedValue({
      id: "assessment-draft",
      classId: "class-1",
      courseId: "course-1",
      classCode: "CLS1",
      classTitle: "Class 1",
      courseCode: "C1",
      courseTitle: "Course 1",
      title: "Draft assessment",
      deliveryMode: "internal",
      provider: "internal",
      embedMode: "disabled",
      attemptLimit: 3,
      shuffleQuestions: false,
      showFeedbackAfterSubmit: false,
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await updateAssessmentStatus({
      assessmentId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
      status: "open",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
    }
  });

  it("deletes assessment permanently for teacher", async () => {
    mockedGetAssessmentSummaryRepository.mockResolvedValue({
      id: "assessment-delete",
      classId: "class-1",
      courseId: "course-1",
      classCode: "CLS1",
      classTitle: "Class 1",
      courseCode: "C1",
      courseTitle: "Course 1",
      title: "Delete assessment",
      deliveryMode: "external",
      provider: "google_form",
      embedMode: "new_tab",
      attemptLimit: 1,
      shuffleQuestions: false,
      showFeedbackAfterSubmit: false,
      status: "closed",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mockedDeleteAssessmentRepository.mockResolvedValue(true);

    const result = await deleteAssessment({
      assessmentId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
    });

    expect(result.ok).toBe(true);
    expect(mockedDeleteAssessmentRepository).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });
});
