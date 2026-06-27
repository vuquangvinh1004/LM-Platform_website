import { redirect } from "next/navigation";
import Link from "next/link";

import { AdminAreaLink } from "@/components/ui/admin-area-link";
import { requireRole } from "@/lib/services/auth-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  approveStudentAccessFromReviewAction,
  grantScopeAction,
  renewStudentAccessFromReviewAction,
  reviewEnrollmentBatchAction,
  revokeScopeAction,
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

type PendingStudentRow = {
  id: string;
  full_name: string;
  email: string;
  access_status: string;
  created_at: string;
};

type ScopeRow = {
  id: string;
  actor_id: string;
  scope_type: "system" | "course" | "class";
  scope_id: string | null;
  status: "active" | "revoked";
  permissions: {
    manage_course?: boolean;
    manage_class?: boolean;
    manage_members?: boolean;
  } | null;
};

type ActorOption = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

type CourseOption = {
  id: string;
  code: string;
  title: string;
};

type ClassOption = {
  id: string;
  class_code: string;
  title: string;
};

export default async function AccessReviewPage(
  { searchParams }: { searchParams: Promise<AccessReviewSearchParams> },
) {
  const profileResult = await requireRole(["teacher", "admin", "moderator"]);

  if (!profileResult.ok) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const supabase = await createServerSupabaseClient();

  const [{ data: pendingRequests }, { data: pendingStudents }] = await Promise.all([
    profileResult.data.role === "teacher"
      ? supabase
          .from("enrollment_requests")
          .select("id,student_id,course_id,class_id,requested_at,courses(code,title),classes!inner(class_code,title,teacher_id,status)")
          .eq("status", "pending")
          .eq("classes.teacher_id", profileResult.data.id)
          .in("classes.status", ["draft", "active"])
          .order("requested_at", { ascending: true })
          .limit(100)
          .returns<PendingEnrollmentRequestRow[]>()
      : Promise.resolve({ data: [] as PendingEnrollmentRequestRow[] }),
    profileResult.data.role === "admin"
      ? supabase
          .from("profiles")
          .select("id,full_name,email,access_status,created_at")
          .eq("role", "student")
          .eq("access_status", "pending_approval")
          .order("created_at", { ascending: true })
          .limit(100)
          .returns<PendingStudentRow[]>()
      : Promise.resolve({ data: [] as PendingStudentRow[] }),
  ]);

  const scopeData = profileResult.data.role === "admin"
    ? await Promise.all([
        supabase
          .from("permission_scopes")
          .select("id,actor_id,scope_type,scope_id,status,permissions")
          .order("created_at", { ascending: false })
          .limit(100)
          .returns<ScopeRow[]>(),
        supabase
          .from("profiles")
          .select("id,full_name,email,role")
          .in("role", ["moderator", "teacher"])
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .returns<ActorOption[]>(),
        supabase
          .from("courses")
          .select("id,code,title")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .returns<CourseOption[]>(),
        supabase
          .from("classes")
          .select("id,class_code,title")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .returns<ClassOption[]>(),
      ])
    : null;

  const activeScopes = scopeData?.[0].data ?? [];
  const actorOptions = scopeData?.[1].data ?? [];
  const courseOptions = scopeData?.[2].data ?? [];
  const classOptions = scopeData?.[3].data ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          {profileResult.data.role === "teacher" ? "Duyệt yêu cầu tham gia lớp" : "Duyệt truy cập và phân quyền"}
        </h1>
        {profileResult.data.role === "admin" ? <AdminAreaLink /> : null}
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Vai trò hiện tại: <span className="font-semibold">{profileResult.data.role}</span>
      </p>

      {params.message ? (
        <p className={params.status === "error" ? "mt-4 text-sm text-red-600" : "mt-4 text-sm text-emerald-700"}>
          {params.message}
        </p>
      ) : null}

      {profileResult.data.role === "teacher" ? (
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
      ) : null}

      {profileResult.data.role !== "teacher" ? (
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Duyệt sinh viên chờ truy cập</h2>
        {(pendingStudents ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Không có sinh viên pending_approval.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {(pendingStudents ?? []).map((student) => (
              <div className="rounded-md border border-slate-200 p-3" key={student.id}>
                <p className="text-sm font-medium text-slate-800">{student.full_name} ({student.email})</p>
                <p className="text-xs text-slate-500">Student ID: {student.id}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <form action={approveStudentAccessFromReviewAction} className="space-y-2">
                    <input name="studentId" type="hidden" value={student.id} />
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="expiresAt" type="datetime-local" />
                    <button className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" type="submit">Duyệt truy cập</button>
                  </form>
                  <form action={renewStudentAccessFromReviewAction} className="space-y-2">
                    <input name="studentId" type="hidden" value={student.id} />
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="expiresAt" type="datetime-local" required />
                    <button className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700" type="submit">Gia hạn truy cập</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        {profileResult.data.role !== "admin" ? (
          <p className="mt-2 text-xs text-slate-500">
            Moderator có thể duyệt enrollment hàng loạt và approve truy cập thông qua student ID từ enrollment request.
          </p>
        ) : null}
      </section>
      ) : null}

      {profileResult.data.role === "admin" ? (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Cấp/thu hồi scope cho moderator và teacher</h2>

          <form action={grantScopeAction} className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              Người được cấp
              <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="targetActorId" required>
                <option value="">Chọn user</option>
                {actorOptions.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.full_name} ({actor.role})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-700">
              Loại phạm vi
              <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="scopeType" defaultValue="course" required>
                <option value="system">System</option>
                <option value="course">Course</option>
                <option value="class">Class</option>
              </select>
            </label>

            <label className="text-sm text-slate-700">
              Scope ID
              <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="scopeId" placeholder="UUID for course/class (bo trong neu system)" />
            </label>

            <div className="flex items-center gap-3 pt-6 text-sm text-slate-700">
              <label><input name="manageCourse" type="checkbox" defaultChecked /> manage_course</label>
              <label><input name="manageClass" type="checkbox" defaultChecked /> manage_class</label>
              <label><input name="manageMembers" type="checkbox" /> manage_members</label>
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-2 text-xs text-slate-500">
              <span>Course options:</span>
              {courseOptions.slice(0, 5).map((course) => (
                <span key={course.id}>{course.code} ({course.id})</span>
              ))}
              <span>Class options:</span>
              {classOptions.slice(0, 5).map((courseClass) => (
                <span key={courseClass.id}>{courseClass.class_code} ({courseClass.id})</span>
              ))}
            </div>

            <button className="md:col-span-2 w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="submit">
              Cấp scope
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {activeScopes.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có scope active.</p>
            ) : (
              activeScopes.map((scope) => (
                <div className="flex items-center justify-between rounded-md border border-slate-200 p-2 text-sm" key={scope.id}>
                  <span>
                    actor={scope.actor_id} | {scope.scope_type} | scope={scope.scope_id ?? "system"} | status={scope.status}
                  </span>
                  {scope.status === "active" ? (
                    <form action={revokeScopeAction}>
                      <input name="scopeId" type="hidden" value={scope.id} />
                      <button className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700" type="submit">Thu hồi</button>
                    </form>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
