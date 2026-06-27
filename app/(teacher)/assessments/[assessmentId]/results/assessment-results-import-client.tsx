"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { importAssessmentResultsAction } from "@/app/(teacher)/assessments/[assessmentId]/results/actions";
import { initialAssessmentResultsImportActionState } from "@/app/(teacher)/assessments/[assessmentId]/results/assessment-results-action-state";
import { useRefreshOnSuccess } from "@/lib/hooks/use-refresh-on-success";

type AssessmentResultsImportClientProps = {
  assessmentId: string;
};

export function AssessmentResultsImportClient({ assessmentId }: AssessmentResultsImportClientProps) {
  const [state, action, isPending] = useActionState(
    importAssessmentResultsAction,
    initialAssessmentResultsImportActionState,
  );
  const [fileName, setFileName] = useState("Chưa chọn file");
  const formRef = useRef<HTMLFormElement>(null);
  const previousNonceRef = useRef(state.nonce);

  useRefreshOnSuccess({ status: state.status, nonce: state.nonce });

  useEffect(() => {
    if (state.status === "success" && state.nonce !== previousNonceRef.current) {
      formRef.current?.reset();
      setFileName("Chưa chọn file");
    }

    previousNonceRef.current = state.nonce;
  }, [state.status, state.nonce]);

  return (
    <form action={action} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3" ref={formRef}>
      <input name="assessmentId" type="hidden" value={assessmentId} />
      <div className="flex flex-wrap items-center gap-3">
        <label
          className="inline-flex cursor-pointer items-center rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          htmlFor={`assessment-results-import-${assessmentId}`}
        >
          Import CSV/XLSX
        </label>
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          href={`/api/assessments/${assessmentId}/results/template?format=csv`}
        >
          Tải mẫu CSV
        </Link>
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          href={`/api/assessments/${assessmentId}/results/template?format=xlsx`}
        >
          Tải mẫu XLSX
        </Link>
        <span className="text-sm text-slate-600">{fileName}</span>
        <input
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          id={`assessment-results-import-${assessmentId}`}
          name="resultsFile"
          onChange={(event) => {
            const nextFileName = event.currentTarget.files?.[0]?.name ?? "Chưa chọn file";
            setFileName(nextFileName);
          }}
          required
          type="file"
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Thứ tự cột file import: Mã sinh viên, Họ tên sinh viên, Email, Điểm, Nộp lúc, Nguồn, Ghi chú. Hệ thống dùng Mã sinh viên làm khóa đối chiếu cố định khi import.
      </p>
      {state.message ? (
        <p className={state.status === "error" ? "mt-2 text-sm text-red-600" : "mt-2 text-sm text-emerald-700"}>
          {state.message}
        </p>
      ) : null}
      <button className="mt-3 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60" disabled={isPending} type="submit">
        {isPending ? "Đang import..." : "Tải kết quả lên"}
      </button>
    </form>
  );
}
