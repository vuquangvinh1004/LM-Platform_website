import { signOutAction } from "@/app/(auth)/login/actions";
import { createGlobalNotificationAction, setGlobalNotificationExpiryAction } from "@/app/(teacher)/dashboard/actions";
import Link from "next/link";
import { AdminAreaLink } from "@/components/ui/admin-area-link";
import { requireRole } from "@/lib/services/auth-service";
import { listClassChangeRequests } from "@/lib/services/class-service";
import { getTeacherDashboard } from "@/lib/services/dashboard-service";
import { listEnrollmentRequestsByClassIds } from "@/lib/services/enrollment-service";
import { listGlobalNotifications } from "@/lib/services/global-notification-service";
import type { DashboardStudentMessageNotice } from "@/lib/types/dashboard";

type TeacherDashboardSearchParams = {
  courseId?: string;
  classId?: string;
};

type EnrollmentRequestNotice = {
  classId: string;
  classCode: string;
  classTitle: string;
  requestCount: number;
  latestRequestedAt: string;
};

type TeacherDashboardGeneralNotice = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  createdByRole: "admin" | "moderator" | "teacher";
  kind: "announcement" | "material_upload_request" | "material_upload_result";
  group: "system" | "material" | "class";
  expiresAt: string | null;
  canSetExpiry: boolean;
  href?: string;
  tone?: "admin" | "info";
  muted?: boolean;
};

type PendingClassOpenNotice = {
  requestId: string;
  classCode: string;
  title: string;
  courseLabel: string;
  createdAt: string;
};

function getClassLabel(input: {
  classId?: string | null;
  classes: Array<{ id: string; classCode: string; title: string }>;
}): string {
  if (!input.classId) {
    return "lớp chưa xác định";
  }

  const matchedClass = input.classes.find((courseClass) => courseClass.id === input.classId);

  if (!matchedClass) {
    return "lớp chưa xác định";
  }

  return `${matchedClass.classCode} - ${matchedClass.title}`;
}

function buildStudentMessageNotice(input: {
  notice: DashboardStudentMessageNotice;
  classes: Array<{ id: string; classCode: string; title: string }>;
}): TeacherDashboardGeneralNotice {
  const classLabel = getClassLabel({
    classId: input.notice.classId,
    classes: input.classes,
  });
  const studentLabel = input.notice.studentName?.trim() || "một sinh viên";

  return {
    id: `message-${input.notice.id}`,
    title: input.notice.replied ? "Tin nhắn của sinh viên đã được phản hồi" : "Có tin nhắn mới từ sinh viên",
    message: input.notice.replied
      ? `${studentLabel} của lớp ${classLabel} đã được giảng viên phản hồi.`
      : `${studentLabel} của lớp ${classLabel} đang chờ giảng viên phản hồi.`,
    createdAt: input.notice.createdAt,
    createdByRole: "teacher",
    kind: "announcement",
    group: "class",
    expiresAt: null,
    canSetExpiry: false,
    href: `/classes/${input.notice.classId}/room#classroom-messages`,
    tone: "info",
    muted: input.notice.replied,
  };
}

