import { AssessmentGradingClient } from "@/app/(teacher)/assessments/[assessmentId]/results/assessment-grading-client";
import { AssessmentResultsImportClient } from "@/app/(teacher)/assessments/[assessmentId]/results/assessment-results-import-client";
import { AssessmentResultsSubmitClient } from "@/app/(teacher)/assessments/[assessmentId]/results/assessment-results-submit-client";
import Link from "next/link";

import { AdminAreaLink } from "@/components/ui/admin-area-link";
import { BackTextLink } from "@/components/ui/back-text-link";
import { getAssessmentSummaryRepository } from "@/lib/repositories/assessment-repository";
import { getAssessmentAuthoringMode, getInternalAssessmentDefinition } from "@/lib/services/assessment-service";
import { listAssessmentAttemptsForGrading } from "@/lib/services/assessment-runtime-service";
import { requireRole } from "@/lib/services/auth-service";
import { getAssessmentResults } from "@/lib/services/submission-service";
import type { AssessmentResultsSortDirection, AssessmentResultsSortField } from "@/lib/types/submission";

const submissionSourceLabels: Record<string, string> = {
  manual: "Nhập tay",
  internal: "Bài kiểm tra nội bộ",
  csv_import: "Import CSV/XLSX",
  google_webhook: "Google Form",
  microsoft_webhook: "Microsoft Form",
  lifecycle: "Đồng bộ hệ thống",
};

const sortableFields: AssessmentResultsSortField[] = [
  "studentCode",
  "studentFullName",
  "studentEmail",
  "rawScore",
  "submittedAt",
  "sourceLabel",
  "note",
];

type AssessmentResultsPageProps = {
  params: Promise<{ assessmentId: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string; sortBy?: string; sortDirection?: string }>;
};

