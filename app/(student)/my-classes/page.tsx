import { signOutAction } from "@/app/(auth)/login/actions";
import { requireRole } from "@/lib/services/auth-service";
import { listAssessmentsForStudent } from "@/lib/services/assessment-service";
import { listClassesForUser } from "@/lib/services/class-service";
import Link from "next/link";

export default async function MyClassesPage() {
  const profileResult = await requireRole(["student", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Lớp của tôi</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const classesResult = await listClassesForUser({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    page: 1,
    pageSize: 100,
  });

  const assessmentsResult = await listAssessmentsForStudent({
    studentId: profileResult.data.id,
  });
  const assessmentCountsByClassId = assessmentsResult.ok
    ? assessmentsResult.data.items.reduce<Map<string, number>>((map, assessment) => {
        if (assessment.studentListStatus !== "available") {
          return map;
        }

        map.set(assessment.classId, (map.get(assessment.classId) ?? 0) + 1);
        return map;
      }, new Map())
    : new Map<string, number>();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Các lớp học của tôi</h1>
          <p className="mt-2 text-sm text-slate-600">Danh sách lớp được giới hạn theo trạng thái thành viên lớp đang hoạt động.</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" href="/my-profile">
            Thông tin của tôi
          </Link>
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" href="/my-classes/enrollment">
            Đăng ký lớp học phần
          </Link>
        </nav>
      </div>

      {!classesResult.ok ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{classesResult.error.message}</div>
      ) : classesResult.data.items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600" data-testid="student-classes-empty">
          Bạn chưa có lớp học phần nào.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {classesResult.data.items.map((courseClass) => (
            <article className="relative rounded-lg border border-slate-200 p-4" data-testid={`student-class-card-${courseClass.classCode}`} key={courseClass.id}>
              {(assessmentCountsByClassId.get(courseClass.id) ?? 0) > 0 ? (
                <div className="absolute right-4 top-4 rounded-full bg-rose-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
                  ĐANG CÓ BÀI KIỂM TRA
                </div>
              ) : null}
              <h2 className="text-lg font-semibold text-slate-900">{courseClass.title}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {courseClass.classCode} · {courseClass.courseCode} - {courseClass.courseTitle}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Học kỳ: {courseClass.semester ?? "-"} · Năm học: {courseClass.academicYear ?? "-"}
              </p>
              <div className="mt-3">
                <Link className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" href={`/my-classes/${courseClass.id}/room`}>
                  Vào phòng học
                </Link>
                <Link className="ml-2 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" href={`/my-classes/assessments?classId=${courseClass.id}`}>
                  Xem bài kiểm tra
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <form action={signOutAction} className="mt-6">
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
          Đăng xuất
        </button>
      </form>
    </main>
  );
}