export default async function TeacherDashboardPage(
  { searchParams }: { searchParams: Promise<TeacherDashboardSearchParams> },
) {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Bảng tổng quan</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const resolvedSearchParams = await searchParams;

  const selectedCourseId = typeof resolvedSearchParams.courseId === "string" ? resolvedSearchParams.courseId : undefined;
  const selectedClassId = typeof resolvedSearchParams.classId === "string" ? resolvedSearchParams.classId : undefined;

  const [dashboardResult, notificationsResult, pendingClassRequestsResult] = await Promise.all([
    getTeacherDashboard({
      courseId: selectedCourseId,
      classId: selectedClassId,
    }),
    listGlobalNotifications({
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
    }),
    profileResult.data.role === "teacher"
      ? listClassChangeRequests({
        requestedBy: profileResult.data.id,
        statuses: ["pending_review"],
        actions: ["create"],
      })
      : Promise.resolve({ ok: true as const, data: [] }),
  ]);

  if (!dashboardResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">{profileResult.data.role === "moderator" ? "Tổng quan giám sát" : "Tổng quan giảng viên"}</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {dashboardResult.error.message}
        </div>
      </main>
    );
  }

  const dashboard = dashboardResult.data;
  const notifications = notificationsResult.ok ? notificationsResult.data : [];
  const isModerator = profileResult.data.role === "moderator";
  const isAdmin = profileResult.data.role === "admin";
  const isTeacher = profileResult.data.role === "teacher";
  const pendingClassReviewRequestsResult = isTeacher
    ? { ok: true as const, data: [] }
    : await listClassChangeRequests(
        isAdmin
          ? { statuses: ["pending_review"], actions: ["create", "archive", "delete"] }
          : { courseIds: dashboard.courses.map((course) => course.id), statuses: ["pending_review"] },
      );
  const pendingClassOpenNotices: PendingClassOpenNotice[] = isTeacher && pendingClassRequestsResult.ok
    ? pendingClassRequestsResult.data.map((request) => {
      const matchedCourse = dashboard.courses.find((course) => course.id === request.courseId);

      return {
        requestId: request.id,
        classCode: request.classCode ?? "Lớp mới",
        title: request.title ?? "Chưa đặt tên lớp",
        courseLabel: matchedCourse ? `${matchedCourse.code} - ${matchedCourse.title}` : "Học phần chưa xác định",
        createdAt: request.createdAt,
      };
    })
    : [];
  const pendingClassReviewNotices: TeacherDashboardGeneralNotice[] = !isTeacher && pendingClassReviewRequestsResult.ok
    ? pendingClassReviewRequestsResult.data.map((request) => {
      const matchedCourse = dashboard.courses.find((course) => course.id === request.courseId);
      const label =
        request.action === "create"
          ? `Mở lớp mới: ${request.classCode ?? "Lớp mới"}`
          : request.action === "archive"
            ? "Lưu trữ lớp"
            : "Xóa lớp";

      return {
        id: `review-${request.id}`,
        title: "Yêu cầu lớp đang chờ duyệt",
        message: `${label} trong học phần ${matchedCourse ? `${matchedCourse.code} - ${matchedCourse.title}` : "chưa xác định"} đang chờ Mod/Admin xử lý.`,
        createdAt: request.createdAt,
        createdByRole: isAdmin ? "admin" : "moderator",
        kind: "announcement",
        group: "class" as const,
        expiresAt: null,
        canSetExpiry: false,
        href: "/classes",
        tone: "info",
      };
    })
    : [];
  const filteredClasses = dashboard.classes.filter((courseClass) => {
    if (dashboard.selectedCourseId && courseClass.courseId !== dashboard.selectedCourseId) {
      return false;
    }

    if (dashboard.selectedClassId && courseClass.id !== dashboard.selectedClassId) {
      return false;
    }

    return true;
  });
  const visibleClassOptions = dashboard.selectedCourseId
    ? dashboard.classes.filter((courseClass) => courseClass.courseId === dashboard.selectedCourseId)
    : dashboard.classes;
  const pendingEnrollmentRequestsResult = isTeacher && filteredClasses.length > 0
    ? await listEnrollmentRequestsByClassIds(filteredClasses.map((courseClass) => courseClass.id))
    : { ok: true as const, data: [] };
  const enrollmentRequestNotices = pendingEnrollmentRequestsResult.ok
    ? Array.from(
        pendingEnrollmentRequestsResult.data
          .filter((request) => request.status === "pending" && request.classId)
          .reduce((map, request) => {
            const classId = request.classId!;
            const existing = map.get(classId);

            if (existing) {
              existing.requestCount += 1;

              if (new Date(request.requestedAt).getTime() > new Date(existing.latestRequestedAt).getTime()) {
                existing.latestRequestedAt = request.requestedAt;
              }

              return map;
            }

            map.set(classId, {
              classId,
              classCode: request.classCode ?? "Lớp chưa xác định",
              classTitle: request.classTitle ?? "Lớp chưa xác định",
              requestCount: 1,
              latestRequestedAt: request.requestedAt,
            });

            return map;
          }, new Map<string, EnrollmentRequestNotice>())
          .values(),
      ).sort((left, right) => new Date(right.latestRequestedAt).getTime() - new Date(left.latestRequestedAt).getTime())
    : [];
  const studentMessageNotices = isTeacher
    ? dashboard.studentMessageNotices
        .map((notice) => buildStudentMessageNotice({
          notice,
          classes: dashboard.classes,
        }))
    : [];
  const generalNotices: TeacherDashboardGeneralNotice[] = [
    ...notifications.map((notification) => {
      const group: TeacherDashboardGeneralNotice["group"] =
        notification.kind === "material_upload_request" || notification.kind === "material_upload_result" ? "material" : "system";

      return {
        id: `global-${notification.id}`,
        title: notification.title,
        message: notification.content,
        createdAt: notification.createdAt,
        createdByRole: notification.createdByRole,
        kind: notification.kind,
        group,
        expiresAt: notification.expiresAt,
        canSetExpiry: isModerator && notification.createdByRole === "moderator" && notification.kind === "announcement",
        tone: "admin" as const,
      };
    }),
    ...pendingClassOpenNotices.map((notice) => ({
      id: `class-open-${notice.requestId}`,
      title: "Yêu cầu mở lớp đang chờ Mod/Admin duyệt",
      message: `${notice.classCode} - ${notice.title} thuộc học phần ${notice.courseLabel} đã được gửi và đang chờ Mod hoặc Admin duyệt.`,
      createdAt: notice.createdAt,
      createdByRole: "teacher" as const,
      kind: "announcement" as const,
      group: "class" as const,
      expiresAt: null,
      canSetExpiry: false,
      href: "/classes",
      tone: "info" as const,
    })),
    ...pendingClassReviewNotices,
    ...enrollmentRequestNotices.map((notice) => ({
      id: `enrollment-${notice.classId}`,
      title: "Yêu cầu tham gia lớp đang chờ duyệt",
      message: `${notice.classCode} - ${notice.classTitle} đang có ${notice.requestCount} yêu cầu tham gia lớp từ sinh viên. Nhấp để mở trang Quản lý lớp và duyệt trực tiếp.`,
      createdAt: notice.latestRequestedAt,
      createdByRole: "teacher" as const,
      kind: "announcement" as const,
      group: "class" as const,
      expiresAt: null,
      canSetExpiry: false,
      href: `/classes?focusClassId=${notice.classId}`,
      tone: "info" as const,
    })),
    ...studentMessageNotices,
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const hasAnyGeneralNotice = generalNotices.length > 0;
  const noticeGroupLabel: Record<TeacherDashboardGeneralNotice["group"], string> = {
    system: "Thông báo hệ thống",
    material: "Duyệt tài liệu",
    class: "Thông báo lớp học",
  };
  const noticeGroupStyle: Record<TeacherDashboardGeneralNotice["group"], string> = {
    system: "border-amber-300 bg-amber-100 text-amber-900",
    material: "border-emerald-300 bg-emerald-100 text-emerald-900",
    class: "border-sky-300 bg-sky-100 text-sky-900",
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isAdmin ? "Tổng quan quản trị" : isModerator ? "Tổng quan giám sát" : "Tổng quan giảng viên"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isAdmin
              ? "Bảng tổng quan quản trị theo toàn hệ thống, gồm học phần, lớp học, sinh viên, bài kiểm tra và tỷ lệ hoàn thành."
              : isModerator
                ? "Thống kê theo các học phần được Admin phân quyền quản lý, bao gồm lớp học, sinh viên, bài kiểm tra và tỷ lệ hoàn thành."
                : "Bảng tổng quan theo phạm vi hiện tại, bao gồm tỷ lệ hoàn thành và hoạt động gần đây."}
          </p>
        </div>
        {isAdmin ? <AdminAreaLink /> : null}
      </div>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <form className="grid gap-3 md:grid-cols-3" method="get">
          <label className="text-xs font-medium text-slate-700" htmlFor="courseId">
            Lọc theo học phần
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
              defaultValue={dashboard.selectedCourseId ?? ""}
              id="courseId"
              name="courseId"
            >
              <option value="">Tất cả học phần</option>
              {dashboard.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.title}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-700" htmlFor="classId">
            Lọc theo lớp học
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
              defaultValue={dashboard.selectedClassId ?? ""}
              id="classId"
              name="classId"
            >
              <option value="">Tất cả lớp học</option>
              {visibleClassOptions.map((courseClass) => (
                <option key={courseClass.id} value={courseClass.id}>
                  {courseClass.classCode} - {courseClass.title}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" type="submit">
              Áp dụng bộ lọc
            </button>
            <Link className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600" href="/dashboard">
              Đặt lại
            </Link>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-white">
              THÔNG BÁO CHUNG
            </span>
          </div>
          {!isTeacher ? (
            <form action={createGlobalNotificationAction} className="grid w-full gap-2 md:max-w-xl">
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="title"
                placeholder="Tiêu đề thông báo"
                required
                type="text"
              />
              <textarea
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="content"
                placeholder="Nội dung thông báo"
                required
              />
              {isModerator ? (
                <label className="text-xs font-medium text-amber-900">
                  Thiết lập thời gian
                  <select className="mt-1 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-slate-800" name="expiresInDays" defaultValue="7">
                    <option value="">Không đặt thời hạn</option>
                    <option value="1">1 ngày</option>
                    <option value="3">3 ngày</option>
                    <option value="7">7 ngày</option>
                    <option value="14">14 ngày</option>
                  </select>
                </label>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
                  Gửi thông báo
                </button>
                {isModerator ? (
                  <button className="rounded-md border border-amber-400 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900" type="submit">
                    Thiết lập thời gian
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}
        </div>

        {!hasAnyGeneralNotice ? (
          <p className="mt-4 rounded-lg border border-dashed border-amber-200 bg-white/80 px-4 py-3 text-sm text-slate-500">
            Chưa có thông báo chung nào.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {generalNotices.map((notice) => {
              const content = (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${noticeGroupStyle[notice.group]}`}>
                        {noticeGroupLabel[notice.group]}
                      </span>
                      <p className={notice.tone === "info" ? "font-medium text-sky-950" : "font-medium text-amber-950"}>{notice.title}</p>
                    </div>
                    <span className={notice.tone === "info" ? "text-xs text-sky-700" : "text-xs text-amber-800"}>
                      {new Date(notice.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  <p className={notice.tone === "info" ? "mt-2 text-sm text-sky-900" : "mt-2 whitespace-pre-wrap text-sm text-amber-950"}>
                    {notice.message}
                  </p>
                  {notice.expiresAt ? (
                    <p className={notice.tone === "info" ? "mt-2 text-xs text-sky-700" : "mt-2 text-xs text-amber-800"}>
                      Hết hạn: {new Date(notice.expiresAt).toLocaleString("vi-VN")}
                    </p>
                  ) : null}
                  {notice.canSetExpiry ? (
                    <form action={setGlobalNotificationExpiryAction} className="mt-3 flex flex-wrap items-end gap-2">
                      <input name="notificationId" type="hidden" value={notice.id.replace(/^global-/, "")} />
                      <label className="text-xs text-amber-900">
                        Thời hạn
                        <select className="mt-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs" name="expiresInDays" defaultValue="7">
                          <option value="1">1 ngày</option>
                          <option value="3">3 ngày</option>
                          <option value="7">7 ngày</option>
                          <option value="14">14 ngày</option>
                        </select>
                      </label>
                      <button className="rounded-md border border-amber-400 px-3 py-2 text-xs font-medium text-amber-800" type="submit">
                        Thiết lập thời hạn
                      </button>
                    </form>
                  ) : null}
                </>
              );

              return (
                <li key={notice.id}>
                  {notice.href ? (
                    <Link
                      className={
                        notice.tone === "info"
                          ? notice.muted
                            ? "block rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 opacity-60 transition hover:border-slate-300 hover:bg-slate-100"
                            : "block rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 transition hover:border-sky-300 hover:bg-sky-100"
                          : "block rounded-lg border border-amber-300 bg-gradient-to-r from-amber-100 via-orange-50 to-amber-100 px-4 py-3 transition hover:border-amber-400 hover:from-amber-200 hover:to-orange-100"
                      }
                      href={notice.href}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div
                      className={
                        notice.tone === "info"
                          ? notice.muted
                            ? "rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 opacity-60"
                            : "rounded-lg border border-sky-200 bg-sky-50 px-4 py-3"
                          : "rounded-lg border border-amber-300 bg-gradient-to-r from-amber-100 via-orange-50 to-amber-100 px-4 py-3"
                      }
                    >
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-5">
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Học phần</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{dashboard.totalCourses}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Lớp học</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{dashboard.totalClasses}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Sinh viên đang hoạt động</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{dashboard.totalStudents}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Bài kiểm tra</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{dashboard.totalAssessments}</p>
        </article>
        <article className="rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-xs text-teal-700">Tỷ lệ hoàn thành</p>
          <p className="mt-1 text-2xl font-semibold text-teal-900">{dashboard.completionRate}%</p>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Tỷ lệ hoàn thành theo bài kiểm tra</h2>
        {dashboard.completionSeries.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Chưa có dữ liệu hoàn thành để hiển thị.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {dashboard.completionSeries.map((point) => (
              <div key={point.assessmentId}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                  <span>{point.assessmentTitle}</span>
                  <span>{point.completionRate}% ({point.completedCount}/{point.expectedCount}) | TB {point.averageScore}%</span>
                </div>
                <div
                  aria-label={`Tỉ lệ hoàn thành ${point.assessmentTitle}: ${point.completionRate}%`}
                  className="h-2 w-full overflow-hidden rounded bg-slate-100"
                  role="img"
                >
                  <div
                    className="h-full rounded bg-teal-600"
                    style={{ width: `${Math.min(100, Math.max(0, point.completionRate))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {!isAdmin ? (
      <div className="mt-4 flex flex-wrap gap-3">
        {!isTeacher ? (
          <Link className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" href="/courses">
            Quản lý học phần
          </Link>
        ) : null}
        {!isModerator ? (
          <Link className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" href="/classes">
            Quản lý lớp
          </Link>
        ) : (
          <Link className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" href="/classes">
            Giám sát lớp
          </Link>
        )}
        <Link className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" href="/library">
          Thư viện
        </Link>
        {!isModerator ? (
          <Link className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" href="/assessments">
            Quản lý bài kiểm tra
          </Link>
        ) : null}
        {!isTeacher ? (
          <Link className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" href="/access-review">
            Duyệt truy cập
          </Link>
        ) : null}
      </div>
      ) : null}
      <form action={signOutAction} className="mt-6">
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
          Đăng xuất
        </button>
      </form>
    </main>
  );
}
