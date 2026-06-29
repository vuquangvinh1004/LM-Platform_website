import { StudentAccountManagementClient } from "@/app/(admin)/admin/users/student-account-management-client";
import {
  updateManagedUserAction,
  updateTeacherPersonalLibraryQuotaAction,
} from "@/app/(admin)/admin/users/actions";
import { AdminAreaLink } from "@/components/ui/admin-area-link";
import { getUserRolePresentation } from "@/lib/presentation/user-role";
import { requireRole } from "@/lib/services/auth-service";
import { listManagedStudentAccounts, listManagedUsers } from "@/lib/services/user-management-service";

function formatMegabytes(bytes: number | null): string {
  if (bytes === null) {
    return "-";
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildRoleCode(input: {
  role: "admin" | "moderator" | "teacher" | "student";
  email: string;
  roleCode: string | null;
}): string {
  if (input.role === "admin") {
    return "ADMIN";
  }

  if (input.roleCode?.trim()) {
    return input.roleCode.trim().toUpperCase();
  }

  const emailPrefix = input.email.split("@")[0]?.trim();

  if (emailPrefix) {
    return emailPrefix.toUpperCase();
  }

  if (input.role === "moderator") {
    return "MOD";
  }

  if (input.role === "teacher") {
    return "TEACHER";
  }

  return input.role.toUpperCase();
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
        <h1 className="text-2xl font-semibold text-slate-900">Quản lý người dùng</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const params = await searchParams;
  const [usersResult, studentsResult] = await Promise.all([
    listManagedUsers(),
    listManagedStudentAccounts(),
  ]);

  if (!usersResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Quản lý người dùng</h1>
        <p className="mt-2 text-sm text-red-600">{usersResult.error.message}</p>
      </main>
    );
  }

  if (!studentsResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Quản lý người dùng</h1>
        <p className="mt-2 text-sm text-red-600">{studentsResult.error.message}</p>
      </main>
    );
  }

  const staffUsers = usersResult.data.filter((user) => user.role !== "student");
  const moderatorRole = getUserRolePresentation("moderator");
  const teacherRole = getUserRolePresentation("teacher");
  const studentRole = getUserRolePresentation("student");

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">Quản lý người dùng</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Tạo tài khoản <span className={moderatorRole.emphasisClassName}>{moderatorRole.label}</span>,{" "}
            <span className={teacherRole.emphasisClassName}>{teacherRole.label}</span>, <span className={studentRole.emphasisClassName}>{studentRole.label}</span>; cập nhật vòng đời tài khoản và điều chỉnh quota
            Thư viện cá nhân của <span className={teacherRole.emphasisClassName}>{teacherRole.label}</span>.
          </p>
        </div>
        <AdminAreaLink />
      </div>

      {params.message ? (
        <p className={params.status === "error" ? "mt-4 text-sm text-red-600" : "mt-4 text-sm text-emerald-700"}>
          {params.message}
        </p>
      ) : null}

      <StudentAccountManagementClient />

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Danh sách tài khoản nhân sự</h2>
        <div className="mt-4 space-y-4">
          {staffUsers.map((user) => {
            const rolePresentation = getUserRolePresentation(user.role);

            return (
              <article className="rounded-lg border border-slate-200 p-4" key={user.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{user.fullName}</h3>
                    <p className="text-sm text-slate-600">{user.email}</p>
                    <p className={`mt-1 text-xs font-semibold uppercase tracking-wide ${rolePresentation.badgeClassName}`}>
                      {rolePresentation.label}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Status: {user.status} | Tạo lúc: {new Date(user.createdAt).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Role code: {buildRoleCode({
                      role: user.role,
                      email: user.email,
                      roleCode: user.roleCode,
                    })}
                  </div>
                </div>

                <form action={updateManagedUserAction} className="mt-4 grid gap-3 md:grid-cols-3">
                  <input name="userId" type="hidden" value={user.id} />
                  <label className="text-sm text-slate-700">
                    Vai trò
                    <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={user.role} name="role">
                      <option value="admin">{getUserRolePresentation("admin").optionLabel}</option>
                      <option value="moderator">{getUserRolePresentation("moderator").optionLabel}</option>
                      <option value="teacher">{getUserRolePresentation("teacher").optionLabel}</option>
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
            );
          })}
        </div>
      </section>
    </main>
  );
}
