"use server";

import type { InternalAssessmentActionState } from "@/app/(student)/my-classes/assessments/[assessmentId]/internal-assessment-action-state";
import { getStudentAssessmentPaths, revalidatePaths } from "@/lib/navigation/route-invalidation";
import { requireRole } from "@/lib/services/auth-service";
import {
  loadInternalAssessmentRuntime,
  saveAssessmentAnswer,
  startAssessmentAttempt,
  startExternalAssessmentAttempt,
  submitAssessmentAttempt,
} from "@/lib/services/assessment-runtime-service";
import type { AssessmentQuestionSnapshot } from "@/lib/types/assessment-runtime";

function isMultipleAnswerQuestion(question: AssessmentQuestionSnapshot): boolean {
  return question.questionType === "multiple_choice" && Array.isArray(question.answerKey);
}

function buildAnswerPayload(question: AssessmentQuestionSnapshot, formData: FormData): Record<string, unknown> {
  const fieldName = `question::${question.questionBankItemId}`;
  const rawValue = String(formData.get(fieldName) ?? "");

  if (question.questionType === "multiple_choice" || question.questionType === "true_false") {
    if (isMultipleAnswerQuestion(question)) {
      const selectedValues = formData.getAll(fieldName).map((value) => String(value).trim()).filter(Boolean);
      return selectedValues.length > 0 ? { values: selectedValues } : {};
    }

    return rawValue.trim() ? { value: rawValue.trim() } : {};
  }

  return rawValue.trim() ? { text: rawValue.trim() } : {};
}

export async function persistInternalAssessmentAction(
  _prevState: InternalAssessmentActionState,
  formData: FormData,
): Promise<InternalAssessmentActionState> {
  const profileResult = await requireRole(["student"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
      attemptExpiresAt: undefined,
      attemptStartedAt: undefined,
      nonce: Date.now(),
    };
  }

  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  const attemptId = String(formData.get("attemptId") ?? "").trim();
  const intent = String(formData.get("intent") ?? "save").trim();

  if (!assessmentId) {
    return {
      status: "error",
      message: "Thiếu mã bài kiểm tra.",
      attemptExpiresAt: undefined,
      attemptStartedAt: undefined,
      nonce: Date.now(),
    };
  }

  if (intent === "start") {
    const startResult = await startAssessmentAttempt({
      assessmentId,
      studentId: profileResult.data.id,
    });

    if (!startResult.ok) {
      return {
        status: "error",
        message: startResult.error.message,
        attemptExpiresAt: undefined,
        attemptStartedAt: undefined,
        nonce: Date.now(),
      };
    }

    revalidatePaths(getStudentAssessmentPaths(assessmentId));

    return {
      status: "success",
      message: "Đã bắt đầu lượt làm bài.",
      attemptExpiresAt: startResult.data.attempt?.expiresAt,
      attemptStartedAt: startResult.data.attempt?.startedAt,
      nonce: Date.now(),
    };
  }

  if (intent === "start_external") {
    const startResult = await startExternalAssessmentAttempt({
      assessmentId,
      studentId: profileResult.data.id,
    });

    if (!startResult.ok) {
      return {
        status: "error",
        message: startResult.error.message,
        attemptExpiresAt: undefined,
        attemptStartedAt: undefined,
        nonce: Date.now(),
      };
    }

    revalidatePaths(getStudentAssessmentPaths(assessmentId));

    return {
      status: "success",
      message: "Đã ghi nhận thời điểm bắt đầu làm bài.",
      attemptExpiresAt: startResult.data.attempt?.expiresAt,
      attemptStartedAt: startResult.data.attempt?.startedAt,
      nonce: Date.now(),
    };
  }

  if (!attemptId) {
    return {
      status: "error",
      message: "Thiếu mã lượt làm bài.",
      attemptExpiresAt: undefined,
      attemptStartedAt: undefined,
      nonce: Date.now(),
    };
  }

  const runtimeResult = await loadInternalAssessmentRuntime({
    assessmentId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!runtimeResult.ok) {
    return {
      status: "error",
      message: runtimeResult.error.message,
      attemptExpiresAt: undefined,
      attemptStartedAt: undefined,
      nonce: Date.now(),
    };
  }

  for (const question of runtimeResult.data.questions) {
    const saveResult = await saveAssessmentAnswer({
      studentId: profileResult.data.id,
      attemptId,
      assessmentId,
      questionBankItemId: question.questionBankItemId,
      sortOrder: question.sortOrder,
      answerPayload: buildAnswerPayload(question, formData),
      isFinal: intent === "submit",
    });

    if (!saveResult.ok) {
      return {
        status: "error",
        message: saveResult.error.message,
        attemptExpiresAt: undefined,
        attemptStartedAt: undefined,
        nonce: Date.now(),
      };
    }
  }

  if (intent === "submit") {
    const submitResult = await submitAssessmentAttempt({
      assessmentId,
      attemptId,
      studentId: profileResult.data.id,
    });

    if (!submitResult.ok) {
      return {
        status: "error",
        message: submitResult.error.message,
        attemptExpiresAt: undefined,
        attemptStartedAt: undefined,
        nonce: Date.now(),
      };
    }

    revalidatePaths(getStudentAssessmentPaths(assessmentId));

    return {
      status: "success",
      message: submitResult.data.pendingManualReview
        ? "Đã nộp bài. Hệ thống đã chấm phần trắc nghiệm và đang chờ giảng viên chấm phần tự luận."
        : `Đã nộp bài thành công. Điểm tạm thời: ${submitResult.data.rawScore}/${submitResult.data.maxScore}.`,
      attemptExpiresAt: undefined,
      attemptStartedAt: undefined,
      nonce: Date.now(),
    };
  }

  revalidatePaths(getStudentAssessmentPaths(assessmentId));

  return {
    status: "success",
    message: "Đã lưu tạm đáp án.",
    attemptExpiresAt: undefined,
    attemptStartedAt: undefined,
    nonce: Date.now(),
  };
}
