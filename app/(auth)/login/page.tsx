"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { initialAuthActionState } from "@/app/(auth)/login/auth-action-state";
import {
  signInWithPasswordAction,
  signUpWithPasswordAction,
} from "@/app/(auth)/login/actions";
import type { EnrollmentOption } from "@/lib/types/enrollment-option";

export default function LoginPage() {
  const router = useRouter();
  const [openEnrollmentOptions, setOpenEnrollmentOptions] = useState<EnrollmentOption[]>([]);
  const [signInState, signInAction, isSignInPending] = useActionState(
    signInWithPasswordAction,
    initialAuthActionState,
  );
  const [signUpState, signUpAction, isSignUpPending] = useActionState(
    signUpWithPasswordAction,
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
    <main className="mx-auto grid min-h-screen max-w-7xl gap-8 px-6 py-12 lg:grid-cols-3 lg:items-start">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Đăng nhập</h1>
        <p className="mt-2 text-sm text-slate-600">Đăng nhập bằng email hoặc tên đăng nhập và mật khẩu Supabase Auth.</p>
        <p className="mt-2 text-xs text-slate-500">
          Tài khoản admin local cho dev/test: tên đăng nhập <strong>Admin</strong>, mật khẩu mặc định <strong>Admin</strong>.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Tài khoản test: <strong>Mod123</strong>, <strong>Lec123</strong>, <strong>Stu123</strong>, <strong>Stu321</strong> dùng mật khẩu trùng tên đăng nhập.
        </p>

        <form action={signInAction} className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-slate-700" htmlFor="sign-in-email">
            Email hoặc tên đăng nhập
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
          Đây là danh sách học phần/lớp đang mở đăng ký ở thời điểm hiện tại. Bạn có thể xem trước trước khi tạo tài khoản sinh viên.
        </p>

        <div className="mt-4 rounded-md border border-sky-200 bg-white p-3">
          {openEnrollmentOptions.length === 0 ? (
            <p className="text-xs text-slate-500">Chưa có lớp active để đăng ký.</p>
          ) : (
            <ul className="space-y-1 text-xs text-slate-700" data-testid="open-enrollment-options">
              {openEnrollmentOptions.map((option) => (
                <li key={`${option.courseId}-${option.classId}`}>
                  {option.courseCode} - {option.courseTitle} | {option.classCode} - {option.classTitle}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Đăng ký nhanh</h2>
        <p className="mt-2 text-sm text-slate-600">
          Đăng ký tài khoản sinh viên. Tài khoản Mod và Giảng viên được Admin tạo trong module quản trị người dùng.
        </p>

        <form action={signUpAction} className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-slate-700" htmlFor="sign-up-full-name">
            Họ tên
          </label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            id="sign-up-full-name"
            name="fullName"
            type="text"
            required
          />

          <label className="block text-sm font-medium text-slate-700" htmlFor="sign-up-email">
            Email
          </label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            id="sign-up-email"
            name="email"
            type="email"
            required
          />

          <label className="block text-sm font-medium text-slate-700" htmlFor="sign-up-student-code">
            Mã số sinh viên
          </label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            id="sign-up-student-code"
            name="studentCode"
            placeholder="Bắt buộc"
            type="text"
            required
          />

          <label className="block text-sm font-medium text-slate-700" htmlFor="sign-up-password">
            Mật khẩu
          </label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            id="sign-up-password"
            name="password"
            type="password"
            required
          />

          <input name="role" type="hidden" value="student" />

          {signUpState.message ? (
            <p className={signUpState.status === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>
              {signUpState.message}
            </p>
          ) : null}

          <button
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
            type="submit"
            disabled={isSignUpPending}
          >
            {isSignUpPending ? "Đang đăng ký..." : "Đăng ký"}
          </button>
        </form>
      </section>
    </main>
  );
}
