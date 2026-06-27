import Link from "next/link";

import { signOutAction } from "@/app/(auth)/login/actions";
import { StudentEnrollmentClient } from "@/app/(student)/my-classes/student-enrollment-client";
import { requireRole } from "@/lib/services/auth-service";
import { listEnrollmentRequestsForStudent } from "@/lib/services/enrollment-service";
import { listOpenEnrollmentOptions } from "@/lib/services/enrollment-option-service";

export default async function StudentEnrollmentPage() {
  const profileResult = await requireRole(["student", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Đăng ký tham gia lớp học phần</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const [enrollmentOptionsResult, enrollmentRequestsResult] = await Promise.all([
    listOpenEnrollmentOptions(),
    listEnrollmentRequestsForStudent(profileResult.data.id),
  ]);
  const enrollmentRequests = enrollmentRequestsResult.ok ? enrollmentRequestsResult.data : [];

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Đăng ký tham gia lớp học phần</h1>
          <p className="mt-2 text-sm text-slate-600">Chọn lớp đang mở và theo dõi các yêu cầu đã gửi.</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" href="/my-profile">
            Thông tin của tôi
          </Link>
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" href="/my-classes">
            Các lớp học của tôi
          </Link>
        </nav>
      </div>

      {enrollmentOptionsResult.ok ? (
        <StudentEnrollmentClient
          options={enrollmentOptionsResult.data.options}
          requestedClassIds={enrollmentRequests
            .filter((request) => request.status === "pending" || request.status === "approved")
            .flatMap((request) => (request.classId ? [request.classId] : []))}
        />
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {enrollmentOptionsResult.error.message}
        </div>
      )}

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Yêu cầu tham gia lớp học đã gửi</h2>
        {!enrollmentRequestsResult.ok ? (
          <p className="mt-2 text-sm text-red-600">{enrollmentRequestsResult.error.message}</p>
        ) : enrollmentRequests.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Bạn chưa gửi yêu cầu tham gia lớp nào.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {enrollmentRequests.map((request) => (
              <article className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700" key={request.id}>
                <p className="font-medium text-slate-900">
                  {request.classCode ?? "-"} - {request.classTitle ?? "Lớp chưa xác định"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {request.courseCode ?? "-"} - {request.courseTitle ?? "Học phần chưa xác định"} · Trạng thái: {request.status}
                </p>
                {request.reviewNote ? <p className="mt-1 text-xs text-slate-500">Ghi chú: {request.reviewNote}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <form action={signOutAction} className="mt-6">
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
          Đăng xuất
        </button>
      </form>
    </main>
  );
}
