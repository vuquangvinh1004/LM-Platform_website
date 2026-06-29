"use client";

import {
  deleteManagedStudentAccountAction,
  resetManagedStudentPasswordAction,
  updateManagedStudentProfileAction,
} from "@/app/(admin)/admin/users/actions";
import type { ManagedStudentAccountSummary } from "@/lib/types/user-management";

type StudentAccountTableClientProps = {
  redirectTo: string;
  students: ManagedStudentAccountSummary[];
};

export function StudentAccountTableClient({ redirectTo, students }: StudentAccountTableClientProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-slate-700">
            <th className="px-3 py-2 font-medium">Mã sinh viên</th>
            <th className="px-3 py-2 font-medium">Họ và tên</th>
            <th className="px-3 py-2 font-medium">Mật khẩu khởi tạo</th>
            <th className="px-3 py-2 font-medium">Thời gian khởi tạo</th>
            <th className="px-3 py-2 font-medium">Quản lý</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {students.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-slate-500" colSpan={5}>Chưa có tài khoản sinh viên nào.</td>
            </tr>
          ) : (
            students.map((student) => (
              <tr key={student.id} className="align-top">
                <td className="px-3 py-3 text-slate-700">{student.studentCode ?? "-"}</td>
                <td className="px-3 py-3 text-slate-900">
                  <div>{student.fullName}</div>
                  <div className="mt-1 text-xs text-slate-500">{student.email}</div>
                </td>
                <td className="px-3 py-3 text-slate-700">{student.currentPassword ?? "-"}</td>
                <td className="px-3 py-3 text-slate-700">{new Date(student.createdAt).toLocaleString("vi-VN")}</td>
                <td className="px-3 py-3">
                  <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer font-medium text-slate-800">Quản lý tài khoản</summary>
                    <div className="mt-3 space-y-4">
                      <form action={resetManagedStudentPasswordAction} className="grid gap-2">
                        <input name="studentId" type="hidden" value={student.id} />
                        <input name="redirectTo" type="hidden" value={redirectTo} />
                        <label className="text-xs text-slate-700">
                          Thay đổi mật khẩu
                          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="newPassword" required type="text" />
                        </label>
                        <button className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" type="submit">
                          Thay đổi mật khẩu
                        </button>
                      </form>

                      <form action={updateManagedStudentProfileAction} className="grid gap-2">
                        <input name="studentId" type="hidden" value={student.id} />
                        <input name="redirectTo" type="hidden" value={redirectTo} />
                        <label className="text-xs text-slate-700">
                          Điều chỉnh thông tin
                          <input
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            defaultValue={student.fullName}
                            name="fullName"
                            required
                            type="text"
                          />
                        </label>
                        <button className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" type="submit">
                          Lưu họ tên
                        </button>
                      </form>

                      <form action={deleteManagedStudentAccountAction}>
                        <input name="studentId" type="hidden" value={student.id} />
                        <input name="redirectTo" type="hidden" value={redirectTo} />
                        <button
                          className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700"
                          onClick={(event) => {
                            if (!window.confirm("Xóa tài khoản sinh viên này sẽ gỡ quyền đăng nhập, nhưng các kết quả đã NỘP KẾT QUẢ vẫn được giữ cứng. Bạn có chắc không?")) {
                              event.preventDefault();
                            }
                          }}
                          type="submit"
                        >
                          Xóa tài khoản
                        </button>
                      </form>
                    </div>
                  </details>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
