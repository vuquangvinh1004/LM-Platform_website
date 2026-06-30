"use server";

import type { AssessmentActionState } from "@/app/(teacher)/assessments/assessment-action-state";
import { revalidatePaths } from "@/lib/navigation/route-invalidation";
import { requireRole } from "@/lib/services/auth-service";
import {
  createAssessmentCommand,
  createQuestionBankItemCommand,
  deleteQuestionBankItemCommand,
  deleteAssessmentCommand,
  updateQuestionBankItemAvailabilityCommand,
  updateQuestionBankItemCommand,
  updateAssessmentStatusCommand,
} from "@/lib/commands/assessment-commands";

function parseLocalDatetimeToIso(value: FormDataEntryValue | null): string | undefined {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return undefined;
  }

  const parsedDate = new Date(rawValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return rawValue;
  }

  return parsedDate.toISOString();
}

function parseAssessmentCloCodes(rawValue: FormDataEntryValue | null): string[] {
  try {
    const parsed = JSON.parse(String(rawValue ?? "[]")) as string[];
    return Array.isArray(parsed) ? parsed.map((value) => String(value).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

type QuestionDifficultyValue =
  | "remembering"
  | "understanding"
  | "applying"
  | "analyzing"
  | "evaluating"
  | "creating";

type QuestionBuilderTypeValue =
  | "multiple_choice_single"
  | "multiple_choice_multiple"
  | "true_false"
  | "short_answer"
  | "essay";

const allowedDifficultiesByQuestionBuilderType: Record<QuestionBuilderTypeValue, QuestionDifficultyValue[]> = {
  true_false: ["remembering", "understanding"],
  multiple_choice_single: ["remembering", "understanding", "applying"],
  multiple_choice_multiple: ["remembering", "understanding", "applying", "analyzing"],
  short_answer: ["applying", "analyzing", "evaluating"],
  essay: ["analyzing", "evaluating", "creating"],
};

const questionBuilderTypeLabels: Record<QuestionBuilderTypeValue, string> = {
  true_false: "Đúng/Sai",
  multiple_choice_single: "Nhiều lựa chọn",
  multiple_choice_multiple: "Nhiều đáp án",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận",
};

const questionDifficultyLabels: Record<QuestionDifficultyValue, string> = {
  remembering: "Nhớ",
  understanding: "Hiểu",
  applying: "Vận dụng",
  analyzing: "Phân tích",
  evaluating: "Đánh giá",
  creating: "Sáng tạo",
};

function parseQuestionDifficulty(rawValue: FormDataEntryValue | null): QuestionDifficultyValue {
  const value = String(rawValue ?? "").trim();

  if (
    value === "remembering"
    || value === "understanding"
    || value === "applying"
    || value === "analyzing"
    || value === "evaluating"
    || value === "creating"
  ) {
    return value;
  }

  return "remembering";
}

function parseQuestionBuilderType(rawValue: FormDataEntryValue | null): QuestionBuilderTypeValue {
  const value = String(rawValue ?? "").trim();

  if (
    value === "multiple_choice_single"
    || value === "multiple_choice_multiple"
    || value === "true_false"
    || value === "short_answer"
    || value === "essay"
  ) {
    return value;
  }

  return "multiple_choice_single";
}

function validateQuestionDifficultyForType(
  questionBuilderType: QuestionBuilderTypeValue,
  difficulty: QuestionDifficultyValue,
): string | null {
  const allowed = allowedDifficultiesByQuestionBuilderType[questionBuilderType];

  if (allowed.includes(difficulty)) {
    return null;
  }

  return `Dạng câu hỏi ${questionBuilderTypeLabels[questionBuilderType]} chỉ được chọn mức độ ${allowed.map((value) => questionDifficultyLabels[value]).join("/")}.`;
}

function buildQuestionBankPayload(formData: FormData):
  | {
      ok: true;
      data: {
        prompt: string;
        questionType: "multiple_choice" | "true_false" | "short_answer" | "essay";
        choices: string[];
        answerKey: unknown;
        explanation?: string;
        cloCode?: string;
        chapterLabel?: string;
      };
    }
  | {
      ok: false;
      message: string;
    } {
  const questionBuilderType = String(formData.get("questionBuilderType") ?? "multiple_choice_single").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const explanation = String(formData.get("explanation") ?? "").trim() || undefined;
  const cloCode = String(formData.get("cloCode") ?? "").trim() || undefined;
  const chapterLabel = String(formData.get("chapterLabel") ?? "").trim() || undefined;

  if (!prompt) {
    return {
      ok: false,
      message: "Nội dung câu hỏi là bắt buộc.",
    };
  }

  if (questionBuilderType === "multiple_choice_single" || questionBuilderType === "multiple_choice_multiple") {
    const choiceRowIds = formData.getAll("choiceRowId").map((value) => String(value).trim()).filter(Boolean);
    const entries = choiceRowIds
      .map((rowId) => ({
        choice: String(formData.get(`choiceText__${rowId}`) ?? "").trim(),
        isCorrect: String(formData.get(`choiceCorrect__${rowId}`) ?? "") === "on",
      }))
      .filter((entry) => entry.choice);

    if (entries.length < 2) {
      return {
        ok: false,
        message: "Câu hỏi trắc nghiệm cần ít nhất 2 đáp án.",
      };
    }

    const correctChoices = entries.filter((entry) => entry.isCorrect).map((entry) => entry.choice);

    if (questionBuilderType === "multiple_choice_single" && correctChoices.length !== 1) {
      return {
        ok: false,
        message: "Dạng Nhiều lựa chọn cần đúng chính xác 1 đáp án.",
      };
    }

    if (questionBuilderType === "multiple_choice_multiple" && correctChoices.length < 1) {
      return {
        ok: false,
        message: "Dạng Nhiều đáp án cần chọn ít nhất 1 đáp án đúng.",
      };
    }

    return {
      ok: true,
      data: {
        prompt,
        questionType: "multiple_choice",
        choices: entries.map((entry) => entry.choice),
        answerKey: questionBuilderType === "multiple_choice_single" ? correctChoices[0] : correctChoices,
        explanation,
        cloCode,
        chapterLabel,
      },
    };
  }

  if (questionBuilderType === "true_false") {
    const answerKey = String(formData.get("trueFalseAnswerKey") ?? "").trim() || "Đúng";

    return {
      ok: true,
      data: {
        prompt,
        questionType: "true_false",
        choices: ["Đúng", "Sai"],
        answerKey,
        explanation,
        cloCode,
        chapterLabel,
      },
    };
  }

  if (questionBuilderType === "short_answer") {
    return {
      ok: true,
      data: {
        prompt,
        questionType: "short_answer",
        choices: [],
        answerKey: String(formData.get("shortAnswerKey") ?? "").trim(),
        explanation,
        cloCode,
        chapterLabel,
      },
    };
  }

  return {
    ok: true,
    data: {
      prompt,
      questionType: "essay",
      choices: [],
      answerKey: null,
      explanation,
      cloCode,
      chapterLabel,
    },
  };
}

/**
 * Creates an assessment for a manageable class.
 */
export async function createAssessmentAction(
  _prevState: AssessmentActionState,
  formData: FormData,
): Promise<AssessmentActionState> {
  const profileResult = await requireRole(["teacher"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const maxScoreRaw = String(formData.get("maxScore") ?? "").trim();
  const attemptLimitRaw = String(formData.get("attemptLimit") ?? "").trim();
  const timeLimitMinutesRaw = String(formData.get("timeLimitMinutes") ?? "").trim();
  const classCoursePair = String(formData.get("classCoursePair") ?? "").trim();
  const [classId = "", courseId = ""] = classCoursePair.split("::");
  const questionIds = formData.getAll("questionId").map((value) => String(value).trim()).filter(Boolean);

  const result = await createAssessmentCommand({
    classId,
    courseId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role as "teacher",
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    deliveryMode: (formData.get("deliveryMode") as "external" | "internal" | null) ?? "external",
    provider: (formData.get("provider") as "google_form" | "microsoft_form" | "manual" | "internal" | "other" | null) ?? "manual",
    formUrl: String(formData.get("formUrl") ?? "").trim() || undefined,
    embedMode: (formData.get("embedMode") as "iframe" | "new_tab" | "disabled" | null) ?? "new_tab",
    assessmentComponentType: (formData.get("assessmentComponentType") as "diagnostic" | "frequent" | "periodic" | "final" | null) ?? "diagnostic",
    assessmentCloCodes: parseAssessmentCloCodes(formData.get("assessmentCloCodes")),
    maxScore: maxScoreRaw ? Number(maxScoreRaw) : undefined,
    attemptLimit: attemptLimitRaw ? Number(attemptLimitRaw) : undefined,
    shuffleQuestions: String(formData.get("shuffleQuestions") ?? "") === "on",
    showFeedbackAfterSubmit: String(formData.get("showFeedbackAfterSubmit") ?? "") === "on",
    timeLimitMinutes: timeLimitMinutesRaw ? Number(timeLimitMinutesRaw) : undefined,
    openAt: parseLocalDatetimeToIso(formData.get("openAt")),
    dueAt: parseLocalDatetimeToIso(formData.get("dueAt")),
    status: (formData.get("status") as "draft" | "open" | "closed" | "archived" | null) ?? "draft",
    questionIds,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  revalidatePaths(["/assessments", "/my-classes/assessments", "/my-classes"]);

  return {
    status: "success",
    message: "Tạo bài kiểm tra thành công.",
  };
}

export async function createQuestionBankItemAction(
  _prevState: AssessmentActionState,
  formData: FormData,
): Promise<AssessmentActionState> {
  const profileResult = await requireRole(["moderator"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const questionPayload = buildQuestionBankPayload(formData);

  if (!questionPayload.ok) {
    return {
      status: "error",
      message: questionPayload.message,
    };
  }

  const questionBuilderType = parseQuestionBuilderType(formData.get("questionBuilderType"));
  const difficulty = parseQuestionDifficulty(formData.get("difficulty"));
  const difficultyValidationMessage = validateQuestionDifficultyForType(questionBuilderType, difficulty);

  if (difficultyValidationMessage) {
    return {
      status: "error",
      message: difficultyValidationMessage,
    };
  }

  const result = await createQuestionBankItemCommand({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role as "moderator",
    courseId: String(formData.get("courseId") ?? "").trim(),
    prompt: questionPayload.data.prompt,
    questionType: questionPayload.data.questionType,
    choices: questionPayload.data.choices,
    answerKey: questionPayload.data.answerKey,
    explanation: questionPayload.data.explanation,
    cloCode: questionPayload.data.cloCode,
    chapterLabel: questionPayload.data.chapterLabel,
    difficulty,
    defaultPoints: Number(String(formData.get("defaultPoints") ?? "1")) || 1,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  revalidatePaths(["/assessments"]);

  return {
    status: "success",
    message: "Đã thêm câu hỏi vào ngân hàng đề.",
  };
}

export async function updateQuestionBankItemAction(
  _prevState: AssessmentActionState,
  formData: FormData,
): Promise<AssessmentActionState> {
  const profileResult = await requireRole(["moderator"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const questionPayload = buildQuestionBankPayload(formData);

  if (!questionPayload.ok) {
    return {
      status: "error",
      message: questionPayload.message,
    };
  }

  const questionBuilderType = parseQuestionBuilderType(formData.get("questionBuilderType"));
  const difficulty = parseQuestionDifficulty(formData.get("difficulty"));
  const difficultyValidationMessage = validateQuestionDifficultyForType(questionBuilderType, difficulty);

  if (difficultyValidationMessage) {
    return {
      status: "error",
      message: difficultyValidationMessage,
    };
  }

  const result = await updateQuestionBankItemCommand({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role as "moderator",
    questionBankItemId: String(formData.get("questionBankItemId") ?? "").trim(),
    prompt: questionPayload.data.prompt,
    questionType: questionPayload.data.questionType,
    choices: questionPayload.data.choices,
    answerKey: questionPayload.data.answerKey,
    explanation: questionPayload.data.explanation,
    cloCode: questionPayload.data.cloCode,
    chapterLabel: questionPayload.data.chapterLabel,
    difficulty,
    defaultPoints: Number(String(formData.get("defaultPoints") ?? "1")) || 1,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  revalidatePaths(["/assessments"]);

  return {
    status: "success",
    message: "Đã cập nhật câu hỏi trong ngân hàng đề.",
  };
}

export async function updateQuestionBankItemAvailabilityAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["moderator"]);

  if (!profileResult.ok) {
    return;
  }

  await updateQuestionBankItemAvailabilityCommand({
    actorRole: profileResult.data.role as "moderator",
    questionBankItemId: String(formData.get("questionBankItemId") ?? "").trim(),
    isAvailable: String(formData.get("isAvailable") ?? "") === "on",
  });

  const courseId = String(formData.get("courseId") ?? "").trim();
  revalidatePaths(courseId ? ["/assessments", `/assessments/question-bank/${courseId}`] : ["/assessments"]);
}

export async function deleteQuestionBankItemAction(
  _prevState: AssessmentActionState,
  formData: FormData,
): Promise<AssessmentActionState> {
  const profileResult = await requireRole(["moderator"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const result = await deleteQuestionBankItemCommand({
    actorRole: profileResult.data.role as "moderator",
    questionBankItemId: String(formData.get("questionBankItemId") ?? "").trim(),
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  const courseId = String(formData.get("courseId") ?? "").trim();
  revalidatePaths(courseId ? ["/assessments", `/assessments/question-bank/${courseId}`] : ["/assessments"]);

  return {
    status: "success",
    message: "Đã xóa câu hỏi khỏi ngân hàng đề.",
  };
}

export async function updateAssessmentStatusAction(
  _prevState: AssessmentActionState,
  formData: FormData,
): Promise<AssessmentActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const result = await updateAssessmentStatusCommand({
    assessmentId: String(formData.get("assessmentId") ?? "").trim(),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role as "teacher" | "moderator" | "admin",
    status: (formData.get("status") as "draft" | "open" | "closed" | "archived" | null) ?? "draft",
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  revalidatePaths(["/assessments", "/my-classes/assessments", "/my-classes"]);

  return {
    status: "success",
    message: "Đã cập nhật trạng thái bài kiểm tra.",
  };
}

export async function deleteAssessmentAction(
  _prevState: AssessmentActionState,
  formData: FormData,
): Promise<AssessmentActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const result = await deleteAssessmentCommand({
    assessmentId: String(formData.get("assessmentId") ?? "").trim(),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role as "teacher" | "moderator" | "admin",
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  revalidatePaths(["/assessments", "/my-classes/assessments", "/my-classes"]);

  return {
    status: "success",
    message: "Đã xóa bài kiểm tra vĩnh viễn.",
  };
}
