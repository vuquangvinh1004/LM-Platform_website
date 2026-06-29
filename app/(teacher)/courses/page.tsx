import Link from "next/link";

import { CourseManagementClient } from "@/app/(teacher)/courses/course-management-client";
import { AdminAreaLink } from "@/components/ui/admin-area-link";
import { BackTextLink } from "@/components/ui/back-text-link";
import { getUserRolePresentation } from "@/lib/presentation/user-role";
import { requireRole } from "@/lib/services/auth-service";
import { listActiveModerators, listActiveTeachers, listCoursesForUser } from "@/lib/services/course-service";

type CoursesPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: "draft" | "active" | "archived";
    page?: string;
    pageSize?: string;
  }>;
};

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const profileResult = await requireRole(["moderator", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Học phần</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
        <BackTextLink className="mt-4" href="/login">Quay lại đăng nhập</BackTextLink>
      </main>
    );
  }

  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const pageSize = Number(params.pageSize ?? "10");
  const isAdmin = profileResult.data.role === "admin";
  const adminRole = getUserRolePresentation("admin");
  const moderatorRole = getUserRolePresentation("moderator");
  const teacherRole = getUserRolePresentation("teacher");

  const [listResult, moderatorOptionsResult, teacherOptionsResult] = await Promise.all([
    listCoursesForUser({
      userId: profileResult.data.id,
      role: profileResult.data.role,
      query: params.q,
      status: isAdmin ? "active" : params.status,
      page,
      pageSize,
    }),
    isAdmin ? listActiveModerators() : Promise.resolve({ ok: true as const, data: [] }),
    isAdmin ? listActiveTeachers() : Promise.resolve({ ok: true as const, data: [] }),
  ]);

  if (!listResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Học phần</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{listResult.error.message}</div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {isAdmin ? <div /> : <BackTextLink href="/dashboard">Quay về Tổng quan giám sát</BackTextLink>}
        {isAdmin ? <AdminAreaLink /> : null}
      </div>
      <div className="mb-6 mt-4">
        <h1 className="text-3xl font-semibold text-slate-950">Quản lý học phần</h1>
        {isAdmin ? (
          <p className="mt-1 text-sm text-slate-600">
            <span className={adminRole.emphasisClassName}>{adminRole.label}</span> chỉ xem các học phần đang hoạt động, gán hoặc bỏ quyền{" "}
            <span className={moderatorRole.emphasisClassName}>{moderatorRole.label}</span> quản lý, đồng thời giao học phần cho một hoặc nhiều{" "}
            <span className={teacherRole.emphasisClassName}>{teacherRole.label}</span> giảng dạy.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-600">Danh sách học phần và biểu mẫu tạo/sửa theo tầng dịch vụ.</p>
        )}
      </div>

      <form className={`mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 ${isAdmin ? "md:grid-cols-[minmax(0,1fr)_auto]" : "md:grid-cols-4"}`} method="get">
        <label className="text-sm text-slate-700 md:col-span-2">
          Tìm kiếm
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            defaultValue={params.q ?? ""}
            name="q"
            placeholder="Nhập mã học phần hoặc tên học phần"
          />
        </label>
        {!isAdmin ? (
          <label className="text-sm text-slate-700">
            Trạng thái
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={params.status ?? ""} name="status">
              <option value="">Tất cả</option>
              <option value="draft">Bản nháp</option>
              <option value="active">Đang hoạt động</option>
              <option value="archived">Đã lưu trữ</option>
            </select>
          </label>
        ) : null}
        <div className="flex items-end gap-2">
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
            Lọc
          </button>
          <Link className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600" href="/courses">
            Xóa lọc
          </Link>
        </div>
      </form>

      <CourseManagementClient
        actorRole={profileResult.data.role}
        changeRequests={[]}
        courses={listResult.data.items}
        moderatorOptions={moderatorOptionsResult.ok ? moderatorOptionsResult.data : []}
        teacherOptions={teacherOptionsResult.ok ? teacherOptionsResult.data : []}
        page={listResult.data.page}
        pageSize={listResult.data.pageSize}
        searchQuery={params.q}
        selectedStatus={isAdmin ? "active" : params.status}
        totalItems={listResult.data.totalItems}
      />

      {isAdmin && !moderatorOptionsResult.ok ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Không thể tải danh sách {moderatorRole.label} để gán quyền quản lý: {moderatorOptionsResult.error.message}
        </div>
      ) : null}

      {isAdmin && !teacherOptionsResult.ok ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Không thể tải danh sách {teacherRole.label} để gán học phần giảng dạy: {teacherOptionsResult.error.message}
        </div>
      ) : null}
    </main>
  );
}
