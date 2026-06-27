import Link from "next/link";

import type { ClassroomOpenAssessment } from "@/lib/types/classroom";

type ClassroomAssessmentPanelProps = {
  assessments: ClassroomOpenAssessment[];
  audience: "student" | "manager";
};

function formatDueAt(dueAt: string | null): string {
  if (!dueAt) {
    return "Không giới hạn";
  }

  return new Date(dueAt).toLocaleString("vi-VN");
}

function assessmentHref(assessmentId: string, audience: ClassroomAssessmentPanelProps["audience"]): string {
  return audience === "student" ? `/my-classes/assessments/${assessmentId}` : `/assessments/${assessmentId}/results`;
}

export function ClassroomAssessmentPanel({ assessments, audience }: ClassroomAssessmentPanelProps) {
  if (assessments.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-rose-950">Kiểm tra</h2>
          <p className="mt-1 text-sm text-rose-800">Bài kiểm tra đang mở trong lớp học phần này.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-rose-800">{assessments.length} đang mở</span>
      </div>

      <div className="space-y-2">
        {assessments.map((assessment) => (
          <article className="rounded-lg border border-rose-200 bg-white p-3" key={assessment.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">{assessment.title}</h3>
                <p className="mt-1 text-xs text-slate-600">Thời hạn làm bài: {formatDueAt(assessment.dueAt)}</p>
              </div>
              <Link
                className="rounded-md bg-rose-700 px-3 py-2 text-xs font-medium text-white"
                href={assessmentHref(assessment.id, audience)}
              >
                Vào phòng kiểm tra
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
