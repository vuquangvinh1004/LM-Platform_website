import Link from "next/link";

import { signOutAction } from "@/app/(auth)/login/actions";
import { StudentProfileFormClient } from "@/app/(student)/my-profile/profile-form-client";
import { requireRole } from "@/lib/services/auth-service";

export default async function MyProfilePage() {
  const profileResult = await requireRole(["student", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Thông tin của tôi</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Thông tin của tôi</h1>
          <p className="mt-2 text-sm text-slate-600">Cập nhật avatar, email và mật khẩu tài khoản sinh viên.</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" href="/my-classes">
            Các lớp học của tôi
          </Link>
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" href="/my-classes/enrollment">
            Đăng ký lớp học phần
          </Link>
        </nav>
      </div>

      <StudentProfileFormClient
        avatarUrl={profileResult.data.avatar_url}
        email={profileResult.data.email}
        fullName={profileResult.data.full_name}
        studentCode={profileResult.data.student_code}
      />

      <form action={signOutAction} className="mt-6">
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
          Đăng xuất
        </button>
      </form>
    </main>
  );
}
