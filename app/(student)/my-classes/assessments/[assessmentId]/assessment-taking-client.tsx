"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  persistInternalAssessmentAction,
} from "@/app/(student)/my-classes/assessments/[assessmentId]/actions";
import { initialInternalAssessmentActionState } from "@/app/(student)/my-classes/assessments/[assessmentId]/internal-assessment-action-state";
import { useRefreshOnSuccess } from "@/lib/hooks/use-refresh-on-success";
import { canStartAssessment, getAssessmentStartBlockedReason, isDraftAssessment } from "@/lib/policies/assessment-policy";
import type { StudentAssessmentView } from "@/lib/types/assessment";
import type { InternalAssessmentDefinition, StudentAssessmentAttemptView, StudentAssessmentReview } from "@/lib/types/assessment-runtime";

type AssessmentTakingClientProps = {
  assessment: StudentAssessmentView;
  internalDefinition?: InternalAssessmentDefinition | null;
  attemptView?: StudentAssessmentAttemptView | null;
  review?: StudentAssessmentReview | null;
};

function getQuestionTypeLabel(question: { questionType: string; answerKey?: unknown; selectionMode?: "single" | "multiple" }): string {
  if (question.questionType === "multiple_choice") {
    if (question.selectionMode) {
      return question.selectionMode === "multiple" ? "Nhiều đáp án" : "Nhiều lựa chọn";
    }

    return Array.isArray(question.answerKey) ? "Nhiều đáp án" : "Nhiều lựa chọn";
  }

  if (question.questionType === "true_false") {
    return "Đúng/Sai";
  }

  if (question.questionType === "short_answer") {
    return "Trả lời ngắn";
  }

  return "Tự luận";
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function formatDateTime(value?: string): string {
  return value ? new Date(value).toLocaleString("vi-VN") : "Không giới hạn";
}

function getAttemptStatusLabel(status?: string): string {
  switch (status) {
    case "in_progress":
      return "Đang làm bài";
    case "submitted":
      return "Đã nộp";
    case "auto_graded":
      return "Đã chấm tự động";
    case "graded":
      return "Đã chấm xong";
    case "expired":
      return "Đã hết thời gian";
    default:
      return status ?? "-";
  }
}

function getStoredAnswerValue(
  attemptView: StudentAssessmentAttemptView | null | undefined,
  questionId: string,
): string {
  const answer = attemptView?.answers.find((item) => item.questionBankItemId === questionId);
  if (!answer) {
    return "";
  }

  const value = answer.answerPayload.value ?? answer.answerPayload.text ?? "";
  return typeof value === "string" ? value : "";
}

function getStoredAnswerValues(
  attemptView: StudentAssessmentAttemptView | null | undefined,
  questionId: string,
): string[] {
  const answer = attemptView?.answers.find((item) => item.questionBankItemId === questionId);
  if (!answer) {
    return [];
  }

  const values = answer.answerPayload.values;

  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => String(value));
}

