"use client";

import { useActionState } from "react";

import { gradeEssayAnswerAction } from "@/app/(teacher)/assessments/[assessmentId]/results/actions";
import { initialAssessmentGradingActionState } from "@/app/(teacher)/assessments/[assessmentId]/results/assessment-results-action-state";
import type { AssessmentAttemptGradingView, InternalAssessmentDefinition } from "@/lib/types/assessment-runtime";

type AssessmentGradingClientProps = {
  assessmentId: string;
  attempts: AssessmentAttemptGradingView[];
  definition: InternalAssessmentDefinition;
  disabled?: boolean;
  disabledMessage?: string;
};

export function AssessmentGradingClient({
  assessmentId,
  attempts,
  definition,
  disabled = false,
  disabledMessage,
}: AssessmentGradingClientProps) {
  const [state, action, isPending] = useActionState(gradeEssayAnswerAction, initialAssessmentGradingActionState);
  const questionById = new Map(definition.questions.map((question) => [question.questionBankItemId, question]));

  const attemptsWithEssay = attempts
    .map((attempt) => {
      const essayItems = attempt.answers
        .map((answer) => {
          const question = questionById.get(answer.questionBankItemId);
          if (!question || question.questionType !== "essay") {
            return null;
          }

          const score = attempt.scores.find((item) => item.questionBankItemId === answer.questionBankItemId);

          return {
            answer,
            question,
            score,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return {
        ...attempt,
        essayItems,
      };
    })
    .filter((attempt) => attempt.essayItems.length > 0);

  if (attemptsWithEssay.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 rounded-lg border border-amber-200 bg-amber-50/40 p-5">
      <h2 className="text-lg font-semibold text-slate-900">Chấm câu tự luận</h2>
      <p className="mt-2 text-sm text-slate-600">
        Các bài kiểm tra nội bộ có câu tự luận sẽ hiển thị tại đây để giảng viên nhập điểm và nhận xét. Sau khi lưu, hệ thống sẽ tự đồng bộ lại tổng điểm vào bảng kết quả.
      </p>
      {disabledMessage ? (
        <p className="mt-2 text-sm text-red-600">{disabledMessage}</p>
      ) : null}

      {state.message ? (
        <p className={state.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}>
          {state.message}
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        {attemptsWithEssay.map((attempt) => (
          <article className="rounded-lg border border-slate-200 bg-white p-4" key={attempt.attempt.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{attempt.studentFullName}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {attempt.studentCode ?? attempt.studentEmail ?? attempt.studentIdentifier} | Lần nộp #{attempt.attempt.attemptNumber}
                </p>
              </div>
              <div className="text-sm text-slate-600">
                <p>Trạng thái attempt: {attempt.attempt.status}</p>
                <p>Nộp lúc: {attempt.attempt.submittedAt ? new Date(attempt.attempt.submittedAt).toLocaleString("vi-VN") : "-"}</p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {attempt.essayItems.map(({ answer, question, score }) => (
                <form action={action} className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={`${attempt.attempt.id}-${question.questionBankItemId}`}>
                  <input name="assessmentId" type="hidden" value={assessmentId} />
                  <input name="attemptId" type="hidden" value={attempt.attempt.id} />
                  <input name="questionBankItemId" type="hidden" value={question.questionBankItemId} />

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-medium text-slate-900">Câu {question.sortOrder}</h4>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{question.prompt}</p>
                    </div>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700">
                      Tối đa {question.points} điểm
                    </span>
                  </div>

                  <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bài làm của sinh viên</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                      {String(answer.answerPayload.text ?? answer.answerPayload.value ?? "Chưa có nội dung trả lời.")}
                    </p>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[180px,1fr]">
                    <label className="text-sm text-slate-700">
                      Điểm chấm tay
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        defaultValue={score?.manualScore ?? score?.finalScore ?? ""}
                        max={question.points}
                        min="0"
                        name="manualScore"
                        step="0.25"
                        type="number"
                      />
                    </label>

                    <label className="text-sm text-slate-700">
                      Nhận xét
                      <textarea
                        className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        defaultValue={score?.feedback ?? ""}
                        name="feedback"
                        placeholder="Nhập nhận xét ngắn cho câu tự luận này"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      <p>Điểm tự động: {score?.autoScore ?? "-"}</p>
                      <p>Điểm cuối cùng hiện tại: {score?.finalScore ?? "-"}</p>
                    </div>
                    <button className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={isPending || disabled} type="submit">
                      {isPending ? "Đang lưu..." : "Lưu điểm tự luận"}
                    </button>
                  </div>
                </form>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
