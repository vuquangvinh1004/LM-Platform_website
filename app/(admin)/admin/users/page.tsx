import Link from "next/link";

import {
  createManagedStaffAccountAction,
  updateManagedUserAction,
  updateTeacherPersonalLibraryQuotaAction,
} from "@/app/(admin)/admin/users/actions";
import { requireRole } from "@/lib/services/auth-service";
import { listManagedUsers } from "@/lib/services/user-management-service";

function formatMegabytes(bytes: number | null): string {
  if (bytes === null) {
    return "-";
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type UserManagementSearchParams = {
  status?: "success" | "error";
  message?: string;
};

export default async function AdminUsersPage(
  { searchParams }: { searchParams: Promise<UserManagementSearchParams> },
) {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">User management</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const params = await searchParams;
  const usersResult = await listManagedUsers();

  if (!usersResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">User management</h1>
        <p className="mt-2 text-sm text-red-600">{usersResult.error.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">User management</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Tạo tài khoản Mod, tạo tài khoản Giảng viên, cập nhật vai trò/trạng thái và điều chỉnh quota Thư viện cá nhân.
          </p>
        </div>
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" href="/admin">
          Quay về khu vực admin
        </Link>
      </div>

      {params.message ? (
        <p className={params.status === "error" ? "mt-4 text-sm text-red-600" : "mt-4 text-sm text-emerald-700"}>
          {params.message}
        </p>
      ) : null}

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Tạo tài khoản nhân sự</h2>
        <form action={createManagedStaffAccountAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            Họ tên
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="fullName" required type="text" />
          </label>
          <label className="text-sm text-slate-700">
            Email
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="email" required type="email" />
          </label>
          <label className="text-sm text-slate-700">
            Mật khẩu khởi tạo
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="password" required type="text" />
          </label>
          <label className="text-sm text-slate-700">
            Vai trò
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="teacher" name="role">
              <option value="teacher">Giảng viên</option>
              <option value="moderator">Mod</option>
            </select>
          </label>
          <label className="text-sm text-slate-700 md:col-span-2">
            Mã giảng viên
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="teacherCode" type="text" />
          </label>
          <div className="md:col-span-2">
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
              Tạo tài khoản
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Danh sách tài khoản</h2>
        <div className="mt-4 space-y-4">
          {usersResult.data.map((user) => (
            <article className="rounded-lg border border-slate-200 p-4" key={user.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{user.fullName}</h3>
                  <p className="text-sm text-slate-600">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Role: {user.role} | Status: {user.status} | Tạo lúc: {new Date(user.createdAt).toLocaleString("vi-VN")}
                  </p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Teacher code: {user.teacherCode ?? "-"} | Student code: {user.studentCode ?? "-"}
                </div>
              </div>

              <form action={updateManagedUserAction} className="mt-4 grid gap-3 md:grid-cols-3">
                <input name="userId" type="hidden" value={user.id} />
                <label className="text-sm text-slate-700">
                  Vai trò
                  <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={user.role} name="role">
                    <option value="admin">Admin</option>
                    <option value="moderator">Mod</option>
                    <option value="teacher">Giảng viên</option>
                    <option value="student">Sinh viên</option>
                  </select>
                </label>
                <label className="text-sm text-slate-700">
                  Trạng thái
                  <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={user.status} name="status">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
                    Lưu vai trò/trạng thái
                  </button>
                </div>
              </form>

              {user.role === "teacher" ? (
                <form action={updateTeacherPersonalLibraryQuotaAction} className="mt-4 grid gap-3 md:grid-cols-3">
                  <input name="teacherId" type="hidden" value={user.id} />
                  <div className="rounded-md bg-teal-50 px-3 py-3 text-sm text-teal-900">
                    Đã dùng: {formatMegabytes(user.personalLibraryUsedBytes)} | Quota: {formatMegabytes(user.personalLibraryQuotaBytes)}
                  </div>
                  <label className="text-sm text-slate-700">
                    Quota mới (MB)
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      defaultValue={user.personalLibraryQuotaBytes ? Math.round(user.personalLibraryQuotaBytes / (1024 * 1024)) : 50}
                      min="1"
                      name="quotaMb"
                      type="number"
                    />
                  </label>
                  <div className="flex items-end">
                    <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
                      Cập nhật quota
                    </button>
                  </div>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
