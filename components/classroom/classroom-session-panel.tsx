import Link from "next/link";

import type { ClassroomSessionSummary } from "@/lib/types/classroom";

type ClassroomSessionPanelProps = {
  sessions: ClassroomSessionSummary[];
  audience: "student" | "manager";
  classId: string;
  createSessionAction?: (formData: FormData) => Promise<void>;
  errorMessage?: string;
};

function getSessionHref(input: {
  audience: "student" | "manager";
  classId: string;
  sessionId: string;
}): string {
  if (input.audience === "student") {
    return `/my-classes/${input.classId}/sessions/${input.sessionId}`;
  }

  return `/classes/${input.classId}/sessions/${input.sessionId}`;
}

function getStudentAccessLabel(session: ClassroomSessionSummary): string {
  if (session.studentAccess === "open") {
    return "Đang mở";
  }

  if (session.studentAccess === "scheduled") {
    return session.availableFrom
      ? `Mở lúc ${new Date(session.availableFrom).toLocaleString("vi-VN")}`
      : "Chờ mở theo lịch";
  }

  return "Đang khóa";
}

export function ClassroomSessionPanel({
  sessions,
  audience,
  classId,
  createSessionAction,
  errorMessage,
}: ClassroomSessionPanelProps) {
  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-violet-950">Các buổi học</h2>
          <p className="mt-1 text-xs text-violet-700">Danh sách buổi học theo thứ tự trong lớp.</p>
        </div>
      </div>

      {audience === "manager" && createSessionAction ? (
        <form action={createSessionAction} className="mt-3 flex flex-wrap gap-2">
          <label className="min-w-[240px] flex-1 text-xs text-violet-900">
            Tiêu đề buổi học
            <input
              className="mt-1 w-full rounded-md border border-violet-200 bg-white px-3 py-2 text-sm text-slate-900"
              maxLength={200}
              name="title"
              placeholder="Nhập nội dung buổi học"
              required
            />
          </label>
          <button className="self-end rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white" type="submit">
            Thêm buổi học
          </button>
        </form>
      ) : null}

      {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}

      {sessions.length === 0 ? (
        <p className="mt-3 text-sm text-violet-800">Chưa có buổi học nào.</p>
      ) : (
        <div className="mt-3 flex flex-wrap justify-center gap-3 sm:justify-start">
          {sessions.map((session) => (
            audience === "student" && !session.isAccessibleToStudents ? (
              <div
                className="flex h-40 w-40 shrink-0 flex-col items-center justify-center gap-3 rounded-lg border border-violet-200 bg-white/80 p-4 text-center text-violet-950 shadow-sm opacity-80"
                key={session.id}
              >
                <span className="text-xs font-medium text-violet-600">Buổi học {session.sessionIndex}</span>
                <span className="text-base font-semibold">{session.title}</span>
                <span className="text-xs text-violet-700">{getStudentAccessLabel(session)}</span>
              </div>
            ) : (
              <Link
                className="flex h-40 w-40 shrink-0 flex-col items-center justify-center gap-3 rounded-lg border border-violet-200 bg-white p-4 text-center text-violet-950 shadow-sm transition hover:border-violet-400 hover:bg-violet-100"
                href={getSessionHref({ audience, classId, sessionId: session.id })}
                key={session.id}
              >
                <span className="text-xs font-medium text-violet-600">Buổi học {session.sessionIndex}</span>
                <span className="text-base font-semibold">{session.title}</span>
                <span className="text-xs text-violet-600">
                  {audience === "manager" ? getStudentAccessLabel(session) : "Mở buổi học"}
                </span>
              </Link>
            )
          ))}
        </div>
      )}
    </section>
  );
}
