"use client";

type StudentMyClassesErrorProps = {
  error: Error;
  reset: () => void;
};

export default function StudentMyClassesError({ error, reset }: StudentMyClassesErrorProps) {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Lớp của tôi</h1>
      <p className="mt-2 text-sm text-red-600">{error.message || "Đã xảy ra lỗi khi tải danh sách lớp."}</p>
      <button
        className="mt-4 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
        onClick={reset}
        type="button"
      >
        Thử lại
      </button>
    </main>
  );
}
