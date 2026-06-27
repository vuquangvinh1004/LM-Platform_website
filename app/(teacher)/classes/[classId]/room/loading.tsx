export default function TeacherClassroomLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Phòng học trực quan</h1>
      <p className="mt-2 text-sm text-slate-600">Đang tải bố cục phòng học...</p>
      <div className="mt-6 space-y-4">
        <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        </div>
        <div className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      </div>
    </main>
  );
}
