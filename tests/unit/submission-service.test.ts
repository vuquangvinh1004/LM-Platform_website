import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { createSystemActivityLogRepository } from "@/lib/repositories/activity-log-repository";
import { upsertCourseAssessmentResultRepository } from "@/lib/repositories/question-bank-repository";
import { syncAssessmentResultLifecycle } from "@/lib/services/assessment-result-lifecycle-service";
import { getAssessmentResults, importSubmissionsFromCsv, upsertExternalSubmission } from "@/lib/services/submission-service";

vi.mock("@/lib/repositories/submission-repository", () => ({
  findManageableAssessmentRepository: vi.fn(),
  findAssessmentByIdServiceRepository: vi.fn(),
  createImportJobRepository: vi.fn(),
  completeImportJobRepository: vi.fn(),
  findStudentsForSubmissionImportRepository: vi.fn(),
  findStudentForExternalSubmissionServiceRepository: vi.fn(),
  listAssessmentResultsRepository: vi.fn(),
  upsertExternalSubmissionServiceRepository: vi.fn(),
  upsertSubmissionRepository: vi.fn(),
}));

vi.mock("@/lib/repositories/activity-log-repository", () => ({
  createSystemActivityLogRepository: vi.fn(),
}));

vi.mock("@/lib/repositories/question-bank-repository", () => ({
  upsertCourseAssessmentResultRepository: vi.fn(),
}));

vi.mock("@/lib/services/assessment-result-lifecycle-service", () => ({
  syncAssessmentResultLifecycle: vi.fn(),
}));

const mockedFindManageableAssessmentRepository = vi.mocked(findManageableAssessmentRepository);
const mockedFindAssessmentByIdServiceRepository = vi.mocked(findAssessmentByIdServiceRepository);
const mockedCreateImportJobRepository = vi.mocked(createImportJobRepository);
const mockedCompleteImportJobRepository = vi.mocked(completeImportJobRepository);
const mockedFindStudentsForSubmissionImportRepository = vi.mocked(findStudentsForSubmissionImportRepository);
const mockedFindStudentForExternalSubmissionServiceRepository = vi.mocked(findStudentForExternalSubmissionServiceRepository);
const mockedListAssessmentResultsRepository = vi.mocked(listAssessmentResultsRepository);
const mockedUpsertExternalSubmissionServiceRepository = vi.mocked(upsertExternalSubmissionServiceRepository);
const mockedUpsertSubmissionRepository = vi.mocked(upsertSubmissionRepository);
const mockedCreateSystemActivityLogRepository = vi.mocked(createSystemActivityLogRepository);
const mockedUpsertCourseAssessmentResultRepository = vi.mocked(upsertCourseAssessmentResultRepository);
const mockedSyncAssessmentResultLifecycle = vi.mocked(syncAssessmentResultLifecycle);