export function AssessmentTakingClient({ assessment, internalDefinition, attemptView, review }: AssessmentTakingClientProps) {
  const [actionState, persistAction, isPending] = useActionState(persistInternalAssessmentAction, initialInternalAssessmentActionState);
  const previousActionNonceRef = useRef(actionState.nonce);
  const [started, setStarted] = useState(
    assessment.deliveryMode === "internal"
      ? attemptView?.attempt?.status === "in_progress"
      : Boolean(attemptView?.attempt),
  );
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [optimisticExternalExpiryTimestamp, setOptimisticExternalExpiryTimestamp] = useState<number | null>(null);
  const attemptExpiryTimestamp = attemptView?.attempt?.expiresAt ? new Date(attemptView.attempt.expiresAt).getTime() : null;
  const isDraftAssessmentValue = isDraftAssessment(assessment.status);
  const remainingSeconds = started && attemptExpiryTimestamp
    ? Math.max(0, Math.floor((attemptExpiryTimestamp - timerNow) / 1000))
    : started && optimisticExternalExpiryTimestamp
      ? Math.max(0, Math.floor((optimisticExternalExpiryTimestamp - timerNow) / 1000))
    : null;
  const attemptStatus = attemptView?.attempt?.status;
  const isTimedAttemptExpired = attemptExpiryTimestamp !== null && attemptExpiryTimestamp <= timerNow;
  const isAttemptLocked = attemptStatus !== undefined && (attemptStatus !== "in_progress" || isTimedAttemptExpired);
  const usedAttemptCount = attemptView?.attempt?.attemptNumber ?? 0;
  const canRetryAfterCompletion = !started && usedAttemptCount > 0 && usedAttemptCount < assessment.attemptLimit;
  const startBlockedMessage = getAssessmentStartBlockedReason({
    assessment: {
      status: assessment.status,
      openAt: assessment.openAt,
      dueAt: assessment.dueAt,
      attemptLimit: assessment.attemptLimit,
    },
    now: timerNow,
    usedAttempts: usedAttemptCount,
    activeAttemptStatus: attemptStatus,
    activeAttemptExpiresAt: attemptView?.attempt?.expiresAt ?? null,
  });
  const canStartCurrentAttempt = canStartAssessment({
    assessment: {
      status: assessment.status,
      openAt: assessment.openAt,
      dueAt: assessment.dueAt,
      attemptLimit: assessment.attemptLimit,
    },
    now: timerNow,
    usedAttempts: usedAttemptCount,
    activeAttemptStatus: attemptStatus,
    activeAttemptExpiresAt: attemptView?.attempt?.expiresAt ?? null,
  });

  useEffect(() => {
    if (!started) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [started]);

  useRefreshOnSuccess({ status: actionState.status, nonce: actionState.nonce });

  useEffect(() => {
    if (actionState.status === "success" && actionState.nonce !== previousActionNonceRef.current) {
      if (assessment.deliveryMode === "external" && actionState.attemptExpiresAt) {
        setOptimisticExternalExpiryTimestamp(new Date(actionState.attemptExpiresAt).getTime());
        setStarted(true);
      }
    }

    previousActionNonceRef.current = actionState.nonce;
  }, [actionState.attemptExpiresAt, actionState.nonce, actionState.status, assessment.deliveryMode]);

  useEffect(() => {
    if (attemptExpiryTimestamp !== null) {
      setOptimisticExternalExpiryTimestamp(null);
    }
  }, [attemptExpiryTimestamp]);

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      {!started ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Khi bấm bắt đầu, nội dung bài kiểm tra sẽ hiển thị. Với bài kiểm tra chính thức, sinh viên chỉ được vào làm trước thời hạn làm bài; riêng bài bản nháp chỉ giới hạn theo số lượt làm.
          </p>
          {internalDefinition ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <p>Số lượt làm tối đa: {internalDefinition.attemptLimit}</p>
              <p>Giới hạn thời gian: {isDraftAssessmentValue ? "Không áp dụng cho bài bản nháp" : (internalDefinition.timeLimitMinutes ? `${internalDefinition.timeLimitMinutes} phút` : "Không giới hạn")}</p>
              <p>Thời hạn làm bài: {isDraftAssessmentValue ? "Không áp dụng cho bài bản nháp" : formatDateTime(assessment.dueAt)}</p>
              <p>Số câu hỏi: {internalDefinition.questions.length}</p>
            </div>
          ) : null}
          {attemptView?.attempt ? (
            <div className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
              <p>Lượt gần nhất: #{attemptView.attempt.attemptNumber}</p>
              <p>Trạng thái: {getAttemptStatusLabel(attemptView.attempt.status)}</p>
              {attemptView.attempt.submittedAt ? <p>Đã nộp lúc: {formatDateTime(attemptView.attempt.submittedAt)}</p> : null}
            </div>
          ) : null}
          {assessment.deliveryMode === "internal" ? (
            <form action={persistAction}>
              <input name="assessmentId" type="hidden" value={assessment.id} />
              <button
                className="rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={isPending || !canStartCurrentAttempt}
                name="intent"
                onClick={() => {
                  if (canStartCurrentAttempt) {
                    setStarted(true);
                  }
                }}
                type="submit"
                value="start"
              >
                {isPending ? "Đang bắt đầu..." : canRetryAfterCompletion ? "Bắt đầu lượt làm tiếp theo" : "Bắt đầu làm bài"}
              </button>
            </form>
          ) : (
            <form action={persistAction}>
              <input name="assessmentId" type="hidden" value={assessment.id} />
              <button
                className="rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={isPending || !canStartCurrentAttempt}
                name="intent"
                type="submit"
                value="start_external"
              >
                {isPending ? "Đang bắt đầu..." : "Bắt đầu làm bài"}
              </button>
            </form>
          )}
          {startBlockedMessage ? <p className="text-sm font-medium text-red-600">{startBlockedMessage}</p> : null}
          {review ? (
            <section className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">Kết quả cá nhân</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Lần nộp #{review.attemptNumber} | Trạng thái: {review.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-slate-900">
                    {review.rawScore}/{review.maxScore}
                  </p>
                  <p className="text-sm text-slate-600">
                    {typeof review.normalizedScore === "number" ? `${review.normalizedScore}%` : "Chưa quy đổi"}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {review.questions.map((question) => (
                  <article className="rounded-lg border border-slate-200 bg-white p-4" key={question.questionBankItemId}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-medium text-slate-900">Câu {question.sortOrder}</h4>
                      <span className="text-sm text-slate-600">
                        Điểm: {typeof question.finalScore === "number" ? question.finalScore : "-"} / {question.points}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {getQuestionTypeLabel(question)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{question.prompt}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Câu trả lời của bạn</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{question.answerText || "Chưa có câu trả lời."}</p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phản hồi</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                          {question.feedback
                            || (question.explanation ?? "")
                            || (review.pendingManualReview && question.questionType === "essay"
                              ? "Câu tự luận này đang chờ giảng viên phản hồi."
                              : "Chưa có phản hồi thêm.")}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {assessment.deliveryMode === "internal" ? (
            internalDefinition && attemptView?.attempt ? (
              <form action={persistAction} className="space-y-5">
                <input name="assessmentId" type="hidden" value={assessment.id} />
                <input name="attemptId" type="hidden" value={attemptView.attempt.id} />
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div className="space-y-4">
                    {internalDefinition.questions.map((question, index) => (
                      <article className="rounded-lg border border-slate-200 p-4" key={question.questionBankItemId}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold text-slate-900">Câu {index + 1}</h3>
                          <span className="text-xs text-slate-500">{question.points} điểm</span>
                        </div>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                          {getQuestionTypeLabel(question)}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{question.prompt}</p>

                        {question.questionType === "multiple_choice" || question.questionType === "true_false" ? (
                          <div className="mt-3 space-y-2">
                            {question.choices.map((choice) => (
                              <label className="flex items-start gap-2 text-sm text-slate-700" key={choice}>
                                {question.questionType === "multiple_choice" && Array.isArray(question.answerKey) ? (
                                  <input
                                    defaultChecked={getStoredAnswerValues(attemptView, question.questionBankItemId).includes(choice)}
                                    disabled={isAttemptLocked}
                                    name={`question::${question.questionBankItemId}`}
                                    type="checkbox"
                                    value={choice}
                                  />
                                ) : (
                                  <input
                                    defaultChecked={getStoredAnswerValue(attemptView, question.questionBankItemId) === choice}
                                    disabled={isAttemptLocked}
                                    name={`question::${question.questionBankItemId}`}
                                    type="radio"
                                    value={choice}
                                  />
                                )}
                                <span>{choice}</span>
                              </label>
                            ))}
                          </div>
                        ) : question.questionType === "short_answer" ? (
                          <input
                            className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            defaultValue={getStoredAnswerValue(attemptView, question.questionBankItemId)}
                            disabled={isAttemptLocked}
                            name={`question::${question.questionBankItemId}`}
                            placeholder="Nhập câu trả lời ngắn"
                          />
                        ) : (
                          <textarea
                            className="mt-3 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            defaultValue={getStoredAnswerValue(attemptView, question.questionBankItemId)}
                            disabled={isAttemptLocked}
                            name={`question::${question.questionBankItemId}`}
                            placeholder="Nhập câu trả lời tự luận"
                          />
                        )}
                      </article>
                    ))}

                    {!isAttemptLocked ? (
                      <div className="flex flex-wrap gap-3">
                        <button
                          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                          disabled={isPending}
                          name="intent"
                          type="submit"
                          value="save"
                        >
                          {isPending ? "Đang xử lý..." : "Lưu tạm"}
                        </button>
                        <button
                          className="rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                          disabled={isPending}
                          name="intent"
                          type="submit"
                          value="submit"
                        >
                          {isPending ? "Đang nộp..." : "Nộp bài"}
                        </button>
                      </div>
                    ) : (
                      <div className={isTimedAttemptExpired
                        ? "rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                        : "rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"}>
                        {isTimedAttemptExpired
                          ? "Đã hết thời gian làm bài."
                          : "Bài kiểm tra này đã được nộp. Bạn không thể chỉnh sửa thêm ở lượt làm hiện tại."}
                      </div>
                    )}
                  </div>

                  <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                      <p className="text-sm font-medium text-rose-950">Thời gian làm bài còn lại</p>
                      <p className="mt-2 font-mono text-3xl font-semibold text-rose-800">
                        {isDraftAssessmentValue || remainingSeconds === null ? "Không giới hạn" : formatDuration(remainingSeconds)}
                      </p>
                      <p className="mt-2 text-xs text-rose-800">
                        {isDraftAssessmentValue ? "Bài bản nháp không áp dụng giới hạn thời gian." : "Đồng hồ sẽ khóa lượt làm khi về 00:00:00."}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      <p>Lượt làm bài: #{attemptView.attempt.attemptNumber}</p>
                      <p>Trạng thái: {getAttemptStatusLabel(attemptView.attempt.status)}</p>
                      <p>Thời hạn làm bài: {isDraftAssessmentValue ? "Không áp dụng cho bài bản nháp" : formatDateTime(assessment.dueAt)}</p>
                      {attemptView.attempt.submittedAt ? <p>Đã nộp lúc: {formatDateTime(attemptView.attempt.submittedAt)}</p> : null}
                    </div>
                  </aside>
                </div>

                {review ? (
                  <section className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">Kết quả cá nhân</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Lần nộp #{review.attemptNumber} | Trạng thái: {review.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">
                          {review.rawScore}/{review.maxScore}
                        </p>
                        <p className="text-sm text-slate-600">
                          {typeof review.normalizedScore === "number" ? `${review.normalizedScore}%` : "Chưa quy đổi"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      {review.pendingManualReview ? (
                        <p>Một số câu tự luận vẫn đang chờ giảng viên chấm, nên điểm hiện tại có thể chưa phải điểm cuối cùng.</p>
                      ) : (
                        <p>Điểm cuối cùng và phản hồi đã sẵn sàng để bạn xem.</p>
                      )}
                    </div>

                    <div className="mt-4 space-y-3">
                      {review.questions.map((question) => (
                        <article className="rounded-lg border border-slate-200 bg-white p-4" key={question.questionBankItemId}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-medium text-slate-900">Câu {question.sortOrder}</h4>
                            <span className="text-sm text-slate-600">
                              Điểm: {typeof question.finalScore === "number" ? question.finalScore : "-"} / {question.points}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                            {getQuestionTypeLabel(question)}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{question.prompt}</p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Câu trả lời của bạn</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{question.answerText || "Chưa có câu trả lời."}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phản hồi</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                                {question.feedback
                                  || (question.explanation ?? "")
                                  || (review.pendingManualReview && question.questionType === "essay"
                                    ? "Câu tự luận này đang chờ giảng viên phản hồi."
                                    : "Chưa có phản hồi thêm.")}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </form>
            ) : (
              <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                Không thể tải đề kiểm tra nội bộ ở thời điểm hiện tại.
              </div>
            )
          ) : assessment.embedMode === "iframe" && assessment.formUrl ? (
            <div className="space-y-3">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <p>Thời gian làm bài: {isDraftAssessmentValue ? "Không giới hạn thời gian" : (assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} phút` : "Không giới hạn")}</p>
                    <p>Thời hạn làm bài: {isDraftAssessmentValue ? "Không áp dụng cho bài bản nháp" : formatDateTime(assessment.dueAt)}</p>
                  </div>
                  {canStartCurrentAttempt ? (
                    <iframe className="h-[640px] w-full rounded-md border border-slate-200" src={assessment.formUrl} title={assessment.title} />
                  ) : (
                    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {startBlockedMessage}
                    </div>
                  )}
                </div>
                <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-medium text-rose-950">Thời gian làm bài còn lại</p>
                    <p className="mt-2 font-mono text-3xl font-semibold text-rose-800">
                      {isDraftAssessmentValue || remainingSeconds === null ? "Không giới hạn" : formatDuration(remainingSeconds)}
                    </p>
                    <p className="mt-2 text-xs text-rose-800">
                      {isDraftAssessmentValue ? "Bài bản nháp không áp dụng giới hạn thời gian." : "Đồng hồ chạy theo thời lượng làm bài ngay sau khi bạn bắt đầu."}
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          ) : assessment.formUrl ? (
            <div className="space-y-3">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <p>Thời gian làm bài: {isDraftAssessmentValue ? "Không giới hạn thời gian" : (assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} phút` : "Không giới hạn")}</p>
                    <p>Thời hạn làm bài: {isDraftAssessmentValue ? "Không áp dụng cho bài bản nháp" : formatDateTime(assessment.dueAt)}</p>
                  </div>
                  {canStartCurrentAttempt ? (
                    <a className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700" href={assessment.formUrl} rel="noreferrer" target="_blank">
                      Mở biểu mẫu trong tab mới
                    </a>
                  ) : (
                    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {startBlockedMessage}
                    </div>
                  )}
                </div>
                <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-medium text-rose-950">Thời gian làm bài còn lại</p>
                    <p className="mt-2 font-mono text-3xl font-semibold text-rose-800">
                      {isDraftAssessmentValue || remainingSeconds === null ? "Không giới hạn" : formatDuration(remainingSeconds)}
                    </p>
                    <p className="mt-2 text-xs text-rose-800">
                      {isDraftAssessmentValue ? "Bài bản nháp không áp dụng giới hạn thời gian." : "Đồng hồ chạy theo thời lượng làm bài ngay sau khi bạn bắt đầu."}
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600">
              Bài kiểm tra chưa có liên kết form. Nội dung kiểm tra sẽ được giảng viên cập nhật sau.
            </div>
          )}

          {actionState.message ? (
            <p className={actionState.status === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>
              {actionState.message}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
