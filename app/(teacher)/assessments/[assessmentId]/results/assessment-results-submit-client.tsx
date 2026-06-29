"use client";

import { useActionState, useMemo, useRef, useState } from "react";

import {
  lockAssessmentResultsAction,
  submitAssessmentResultsToCourseAction,
  unlockAssessmentResultsAction,
} from "@/app/(teacher)/assessments/[assessmentId]/results/actions";
import {
  initialAssessmentResultsLockActionState,
  initialAssessmentResultsSubmitActionState,
} from "@/app/(teacher)/assessments/[assessmentId]/results/assessment-results-action-state";
import { useRefreshOnSuccess } from "@/lib/hooks/use-refresh-on-success";

type AssessmentResultsSubmitClientProps = {
  assessmentId: string;
  resultsLockedAt?: string;
  resultsPublishedAt?: string;
};

type ClientActionKey = "lock" | "unlock" | "submit";

export function AssessmentResultsSubmitClient({
  assessmentId,
  resultsLockedAt,
  resultsPublishedAt,
}: AssessmentResultsSubmitClientProps) {
  const [lockState, lockAction, isLockPending] = useActionState(
    lockAssessmentResultsAction,
    initialAssessmentResultsLockActionState,
  );
  const [unlockState, unlockAction, isUnlockPending] = useActionState(
    unlockAssessmentResultsAction,
    initialAssessmentResultsLockActionState,
  );
  const [submitState, submitAction, isSubmitPending] = useActionState(
    submitAssessmentResultsToCourseAction,
    initialAssessmentResultsSubmitActionState,
  );
  const [clientMessage, setClientMessage] = useState<{ kind: "error"; text: string } | null>(null);
  const [lastAction, setLastAction] = useState<ClientActionKey | null>(null);
  const lockFormRef = useRef<HTMLFormElement>(null);
  const unlockFormRef = useRef<HTMLFormElement>(null);
  const submitFormRef = useRef<HTMLFormElement>(null);

  useRefreshOnSuccess({ status: lockState.status, nonce: lockState.nonce });
  useRefreshOnSuccess({ status: unlockState.status, nonce: unlockState.nonce });
  useRefreshOnSuccess({ status: submitState.status, nonce: submitState.nonce });

  const isLocked = Boolean(resultsLockedAt);
  const isPublished = Boolean(resultsPublishedAt);
  const isPending = isLockPending || isUnlockPending || isSubmitPending;

  const serverMessage = useMemo(() => {
    if (lastAction === "lock" && lockState.message) {
      return {
        kind: lockState.status === "error" ? "error" as const : "success" as const,
        text: lockState.message,
      };
    }

    if (lastAction === "unlock" && unlockState.message) {
      return {
        kind: unlockState.status === "error" ? "error" as const : "success" as const,
        text: unlockState.message,
      };
    }

    if (lastAction === "submit" && submitState.message) {
      return {
        kind: submitState.status === "error" ? "error" as const : "success" as const,
        text: submitState.message,
      };
    }

    return null;
  }, [lastAction, lockState.message, lockState.status, submitState.message, submitState.status, unlockState.message, unlockState.status]);

  const visibleMessage = clientMessage ?? serverMessage;

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-start gap-2">
        {!isLocked ? (
          <form action={lockAction} ref={lockFormRef}>
            <input name="assessmentId" type="hidden" value={assessmentId} />
            <button
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isPending || isPublished}
              onClick={(event) => {
                event.preventDefault();
                setLastAction("lock");
                setClientMessage(null);

                if (!window.confirm(
                  "Nếu khóa kết quả thì sẽ không được phép nhập file và tải kết quả lên đối với bài kiểm tra nguồn ngoài, hoặc không được phép chỉnh sửa/cập nhật điểm đối với bài kiểm tra nội bộ. Bạn có muốn tiếp tục không?",
                )) {
                  return;
                }

                lockFormRef.current?.requestSubmit();
              }}
              type="button"
            >
              {isLockPending ? "Đang khóa..." : "KHÓA KẾT QUẢ"}
            </button>
          </form>
        ) : (
          <form action={unlockAction} ref={unlockFormRef}>
            <input name="assessmentId" type="hidden" value={assessmentId} />
            <button
              className={isPublished
                ? "rounded-md bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed"
                : "rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"}
              disabled={isPending || isPublished}
              onClick={(event) => {
                event.preventDefault();
                setLastAction("unlock");
                setClientMessage(null);

                if (isPublished) {
                  return;
                }

                if (!window.confirm("Mở lại kết quả sẽ cho phép cập nhật điểm trở lại. Bạn có muốn tiếp tục không?")) {
                  return;
                }

                unlockFormRef.current?.requestSubmit();
              }}
              type="button"
            >
              {isUnlockPending ? "Đang mở..." : "MỞ KẾT QUẢ"}
            </button>
          </form>
        )}

        <form action={submitAction} ref={submitFormRef}>
          <input name="assessmentId" type="hidden" value={assessmentId} />
          <button
            className={isPublished
              ? "rounded-md bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed"
              : "rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"}
            disabled={isPending || isPublished}
            onClick={(event) => {
              event.preventDefault();
              setLastAction("submit");

              if (isPublished) {
                setClientMessage({
                  kind: "error",
                  text: "Kết quả bài kiểm tra này đã được nộp cho Mod và không thể hoàn tác.",
                });
                return;
              }

              if (!isLocked) {
                setClientMessage({
                  kind: "error",
                  text: "Bạn phải KHÓA KẾT QUẢ rồi mới được NỘP KẾT QUẢ.",
                });
                return;
              }

              setClientMessage(null);

              if (!window.confirm(
                "Kết quả của bài kiểm tra sẽ được gửi về cho Mod. Thao tác này sẽ khóa hoàn toàn kết quả, không thể mở lại và không thể hoàn tác. Bạn có đồng ý không?",
              )) {
                return;
              }

              submitFormRef.current?.requestSubmit();
            }}
            type="button"
          >
            {isSubmitPending ? "Đang nộp..." : "NỘP KẾT QUẢ"}
          </button>
        </form>
      </div>

      {visibleMessage ? (
        <p className={visibleMessage.kind === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>
          {visibleMessage.text}
        </p>
      ) : null}

      {isPublished ? (
        <p className="text-xs text-slate-500">
          Kết quả đã được gửi cho Mod và bị khóa vĩnh viễn; bạn không thể mở lại để cập nhật điểm.
        </p>
      ) : isLocked ? (
        <p className="text-xs text-slate-500">
          Kết quả đang được khóa tạm thời. Chọn <span className="font-semibold">MỞ KẾT QUẢ</span> nếu bạn cần cập nhật điểm trước khi nộp.
        </p>
      ) : null}
    </div>
  );
}
