"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { initialAuthActionState } from "@/app/(auth)/login/auth-action-state";
import { signInWithPasswordAction } from "@/app/(auth)/login/actions";
import type { EnrollmentOption } from "@/lib/types/enrollment-option";

export default function LoginPage() {
  const router = useRouter();
  const [openEnrollmentOptions, setOpenEnrollmentOptions] = useState<EnrollmentOption[]>([]);
  const [signInState, signInAction, isSignInPending] = useActionState(
    signInWithPasswordAction,
    initialAuthActionState,
  );

  useEffect(() => {
    if (signInState.status === "success" && signInState.redirectTo) {
      router.replace(signInState.redirectTo);
    }
  }, [router, signInState.redirectTo, signInState.status]);

  useEffect(() => {
    let isMounted = true;

    async function loadOpenEnrollmentOptions() {
      const response = await fetch("/api/enrollment/options", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json() as { options?: EnrollmentOption[] };

      if (isMounted && Array.isArray(data.options)) {
        setOpenEnrollmentOptions(data.options);
      }
    }

    void loadOpenEnrollmentOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl gap-8 px-6 py-12 lg:grid-cols-2 lg:items-start">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Đăng nhập</h1>

        <form action={signInAction} className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-slate-700" htmlFor="sign-in-email">
            Tên đăng nhập
          </label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            id="sign-in-email"
            name="email"
            type="text"
            required
          />

          <label className="block text-sm font-medium text-slate-700" htmlFor="sign-in-password">
            Mật khẩu
          </label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            id="sign-in-password"
            name="password"
            type="password"
            required
          />

          {signInState.message ? (
            <p className={signInState.status === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>
              {signInState.message}
            </p>
          ) : null}

          <button
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            type="submit"
            disabled={isSignInPending}
          >
            {isSignInPending ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-sky-200 bg-sky-50 p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Các lớp đang mở đăng ký</h2>
        <p className="mt-2 text-sm text-slate-600">
          Đây là danh sách lớp đang mở đăng ký ở thời điểm hiện tại. Bạn có thể xem trước trước khi tạo tài khoản sinh viên.
        </p>

        <div className="mt-4 rounded-md border border-sky-200 bg-white p-3">
          {openEnrollmentOptions.length === 0 ? (
            <p className="text-xs text-slate-500">Chưa có lớp active để đăng ký.</p>
          ) : (
            <ul className="space-y-1 text-xs text-slate-700" data-testid="open-enrollment-options">
              {openEnrollmentOptions.map((option) => (
                <li key={`${option.courseId}-${option.classId}`}>
                  {option.classCode} - {option.classTitle}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

    </main>
  );
}
