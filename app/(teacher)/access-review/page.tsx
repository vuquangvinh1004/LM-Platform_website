import { redirect } from "next/navigation";
import Link from "next/link";

import { requireRole } from "@/lib/services/auth-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  reviewEnrollmentBatchAction,
} from "@/app/(teacher)/access-review/actions";

type AccessReviewSearchParams = {
  status?: "success" | "error";
  message?: string;
};

type PendingEnrollmentRequestRow = {
  id: string;
  student_id: string;
  course_id: string;
  class_id: string | null;
  requested_at: string;
  courses: {
    code: string;
    title: string;
  } | null;
  classes: {
    class_code: string;
    title: string;
    teacher_id: string;
    status: "draft" | "active" | "archived";
  } | null;
};

export default async function AccessReviewPage(
  { searchParams }: { searchParams: Promise<AccessReviewSearchParams> },
) {
  const profileResult = await requireRole(["teacher"]);

  if (!profileResult.ok) {
    redirect("/admin");
  }

  const params = await searchParams;
  const supabase = await createServerSupabaseClient();

  const { data: pendingRequests } = await supabase
    .from("enrollment_requests")
    .select("id,student_id,course_id,class_id,requested_at,courses(code,title),classes!inner(class_code,title,teacher_id,status)")
    .eq("status", "pending")
    .eq("classes.teacher_id", profileResult.data.id)
    .in("classes.status", ["draft", "active"])
    .order("requested_at", { ascending: true })
    .limit(100)
    .returns<PendingEnrollmentRequestRow[]>();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Duyệt yêu cầu tham gia lớp</h1>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Vai trò hiện tại: <span className="font-semibold">{profileResult.data.role}</span>
      </p>

      {params.message ? (
        <p className={params.status === "error" ? "mt-4 text-sm text-red-600" : "mt-4 text-sm text-emerald-700"}>
          {params.message}
        </p>
      ) : null}

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Yêu cầu sinh viên đang chờ duyệt</h2>
        <p className="mt-2 text-sm text-slate-600">
          Theo thiết kế đã chốt, chỉ giảng viên phụ trách lớp mới được duyệt hoặc từ chối yêu cầu tham gia lớp học.
        </p>
        <p className="mt-2 text-sm text-sky-700">
          Nếu bạn cần xem chi tiết theo từng lớp và duyệt ngay trên từng thẻ lớp, hãy vào trang{" "}
          <Link className="font-medium underline underline-offset-2" href="/classes">
            Quản lý lớp
          </Link>.
        </p>
        <form action={reviewEnrollmentBatchAction} className="mt-3 space-y-3">
          <div className="grid gap-2">
            {(pendingRequests ?? []).length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                Không có yêu cầu tham gia lớp nào đang chờ duyệt trong phạm vi lớp của bạn.
              </p>
            ) : (
              (pendingRequests ?? []).map((request) => (
                <label className="flex items-start gap-2 text-sm text-slate-700" key={request.id}>
                  <input name="requestId" type="checkbox" value={request.id} />
                  <span>
                    {request.courses?.code} - {request.courses?.title}
                    {" | "}
                    {request.classes?.class_code} - {request.classes?.title}
                    {" | Sinh viên: "}
                    {request.student_id}
                  </span>
                </label>
              ))
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              Quyết định
              <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="decision" defaultValue="approved">
                <option value="approved">Duyệt</option>
                <option value="rejected">Từ chối</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Ghi chú
              <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="note" type="text" />
            </label>
          </div>

          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
            Xử lý yêu cầu đã chọn
          </button>
        </form>
      </section>
    </main>
  );
}
