import Link from "next/link";

import { BackTextLink } from "@/components/ui/back-text-link";
import { requireRole } from "@/lib/services/auth-service";
import { listAssessmentsForStudent } from "@/lib/services/assessment-service";

const studentAssessmentStatusLabels: Record<string, string> = {
  available: "Đang mở",
  completed: "Đã làm",
  overdue: "Quá hạn",
  upcoming: "Sắp diễn ra",
};

const studentAssessmentStatusClasses: Record<string, string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  overdue: "border-red-200 bg-red-50 text-red-700",
  upcoming: "border-sky-200 bg-sky-50 text-sky-700",
};

const providerLabels: Record<string, string> = {
  google_form: "Google Form",
  microsoft_form: "Microsoft Form",
  manual: "Nhập thủ công",
  internal: "Đề nội bộ",
  other: "Nguồn ngoài khác",
};

function formatDateTime(value?: string): string {
  return value ? new Date(value).toLocaleString("vi-VN") : "-";
}

function formatTimeLimit(value?: number): string {
  return value ? `${value} phút` : "Không giới hạn";
}

function formatAttemptLimit(value: number): string {
  return `${value} lượt`;
}

function getStudentAssessmentBadgeLabel(assessment: {
  studentListStatus: string;
  status: string;
}): string {
  if (assessment.status === "draft") {
    return "Bản nháp";
  }

  if (assessment.studentListStatus === "overdue" && assessment.status === "closed") {
    return "Đã đóng";
  }

  return studentAssessmentStatusLabels[assessment.studentListStatus] ?? assessment.studentListStatus;
}

export default async function StudentAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const profileResult = await requireRole(["student", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Bài kiểm tra của tôi</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const params = await searchParams;
  const assessmentsResult = await listAssessmentsForStudent({
    studentId: profileResult.data.id,
    classId: params.classId,
  });
  const visibleAssessments = assessmentsResult.ok
    ? assessmentsResult.data.items.filter((assessment) =>
        assessment.studentListStatus === "available"
        || assessment.studentListStatus === "completed"
        || assessment.studentListStatus === "overdue"
        || assessment.studentListStatus === "upcoming",
      )
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <BackTextLink className="mb-4" href="/my-classes">Quay về các lớp học của tôi</BackTextLink>
      <h1 className="text-2xl font-semibold text-slate-900">Bài kiểm tra của tôi</h1>
      <p className="mt-2 text-sm text-slate-600">
        {params.classId
          ? "Hiển thị các bài kiểm tra đang mở, đã làm, quá hạn hoặc sắp diễn ra của lớp đã chọn."
          : "Hiển thị các bài kiểm tra đang mở, đã làm, quá hạn hoặc sắp diễn ra trong các lớp bạn đang tham gia."}
      </p>

      {!assessmentsResult.ok ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{assessmentsResult.error.message}</div>
      ) : visibleAssessments.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">Chưa có bài kiểm tra nào.</div>
      ) : (
        <div className="mt-6 space-y-3">
          {visibleAssessments.map((assessment) => (
            <article className="rounded-lg border border-slate-200 p-4" key={assessment.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{assessment.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{assessment.classCode} - {assessment.classTitle}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${studentAssessmentStatusClasses[assessment.studentListStatus]}`}>
                  {getStudentAssessmentBadgeLabel(assessment)}
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Nguồn: {providerLabels[assessment.provider] ?? assessment.provider}
              </p>
              <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bắt đầu</span>
                  <p className="mt-1">{formatDateTime(assessment.openAt)}</p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thời hạn làm bài</span>
                  <p className="mt-1">{assessment.status === "draft" ? "Không áp dụng cho bản nháp" : formatDateTime(assessment.dueAt)}</p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thời lượng</span>
                  <p className="mt-1">{assessment.status === "draft" ? "Không giới hạn thời gian" : formatTimeLimit(assessment.timeLimitMinutes)}</p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Số lượt làm bài</span>
                  <p className="mt-1">{formatAttemptLimit(assessment.attemptLimit)}</p>
                </div>
              </div>
              <div className="mt-3">
                <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" href={`/my-classes/assessments/${assessment.id}`}>
                  {assessment.studentListStatus === "completed" ? "Xem lại bài kiểm tra" : "Xem chi tiết bài kiểm tra"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
