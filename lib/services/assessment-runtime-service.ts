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
import { upsertCourseAssessmentResultRepository } from "@/lib/repositories/question-bank-repository";
import { findStudentProfilesByIdsServiceRepository, upsertSubmissionRepository } from "@/lib/repositories/submission-repository";
import { getAssessmentSummaryRepository } from "@/lib/repositories/assessment-repository";
import { getAssessmentStartBlockedReason, isDraftAssessment, toTimestamp } from "@/lib/policies/assessment-policy";
import { getInternalAssessmentDefinition } from "@/lib/services/assessment-service";
import type {
  AssessmentQuestionSnapshot,
  AssessmentAnswerRecord,
  AssessmentAttemptGradingView,
  InternalAssessmentDefinition,
  StudentAssessmentReview,
  StudentAssessmentAttemptView,
} from "@/lib/types/assessment-runtime";
import type { ServiceResult } from "@/lib/types/service-result";
import type { SubmissionStatus } from "@/lib/types/submission";
import {
  getAssessmentAttemptForStudentSchema,
  getStudentAssessmentReviewSchema,
  saveAssessmentAnswerSchema,
  startAssessmentAttemptSchema,
  submitAssessmentAttemptSchema,
  teacherGradeAnswerSchema,
} from "@/lib/validators/assessment-runtime-validator";

function isAttemptExpired(expiresAt?: string): boolean {
  const expiresTimestamp = toTimestamp(expiresAt);
  return expiresTimestamp !== null && expiresTimestamp <= Date.now();
}

async function markAttemptExpired(attemptId: string): Promise<void> {
  await updateAssessmentAttemptStatusRepository({
    attemptId,
    status: "expired",
    metadata: {
      reason: "time_limit_reached",
    },
  });
}

async function expireAttemptIfNeeded(attempt: StudentAssessmentAttemptView["attempt"]): Promise<StudentAssessmentAttemptView["attempt"]> {
  if (!attempt || attempt.status !== "in_progress" || !isAttemptExpired(attempt.expiresAt)) {
    return attempt;
  }

  return updateAssessmentAttemptStatusRepository({
    attemptId: attempt.id,
    status: "expired",
    metadata: {
      reason: "time_limit_reached",
    },
  });
}

