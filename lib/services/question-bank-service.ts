import {
  attachQuestionBankItemsToAssessmentRepository,
  archiveQuestionBankItemRepository,
  createQuestionBankItemRepository,
  listCourseAssessmentResultsByCourseIdsRepository,
  listCourseAssessmentResultsRepository,
  listQuestionBankItemsForCoursesRepository,
  listQuestionBankItemsForCourseRepository,
  updateQuestionBankItemAvailabilityRepository,
  updateQuestionBankItemRepository,
} from "@/lib/repositories/question-bank-repository";
import type { CourseAssessmentResultItem, QuestionBankItem, QuestionDifficulty, QuestionType } from "@/lib/types/question-bank";
import type { ServiceResult } from "@/lib/types/service-result";

function normalizeQuestionBankMutationError(error: unknown): { message: string; details?: string } {
  if (error && typeof error === "object") {
    const errorLike = error as { code?: unknown; message?: unknown; details?: unknown };
    const code = typeof errorLike.code === "string" ? errorLike.code : undefined;
    const message = typeof errorLike.message === "string" ? errorLike.message : "";
    const details = typeof errorLike.details === "string" ? errorLike.details : undefined;

    if (code === "23514" && message.includes("question_bank_items_difficulty_check")) {
      return {
        message: "Mức độ câu hỏi hiện không hợp lệ với cấu hình dữ liệu đang áp dụng.",
        details,
      };
    }

    if (message) {
      return { message, details };
    }
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: String(error) };
}

export async function listQuestionBankItemsForCourse(input: {
  courseId: string;
}): Promise<ServiceResult<QuestionBankItem[]>> {
  try {
    return {
      ok: true,
      data: await listQuestionBankItemsForCourseRepository(input.courseId),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải ngân hàng đề thi của học phần.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function listQuestionBankItemsForCourses(input: {
  courseIds: string[];
}): Promise<ServiceResult<QuestionBankItem[]>> {
  try {
    return {
      ok: true,
      data: await listQuestionBankItemsForCoursesRepository(input.courseIds),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải ngân hàng đề thi của các học phần.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function createQuestionBankItem(input: {
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  courseId: string;
  prompt: string;
  questionType: QuestionType;
  choices: string[];
  answerKey: unknown;
  explanation?: string;
  cloCode?: string;
  chapterLabel?: string;
  difficulty: QuestionDifficulty;
  defaultPoints: number;
}): Promise<ServiceResult<QuestionBankItem>> {
  if (input.actorRole !== "moderator") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ GIÁM SÁT VIÊN được tạo câu hỏi cho ngân hàng đề thi.",
      },
    };
  }

  if (!input.prompt.trim()) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Nội dung câu hỏi là bắt buộc.",
      },
    };
  }

  try {
    return {
      ok: true,
      data: await createQuestionBankItemRepository({
        courseId: input.courseId,
        actorId: input.actorId,
        prompt: input.prompt.trim(),
        questionType: input.questionType,
        choices: input.choices,
        answerKey: input.answerKey,
        explanation: input.explanation,
        cloCode: input.cloCode,
        chapterLabel: input.chapterLabel,
        difficulty: input.difficulty,
        defaultPoints: input.defaultPoints,
      }),
    };
  } catch (error) {
    const normalizedError = normalizeQuestionBankMutationError(error);
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: normalizedError.message || "Không thể tạo câu hỏi trong ngân hàng đề thi.",
        details: normalizedError.details ?? normalizedError.message,
      },
    };
  }
}

