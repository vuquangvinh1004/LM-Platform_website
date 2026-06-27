import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Giai đoạn 0 - Khởi tạo dự án
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
        Learning Management Platform
      </h1>
      <p className="max-w-2xl text-slate-600">
        Nền tảng quản lý học tập nhẹ cho giảng viên, tối ưu cho luồng quản lý học phần, lớp học,
        tài liệu, mô phỏng và kết quả bài kiểm tra external/internal.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" href="/dashboard">
          Bảng điều khiển giảng viên
        </Link>
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" href="/library">
          Thư viện
        </Link>
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" href="/my-classes">
          Khu vực sinh viên
        </Link>
        <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" href="/login">
          Đăng nhập
        </Link>
      </div>
    </main>
  );
}