function normalizeComparable(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isAnswerPayloadEmpty(answerPayload: Record<string, unknown>): boolean {
  return Object.values(answerPayload).every((value) => {
    if (Array.isArray(value)) {
      return value.length === 0;
    }

    if (typeof value === "string") {
      return value.trim().length === 0;
    }

    return value === null || value === undefined;
  });
}

function extractStudentIdentifier(profile: {
  email?: string | null;
  studentCode?: string;
  fullName?: string;
  student_code?: string | null;
  full_name?: string;
}): string {
  return profile.studentCode?.trim()
    || profile.student_code?.trim()
    || profile.email?.trim().toLowerCase()
    || profile.fullName?.trim()
    || profile.full_name?.trim()
    || "student";
}

function sanitizeDefinitionForStudent(definition: InternalAssessmentDefinition): InternalAssessmentDefinition {
  return {
    ...definition,
    questions: definition.questions.map((question) => ({
      ...question,
      answerKey: null,
    })),
  };
}

function scoreQuestion(question: AssessmentQuestionSnapshot, answer?: AssessmentAnswerRecord): {
  autoScore?: number;
  finalScore?: number;
  pendingManual: boolean;
} {
  if (!answer || isAnswerPayloadEmpty(answer.answerPayload)) {
    return {
      autoScore: question.questionType === "essay" ? undefined : 0,
      finalScore: question.questionType === "essay" ? undefined : 0,
      pendingManual: question.questionType === "essay",
    };
  }

  if (question.questionType === "essay") {
    return {
      pendingManual: true,
    };
  }

  const rawStudentValue =
    answer.answerPayload.value
    ?? answer.answerPayload.text
    ?? answer.answerPayload.values
    ?? answer.answerPayload;

  const normalizedStudentValue = Array.isArray(rawStudentValue)
    ? rawStudentValue.map((value) => normalizeComparable(value)).sort()
    : normalizeComparable(rawStudentValue);

  const rawAnswerKey = question.answerKey;
  const normalizedAnswerKey = Array.isArray(rawAnswerKey)
    ? rawAnswerKey.map((value) => normalizeComparable(value)).sort()
    : normalizeComparable(rawAnswerKey);

  const isCorrect = Array.isArray(normalizedStudentValue) && Array.isArray(normalizedAnswerKey)
    ? normalizedStudentValue.length === normalizedAnswerKey.length
      && normalizedStudentValue.every((value, index) => value === normalizedAnswerKey[index])
    : normalizedStudentValue === normalizedAnswerKey;

  const awardedScore = isCorrect ? question.points : 0;

  return {
    autoScore: awardedScore,
    finalScore: awardedScore,
    pendingManual: false,
  };
}

function findQuestionScoreValue(input: {
  question: AssessmentQuestionSnapshot;
  scoresByQuestionId: Map<string, AssessmentAttemptGradingView["scores"][number]>;
}): {
  finalScore: number;
  pendingManual: boolean;
} {
  const score = input.scoresByQuestionId.get(input.question.questionBankItemId);

  if (input.question.questionType === "essay") {
    if (typeof score?.finalScore === "number") {
      return {
        finalScore: score.finalScore,
        pendingManual: false,
      };
    }

    return {
      finalScore: 0,
      pendingManual: true,
    };
  }

  return {
    finalScore: score?.finalScore ?? score?.autoScore ?? 0,
    pendingManual: false,
  };
}

function extractAnswerText(answer?: AssessmentAnswerRecord): string | undefined {
  if (!answer) {
    return undefined;
  }

  const rawValue = answer.answerPayload.text ?? answer.answerPayload.value ?? answer.answerPayload.values;

  if (Array.isArray(rawValue)) {
    return rawValue.map((value) => String(value)).join(", ");
  }

  if (typeof rawValue === "string") {
    return rawValue;
  }

  if (rawValue === null || rawValue === undefined) {
    return undefined;
  }

  return String(rawValue);
}

async function loadInternalDefinitionOrError(assessmentId: string): Promise<ServiceResult<InternalAssessmentDefinition>> {
  try {
    const definition = await getInternalAssessmentDefinitionRepository(assessmentId);

    if (!definition) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy bài kiểm tra nội bộ hoặc bạn không có quyền truy cập.",
        },
      };
    }

    return {
      ok: true,
      data: definition,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải cấu hình bài kiểm tra nội bộ.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Student-facing load: strips answer keys before sending definition to UI.
 */
export async function loadInternalAssessmentRuntime(
  input: {
    assessmentId: string;
    actorId: string;
    actorRole: "admin" | "moderator" | "teacher" | "student";
  },
): Promise<ServiceResult<InternalAssessmentDefinition>> {
  const definitionResult = await getInternalAssessmentDefinition(input);

  if (!definitionResult.ok) {
    return definitionResult;
  }

  if (input.actorRole === "student") {
    return {
      ok: true,
      data: sanitizeDefinitionForStudent(definitionResult.data),
    };
  }

  return definitionResult;
}

export async function startAssessmentAttempt(
  input: Parameters<typeof startAssessmentAttemptSchema.parse>[0],
): Promise<ServiceResult<StudentAssessmentAttemptView>> {
  const parsedInput = startAssessmentAttemptSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu bắt đầu lượt làm bài không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const definitionResult = await loadInternalDefinitionOrError(parsedInput.data.assessmentId);

  if (!definitionResult.ok) {
    return definitionResult;
  }

  const definition = definitionResult.data;
  const now = Date.now();
  const blockedReason = getAssessmentStartBlockedReason({
    assessment: {
      status: definition.status,
      openAt: definition.openAt,
      dueAt: definition.dueAt,
      attemptLimit: definition.attemptLimit,
    },
    now,
    usedAttempts: 0,
  });

    if (blockedReason) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: blockedReason,
        },
      };
    }

  try {
    const currentAttemptView = await findStudentAssessmentAttemptRepository({
      assessmentId: parsedInput.data.assessmentId,
      studentId: parsedInput.data.studentId,
    });

    if (currentAttemptView.attempt && currentAttemptView.attempt.status === "in_progress") {
      if (isAttemptExpired(currentAttemptView.attempt.expiresAt)) {
        await markAttemptExpired(currentAttemptView.attempt.id);
      } else {
        return {
          ok: true,
          data: currentAttemptView,
        };
      }
    }

    const usedAttempts = currentAttemptView.attempt?.attemptNumber ?? 0;
    if (usedAttempts >= definition.attemptLimit) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Bạn đã dùng hết số lượt làm bài cho bài kiểm tra này.",
        },
      };
    }

    const expiresAt = !isDraftAssessment(definition.status) && definition.timeLimitMinutes
      ? new Date(now + (definition.timeLimitMinutes * 60 * 1000)).toISOString()
      : undefined;

    const attempt = await createAssessmentAttemptRepository({
      assessmentId: parsedInput.data.assessmentId,
      studentId: parsedInput.data.studentId,
      attemptNumber: usedAttempts + 1,
      expiresAt,
      metadata: {
        deliveryMode: "internal",
      },
    });

    return {
      ok: true,
      data: {
        attempt,
        answers: [],
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể bắt đầu lượt làm bài.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function startExternalAssessmentAttempt(
  input: Parameters<typeof startAssessmentAttemptSchema.parse>[0],
): Promise<ServiceResult<StudentAssessmentAttemptView>> {
  const parsedInput = startAssessmentAttemptSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu bắt đầu lượt làm bài không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const assessment = await getAssessmentSummaryRepository(parsedInput.data.assessmentId);

    if (!assessment) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy bài kiểm tra hoặc bạn không có quyền truy cập.",
        },
      };
    }

    if (assessment.deliveryMode !== "external") {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Bài kiểm tra này không dùng luồng biểu mẫu ngoài.",
        },
      };
    }

    const now = Date.now();
    const blockedReason = getAssessmentStartBlockedReason({
      assessment: {
        status: assessment.status,
        openAt: assessment.openAt,
        dueAt: assessment.dueAt,
        attemptLimit: assessment.attemptLimit,
      },
      now,
      usedAttempts: 0,
    });

    if (blockedReason) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: blockedReason,
        },
      };
    }

    const currentAttemptView = await findStudentAssessmentAttemptRepository({
      assessmentId: parsedInput.data.assessmentId,
      studentId: parsedInput.data.studentId,
    });
    const currentAttempt = await expireAttemptIfNeeded(currentAttemptView.attempt);

    if (currentAttempt && currentAttempt.status === "in_progress") {
      return {
        ok: true,
        data: {
          attempt: currentAttempt,
          answers: currentAttemptView.answers,
        },
      };
    }

    const usedAttempts = currentAttempt?.attemptNumber ?? 0;
    if (usedAttempts >= assessment.attemptLimit) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Bạn đã dùng hết số lượt làm bài cho bài kiểm tra này.",
        },
      };
    }

    const expiresAt = !isDraftAssessment(assessment.status) && assessment.timeLimitMinutes
      ? new Date(now + (assessment.timeLimitMinutes * 60 * 1000)).toISOString()
      : undefined;

    const attempt = await createAssessmentAttemptRepository({
      assessmentId: parsedInput.data.assessmentId,
      studentId: parsedInput.data.studentId,
      attemptNumber: usedAttempts + 1,
      expiresAt,
      metadata: {
        deliveryMode: "external",
      },
    });

    return {
      ok: true,
      data: {
        attempt,
        answers: [],
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể bắt đầu lượt làm bài biểu mẫu ngoài.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function getAssessmentAttemptForStudent(
  input: Parameters<typeof getAssessmentAttemptForStudentSchema.parse>[0],
): Promise<ServiceResult<StudentAssessmentAttemptView>> {
  const parsedInput = getAssessmentAttemptForStudentSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu lượt làm bài không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const attemptView = await findStudentAssessmentAttemptRepository(parsedInput.data);
    const attempt = await expireAttemptIfNeeded(attemptView.attempt);

    return {
      ok: true,
      data: {
        attempt,
        answers: attemptView.answers,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải lượt làm bài hiện tại.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function saveAssessmentAnswer(
  input: Parameters<typeof saveAssessmentAnswerSchema.parse>[0],
): Promise<ServiceResult<AssessmentAnswerRecord>> {
  const parsedInput = saveAssessmentAnswerSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu lưu câu trả lời không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const attemptViewResult = await getAssessmentAttemptForStudent({
    assessmentId: parsedInput.data.assessmentId,
    studentId: parsedInput.data.studentId,
    attemptId: parsedInput.data.attemptId,
  });

  if (!attemptViewResult.ok) {
    return attemptViewResult;
  }

  if (!attemptViewResult.data.attempt) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Không tìm thấy lượt làm bài để lưu đáp án.",
      },
    };
  }

  if (attemptViewResult.data.attempt.status !== "in_progress") {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Lượt làm bài này đã được nộp hoặc đã khóa.",
      },
    };
  }

  if (isAttemptExpired(attemptViewResult.data.attempt.expiresAt)) {
    await markAttemptExpired(parsedInput.data.attemptId);

    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Lượt làm bài đã hết thời gian và bị khóa.",
      },
    };
  }

  const definitionResult = await loadInternalDefinitionOrError(parsedInput.data.assessmentId);

  if (!definitionResult.ok) {
    return definitionResult;
  }

  const question = definitionResult.data.questions.find((item) => item.questionBankItemId === parsedInput.data.questionBankItemId);

  if (!question) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Không tìm thấy câu hỏi tương ứng trong đề kiểm tra.",
      },
    };
  }

  try {
    return {
      ok: true,
      data: await upsertAssessmentAnswerRepository({
        attemptId: parsedInput.data.attemptId,
        assessmentId: parsedInput.data.assessmentId,
        questionBankItemId: parsedInput.data.questionBankItemId,
        sortOrder: parsedInput.data.sortOrder,
        answerPayload: parsedInput.data.answerPayload,
        isFinal: parsedInput.data.isFinal ?? false,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể lưu câu trả lời.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function submitAssessmentAttempt(
  input: Parameters<typeof submitAssessmentAttemptSchema.parse>[0],
): Promise<ServiceResult<{
  attemptId: string;
  submissionId: string;
  submissionStatus: SubmissionStatus;
  rawScore: number;
  maxScore: number;
  normalizedScore?: number;
  pendingManualReview: boolean;
}>> {
  const parsedInput = submitAssessmentAttemptSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu nộp bài không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const definitionResult = await loadInternalDefinitionOrError(parsedInput.data.assessmentId);

  if (!definitionResult.ok) {
    return definitionResult;
  }

  const definition = definitionResult.data;
  const attemptViewResult = await getAssessmentAttemptForStudent({
    assessmentId: parsedInput.data.assessmentId,
    studentId: parsedInput.data.studentId,
    attemptId: parsedInput.data.attemptId,
  });

  if (!attemptViewResult.ok) {
    return attemptViewResult;
  }

  if (!attemptViewResult.data.attempt) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Không tìm thấy lượt làm bài để nộp.",
      },
    };
  }

  if (attemptViewResult.data.attempt.status !== "in_progress") {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Lượt làm bài này đã được nộp hoặc đã khóa.",
      },
    };
  }

  if (isAttemptExpired(attemptViewResult.data.attempt.expiresAt)) {
    await markAttemptExpired(parsedInput.data.attemptId);

    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Lượt làm bài đã hết thời gian và không thể nộp tiếp.",
      },
    };
  }

  const answerByQuestionId = new Map(attemptViewResult.data.answers.map((answer) => [answer.questionBankItemId, answer]));
  const submittedAt = new Date().toISOString();
  let rawScore = 0;
  let maxScore = 0;
  let pendingManualReview = false;

  try {
    for (const question of definition.questions) {
      const answer = answerByQuestionId.get(question.questionBankItemId);
      const score = scoreQuestion(question, answer);

      maxScore += question.points;
      rawScore += score.finalScore ?? 0;
      pendingManualReview = pendingManualReview || score.pendingManual;

      await upsertAssessmentAnswerScoreRepository({
        attemptId: parsedInput.data.attemptId,
        questionBankItemId: question.questionBankItemId,
        autoScore: score.autoScore,
        finalScore: score.finalScore,
        gradedAt: score.pendingManual ? undefined : submittedAt,
      });
    }

    const normalizedScore = maxScore > 0 ? Number(((rawScore / maxScore) * 100).toFixed(2)) : undefined;
    const dueAt = toTimestamp(definition.dueAt);
    const submissionStatus: SubmissionStatus = dueAt !== null && dueAt < Date.now() ? "late" : "submitted";
    const attemptStatus = pendingManualReview ? "submitted" : "auto_graded";

    const updatedAttempt = await updateAssessmentAttemptStatusRepository({
      attemptId: parsedInput.data.attemptId,
      status: attemptStatus,
      submittedAt,
      autoGradedAt: pendingManualReview ? undefined : submittedAt,
      metadata: {
        pendingManualReview,
        rawScore,
        maxScore,
        normalizedScore,
      },
    });

    const [studentProfile] = await findStudentProfilesByIdsServiceRepository({
      studentIds: [parsedInput.data.studentId],
    });

    if (!studentProfile) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy hồ sơ sinh viên để ghi nhận kết quả.",
        },
      };
    }

    const studentIdentifier = extractStudentIdentifier(studentProfile);
    const submission = await upsertSubmissionRepository({
      assessmentId: parsedInput.data.assessmentId,
      studentId: parsedInput.data.studentId,
      studentIdentifier,
      attemptNumber: updatedAttempt.attemptNumber,
      rawScore,
      maxScore,
      normalizedScore,
      submittedAt,
      status: submissionStatus,
      source: "internal",
      metadata: {
        attemptId: updatedAttempt.id,
        pendingManualReview,
      },
    });

    await upsertCourseAssessmentResultRepository({
      courseId: definition.courseId,
      classId: definition.classId,
      assessmentId: parsedInput.data.assessmentId,
      submissionId: submission.id,
      studentId: parsedInput.data.studentId,
      studentIdentifier,
      attemptNumber: updatedAttempt.attemptNumber,
      rawScore,
      maxScore,
      normalizedScore,
      status: submissionStatus,
      source: "internal",
      submittedAt,
    });

    return {
      ok: true,
      data: {
        attemptId: parsedInput.data.attemptId,
        submissionId: submission.id,
        submissionStatus,
        rawScore,
        maxScore,
        normalizedScore,
        pendingManualReview,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể nộp bài kiểm tra nội bộ.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function finalizeAssessmentSubmission(
  input: Parameters<typeof teacherGradeAnswerSchema.parse>[0],
): Promise<ServiceResult<{
  attemptId: string;
  questionBankItemId: string;
  rawScore: number;
  maxScore: number;
  normalizedScore?: number;
  pendingManualReview: boolean;
}>> {
  const parsedInput = teacherGradeAnswerSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu chấm câu trả lời không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole !== "teacher" && parsedInput.data.actorRole !== "moderator" && parsedInput.data.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền chấm bài kiểm tra này.",
      },
    };
  }

  try {
    const attemptView = await getAssessmentAttemptGradingRepository(parsedInput.data.attemptId);

    if (!attemptView) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lượt làm bài cần chấm.",
        },
      };
    }

    const definitionResult = await loadInternalDefinitionOrError(attemptView.attempt.assessmentId);

    if (!definitionResult.ok) {
      return definitionResult;
    }

    const definition = definitionResult.data;
    const targetQuestion = definition.questions.find((question) => question.questionBankItemId === parsedInput.data.questionBankItemId);

    if (!targetQuestion) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy câu hỏi cần chấm trong đề kiểm tra.",
        },
      };
    }

    if (targetQuestion.questionType !== "essay") {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Chức năng chấm tay hiện chỉ áp dụng cho câu tự luận.",
        },
      };
    }

    const finalScore = parsedInput.data.finalScore ?? parsedInput.data.manualScore ?? parsedInput.data.autoScore;

    if (typeof finalScore !== "number") {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Bạn cần nhập điểm cuối cùng cho câu tự luận.",
          field: "finalScore",
        },
      };
    }

    if (finalScore > targetQuestion.points) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Điểm câu tự luận không được vượt quá ${targetQuestion.points}.`,
          field: "finalScore",
        },
      };
    }

    const gradedAt = new Date().toISOString();

    await upsertAssessmentAnswerScoreRepository({
      attemptId: parsedInput.data.attemptId,
      questionBankItemId: parsedInput.data.questionBankItemId,
      autoScore: parsedInput.data.autoScore,
      manualScore: parsedInput.data.manualScore ?? finalScore,
      finalScore,
      graderId: parsedInput.data.actorId,
      feedback: parsedInput.data.feedback,
      gradedAt,
    });

    const refreshedAttemptView = await getAssessmentAttemptGradingRepository(parsedInput.data.attemptId);

    if (!refreshedAttemptView) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không thể tải lại lượt làm bài sau khi chấm.",
        },
      };
    }

    const scoresByQuestionId = new Map(refreshedAttemptView.scores.map((score) => [score.questionBankItemId, score]));
    let rawScore = 0;
    let maxScore = 0;
    let pendingManualReview = false;

    for (const question of definition.questions) {
      const questionScore = findQuestionScoreValue({
        question,
        scoresByQuestionId,
      });

      rawScore += questionScore.finalScore;
      maxScore += question.points;
      pendingManualReview = pendingManualReview || questionScore.pendingManual;
    }

    const normalizedScore = maxScore > 0 ? Number(((rawScore / maxScore) * 100).toFixed(2)) : undefined;
    const submittedTimestamp = refreshedAttemptView.attempt.submittedAt ? Date.parse(refreshedAttemptView.attempt.submittedAt) : Date.now();
    const dueAt = toTimestamp(definition.dueAt);
    const submissionStatus: SubmissionStatus = dueAt !== null && submittedTimestamp > dueAt ? "late" : "submitted";

    const updatedAttempt = await updateAssessmentAttemptStatusRepository({
      attemptId: parsedInput.data.attemptId,
      status: pendingManualReview ? "submitted" : "graded",
      submittedAt: refreshedAttemptView.attempt.submittedAt,
      autoGradedAt: refreshedAttemptView.attempt.autoGradedAt,
      gradedAt: pendingManualReview ? undefined : gradedAt,
      metadata: {
        ...(refreshedAttemptView.attempt.metadata ?? {}),
        pendingManualReview,
        rawScore,
        maxScore,
        normalizedScore,
      },
    });

    const submission = await upsertSubmissionRepository({
      assessmentId: updatedAttempt.assessmentId,
      studentId: refreshedAttemptView.studentId,
      studentIdentifier: refreshedAttemptView.studentIdentifier,
      attemptNumber: updatedAttempt.attemptNumber,
      rawScore,
      maxScore,
      normalizedScore,
      submittedAt: updatedAttempt.submittedAt,
      status: submissionStatus,
      source: "internal",
      metadata: {
        attemptId: updatedAttempt.id,
        pendingManualReview,
        gradedAt: pendingManualReview ? null : gradedAt,
      },
    });

    await upsertCourseAssessmentResultRepository({
      courseId: definition.courseId,
      classId: definition.classId,
      assessmentId: updatedAttempt.assessmentId,
      submissionId: submission.id,
      studentId: refreshedAttemptView.studentId,
      studentIdentifier: refreshedAttemptView.studentIdentifier,
      attemptNumber: updatedAttempt.attemptNumber,
      rawScore,
      maxScore,
      normalizedScore,
      status: submissionStatus,
      source: "internal",
      submittedAt: updatedAttempt.submittedAt,
    });

    return {
      ok: true,
      data: {
        attemptId: parsedInput.data.attemptId,
        questionBankItemId: parsedInput.data.questionBankItemId,
        rawScore,
        maxScore,
        normalizedScore,
        pendingManualReview,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể chấm tay câu tự luận.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function listAssessmentAttemptsForGrading(
  input: {
    assessmentId: string;
    actorId: string;
    actorRole: "admin" | "moderator" | "teacher" | "student";
  },
): Promise<ServiceResult<AssessmentAttemptGradingView[]>> {
  if (input.actorRole !== "teacher" && input.actorRole !== "moderator" && input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền xem hàng chờ chấm bài.",
      },
    };
  }

  const definitionResult = await loadInternalDefinitionOrError(input.assessmentId);

  if (!definitionResult.ok) {
    return definitionResult;
  }

  try {
    const attempts = await listAssessmentAttemptsForGradingRepository(input.assessmentId);

    return {
      ok: true,
      data: attempts,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải danh sách bài cần chấm tay.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function getStudentAssessmentReview(
  input: Parameters<typeof getStudentAssessmentReviewSchema.parse>[0],
): Promise<ServiceResult<StudentAssessmentReview>> {
  const parsedInput = getStudentAssessmentReviewSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu xem kết quả cá nhân không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const definitionResult = await loadInternalDefinitionOrError(parsedInput.data.assessmentId);

  if (!definitionResult.ok) {
    return definitionResult;
  }

  const definition = definitionResult.data;
  const attemptViewResult = await getAssessmentAttemptForStudent({
    assessmentId: parsedInput.data.assessmentId,
    studentId: parsedInput.data.studentId,
  });

  if (!attemptViewResult.ok) {
    return attemptViewResult;
  }

  if (!attemptViewResult.data.attempt) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Chưa có kết quả cá nhân cho bài kiểm tra này.",
      },
    };
  }

  if (!definition.showFeedbackAfterSubmit) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Giảng viên chưa bật chế độ hiển thị phản hồi sau khi nộp bài.",
      },
    };
  }

  try {
    const gradingView = await getAssessmentAttemptGradingRepository(attemptViewResult.data.attempt.id);

    if (!gradingView) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy dữ liệu chấm điểm của lượt làm bài này.",
        },
      };
    }

    const scoreByQuestionId = new Map(gradingView.scores.map((score) => [score.questionBankItemId, score]));
    const answerByQuestionId = new Map(gradingView.answers.map((answer) => [answer.questionBankItemId, answer]));
    let rawScore = 0;
    let maxScore = 0;
    let pendingManualReview = false;

    const questions = definition.questions.map((question) => {
      const score = scoreByQuestionId.get(question.questionBankItemId);
      const answer = answerByQuestionId.get(question.questionBankItemId);
      const finalScore = score?.finalScore ?? score?.autoScore ?? 0;

      rawScore += finalScore;
      maxScore += question.points;
      pendingManualReview = pendingManualReview || (question.questionType === "essay" && typeof score?.finalScore !== "number");

      return {
        questionBankItemId: question.questionBankItemId,
        sortOrder: question.sortOrder,
        prompt: question.prompt,
        questionType: question.questionType,
        selectionMode: question.questionType === "multiple_choice"
          ? (Array.isArray(question.answerKey) ? "multiple" as const : "single" as const)
          : undefined,
        choices: question.choices,
        points: question.points,
        answerText: extractAnswerText(answer),
        finalScore: typeof score?.finalScore === "number" ? score.finalScore : score?.autoScore,
        feedback: score?.feedback,
        explanation: question.questionType === "essay" ? null : question.explanation,
      };
    });

    const normalizedScore = maxScore > 0 ? Number(((rawScore / maxScore) * 100).toFixed(2)) : undefined;

    return {
      ok: true,
      data: {
        attemptId: gradingView.attempt.id,
        attemptNumber: gradingView.attempt.attemptNumber,
        status: gradingView.attempt.status,
        submittedAt: gradingView.attempt.submittedAt,
        gradedAt: gradingView.attempt.gradedAt,
        rawScore,
        maxScore,
        normalizedScore,
        pendingManualReview,
        questions,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải kết quả cá nhân của bài kiểm tra.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
