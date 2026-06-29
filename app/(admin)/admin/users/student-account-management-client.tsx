"use client";

import Link from "next/link";
import { useState } from "react";

import {
  createManagedStaffAccountAction,
  createManagedStudentAccountAction,
  createManagedStudentAccountsBulkAction,
} from "@/app/(admin)/admin/users/actions";
import { getUserRolePresentation } from "@/lib/presentation/user-role";

type StudentPanel = "manual" | "bulk";

function getStaffCodePrefix(role: "teacher" | "moderator"): string {
  return role === "moderator" ? "MOD" : "LEC";
}

export function StudentAccountManagementClient() {
  const [activePanel, setActivePanel] = useState<StudentPanel>("manual");
  const [staffRole, setStaffRole] = useState<"teacher" | "moderator">("teacher");
  const [staffCodeSuffix, setStaffCodeSuffix] = useState("");
  const staffCodePrefix = getStaffCodePrefix(staffRole);
  const adminRole = getUserRolePresentation("admin");

  return (
    <>
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Tạo tài khoản sinh viên</h2>
            <p className="mt-1 text-sm text-slate-600">
              <span className={adminRole.emphasisClassName}>{adminRole.label}</span> tạo và quản lý toàn bộ tài khoản sinh viên; sinh viên không còn tự đăng ký trên trang login.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={activePanel === "manual" ? "rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" : "rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"}
              onClick={() => setActivePanel("manual")}
              type="button"
            >
              Tạo tài khoản thủ công
            </button>
            <button
              className={activePanel === "bulk" ? "rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" : "rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"}
              onClick={() => setActivePanel("bulk")}
              type="button"
            >
              Tạo tài khoản hàng loạt
            </button>
            <Link
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              href="/admin/users/students"
            >
              Quản lý tài khoản sinh viên
            </Link>
          </div>
        </div>

        {activePanel === "manual" ? (
          <form action={createManagedStudentAccountAction} className="mt-5 grid gap-3 md:grid-cols-3">
            <label className="text-sm text-slate-700">
              Mã sinh viên
              <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="studentCode" required type="text" />
            </label>
            <label className="text-sm text-slate-700">
              Họ và tên
              <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="fullName" required type="text" />
            </label>
            <label className="text-sm text-slate-700">
              Mật khẩu khởi tạo
              <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="password" required type="text" />
            </label>
            <div className="md:col-span-3">
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
                Tạo tài khoản
              </button>
            </div>
          </form>
        ) : null}

        {activePanel === "bulk" ? (
          <form action={createManagedStudentAccountsBulkAction} className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Import file CSV
                <input accept=".csv,text/csv" className="sr-only" name="csvFile" required type="file" />
              </label>
              <a
                className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                href="/api/admin/student-accounts/template"
              >
                Xuất file CSV mẫu
              </a>
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
                Tạo tài khoản
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Header cố định của file CSV: Mã sinh viên, Họ và tên, Mật khẩu khởi tạo.
            </p>
          </form>
        ) : null}
      </section>

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
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              name="role"
              onChange={(event) => setStaffRole(event.target.value === "moderator" ? "moderator" : "teacher")}
              value={staffRole}
            >
              <option value="teacher">{getUserRolePresentation("teacher").optionLabel}</option>
              <option value="moderator">{getUserRolePresentation("moderator").optionLabel}</option>
            </select>
          </label>
          <label className="text-sm text-slate-700 md:col-span-2">
            Mã nhân sự
            <div className="mt-1 flex overflow-hidden rounded-md border border-slate-300">
              <span className="inline-flex items-center border-r border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-700">
                {staffCodePrefix}
              </span>
              <input
                className="w-full px-3 py-2 text-sm outline-none"
                onChange={(event) => setStaffCodeSuffix(event.target.value.toUpperCase())}
                placeholder={staffRole === "teacher" ? "Ví dụ: 123 để tạo mã LEC123" : "Ví dụ: ABC để tạo mã MODABC"}
                required
                type="text"
                value={staffCodeSuffix}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Mã hoàn chỉnh sẽ là <span className="font-medium text-slate-700">{staffRole === "teacher" ? "LEC123" : "MODABC"}</span>.
            </p>
            <input name="roleCode" type="hidden" value={`${staffCodePrefix}${staffCodeSuffix.trim().toUpperCase()}`} />
          </label>
          <div className="md:col-span-2">
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
              Tạo tài khoản
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