export default async function AssessmentResultsPage({ params, searchParams }: AssessmentResultsPageProps) {
  const profileResult = await requireRole(["teacher", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Kết quả bài kiểm tra</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const page = Number.parseInt(resolvedSearchParams.page ?? "1", 10);
  const pageSize = Number.parseInt(resolvedSearchParams.pageSize ?? "20", 10);
  const sortBy = sortableFields.includes(resolvedSearchParams.sortBy as AssessmentResultsSortField)
    ? resolvedSearchParams.sortBy as AssessmentResultsSortField
    : "submittedAt";
  const sortDirection: AssessmentResultsSortDirection = resolvedSearchParams.sortDirection === "asc" ? "asc" : "desc";

  const results = await getAssessmentResults({
    assessmentId: resolvedParams.assessmentId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20,
    sortBy,
    sortDirection,
  });

  const [assessmentSummary, authoringModeResult] = await Promise.all([
    getAssessmentSummaryRepository(resolvedParams.assessmentId),
    getAssessmentAuthoringMode({
      assessmentId: resolvedParams.assessmentId,
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
    }),
  ]);

  const isInternalAssessment = authoringModeResult.ok && authoringModeResult.data.deliveryMode === "internal";
  const resultsLocked = Boolean(assessmentSummary?.resultsLockedAt);
  const resultsPublished = Boolean(assessmentSummary?.resultsPublishedAt);
  const importDisabledMessage = resultsPublished
    ? "Kết quả đã được NỘP KẾT QUẢ cho Mod nên không thể nhập file hoặc tải kết quả lên nữa."
    : resultsLocked
      ? "Kết quả đang bị khóa; hãy chọn MỞ KẾT QUẢ nếu bạn muốn nhập file và tải kết quả lên."
      : undefined;
  const gradingDisabledMessage = resultsPublished
    ? "Kết quả đã được NỘP KẾT QUẢ cho Mod nên không thể chỉnh sửa hoặc cập nhật điểm nữa."
    : resultsLocked
      ? "Kết quả đang bị khóa; hãy chọn MỞ KẾT QUẢ nếu bạn muốn chỉnh sửa hoặc cập nhật điểm."
      : undefined;

  const [internalDefinitionResult, gradingAttemptsResult] = isInternalAssessment
    ? await Promise.all([
        getInternalAssessmentDefinition({
          assessmentId: resolvedParams.assessmentId,
          actorId: profileResult.data.id,
          actorRole: profileResult.data.role,
        }),
        listAssessmentAttemptsForGrading({
          assessmentId: resolvedParams.assessmentId,
          actorId: profileResult.data.id,
          actorRole: profileResult.data.role,
        }),
      ])
    : [null, null];

  const buildQueryString = (extra: Record<string, string>) => {
    const query = new URLSearchParams();
    query.set("page", "1");
    query.set("pageSize", String(Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20));
    query.set("sortBy", sortBy);
    query.set("sortDirection", sortDirection);

    for (const [key, value] of Object.entries(extra)) {
      query.set(key, value);
    }

    return query.toString();
  };

  const buildSortHref = (field: AssessmentResultsSortField) => {
    const nextDirection = sortBy === field && sortDirection === "asc" ? "desc" : "asc";
    return `/assessments/${resolvedParams.assessmentId}/results?${buildQueryString({
      sortBy: field,
      sortDirection: nextDirection,
    })}`;
  };

  const sortIndicator = (field: AssessmentResultsSortField) => {
    if (sortBy !== field) {
      return "↕";
    }

    return sortDirection === "asc" ? "↑" : "↓";
  };

  const csvExportHref = `/api/assessments/${resolvedParams.assessmentId}/results/export?${buildQueryString({ format: "csv" })}`;
  const xlsxExportHref = `/api/assessments/${resolvedParams.assessmentId}/results/export?${buildQueryString({ format: "xlsx" })}`;

  if (!results.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Kết quả bài kiểm tra</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {results.error.message}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        {profileResult.data.role !== "admin" ? <BackTextLink href="/assessments">Quay về Quản lý bài kiểm tra</BackTextLink> : <div />}
        {profileResult.data.role === "admin" ? <AdminAreaLink /> : null}
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {assessmentSummary?.title ? `Kết quả bài ${assessmentSummary.title}` : "Kết quả bài kiểm tra"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {assessmentSummary
              ? `${assessmentSummary.classCode} - ${assessmentSummary.classTitle} | ${assessmentSummary.courseCode}`
              : "Bảng kết quả theo từng bài kiểm tra."}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        {!isInternalAssessment ? (
          <div className="min-w-[320px] flex-1">
            <AssessmentResultsImportClient
              assessmentCloCodes={assessmentSummary?.assessmentCloCodes ?? []}
              assessmentId={resolvedParams.assessmentId}
              disabled={resultsLocked || resultsPublished}
              disabledMessage={importDisabledMessage}
            />
          </div>
        ) : <div />}
        <div className="flex shrink-0 flex-wrap items-start gap-2 whitespace-nowrap">
          {profileResult.data.role === "teacher" ? (
            <AssessmentResultsSubmitClient
              assessmentId={resolvedParams.assessmentId}
              resultsLockedAt={assessmentSummary?.resultsLockedAt}
              resultsPublishedAt={assessmentSummary?.resultsPublishedAt}
            />
          ) : null}
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" href={csvExportHref}>
            Xuất kết quả kiểm tra
          </Link>
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" href={xlsxExportHref}>
            Xuất thống kê kết quả
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left font-medium">
                <Link className="inline-flex items-center gap-1 hover:text-slate-900" href={buildSortHref("studentCode")}>
                  Mã sinh viên <span>{sortIndicator("studentCode")}</span>
                </Link>
              </th>
              <th className="px-3 py-2 text-left font-medium">
                <Link className="inline-flex items-center gap-1 hover:text-slate-900" href={buildSortHref("studentFullName")}>
                  Họ tên sinh viên <span>{sortIndicator("studentFullName")}</span>
                </Link>
              </th>
              <th className="px-3 py-2 text-left font-medium">
                <Link className="inline-flex items-center gap-1 hover:text-slate-900" href={buildSortHref("studentEmail")}>
                  Email <span>{sortIndicator("studentEmail")}</span>
                </Link>
              </th>
              <th className="px-3 py-2 text-left font-medium">
                <Link className="inline-flex items-center gap-1 hover:text-slate-900" href={buildSortHref("rawScore")}>
                  Điểm <span>{sortIndicator("rawScore")}</span>
                </Link>
              </th>
              {(assessmentSummary?.assessmentCloCodes ?? []).map((cloCode) => (
                <th className="px-3 py-2 text-left font-medium" key={cloCode}>
                  {cloCode}
                </th>
              ))}
              <th className="px-3 py-2 text-left font-medium">
                <Link className="inline-flex items-center gap-1 hover:text-slate-900" href={buildSortHref("submittedAt")}>
                  Nộp lúc <span>{sortIndicator("submittedAt")}</span>
                </Link>
              </th>
              <th className="px-3 py-2 text-left font-medium">
                <Link className="inline-flex items-center gap-1 hover:text-slate-900" href={buildSortHref("sourceLabel")}>
                  Nguồn <span>{sortIndicator("sourceLabel")}</span>
                </Link>
              </th>
              <th className="px-3 py-2 text-left font-medium">
                <Link className="inline-flex items-center gap-1 hover:text-slate-900" href={buildSortHref("note")}>
                  Ghi chú <span>{sortIndicator("note")}</span>
                </Link>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.data.items.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={7 + ((assessmentSummary?.assessmentCloCodes ?? []).length)}>Chưa có kết quả nào cho bài kiểm tra này.</td>
              </tr>
            ) : (
              results.data.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-slate-600">{item.studentCode ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-900">{item.studentFullName}</td>
                  <td className="px-3 py-2 text-slate-600">{item.studentEmail ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{item.rawScore ?? "-"}{item.maxScore ? ` / ${item.maxScore}` : ""}</td>
                  {(assessmentSummary?.assessmentCloCodes ?? []).map((cloCode) => (
                    <td className="px-3 py-2 text-slate-700" key={`${item.id}-${cloCode}`}>
                      {item.cloScores?.[cloCode] ?? "-"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-slate-600">{item.submittedAt ? new Date(item.submittedAt).toLocaleString("vi-VN") : "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{item.sourceLabel ?? submissionSourceLabels[item.source] ?? item.source}</td>
                  <td className="px-3 py-2 text-slate-600">{item.note ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Tổng số bản ghi: {results.data.totalItems} | Trang {results.data.page}/{Math.max(results.data.totalPages, 1)}
      </p>

      {isInternalAssessment && internalDefinitionResult?.ok && gradingAttemptsResult?.ok ? (
        <AssessmentGradingClient
          assessmentId={resolvedParams.assessmentId}
          attempts={gradingAttemptsResult.data}
          disabled={resultsLocked || resultsPublished}
          disabledMessage={gradingDisabledMessage}
          definition={internalDefinitionResult.data}
        />
      ) : null}
    </main>
  );
}
