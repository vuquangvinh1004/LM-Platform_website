import { attachQuestionBankItemsToAssessment, createQuestionBankItem } from "@/lib/services/question-bank-service";
import { createAssessment, deleteAssessment, updateAssessmentStatus } from "@/lib/services/assessment-service";

export type AssessmentMutationActor = {
  actorId: string;
  actorRole: "teacher" | "moderator" | "admin";
};

/**
 * Assessment mutations are split into small commands so the server action only owns
 * auth, form extraction, and invalidation. The commands own the business rules and
 * future command handlers can reuse the same contract from API routes or jobs.
 */
export async function createAssessmentCommand(input: AssessmentMutationActor & {
  classId: string;
  courseId: string;
  title: string;
  description?: string;
  deliveryMode: "external" | "internal";
  provider: "google_form" | "microsoft_form" | "manual" | "internal" | "other";
  formUrl?: string;
  embedMode: "iframe" | "new_tab" | "disabled";
  maxScore?: number;
  attemptLimit?: number;
  shuffleQuestions: boolean;
  showFeedbackAfterSubmit: boolean;
  timeLimitMinutes?: number;
  openAt?: string;
  dueAt?: string;
  status: "draft" | "open" | "closed" | "archived";
  questionIds: string[];
}): Promise<{ ok: true; assessmentId: string } | { ok: false; message: string }> {
  const result = await createAssessment({
    classId: input.classId,
    courseId: input.courseId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    title: input.title,
    description: input.description,
    deliveryMode: input.deliveryMode,
    provider: input.provider,
    formUrl: input.formUrl,
    embedMode: input.embedMode,
    maxScore: input.maxScore,
    attemptLimit: input.attemptLimit,
    shuffleQuestions: input.shuffleQuestions,
    showFeedbackAfterSubmit: input.showFeedbackAfterSubmit,
    timeLimitMinutes: input.timeLimitMinutes,
    openAt: input.openAt,
    dueAt: input.dueAt,
    status: input.status,
  });

  if (!result.ok) {
    return { ok: false, message: result.error.message };
  }

  if (input.questionIds.length > 0) {
    const attachResult = await attachQuestionBankItemsToAssessment({
      assessmentId: result.data.id,
      questionIds: input.questionIds,
    });

    if (!attachResult.ok) {
      return {
        ok: false,
        message: `Đã tạo bài kiểm tra nhưng chưa gắn được câu hỏi: ${attachResult.error.message}`,
      };
    }
  }

  return { ok: true, assessmentId: result.data.id };
}

export async function createQuestionBankItemCommand(input: AssessmentMutationActor & {
  courseId: string;
  prompt: string;
  questionType: "multiple_choice" | "true_false" | "short_answer" | "essay";
  choices: string[];
  answerKey: unknown;
  explanation?: string;
  difficulty: "easy" | "medium" | "hard";
  defaultPoints: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await createQuestionBankItem({
    actorId: input.actorId,
    actorRole: input.actorRole,
    courseId: input.courseId,
    prompt: input.prompt,
    questionType: input.questionType,
    choices: input.choices,
    answerKey: input.answerKey,
    explanation: input.explanation,
    difficulty: input.difficulty,
    defaultPoints: input.defaultPoints,
  });

  if (!result.ok) {
    return { ok: false, message: result.error.message };
  }

  return { ok: true };
}

export async function updateAssessmentStatusCommand(input: AssessmentMutationActor & {
  assessmentId: string;
  status: "draft" | "open" | "closed" | "archived";
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await updateAssessmentStatus({
    assessmentId: input.assessmentId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    status: input.status,
  });

  if (!result.ok) {
    return { ok: false, message: result.error.message };
  }

  return { ok: true };
}

export async function deleteAssessmentCommand(input: AssessmentMutationActor & { assessmentId: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await deleteAssessment({
    assessmentId: input.assessmentId,
    actorId: input.actorId,
    actorRole: input.actorRole,
  });

  if (!result.ok) {
    return { ok: false, message: result.error.message };
  }

  return { ok: true };
}