export async function updateQuestionBankItem(input: {
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  questionBankItemId: string;
  prompt: string;
  questionType: QuestionType;
  choices: string[];
  answerKey: unknown;
  explanation?: string;
  cloCode?: string;
  chapterLabel?: string;
  difficulty: QuestionDifficulty;
  defaultPoints: number;
}): Promise<ServiceResult<QuestionBankItem>> {
  if (input.actorRole !== "moderator") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ GIÁM SÁT VIÊN được chỉnh sửa câu hỏi ngân hàng đề thi.",
      },
    };
  }

  if (!input.prompt.trim()) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Nội dung câu hỏi là bắt buộc.",
      },
    };
  }

  try {
    const updated = await updateQuestionBankItemRepository({
      questionBankItemId: input.questionBankItemId,
      prompt: input.prompt.trim(),
      questionType: input.questionType,
      choices: input.choices,
      answerKey: input.answerKey,
      explanation: input.explanation,
      cloCode: input.cloCode,
      chapterLabel: input.chapterLabel,
      difficulty: input.difficulty,
      defaultPoints: input.defaultPoints,
    });

    if (!updated) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy câu hỏi để cập nhật.",
        },
      };
    }

    return { ok: true, data: updated };
  } catch (error) {
    const normalizedError = normalizeQuestionBankMutationError(error);
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: normalizedError.message || "Không thể cập nhật câu hỏi trong ngân hàng đề thi.",
        details: normalizedError.details ?? normalizedError.message,
      },
    };
  }
}

export async function updateQuestionBankItemAvailability(input: {
  actorRole: "admin" | "moderator" | "teacher" | "student";
  questionBankItemId: string;
  isAvailable: boolean;
}): Promise<ServiceResult<QuestionBankItem>> {
  if (input.actorRole !== "moderator") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ GIÁM SÁT VIÊN được đổi trạng thái khả dụng của câu hỏi.",
      },
    };
  }

  try {
    const updated = await updateQuestionBankItemAvailabilityRepository({
      questionBankItemId: input.questionBankItemId,
      isAvailable: input.isAvailable,
    });

    if (!updated) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy câu hỏi để cập nhật trạng thái.",
        },
      };
    }

    return { ok: true, data: updated };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể cập nhật trạng thái khả dụng của câu hỏi.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function archiveQuestionBankItem(input: {
  actorRole: "admin" | "moderator" | "teacher" | "student";
  questionBankItemId: string;
}): Promise<ServiceResult<QuestionBankItem>> {
  if (input.actorRole !== "moderator") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ GIÁM SÁT VIÊN được xóa câu hỏi khỏi ngân hàng đề thi.",
      },
    };
  }

  try {
    const archived = await archiveQuestionBankItemRepository(input.questionBankItemId);

    if (!archived) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy câu hỏi để xóa.",
        },
      };
    }

    return { ok: true, data: archived };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể xóa câu hỏi khỏi ngân hàng đề thi.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function attachQuestionBankItemsToAssessment(input: {
  assessmentId: string;
  questionIds: string[];
}): Promise<ServiceResult<{ linked: number }>> {
  try {
    await attachQuestionBankItemsToAssessmentRepository(input);
    return {
      ok: true,
      data: {
        linked: input.questionIds.length,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể gắn câu hỏi vào bài kiểm tra.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function listCourseAssessmentResults(input: {
  courseId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
}): Promise<ServiceResult<CourseAssessmentResultItem[]>> {
  if (input.actorRole === "student") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Sinh viên không có quyền xem kho kết quả kiểm tra theo học phần.",
      },
    };
  }

  try {
    return {
      ok: true,
      data: await listCourseAssessmentResultsRepository(input.courseId),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải kho kết quả kiểm tra theo học phần.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function listCourseAssessmentResultsByCourseIds(input: {
  courseIds: string[];
  actorRole: "admin" | "moderator" | "teacher" | "student";
}): Promise<ServiceResult<CourseAssessmentResultItem[]>> {
  if (input.actorRole === "student") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Sinh viên không có quyền xem kho kết quả kiểm tra theo học phần.",
      },
    };
  }

  try {
    return {
      ok: true,
      data: await listCourseAssessmentResultsByCourseIdsRepository(input.courseIds),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải kho kết quả kiểm tra theo các học phần.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
