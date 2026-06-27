import {
  attachQuestionBankItemsToAssessmentRepository,
  createQuestionBankItemRepository,
  listCourseAssessmentResultsByCourseIdsRepository,
  listCourseAssessmentResultsRepository,
  listQuestionBankItemsForCoursesRepository,
  listQuestionBankItemsForCourseRepository,
} from "@/lib/repositories/question-bank-repository";
import type { CourseAssessmentResultItem, QuestionBankItem, QuestionDifficulty, QuestionType } from "@/lib/types/question-bank";
import type { ServiceResult } from "@/lib/types/service-result";

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
  difficulty: QuestionDifficulty;
  defaultPoints: number;
}): Promise<ServiceResult<QuestionBankItem>> {
  if (input.actorRole !== "teacher" && input.actorRole !== "moderator" && input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền tạo câu hỏi cho ngân hàng đề thi.",
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
        difficulty: input.difficulty,
        defaultPoints: input.defaultPoints,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo câu hỏi trong ngân hàng đề thi.",
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
