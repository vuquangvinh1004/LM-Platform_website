import Link from "next/link";

import { StudentAccountTableClient } from "@/app/(admin)/admin/users/student-account-table-client";
import { getUserRolePresentation } from "@/lib/presentation/user-role";
import { requireRole } from "@/lib/services/auth-service";
import { listManagedStudentAccounts } from "@/lib/services/user-management-service";

type StudentManagementSearchParams = {
  status?: "success" | "error";
  message?: string;
};

export default async function AdminStudentAccountsPage(
  { searchParams }: { searchParams: Promise<StudentManagementSearchParams> },
) {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Quản lý tài khoản sinh viên</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const params = await searchParams;
  const studentsResult = await listManagedStudentAccounts();

  if (!studentsResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Quản lý tài khoản sinh viên</h1>
        <p className="mt-2 text-sm text-red-600">{studentsResult.error.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className={`text-sm font-medium uppercase tracking-wide ${getUserRolePresentation("admin").badgeClassName}`}>
            {getUserRolePresentation("admin").label}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Quản lý tài khoản sinh viên</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Trang quản lý tập trung cho toàn bộ tài khoản sinh viên do Admin khởi tạo.
          </p>
        </div>
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" href="/admin/users">
          Quay về User management
        </Link>
      </div>

      {params.message ? (
        <p className={params.status === "error" ? "mt-4 text-sm text-red-600" : "mt-4 text-sm text-emerald-700"}>
          {params.message}
        </p>
      ) : null}

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Danh sách tài khoản sinh viên</h2>
        <p className="mt-1 text-sm text-slate-600">
          Tổng {studentsResult.data.length} tài khoản sinh viên đang được quản lý trong hệ thống.
        </p>
        <div className="mt-5">
          <StudentAccountTableClient redirectTo="/admin/users/students" students={studentsResult.data} />
        </div>
      </section>
    </main>
  );
}
