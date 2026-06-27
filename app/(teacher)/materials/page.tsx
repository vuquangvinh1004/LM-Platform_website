import { MaterialUploadClient } from "@/app/(teacher)/materials/material-upload-client";
import { AdminAreaLink } from "@/components/ui/admin-area-link";
import { BackTextLink } from "@/components/ui/back-text-link";
import { requireRole } from "@/lib/services/auth-service";
import { listCoursesForUser } from "@/lib/services/course-service";
import { getLibraryOverview } from "@/lib/services/library-service";

export default async function MaterialsPage() {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Tài liệu</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
        <BackTextLink className="mt-4" href="/login">Quay lại đăng nhập</BackTextLink>
      </main>
    );
  }

  const [coursesResult, libraryResult] = await Promise.all([
    listCoursesForUser({
      userId: profileResult.data.id,
      role: profileResult.data.role,
      page: 1,
      pageSize: 100,
    }),
    getLibraryOverview({
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
    }),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {profileResult.data.role !== "admin" ? (
          <div className="flex flex-wrap gap-4">
            {profileResult.data.role !== "teacher" ? (
              <BackTextLink href="/courses">
                {profileResult.data.role === "moderator" ? "Quay về Quản lý học phần" : "Quay về học phần"}
              </BackTextLink>
            ) : null}
            <BackTextLink href="/dashboard">
              {profileResult.data.role === "teacher"
                ? "Quay về Tổng quan giảng viên"
                : profileResult.data.role === "moderator"
                  ? "Quay về Tổng quan giám sát"
                  : "Quay về bảng điều khiển"}
            </BackTextLink>
          </div>
        ) : (
          <div />
        )}
        {profileResult.data.role === "admin" ? <AdminAreaLink /> : null}
      </div>
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-semibold text-slate-900">Quản lý tài liệu</h1>
        <p className="mt-1 text-sm text-slate-600">Tải tài liệu vào vùng lưu trữ riêng tư và gắn với học phần phù hợp.</p>
      </div>

      {!coursesResult.ok ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{coursesResult.error.message}</div>
      ) : coursesResult.data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          Bạn cần tạo và kích hoạt ít nhất một học phần trước khi tải tài liệu lên.
        </div>
      ) : (
        <MaterialUploadClient
          actorRole={profileResult.data.role}
          categories={libraryResult.ok ? libraryResult.data.categories : []}
          courses={coursesResult.data.items}
        />
      )}
    </main>
  );
}
