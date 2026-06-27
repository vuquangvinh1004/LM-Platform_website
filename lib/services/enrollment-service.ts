import {
  createEnrollmentRequestsRepository,
  listEnrollmentRequestsByClassIdsRepository,
  listEnrollmentRequestsForStudentRepository,
  reviewEnrollmentRequestRepository,
} from "@/lib/repositories/enrollment-repository";
import type {
  EnrollmentRequestBatchCreateResult,
  EnrollmentRequestBatchReviewResult,
  EnrollmentRequestSummary,
} from "@/lib/types/enrollment";
import type { ServiceResult } from "@/lib/types/service-result";
import {
  createEnrollmentRequestsSchema,
  reviewEnrollmentRequestsBatchSchema,
  reviewEnrollmentRequestSchema,
} from "@/lib/validators/enrollment-validator";

/**
 * Creates one or more enrollment requests for a student account.
 */
export async function createEnrollmentRequests(
  input: Parameters<typeof createEnrollmentRequestsSchema.parse>[0],
): Promise<ServiceResult<EnrollmentRequestBatchCreateResult>> {
  const parsedInput = createEnrollmentRequestsSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu yêu cầu đăng ký học phần không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const duplicateMap = new Map<string, { courseId: string; classId?: string }>();
  const payloadDuplicateItems: Array<{ courseId: string; classId?: string }> = [];
  const uniqueRequests: Array<{ courseId: string; classId?: string }> = [];

  for (const request of parsedInput.data.requests) {
    const key = `${request.courseId}::${request.classId ?? ""}`;

    if (duplicateMap.has(key)) {
      payloadDuplicateItems.push({
        courseId: request.courseId,
        classId: request.classId,
      });
      continue;
    }

    duplicateMap.set(key, {
      courseId: request.courseId,
      classId: request.classId,
    });
    uniqueRequests.push({
      courseId: request.courseId,
      classId: request.classId,
    });
  }

  try {
    const result = await createEnrollmentRequestsRepository({
      studentId: parsedInput.data.studentId,
      requests: uniqueRequests,
    });

    const duplicates = [
      ...result.skipped,
      ...payloadDuplicateItems,
    ];

    return {
      ok: true,
      data: {
        created: result.created.length,
        skipped: duplicates.length,
        duplicates,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo yêu cầu đăng ký học phần.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function listEnrollmentRequestsForStudent(
  studentId: string,
): Promise<ServiceResult<EnrollmentRequestSummary[]>> {
  try {
    const requests = await listEnrollmentRequestsForStudentRepository(studentId);
    return { ok: true, data: requests };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải yêu cầu tham gia lớp học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function listEnrollmentRequestsByClassIds(
  classIds: string[],
): Promise<ServiceResult<EnrollmentRequestSummary[]>> {
  try {
    const requests = await listEnrollmentRequestsByClassIdsRepository(classIds);
    return { ok: true, data: requests };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải yêu cầu tham gia theo lớp.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Reviews an enrollment request. Approval linkage to class membership is handled in later implementation.
 */
export async function reviewEnrollmentRequest(
  input: Parameters<typeof reviewEnrollmentRequestSchema.parse>[0],
): Promise<ServiceResult<{ requestId: string; status: "approved" | "rejected" }>> {
  const parsedInput = reviewEnrollmentRequestSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu duyệt yêu cầu đăng ký không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    if (parsedInput.data.actorRole !== "teacher") {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Chỉ giảng viên phụ trách lớp được duyệt yêu cầu tham gia lớp học.",
        },
      };
    }

    const reviewed = await reviewEnrollmentRequestRepository({
      requestId: parsedInput.data.requestId,
      actorId: parsedInput.data.actorId,
      actorRole: parsedInput.data.actorRole,
      status: parsedInput.data.decision,
      note: parsedInput.data.note,
    });

    if (!reviewed) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy yêu cầu đăng ký cần duyệt.",
        },
      };
    }

    return {
      ok: true,
      data: {
        requestId: reviewed.id,
        status: reviewed.status as "approved" | "rejected",
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage === "FORBIDDEN_SCOPE_REVIEW") {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Bạn không có quyền duyệt yêu cầu đăng ký trong phạm vi này.",
        },
      };
    }

    if (errorMessage === "NO_ACTIVE_CLASS_FOR_COURSE" || errorMessage === "MULTIPLE_ACTIVE_CLASSES_FOR_COURSE") {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Không thể duyệt yêu cầu vì chưa xác định được lớp học phần mục tiêu.",
          details: errorMessage,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể duyệt yêu cầu đăng ký.",
        details: errorMessage,
      },
    };
  }
}

/**
 * Reviews multiple enrollment requests with one decision while preserving per-item outcomes.
 */
export async function reviewEnrollmentRequestsBatch(
  input: Parameters<typeof reviewEnrollmentRequestsBatchSchema.parse>[0],
): Promise<ServiceResult<EnrollmentRequestBatchReviewResult>> {
  const parsedInput = reviewEnrollmentRequestsBatchSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu duyệt hàng loạt yêu cầu đăng ký không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const results: EnrollmentRequestBatchReviewResult["results"] = [];

  if (parsedInput.data.actorRole !== "teacher") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ giảng viên phụ trách lớp được duyệt yêu cầu tham gia lớp học.",
      },
    };
  }

  for (const request of parsedInput.data.requests) {
    const reviewed = await reviewEnrollmentRequest({
      requestId: request.requestId,
      actorId: parsedInput.data.actorId,
      actorRole: parsedInput.data.actorRole,
      decision: parsedInput.data.decision,
      note: parsedInput.data.note,
    });

    if (reviewed.ok) {
      results.push({
        requestId: request.requestId,
        ok: true,
        status: reviewed.data.status,
      });
      continue;
    }

    const errorCode =
      reviewed.error.code === "NOT_FOUND"
      || reviewed.error.code === "FORBIDDEN"
      || reviewed.error.code === "CONFLICT"
        ? reviewed.error.code
        : "UNKNOWN_ERROR";

    results.push({
      requestId: request.requestId,
      ok: false,
      errorCode,
      message: reviewed.error.message,
    });
  }

  const reviewedCount = results.filter((item) => item.ok).length;

  return {
    ok: true,
    data: {
      reviewed: reviewedCount,
      failed: results.length - reviewedCount,
      results,
    },
  };
}
