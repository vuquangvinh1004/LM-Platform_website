"use client";

import { useActionState } from "react";

import { updateStudentProfileAction } from "@/app/(student)/my-profile/actions";
import { initialStudentProfileActionState } from "@/app/(student)/my-profile/profile-action-state";

type StudentProfileFormClientProps = {
  email: string;
  fullName: string;
  studentCode: string | null;
  avatarUrl: string | null;
};

export function StudentProfileFormClient({ email, fullName, studentCode, avatarUrl }: StudentProfileFormClientProps) {
  const [state, action, isPending] = useActionState(updateStudentProfileAction, initialStudentProfileActionState);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">Thông tin cá nhân</h2>
      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xl font-semibold text-slate-500">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="Avatar" className="h-full w-full object-cover" src={avatarUrl} />
          ) : (
            fullName.slice(0, 1).toUpperCase()
          )}
        </div>
        <div>
          <p className="font-semibold text-slate-900">{fullName}</p>
          <p className="text-sm text-slate-600">MSSV: {studentCode ?? "Chưa cập nhật"}</p>
        </div>
      </div>

      <form action={action} className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-700 md:col-span-2">
          Avatar URL
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={avatarUrl ?? ""} name="avatarUrl" placeholder="https://..." />
        </label>
        <label className="text-sm text-slate-700">
          Email
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={email} name="email" type="email" required />
        </label>
        <label className="text-sm text-slate-700">
          Mật khẩu mới
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="newPassword" type="password" placeholder="Để trống nếu không đổi" />
        </label>
        <div className="md:col-span-2">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={isPending} type="submit">
            {isPending ? "Đang lưu..." : "Lưu thông tin"}
          </button>
        </div>
      </form>
      {state.message ? (
        <p className={state.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}>{state.message}</p>
      ) : null}
    </section>
  );
}
