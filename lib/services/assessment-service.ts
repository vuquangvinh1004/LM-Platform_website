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
import { getAssessmentAuthoringModeRepository, getInternalAssessmentDefinitionRepository } from "@/lib/repositories/assessment-runtime-repository";
import { getStudentAssessmentListStatus, isArchivedAssessment, isDraftAssessment } from "@/lib/policies/assessment-policy";
import type { AssessmentAuthoringMode, AssessmentDeliveryMode, AssessmentSummary, StudentAssessmentSummary, StudentAssessmentView } from "@/lib/types/assessment";
import type { InternalAssessmentDefinition } from "@/lib/types/assessment-runtime";
import type { ServiceResult } from "@/lib/types/service-result";
import {
  createAssessmentSchema,
  deleteAssessmentSchema,
  getAssessmentForStudentSchema,
  listAssessmentsForManagerSchema,
  listAssessmentsForStudentSchema,
  updateAssessmentStatusSchema,
} from "@/lib/validators/assessment-validator";
import { getAssessmentAuthoringModeSchema, getInternalAssessmentDefinitionSchema } from "@/lib/validators/assessment-runtime-validator";

function normalizeAssessmentProviderSettings(input: {
  deliveryMode: AssessmentDeliveryMode;
  provider: "google_form" | "microsoft_form" | "manual" | "internal" | "other";
  formUrl?: string;
  embedMode?: "iframe" | "new_tab" | "disabled";
}): ServiceResult<{
  provider: "google_form" | "microsoft_form" | "manual" | "internal" | "other";
  formUrl?: string;
  embedMode: "iframe" | "new_tab" | "disabled";
}> {
  const formUrl = input.formUrl?.trim();
  let resolvedProvider = input.provider;

  if (input.deliveryMode === "internal") {
    return {
      ok: true,
      data: {
        provider: "internal",
        embedMode: "disabled",
      },
    };
  }

  if (resolvedProvider === "internal") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Provider internal chỉ dùng cho bài kiểm tra nội bộ.",
        field: "provider",
      },
    };
  }

  if (!formUrl) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Bài kiểm tra biểu mẫu ngoài phải có liên kết nguồn biểu mẫu.",
        field: "formUrl",
      },
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(formUrl);
  } catch {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Liên kết biểu mẫu không hợp lệ.",
        field: "formUrl",
      },
    };
  }

  if (parsedUrl.hostname === "docs.google.com" && parsedUrl.pathname.includes("/forms/") || parsedUrl.hostname === "forms.gle") {
    resolvedProvider = "google_form";
  } else if (parsedUrl.hostname === "forms.office.com" || parsedUrl.hostname.endsWith(".forms.office.com")) {
    resolvedProvider = "microsoft_form";
  }

  if (resolvedProvider === "google_form") {
    const isValidGoogleForm =
      parsedUrl.hostname === "docs.google.com" && parsedUrl.pathname.includes("/forms/")
      || parsedUrl.hostname === "forms.gle";

    if (!isValidGoogleForm) {
      return {
        ok: false,
        error: {
          code: "EXTERNAL_PROVIDER_ERROR",
          message: "Liên kết Google Form không hợp lệ.",
          field: "formUrl",
        },
      };
    }

    return {
      ok: true,
      data: {
        provider: resolvedProvider,
        formUrl,
        embedMode: input.embedMode ?? "iframe",
      },
    };
  }

  if (resolvedProvider === "microsoft_form") {
    const isValidMicrosoftForm = parsedUrl.hostname === "forms.office.com" || parsedUrl.hostname.endsWith(".forms.office.com");

    if (!isValidMicrosoftForm) {
      return {
        ok: false,
        error: {
          code: "EXTERNAL_PROVIDER_ERROR",
          message: "Liên kết Microsoft Form không hợp lệ.",
          field: "formUrl",
        },
      };
    }

    return {
      ok: true,
      data: {
        provider: resolvedProvider,
        formUrl,
        // Microsoft Forms often blocks iframe in many tenants; default to new tab.
        embedMode: input.embedMode === "iframe" ? "new_tab" : (input.embedMode ?? "new_tab"),
      },
    };
  }

  return {
    ok: true,
    data: {
      provider: resolvedProvider,
      formUrl,
      embedMode: input.embedMode ?? "new_tab",
    },
  };
}

/**
 * Creates an assessment link while validating provider URL and manager role.
 */
