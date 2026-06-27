"use server";

import type {
  AssessmentGradingActionState,
  AssessmentResultsImportActionState,
} from "@/app/(teacher)/assessments/[assessmentId]/results/assessment-results-action-state";
import { getAssessmentResultsPaths, revalidatePaths } from "@/lib/navigation/route-invalidation";
import { requireRole } from "@/lib/services/auth-service";
import { finalizeAssessmentSubmission } from "@/lib/services/assessment-runtime-service";
import { importSubmissionsFromSpreadsheet } from "@/lib/services/submission-service";

export async function gradeEssayAnswerAction(
  _prevState: AssessmentGradingActionState,
  formData: FormData,
): Promise<AssessmentGradingActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
      nonce: Date.now(),
    };
  }

  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  const attemptId = String(formData.get("attemptId") ?? "").trim();
  const questionBankItemId = String(formData.get("questionBankItemId") ?? "").trim();
  const manualScoreRaw = String(formData.get("manualScore") ?? "").trim();
  const feedback = String(formData.get("feedback") ?? "").trim() || undefined;

  const result = await finalizeAssessmentSubmission({
    attemptId,
    questionBankItemId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    manualScore: manualScoreRaw ? Number(manualScoreRaw) : undefined,
    finalScore: manualScoreRaw ? Number(manualScoreRaw) : undefined,
    feedback,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.error.message,
      nonce: Date.now(),
    };
  }

  revalidatePaths(getAssessmentResultsPaths(assessmentId));

  return {
    status: "success",
    message: result.data.pendingManualReview
      ? `Đã lưu điểm câu tự luận. Tổng điểm hiện tại: ${result.data.rawScore}/${result.data.maxScore}. Vẫn còn câu tự luận khác chưa chấm.`
      : `Đã chấm xong và đồng bộ điểm cuối cùng: ${result.data.rawScore}/${result.data.maxScore}.`,
    nonce: Date.now(),
  };
}

export async function importAssessmentResultsAction(
  _prevState: AssessmentResultsImportActionState,
  formData: FormData,
): Promise<AssessmentResultsImportActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
      nonce: Date.now(),
    };
  }

  const assessmentId = String(formData.get("assessmentId") ?? "").trim();
  const resultsFile = formData.get("resultsFile");

  if (!(resultsFile instanceof File) || resultsFile.size === 0) {
    return {
      status: "error",
      message: "Vui lòng chọn file CSV/XLSX để import kết quả.",
      nonce: Date.now(),
    };
  }

  const lowerFileName = resultsFile.name.toLowerCase();
  if (!lowerFileName.endsWith(".csv") && !lowerFileName.endsWith(".xlsx") && !lowerFileName.endsWith(".xls")) {
    return {
      status: "error",
      message: "Chỉ hỗ trợ file CSV, XLS hoặc XLSX.",
      nonce: Date.now(),
    };
  }

  const importResult = await importSubmissionsFromSpreadsheet({
    assessmentId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    fileName: resultsFile.name,
    fileContentBase64: Buffer.from(await resultsFile.arrayBuffer()).toString("base64"),
  });

  if (!importResult.ok) {
    return {
      status: "error",
      message: importResult.error.message,
      nonce: Date.now(),
    };
  }

  revalidatePaths(getAssessmentResultsPaths(assessmentId));

  const summary = `Import hoàn tất: ${importResult.data.successRows}/${importResult.data.totalRows} dòng thành công`;
  const errorSuffix = importResult.data.errorRows > 0 ? `, ${importResult.data.errorRows} dòng lỗi.` : ".";
  const firstError = importResult.data.errors[0]?.reason ? ` Lỗi đầu tiên: ${importResult.data.errors[0].reason}` : "";

  return {
    status: importResult.data.errorRows > 0 ? "error" : "success",
    message: `${summary}${errorSuffix}${firstError}`,
    nonce: Date.now(),
  };
}
