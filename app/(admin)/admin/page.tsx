import { signOutAction } from "@/app/(auth)/login/actions";
import { requireRole } from "@/lib/services/auth-service";
import Link from "next/link";

const adminLinks = [
  { href: "/courses", label: "Quản lý học phần", description: "Xem các học phần đang hoạt động và gán hoặc bỏ quyền GIÁM SÁT VIÊN quản lý." },
  { href: "/library", label: "Thư viện", description: "Chỉ quản lý Danh mục Thư viện dùng cho tài nguyên được tải lên." },
  { href: "/admin/users", label: "Quản lý người dùng", description: "Tạo tài khoản GIÁM SÁT VIÊN/GIẢNG VIÊN/SINH VIÊN, cập nhật vai trò và quota Thư viện cá nhân." },
] as const;

export default async function AdminPage() {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Khu vực Quản trị</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Khu vực Quản trị</h1>
      <p className="mt-2 text-sm text-slate-600">
        Trung tâm điều hướng quản trị cho học phần, danh mục thư viện và tài khoản người dùng.
      </p>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        {adminLinks.map((item) => (
          <Link
            className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-teal-300 hover:bg-teal-50"
            href={item.href}
            key={item.href}
          >
            <h2 className="font-semibold text-slate-900">{item.label}</h2>
            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
          </Link>
        ))}
      </section>

      <form action={signOutAction} className="mt-6">
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
          Đăng xuất
        </button>
      </form>
    </main>
  );
}
