import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEnrollmentRequestsRepository,
  reviewEnrollmentRequestRepository,
} from "@/lib/repositories/enrollment-repository";
import {
  createEnrollmentRequests,
  reviewEnrollmentRequest,
} from "@/lib/services/enrollment-service";

vi.mock("@/lib/repositories/enrollment-repository", () => ({
  createEnrollmentRequestsRepository: vi.fn(),
  reviewEnrollmentRequestRepository: vi.fn(),
}));

const mockedCreateEnrollmentRequestsRepository = vi.mocked(createEnrollmentRequestsRepository);
const mockedReviewEnrollmentRequestRepository = vi.mocked(reviewEnrollmentRequestRepository);

describe("enrollment-service", () => {
  beforeEach(() => {
    mockedCreateEnrollmentRequestsRepository.mockReset();
    mockedReviewEnrollmentRequestRepository.mockReset();
  });

  it("returns validation error when request list is empty", async () => {
    const result = await createEnrollmentRequests({
      studentId: "11111111-1111-4111-8111-111111111111",
      requests: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(mockedCreateEnrollmentRequestsRepository).not.toHaveBeenCalled();
  });

  it("deduplicates payload requests and maps skipped counts", async () => {
    mockedCreateEnrollmentRequestsRepository.mockResolvedValue({
      created: [
        {
          id: "request-1",
          studentId: "student-1",
          courseId: "course-1",
          classId: null,
          status: "pending",
          requestedAt: "2026-01-01T00:00:00.000Z",
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
        },
      ],
      skipped: [{ courseId: "course-2" }],
      autoApproved: 0,
    });

    const result = await createEnrollmentRequests({
      studentId: "22222222-2222-4222-8222-222222222222",
      requests: [
        { courseId: "33333333-3333-4333-8333-333333333333" },
        { courseId: "33333333-3333-4333-8333-333333333333" },
      ],
    });

    expect(mockedCreateEnrollmentRequestsRepository).toHaveBeenCalledWith({
      studentId: "22222222-2222-4222-8222-222222222222",
      requests: [{ courseId: "33333333-3333-4333-8333-333333333333", classId: undefined }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.created).toBe(1);
      expect(result.data.autoApproved).toBe(0);
      expect(result.data.skipped).toBe(2);
      expect(result.data.duplicates).toHaveLength(2);
    }
  });

  it("returns not found when review target does not exist", async () => {
    mockedReviewEnrollmentRequestRepository.mockResolvedValue(null);

    const result = await reviewEnrollmentRequest({
      requestId: "44444444-4444-4444-8444-444444444444",
      actorId: "55555555-5555-4555-8555-555555555555",
      actorRole: "teacher",
      decision: "approved",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("reviews enrollment request successfully", async () => {
    mockedReviewEnrollmentRequestRepository.mockResolvedValue({
      id: "request-1",
      studentId: "student-1",
      courseId: "course-1",
      classId: null,
      status: "approved",
      requestedAt: "2026-01-01T00:00:00.000Z",
      reviewedBy: "teacher-1",
      reviewedAt: "2026-01-02T00:00:00.000Z",
      reviewNote: null,
    });

    const result = await reviewEnrollmentRequest({
      requestId: "66666666-6666-4666-8666-666666666666",
      actorId: "77777777-7777-4777-8777-777777777777",
      actorRole: "teacher",
      decision: "approved",
      note: "OK",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("approved");
    }
  });

  it("maps scoped review failure to forbidden", async () => {
    mockedReviewEnrollmentRequestRepository.mockRejectedValue(new Error("FORBIDDEN_SCOPE_REVIEW"));

    const result = await reviewEnrollmentRequest({
      requestId: "88888888-8888-4888-8888-888888888888",
      actorId: "99999999-9999-4999-8999-999999999999",
      actorRole: "teacher",
      decision: "approved",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("maps unresolved target class to conflict", async () => {
    mockedReviewEnrollmentRequestRepository.mockRejectedValue(new Error("NO_ACTIVE_CLASS_FOR_COURSE"));

    const result = await reviewEnrollmentRequest({
      requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actorRole: "teacher",
      decision: "approved",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
    }
  });
});