export async function createAssessment(
  input: Parameters<typeof createAssessmentSchema.parse>[0],
): Promise<ServiceResult<AssessmentSummary>> {
  const parsedInput = createAssessmentSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu tạo bài kiểm tra không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const normalizedInput = parsedInput.data;

  if (normalizedInput.actorRole !== "teacher") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ giảng viên được tạo bài kiểm tra.",
      },
    };
  }

  const providerSettings = normalizeAssessmentProviderSettings({
    deliveryMode: normalizedInput.deliveryMode,
    provider: normalizedInput.provider,
    formUrl: normalizedInput.formUrl,
    embedMode: normalizedInput.embedMode,
  });

  if (!providerSettings.ok) {
    return providerSettings;
  }

  const normalizedStatus = normalizedInput.status ?? "draft";
  const normalizedAttemptLimit = normalizedStatus === "open" ? 1 : (normalizedInput.attemptLimit ?? 1);
  const normalizedTimeLimitMinutes = isDraftAssessment(normalizedStatus) ? undefined : normalizedInput.timeLimitMinutes;

  try {
    const created = await createAssessmentRepository({
      classId: normalizedInput.classId,
      courseId: normalizedInput.courseId,
      actorId: normalizedInput.actorId,
      title: normalizedInput.title,
      description: normalizedInput.description,
      deliveryMode: normalizedInput.deliveryMode,
      provider: providerSettings.data.provider,
      formUrl: providerSettings.data.formUrl,
      embedMode: providerSettings.data.embedMode,
      maxScore: normalizedInput.maxScore,
      attemptLimit: normalizedAttemptLimit,
      shuffleQuestions: normalizedInput.shuffleQuestions ?? false,
      showFeedbackAfterSubmit: normalizedInput.showFeedbackAfterSubmit ?? false,
      timeLimitMinutes: normalizedTimeLimitMinutes,
      openAt: normalizedInput.openAt,
      dueAt: normalizedInput.dueAt,
      status: normalizedStatus,
    });

    return {
      ok: true,
      data: created,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo bài kiểm tra.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Returns authoring mode flags so UI can branch between external and internal flows.
 */
export async function getAssessmentAuthoringMode(
  input: Parameters<typeof getAssessmentAuthoringModeSchema.parse>[0],
): Promise<ServiceResult<AssessmentAuthoringMode>> {
  const parsedInput = getAssessmentAuthoringModeSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu chế độ biên soạn bài kiểm tra không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole !== "teacher" && parsedInput.data.actorRole !== "moderator" && parsedInput.data.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền xem cấu hình bài kiểm tra.",
      },
    };
  }

  try {
    const assessment = await getAssessmentAuthoringModeRepository(parsedInput.data.assessmentId);

    if (!assessment) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy bài kiểm tra hoặc bạn không có quyền xem.",
        },
      };
    }

    return {
      ok: true,
      data: assessment,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải cấu hình bài kiểm tra.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Loads the internal assessment definition and question snapshots for authoring/runtime setup.
 */
export async function getInternalAssessmentDefinition(
  input: Parameters<typeof getInternalAssessmentDefinitionSchema.parse>[0],
): Promise<ServiceResult<InternalAssessmentDefinition>> {
  const parsedInput = getInternalAssessmentDefinitionSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu đề kiểm tra nội bộ không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (
    parsedInput.data.actorRole !== "teacher"
    && parsedInput.data.actorRole !== "moderator"
    && parsedInput.data.actorRole !== "admin"
    && parsedInput.data.actorRole !== "student"
  ) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền xem đề kiểm tra nội bộ.",
      },
    };
  }

  try {
    const definition = await getInternalAssessmentDefinitionRepository(parsedInput.data.assessmentId);

    if (!definition) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy đề kiểm tra nội bộ hoặc bạn không có quyền xem.",
        },
      };
    }

    return {
      ok: true,
      data: parsedInput.data.actorRole === "student"
        ? {
            ...definition,
            questions: definition.questions.map((question) => ({
              ...question,
              answerKey: null,
            })),
          }
        : definition,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải đề kiểm tra nội bộ.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Lists assessments manageable by current teacher/moderator/admin.
 */
export async function listAssessmentsForManager(
  input: Parameters<typeof listAssessmentsForManagerSchema.parse>[0],
): Promise<ServiceResult<{ items: AssessmentSummary[] }>> {
  const parsedInput = listAssessmentsForManagerSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu danh sách bài kiểm tra không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole !== "teacher" && parsedInput.data.actorRole !== "moderator" && parsedInput.data.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền xem danh sách bài kiểm tra.",
      },
    };
  }

  try {
    const items = await listAssessmentsForManagerRepository({
      classId: parsedInput.data.classId,
    });

    return {
      ok: true,
      data: {
        items,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải danh sách bài kiểm tra.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Lists student-visible assessments.
 */
export async function listAssessmentsForStudent(
  input: Parameters<typeof listAssessmentsForStudentSchema.parse>[0],
): Promise<ServiceResult<{ items: StudentAssessmentSummary[] }>> {
  const parsedInput = listAssessmentsForStudentSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu danh sách bài kiểm tra cho sinh viên không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const assessments = await listAssessmentsForStudentRepository({
      classId: parsedInput.data.classId,
    });
    const completedAssessmentIds = await listCompletedAssessmentIdsForStudentRepository({
      studentId: parsedInput.data.studentId,
      assessmentIds: assessments.map((assessment) => assessment.id),
    });
    const now = Date.now();
    const items = assessments.map((assessment) => ({
      ...assessment,
      studentListStatus: getStudentAssessmentListStatus({
        assessment,
        completedAssessmentIds,
        now,
      }),
    }));

    return {
      ok: true,
      data: {
        items,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải danh sách bài kiểm tra cho sinh viên.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Updates lifecycle status of one assessment that the current manager can control.
 */
export async function updateAssessmentStatus(
  input: Parameters<typeof updateAssessmentStatusSchema.parse>[0],
): Promise<ServiceResult<AssessmentSummary>> {
  const parsedInput = updateAssessmentStatusSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu cập nhật trạng thái bài kiểm tra không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (
    parsedInput.data.actorRole !== "teacher"
    && parsedInput.data.actorRole !== "moderator"
    && parsedInput.data.actorRole !== "admin"
  ) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền cập nhật trạng thái bài kiểm tra.",
      },
    };
  }

  try {
    const currentAssessment = await getAssessmentSummaryRepository(parsedInput.data.assessmentId);

    if (!currentAssessment) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy bài kiểm tra hoặc bạn không có quyền cập nhật.",
        },
      };
    }

    if (isDraftAssessment(currentAssessment.status) && parsedInput.data.status !== "draft") {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Bài kiểm tra Bản nháp chỉ dùng để hỗ trợ học tập và không thể chuyển sang trạng thái khác.",
        },
      };
    }

    if (!isDraftAssessment(currentAssessment.status) && parsedInput.data.status === "draft") {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Không thể chuyển bài kiểm tra chính thức sang trạng thái Bản nháp.",
        },
      };
    }

    const updated = await updateAssessmentStatusRepository({
      assessmentId: parsedInput.data.assessmentId,
      status: parsedInput.data.status,
    });

    if (!updated) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy bài kiểm tra hoặc bạn không có quyền cập nhật.",
        },
      };
    }

    return {
      ok: true,
      data: updated,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể cập nhật trạng thái bài kiểm tra.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function deleteAssessment(
  input: Parameters<typeof deleteAssessmentSchema.parse>[0],
): Promise<ServiceResult<{ assessmentId: string }>> {
  const parsedInput = deleteAssessmentSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu xóa bài kiểm tra không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (
    parsedInput.data.actorRole !== "teacher"
    && parsedInput.data.actorRole !== "moderator"
    && parsedInput.data.actorRole !== "admin"
  ) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền xóa bài kiểm tra.",
      },
    };
  }

  try {
    const currentAssessment = await getAssessmentSummaryRepository(parsedInput.data.assessmentId);

    if (!currentAssessment) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy bài kiểm tra hoặc bạn không có quyền xóa.",
        },
      };
    }

    const deleted = await deleteAssessmentRepository(parsedInput.data.assessmentId);

    if (!deleted) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy bài kiểm tra hoặc bạn không có quyền xóa.",
        },
      };
    }

    return {
      ok: true,
      data: {
        assessmentId: parsedInput.data.assessmentId,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể xóa bài kiểm tra.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Loads one assessment for student and blocks closed/invalid links by default.
 */
export async function getAssessmentForStudent(
  input: Parameters<typeof getAssessmentForStudentSchema.parse>[0],
): Promise<ServiceResult<StudentAssessmentView>> {
  const parsedInput = getAssessmentForStudentSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu bài kiểm tra sinh viên không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const assessment = await getAssessmentForStudentRepository(parsedInput.data.assessmentId);

    if (!assessment) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy bài kiểm tra hoặc bạn không có quyền xem.",
        },
      };
    }

    if (isArchivedAssessment(assessment.status)) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Bài kiểm tra này hiện không còn khả dụng.",
        },
      };
    }

    if (!isDraftAssessment(assessment.status) && assessment.status !== "open" && assessment.status !== "closed") {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Bài kiểm tra đang đóng hoặc chưa sẵn sàng.",
        },
      };
    }

    return {
      ok: true,
      data: assessment,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải bài kiểm tra.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
