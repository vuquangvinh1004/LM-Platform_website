import { signOutAction } from "@/app/(auth)/login/actions";
import { requireRole } from "@/lib/services/auth-service";
import Link from "next/link";

const adminLinks = [
  { href: "/dashboard", label: "Bảng điều khiển", description: "Tổng quan học phần, lớp, sinh viên và hoạt động gần đây." },
  { href: "/courses", label: "Quản lý học phần", description: "Mở, cập nhật, lưu trữ học phần và phân quyền Mod quản lý." },
  { href: "/classes", label: "Quản lý lớp học", description: "Tạo lớp, thêm sinh viên, nhập CSV và vào phòng học." },
  { href: "/library", label: "Thư viện", description: "Quản lý tài liệu, mô phỏng, duyệt ẩn/xóa và tích hợp native." },
  { href: "/access-review", label: "Duyệt truy cập và scope", description: "Duyệt truy cập sinh viên và cấp phạm vi cho Mod/giảng viên; yêu cầu vào lớp do giảng viên xử lý." },
  { href: "/admin/users", label: "User management", description: "Tạo tài khoản Mod/Giảng viên, cập nhật vai trò và quota Thư viện cá nhân." },
] as const;

export default async function AdminPage() {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Khu vực admin</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Khu vực admin</h1>
      <p className="mt-2 text-sm text-slate-600">
        Trung tâm điều hướng quản trị cho học phần, lớp học, tài nguyên, bài kiểm tra và phân quyền.
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
