export default function TeacherClassesLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Quản lý lớp</h1>
      <p className="mt-2 text-sm text-slate-600">Đang tải danh sách lớp học...</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      </div>
    </main>
  );
}
