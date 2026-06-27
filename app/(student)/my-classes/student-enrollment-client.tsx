"use client";

import { useActionState } from "react";

import {
  requestClassEnrollmentAction,
} from "@/app/(student)/my-classes/actions";
import { initialStudentEnrollmentActionState } from "@/app/(student)/my-classes/student-enrollment-action-state";
import type { EnrollmentOption } from "@/lib/types/enrollment-option";

type StudentEnrollmentClientProps = {
  options: EnrollmentOption[];
  requestedClassIds: string[];
};

export function StudentEnrollmentClient({ options, requestedClassIds }: StudentEnrollmentClientProps) {
  const [state, action, isPending] = useActionState(requestClassEnrollmentAction, initialStudentEnrollmentActionState);
  const requestedSet = new Set(requestedClassIds);

  return (
    <section className="mt-6 rounded-lg border border-teal-200 bg-teal-50 p-4">
      <h2 className="text-lg font-semibold text-teal-950">Đăng ký tham gia lớp học phần</h2>
      <p className="mt-1 text-sm text-teal-900">
        Chọn một lớp đang hoạt động để gửi yêu cầu. Lớp sẽ xuất hiện trong “Lớp của tôi” sau khi được duyệt.
      </p>

      {options.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-teal-300 bg-white/70 p-4 text-sm text-teal-900">
          Hiện chưa có lớp học phần đang mở.
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          {options.map((option) => {
            const alreadyRequested = requestedSet.has(option.classId);

            return (
              <article className="rounded-lg border border-teal-200 bg-white p-4" key={option.classId}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{option.classTitle}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {option.classCode} · {option.courseCode} - {option.courseTitle}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Học kỳ: {option.semester ?? "-"} · Năm học: {option.academicYear ?? "-"}
                    </p>
                  </div>
                  {alreadyRequested ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">Đã gửi yêu cầu</span>
                  ) : (
                    <form action={action}>
                      <input name="courseId" type="hidden" value={option.courseId} />
                      <input name="classId" type="hidden" value={option.classId} />
                      <button
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                        disabled={isPending}
                        type="submit"
                      >
                        Xin tham gia
                      </button>
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {state.message ? (
        <p className={state.status === "success" ? "mt-3 text-sm text-emerald-700" : "mt-3 text-sm text-red-600"}>
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