describe("submission-service", () => {
  beforeEach(() => {
    process.env.GOOGLE_FORM_WEBHOOK_SECRET = "g-secret";
    process.env.MICROSOFT_FORM_WEBHOOK_SECRET = "m-secret";

    mockedFindManageableAssessmentRepository.mockReset();
    mockedFindAssessmentByIdServiceRepository.mockReset();
    mockedCreateImportJobRepository.mockReset();
    mockedCompleteImportJobRepository.mockReset();
    mockedFindStudentsForSubmissionImportRepository.mockReset();
    mockedFindStudentForExternalSubmissionServiceRepository.mockReset();
    mockedListAssessmentResultsRepository.mockReset();
    mockedUpsertExternalSubmissionServiceRepository.mockReset();
    mockedUpsertSubmissionRepository.mockReset();
    mockedCreateSystemActivityLogRepository.mockReset();
    mockedUpsertCourseAssessmentResultRepository.mockReset();
    mockedSyncAssessmentResultLifecycle.mockReset();

    mockedFindManageableAssessmentRepository.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      classId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      courseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      title: "Assessment Import",
    });
    mockedCreateImportJobRepository.mockResolvedValue({ id: "job-1" });
    mockedCompleteImportJobRepository.mockResolvedValue();
    mockedFindAssessmentByIdServiceRepository.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      classId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      courseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      title: "Assessment Import",
    });
    mockedFindStudentForExternalSubmissionServiceRepository.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      email: "student1@local.test",
      studentCode: "SV001",
      fullName: "Student One",
    });
    mockedUpsertExternalSubmissionServiceRepository.mockResolvedValue({ id: "submission-webhook-1" });
    mockedListAssessmentResultsRepository.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });
    mockedCreateSystemActivityLogRepository.mockResolvedValue();
    mockedUpsertCourseAssessmentResultRepository.mockResolvedValue();
    mockedSyncAssessmentResultLifecycle.mockResolvedValue({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      createdMissingCount: 0,
      updatedStatusCount: 0,
      ignoredCount: 0,
    });
    mockedFindStudentsForSubmissionImportRepository.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        email: "student1@local.test",
        studentCode: "SV001",
        fullName: "Student One",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        email: "student2@local.test",
        studentCode: "SV002",
        fullName: "Student Two",
      },
    ]);
    mockedUpsertSubmissionRepository.mockResolvedValue({ id: "submission-1" });
  });

  it("blocks student role from importing submissions", async () => {
    const result = await importSubmissionsFromCsv({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      actorRole: "student",
      csvContent: "Mã sinh viên,Họ tên sinh viên,Email,Điểm,Nộp lúc,Nguồn,Ghi chú\nSV001,Student One,student1@local.test,8,2026-05-28T08:00:00Z,Google Form,",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
    expect(mockedCreateImportJobRepository).not.toHaveBeenCalled();
  });

  it("imports valid CSV rows and computes summary", async () => {
    const result = await importSubmissionsFromCsv({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      actorRole: "teacher",
      csvContent: [
        "Mã sinh viên,Họ tên sinh viên,Email,Điểm,Nộp lúc,Nguồn,Ghi chú,max_score,attempt",
        "SV001,Student One,student1@local.test,8,2026-05-28T08:00:00Z,Google Form,,10,1",
        "SV002,Student Two,student2@local.test,7,2026-05-28T08:10:00Z,Google Form,,10,1",
      ].join("\n"),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalRows).toBe(2);
      expect(result.data.successRows).toBe(2);
      expect(result.data.errorRows).toBe(0);
      expect(result.data.status).toBe("completed");
    }

    expect(mockedUpsertSubmissionRepository).toHaveBeenCalledTimes(2);
    expect(mockedCompleteImportJobRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        successRows: 2,
        errorRows: 0,
      }),
    );
    expect(mockedCreateSystemActivityLogRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "submission.import_csv.completed",
        entityType: "submission",
      }),
    );
  });

  it("keeps processing when one row cannot resolve student", async () => {
    const result = await importSubmissionsFromCsv({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      actorRole: "teacher",
      csvContent: [
        "Mã sinh viên,Họ tên sinh viên,Email,Điểm,Nộp lúc,Nguồn,Ghi chú",
        "SV001,Student One,student1@local.test,8,2026-05-28T08:00:00Z,Google Form,",
        "SV999,Unknown Student,unknown@local.test,9,2026-05-28T08:05:00Z,Google Form,",
      ].join("\n"),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalRows).toBe(2);
      expect(result.data.successRows).toBe(1);
      expect(result.data.errorRows).toBe(1);
      expect(result.data.status).toBe("partial");
      expect(result.data.errors[0]?.reason).toContain("mã sinh viên");
    }

    expect(mockedUpsertSubmissionRepository).toHaveBeenCalledTimes(1);
    expect(mockedCompleteImportJobRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "partial",
        successRows: 1,
        errorRows: 1,
      }),
    );
  });

  it("imports csv rows with Vietnamese names and Excel-style datetime", async () => {
    const result = await importSubmissionsFromCsv({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      actorRole: "teacher",
      csvContent: [
        "Mã sinh viên,Họ tên sinh viên,Email,Điểm,Nộp lúc,Nguồn,Ghi chú",
        "SV001,Nguyễn Văn A,student1@local.test,8,5/26/2026 12:00,Google Form,Ghi chú có dấu",
      ].join("\n"),
    });

    expect(result.ok).toBe(true);
    expect(mockedUpsertSubmissionRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        submittedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        metadata: expect.objectContaining({
          fullName: "Nguyễn Văn A",
          note: "Ghi chú có dấu",
          sourceLabel: "Google Form",
        }),
      }),
    );
  });

  it("returns validation error when CSV misses score column", async () => {
    const result = await importSubmissionsFromCsv({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      actorRole: "teacher",
      csvContent: [
        "Mã sinh viên,Họ tên sinh viên,Email,Nộp lúc,Nguồn,Ghi chú",
        "SV001,Student One,student1@local.test,2026-05-28T08:00:00Z,Google Form,",
      ].join("\n"),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("Mã sinh viên");
    }

    expect(mockedCreateImportJobRepository).not.toHaveBeenCalled();
  });

  it("upserts external submission for google webhook payload", async () => {
    const result = await upsertExternalSubmission({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      provider: "google_form",
      sharedSecret: "g-secret",
      payload: {
        responseId: "resp-1",
        submittedAt: "2026-05-28T08:00:00Z",
        answers: {
          email: "student1@local.test",
          studentCode: "SV001",
          score: 9,
          maxScore: 10,
          attempt: 1,
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(mockedUpsertExternalSubmissionServiceRepository).toHaveBeenCalledTimes(1);
  });

  it("blocks teacher read-model call when actor role is student", async () => {
    const result = await getAssessmentResults({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      actorRole: "student",
      page: 1,
      pageSize: 20,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("rejects import rows that do not contain student code key", async () => {
    const result = await importSubmissionsFromCsv({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      actorRole: "teacher",
      csvContent: [
        "Mã sinh viên,Họ tên sinh viên,Email,Điểm,Nộp lúc,Nguồn,Ghi chú",
        ",Nguyễn Văn A,student1@local.test,8,5/26/2026 12:00,Google Form,",
      ].join("\n"),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.successRows).toBe(0);
      expect(result.data.errorRows).toBe(1);
      expect(result.data.errors[0]?.reason).toContain("mã sinh viên");
    }
  });

  it("synchronizes roster lifecycle before listing assessment results", async () => {
    const result = await getAssessmentResults({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      actorRole: "teacher",
      page: 1,
      pageSize: 20,
    });

    expect(result.ok).toBe(true);
    expect(mockedSyncAssessmentResultLifecycle).toHaveBeenCalledWith({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(mockedListAssessmentResultsRepository).toHaveBeenCalledWith({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      page: 1,
      pageSize: 20,
      status: undefined,
      sortBy: undefined,
      sortDirection: undefined,
    });
  });

  it("matches import rows against active roster values with case-insensitive student code", async () => {
    mockedFindStudentsForSubmissionImportRepository.mockResolvedValueOnce([
      {
        id: "11111111-1111-4111-8111-111111111111",
        email: "stu123@local.test",
        studentCode: "Stu123",
        fullName: "Local Student",
      },
    ]);

    const result = await importSubmissionsFromCsv({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      actorRole: "teacher",
      csvContent: [
        "Mã sinh viên,Họ tên sinh viên,Email,Điểm,Nộp lúc,Nguồn,Ghi chú",
        "STU123,Local Student,stu123@local.test,8,5/26/2026 12:00,Google Form,",
      ].join("\n"),
    });

    expect(result.ok).toBe(true);
    expect(mockedFindStudentsForSubmissionImportRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        classId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    );
    expect(mockedUpsertSubmissionRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "11111111-1111-4111-8111-111111111111",
        studentIdentifier: "STU123",
      }),
    );
  });
});
