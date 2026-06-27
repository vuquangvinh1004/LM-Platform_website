import Link from "next/link";

import { LibraryCategoryManagerClient } from "@/app/(teacher)/library/library-category-manager-client";
import { LibraryChangeRequestsClient } from "@/app/(teacher)/library/library-change-requests-client";
import { LibraryResourceBrowserClient } from "@/app/(teacher)/library/library-resource-browser-client";
import { SimulationUploadClient } from "@/app/(teacher)/library/simulation-upload-client";
import { MaterialUploadClient } from "@/app/(teacher)/materials/material-upload-client";
import { AdminAreaLink } from "@/components/ui/admin-area-link";
import { BackTextLink } from "@/components/ui/back-text-link";
import { requireRole } from "@/lib/services/auth-service";
import { listCoursesForUser } from "@/lib/services/course-service";
import { getLibraryOverview } from "@/lib/services/library-service";

export default async function LibraryPage() {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Thư viện</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
        <BackTextLink className="mt-4" href="/login">Quay lại đăng nhập</BackTextLink>
      </main>
    );
  }

  const [libraryResult, coursesResult] = await Promise.all([
    getLibraryOverview({
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
    }),
    listCoursesForUser({
      userId: profileResult.data.id,
      role: profileResult.data.role,
      status: "active",
      page: 1,
      pageSize: 100,
    }),
  ]);

  if (!libraryResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Thư viện</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {libraryResult.error.message}
        </div>
      </main>
    );
  }

  const library = libraryResult.data;
  const courses = coursesResult.ok ? coursesResult.data.items : [];
  const personalLibrary = library.personalLibrary;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {profileResult.data.role !== "admin" ? (
          <BackTextLink href="/dashboard">
            {profileResult.data.role === "teacher"
              ? "Quay về Tổng quan giảng viên"
              : profileResult.data.role === "moderator"
                ? "Quay về Tổng quan giám sát"
                : "Quay về bảng điều khiển"}
          </BackTextLink>
        ) : <div />}
        {profileResult.data.role === "admin" ? <AdminAreaLink /> : null}
      </div>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">Tài nguyên học tập</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Thư viện</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Quản lý tập trung tài liệu và mô phỏng được tải lên bởi giảng viên, Mod hoặc Admin. Tài nguyên được liên kết với
            lớp học phần bằng thao tác thêm/bớt trong từng lớp, còn thao tác xóa/ẩn cần xác nhận để giữ nhật ký thao tác.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profileResult.data.role !== "teacher" ? (
            <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" href="/courses">
              Chọn học phần
            </Link>
          ) : null}
        </div>
      </div>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Tài liệu</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{library.materials.length}</p>
          <p className="mt-1 text-xs text-slate-500">Không hiển thị tài liệu đã lưu trữ.</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Mô phỏng</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{library.simulations.length}</p>
          <p className="mt-1 text-xs text-slate-500">Đã gắn vào học phần theo quyền hiện tại.</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Mô phỏng HTML</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{library.simulationUploads.length}</p>
          <p className="mt-1 text-xs text-slate-500">Tệp HTML độc lập có thể mở bằng tab mới.</p>
        </article>
      </section>

      {profileResult.data.role === "teacher" && personalLibrary ? (
        <section className="mt-6 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <h2 className="text-lg font-semibold text-teal-950">Thư viện cá nhân</h2>
          <p className="mt-2 text-sm text-teal-900">
            Dung lượng đang dùng: {(personalLibrary.usedBytes / (1024 * 1024)).toFixed(2)} MB / {(personalLibrary.quotaBytes / (1024 * 1024)).toFixed(2)} MB.
            Còn lại {(personalLibrary.remainingBytes / (1024 * 1024)).toFixed(2)} MB.
          </p>
        </section>
      ) : null}

      <LibraryResourceBrowserClient
        actorId={profileResult.data.id}
        actorRole={profileResult.data.role}
        categories={library.categories}
        courses={courses}
        materials={library.materials}
        simulationUploads={library.simulationUploads}
        simulations={library.simulations}
      />

      {profileResult.data.role === "admin" ? <LibraryCategoryManagerClient categories={library.categories} /> : null}

      <div className="mt-6" id="upload-material">
        <MaterialUploadClient actorRole={profileResult.data.role} categories={library.categories} courses={courses} />
      </div>

      <div id="upload-simulation">
        <SimulationUploadClient
          actorRole={profileResult.data.role}
          categories={library.categories}
          courses={courses}
          uploads={library.simulationUploads}
        />
      </div>

      <LibraryChangeRequestsClient
        actorRole={profileResult.data.role}
        materials={library.materials}
        requests={library.changeRequests}
        simulations={library.simulations}
      />

      {!coursesResult.ok ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Không thể tải danh sách học phần để gắn mô phỏng: {coursesResult.error.message}
        </div>
      ) : null}

      <section className="mt-6">
        <article className="rounded-lg border border-teal-200 bg-teal-50 p-4">
          <h2 className="text-lg font-semibold text-teal-950">Quy trình quyền và xác nhận</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-teal-900">
            <li>{library.pendingWorkflow.uploadPolicy}</li>
            <li>{library.pendingWorkflow.linkPolicy}</li>
            <li>{library.pendingWorkflow.deletePolicy}</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
