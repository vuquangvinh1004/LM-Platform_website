"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  addStudentToClassAction,
  createClassAction,
  createClassLifecycleRequestAction,
  createTemplateClassAction,
  deleteClassTemplateAction,
  importStudentsCsvToClassAction,
  reviewClassChangeRequestAction,
  reviewClassEnrollmentRequestAction,
} from "@/app/(teacher)/classes/actions";
import { initialClassActionState } from "@/app/(teacher)/classes/class-action-state";
import type { UserRole } from "@/lib/types/auth";
import type { ClassChangeRequest, ClassMemberSummary, CourseClassSummary } from "@/lib/types/class";
import type { EnrollmentRequestSummary } from "@/lib/types/enrollment";
import type { ClassroomTemplateSummary } from "@/lib/types/classroom";
import type { CourseSummary } from "@/lib/types/course";

type ClassManagementClientProps = {
  actorRole: UserRole;
  currentActorId: string;
  courses: CourseSummary[];
  classes: CourseClassSummary[];
  changeRequests: ClassChangeRequest[];
  enrollmentRequests: EnrollmentRequestSummary[];
  templates: ClassroomTemplateSummary[];
  focusedClassId?: string;
  membersByClassId: Record<string, ClassMemberSummary[]>;
};

const classStatusMeta: Record<string, { label: string; dotClassName: string }> = {
  draft: { label: "Chưa bắt đầu", dotClassName: "bg-slate-400" },
  active: { label: "Đang hoạt động", dotClassName: "bg-emerald-500" },
  archived: { label: "Kết thúc", dotClassName: "bg-red-500" },
};

const requestStatusMeta: Record<ClassChangeRequest["status"], { label: string; className: string }> = {
  pending_review: { label: "Chờ duyệt", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Đã duyệt", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Từ chối", className: "bg-rose-100 text-rose-800" },
};

const requestActionLabels: Record<ClassChangeRequest["action"], string> = {
  create: "Mở lớp mới",
  archive: "Lưu trữ lớp",
  delete: "Xóa lớp",
};

export function ClassManagementClient({
  actorRole,
  currentActorId,
  courses,
  classes,
  changeRequests,
  enrollmentRequests,
  templates,
  focusedClassId,
  membersByClassId,
}: ClassManagementClientProps) {
  const [createState, createAction, createPending] = useActionState(createClassAction, initialClassActionState);
  const [addStudentState, addStudentAction, addStudentPending] = useActionState(addStudentToClassAction, initialClassActionState);
  const [importStudentsState, importStudentsAction, importStudentsPending] = useActionState(importStudentsCsvToClassAction, initialClassActionState);
  const [lifecycleState, lifecycleAction, lifecyclePending] = useActionState(createClassLifecycleRequestAction, initialClassActionState);
  const [changeRequestReviewState, changeRequestReviewAction, changeRequestReviewPending] = useActionState(reviewClassChangeRequestAction, initialClassActionState);
  const [enrollmentReviewState, enrollmentReviewAction, enrollmentReviewPending] = useActionState(reviewClassEnrollmentRequestAction, initialClassActionState);
  const [templateDeleteState, templateDeleteAction, templateDeletePending] = useActionState(deleteClassTemplateAction, initialClassActionState);
  const [templateCreateState, templateCreateAction, templateCreatePending] = useActionState(createTemplateClassAction, initialClassActionState);
  const router = useRouter();
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const classesById = new Map(classes.map((courseClass) => [courseClass.id, courseClass]));
  const isAdmin = actorRole === "admin";
  const canReviewChangeRequests = actorRole === "admin" || actorRole === "moderator";
  const visibleReviewRequests = canReviewChangeRequests
    ? changeRequests.filter((request) => request.status === "pending_review")
    : [];
  const teacherPendingCreateRequests = actorRole === "teacher"
    ? changeRequests.filter((request) => request.action === "create" && request.status === "pending_review")
    : [];
  const focusedCardRef = useRef<HTMLElement | null>(null);
  const [csvFileNames, setCsvFileNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!focusedClassId || !focusedCardRef.current) {
      return;
    }

    focusedCardRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [focusedClassId]);

  useEffect(() => {
    if (templateCreateState.redirectTo) {
      router.push(templateCreateState.redirectTo);
    }
  }, [router, templateCreateState.redirectTo]);

  return (
    <div className="space-y-8">
      {canReviewChangeRequests ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-amber-950">Yêu cầu thay đổi lớp</h2>
              <p className="mt-1 text-sm text-amber-900">
                {actorRole === "admin"
                  ? "Admin có thể duyệt toàn bộ yêu cầu mở lớp, lưu trữ hoặc xóa lớp."
                  : "Mod duyệt các yêu cầu lớp thuộc học phần mình đang quản lý."}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-amber-900">
              {visibleReviewRequests.length} chờ duyệt
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {visibleReviewRequests.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-300 bg-white p-4 text-sm text-amber-900">
                Chưa có yêu cầu thay đổi lớp nào.
              </div>
            ) : (
              visibleReviewRequests.map((request) => {
                const statusMeta = requestStatusMeta[request.status];
                const course = coursesById.get(request.courseId);
                const targetClass = request.targetClassId ? classesById.get(request.targetClassId) : null;

                return (
                  <article className="rounded-lg border border-amber-200 bg-white p-4" key={request.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">
                          {requestActionLabels[request.action]}
                          {request.action === "create"
                            ? `: ${request.classCode ?? "Lớp mới"}`
                            : targetClass
                              ? `: ${targetClass.title}`
                              : request.classCode
                                ? `: ${request.classCode}`
                                : ""}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {course ? `${course.code} - ${course.title}` : "Học phần chưa xác định"}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500">Người gửi</dt>
                        <dd className="font-medium text-slate-900">{request.requestedByName ?? request.requestedBy}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Thời điểm</dt>
                        <dd className="font-medium text-slate-900">{new Date(request.createdAt).toLocaleString("vi-VN")}</dd>
                      </div>
                      {request.action === "create" ? (
                        <>
                          <div>
                            <dt className="text-xs text-slate-500">Tên lớp</dt>
                            <dd className="font-medium text-slate-900">{request.title ?? "-"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500">Trạng thái đề xuất</dt>
                            <dd className="font-medium text-slate-900">
                              {request.requestedStatus ? classStatusMeta[request.requestedStatus]?.label ?? request.requestedStatus : "-"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500">Học kỳ</dt>
                            <dd className="font-medium text-slate-900">{request.semester ?? "-"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-500">Năm học</dt>
                            <dd className="font-medium text-slate-900">{request.academicYear ?? "-"}</dd>
                          </div>
                        </>
                      ) : null}
                      {request.reason ? (
                        <div className="md:col-span-2">
                          <dt className="text-xs text-slate-500">Lý do</dt>
                          <dd className="font-medium text-slate-900">{request.reason}</dd>
                        </div>
                      ) : null}
                      {request.reviewNote ? (
                        <div className="md:col-span-2">
                          <dt className="text-xs text-slate-500">Ghi chú duyệt</dt>
                          <dd className="font-medium text-slate-900">{request.reviewNote}</dd>
                        </div>
                      ) : null}
                    </dl>

                    {request.status === "pending_review" ? (
                      <form action={changeRequestReviewAction} className="mt-4 flex flex-wrap items-end gap-2">
                        <input name="requestId" type="hidden" value={request.id} />
                        <label className="text-sm text-slate-700">
                          Quyết định
                          <select className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="approved" name="decision">
                            <option value="approved">Duyệt</option>
                            <option value="rejected">Từ chối</option>
                          </select>
                        </label>
                        <label className="text-sm text-slate-700">
                          Ghi chú
                          <input className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm" name="note" />
                        </label>
                        <button className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={changeRequestReviewPending} type="submit">
                          {changeRequestReviewPending ? "Đang lưu..." : "Lưu duyệt"}
                        </button>
                      </form>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>

          {changeRequestReviewState.message ? (
            <p className={changeRequestReviewState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}>
              {changeRequestReviewState.message}
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Danh sách lớp</h2>
        {actorRole === "teacher" && teacherPendingCreateRequests.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-amber-950">Lớp đang chờ duyệt mở</h3>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-900">
                {teacherPendingCreateRequests.length} yêu cầu
              </span>
            </div>
            <p className="mt-2 text-sm text-amber-900">
              Bạn đã gửi yêu cầu mở lớp. Các lớp dưới đây sẽ xuất hiện trong danh sách chính sau khi được Mod hoặc Admin duyệt.
            </p>
            <div className="mt-3 space-y-2">
              {teacherPendingCreateRequests.map((request) => {
                const course = coursesById.get(request.courseId);

                return (
                  <div className="rounded-md border border-amber-200 bg-white p-3" key={request.id}>
                    <p className="text-sm font-medium text-slate-900">
                      {request.classCode ?? "Lớp mới"}{request.title ? ` - ${request.title}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {course ? `${course.code} - ${course.title}` : "Học phần chưa xác định"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Học kỳ: {request.semester ?? "-"} · Năm học: {request.academicYear ?? "-"} · Trạng thái đề xuất: {request.requestedStatus ? classStatusMeta[request.requestedStatus]?.label ?? request.requestedStatus : "-"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {isAdmin ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {classes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600 md:col-span-2">
                Chưa có lớp nào.
              </div>
            ) : (
              classes.map((courseClass) => {
                const members = membersByClassId[courseClass.id] ?? [];
                const course = coursesById.get(courseClass.courseId);
                const statusMeta = classStatusMeta[courseClass.status] ?? classStatusMeta.draft;

                return (
                  <article className="rounded-lg border border-slate-200 bg-white p-4" key={courseClass.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dotClassName}`} />
                          <h3 className="text-base font-semibold text-slate-900">{courseClass.title}</h3>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{courseClass.classCode}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {statusMeta.label}
                      </span>
                    </div>

                    <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500">Học phần</dt>
                        <dd className="font-medium text-slate-900">
                          {courseClass.courseCode} - {courseClass.courseTitle}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Số tín chỉ</dt>
                        <dd className="font-medium text-slate-900">{course?.credits ?? "Chưa cập nhật"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Học kỳ</dt>
                        <dd className="font-medium text-slate-900">{courseClass.semester ?? "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Năm học</dt>
                        <dd className="font-medium text-slate-900">{courseClass.academicYear ?? "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Sinh viên</dt>
                        <dd className="font-medium text-slate-900">{members.length} sinh viên</dd>
                      </div>
                    </dl>
                  </article>
                );
              })
            )}
          </div>
        ) : (
        <div className="mt-4 space-y-4">
          {classes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">Chưa có lớp nào.</div>
          ) : (
            classes.map((courseClass) => {
              const members = membersByClassId[courseClass.id] ?? [];
              const pendingEnrollmentRequests = enrollmentRequests.filter(
                (request) => request.classId === courseClass.id && request.status === "pending",
              );
              const isFocusedClass = focusedClassId === courseClass.id;
              const statusMeta = classStatusMeta[courseClass.status] ?? classStatusMeta.draft;

              return (
                <article
                  className={`rounded-lg border p-4 transition ${isFocusedClass ? "border-sky-400 bg-sky-50 shadow-md ring-2 ring-sky-200" : "border-slate-200"}`}
                  data-testid={`class-card-${courseClass.classCode}`}
                  id={`class-card-${courseClass.id}`}
                  key={courseClass.id}
                  ref={isFocusedClass ? focusedCardRef : undefined}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{courseClass.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {courseClass.classCode} · {courseClass.courseCode} - {courseClass.courseTitle}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Học kỳ: {courseClass.semester ?? "-"} · Năm học: {courseClass.academicYear ?? "-"} · Trạng thái: {statusMeta.label}
                      </p>
                      {isFocusedClass ? (
                        <p className="mt-2 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-900">
                          Lớp này đang có yêu cầu tham gia chờ duyệt từ dashboard
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-slate-600">{members.length} sinh viên</div>
                      <Link
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                        href={`/classes/${courseClass.id}/room`}
                      >
                        Vào phòng học
                      </Link>
                    </div>
                  </div>

                  {actorRole !== "moderator" ? (
                    <form action={addStudentAction} className="mt-4 grid gap-3 md:grid-cols-3" data-testid={`add-student-form-${courseClass.classCode}`}>
                      <input name="classId" type="hidden" value={courseClass.id} />
                      <label className="text-sm text-slate-700">
                        Mã sinh viên
                        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid={`add-student-code-${courseClass.classCode}`} name="studentCode" />
                      </label>
                      <label className="text-sm text-slate-700">
                        Họ tên sinh viên
                        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid={`add-student-full-name-${courseClass.classCode}`} name="fullName" required />
                      </label>
                      <label className="text-sm text-slate-700">
                        Email
                        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid={`add-student-email-${courseClass.classCode}`} name="email" type="email" />
                      </label>
                      <div className="md:col-span-3">
                        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60" data-testid={`add-student-submit-${courseClass.classCode}`} disabled={addStudentPending} type="submit">
                          {addStudentPending ? "Đang thêm..." : "Thêm sinh viên"}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {actorRole !== "moderator" ? (
                    <form action={importStudentsAction} className="mt-4 rounded-md border border-dashed border-slate-300 p-3" data-testid={`import-students-form-${courseClass.classCode}`}>
                      <input name="classId" type="hidden" value={courseClass.id} />
                      <div className="block text-sm text-slate-700">
                        <span>Nhập CSV sinh viên</span>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <label
                            className="inline-flex cursor-pointer items-center rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                            htmlFor={`import-students-file-${courseClass.id}`}
                          >
                            Chọn file
                          </label>
                          <span className="text-sm text-slate-600">{csvFileNames[courseClass.id] ?? "Chưa chọn file"}</span>
                        </div>
                          <input
                          accept=".csv,text/csv"
                          className="sr-only"
                          data-testid={`import-students-file-${courseClass.classCode}`}
                          id={`import-students-file-${courseClass.id}`}
                          name="csvFile"
                          onChange={(event) => {
                            const fileName = event.currentTarget.files?.[0]?.name ?? "Chưa chọn file";
                            setCsvFileNames((current) => ({ ...current, [courseClass.id]: fileName }));
                          }}
                          type="file"
                          required
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Chấp nhận header theo thứ tự: mã sinh viên, họ tên sinh viên, email.
                      </p>
                      <button className="mt-3 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60" data-testid={`import-students-submit-${courseClass.classCode}`} disabled={importStudentsPending} type="submit">
                        {importStudentsPending ? "Đang nhập..." : "Nhập CSV"}
                      </button>
                    </form>
                  ) : null}

                  {actorRole !== "moderator" ? (
                    <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-medium text-sky-950">Yêu cầu tham gia lớp</h4>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-sky-800">{pendingEnrollmentRequests.length} chờ duyệt</span>
                    </div>
                    {pendingEnrollmentRequests.length === 0 ? (
                      <p className="mt-2 text-sm text-sky-800">Chưa có yêu cầu tham gia đang chờ duyệt.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {pendingEnrollmentRequests.map((request) => (
                          <article className="rounded-md border border-sky-200 bg-white p-3" key={request.id}>
                            <p className="text-sm font-medium text-slate-900">
                              {request.studentFullName ?? "Sinh viên chưa xác định"}
                              {request.studentCode ? ` · ${request.studentCode}` : ""}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {request.studentEmail ?? "Chưa có email"} · {request.courseCode ?? "-"} - {request.courseTitle ?? "-"}
                            </p>
                            <form action={enrollmentReviewAction} className="mt-3 flex flex-wrap items-end gap-2">
                              <input name="requestId" type="hidden" value={request.id} />
                              <label className="text-sm text-slate-700">
                                Quyết định
                                <select className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="approved" name="decision">
                                  <option value="approved">Duyệt</option>
                                  <option value="rejected">Từ chối</option>
                                </select>
                              </label>
                              <label className="text-sm text-slate-700">
                                Ghi chú
                                <input className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm" name="note" />
                              </label>
                              <button className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={enrollmentReviewPending} type="submit">
                                {enrollmentReviewPending ? "Đang lưu..." : "Lưu duyệt"}
                              </button>
                            </form>
                          </article>
                        ))}
                      </div>
                    )}
                    </div>
                  ) : null}

                  {actorRole !== "moderator" ? (
                    <form action={lifecycleAction} className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3" data-testid={`class-lifecycle-form-${courseClass.classCode}`}>
                    <input name="action" type="hidden" value="archive" />
                    <input name="classId" type="hidden" value={courseClass.id} />
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <label className="text-sm text-amber-900">
                        Lý do lưu trữ lớp
                        <input className="mt-1 w-full rounded-md border border-amber-300 px-3 py-2 text-sm" name="reason" placeholder="Ví dụ: lớp đã kết thúc" />
                      </label>
                      <div className="flex items-end">
                        <button className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={lifecyclePending} type="submit">
                          {lifecyclePending ? "Đang gửi..." : "Gửi yêu cầu lưu trữ lớp"}
                        </button>
                      </div>
                    </div>
                    </form>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
        )}
        {addStudentState.message ? (
          <p className={addStudentState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"} data-testid="add-student-message">
            {addStudentState.message}
          </p>
        ) : null}
        {importStudentsState.message ? (
          <p className={importStudentsState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"} data-testid="import-students-message">
            {importStudentsState.message}
          </p>
        ) : null}
        {lifecycleState.message ? (
          <p className={lifecycleState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}>
            {lifecycleState.message}
          </p>
        ) : null}
        {enrollmentReviewState.message ? (
          <p className={enrollmentReviewState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}>
            {enrollmentReviewState.message}
          </p>
        ) : null}
      </section>

      {actorRole === "teacher" ? (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Tạo lớp</h2>
          <form action={createAction} className="mt-4 grid gap-3 md:grid-cols-2" data-testid="create-class-form">
          <label className="text-sm text-slate-700">
            Học phần
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid="create-class-course-id" name="courseId" required>
              <option value="">Chọn học phần</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Mã lớp
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid="create-class-code" name="classCode" required />
          </label>
          <label className="text-sm text-slate-700">
            Tên lớp
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid="create-class-title" name="title" required />
          </label>
          <label className="text-sm text-slate-700">
            Học kỳ
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid="create-class-semester" name="semester" placeholder="VD: HK1" />
          </label>
          <label className="text-sm text-slate-700">
            Năm học
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid="create-class-academic-year" name="academicYear" placeholder="VD: 2026-2027" />
          </label>
          <label className="text-sm text-slate-700">
            Trạng thái
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid="create-class-status" defaultValue="active" name="status">
              <option value="draft">Bản nháp</option>
              <option value="active">Đang hoạt động</option>
              <option value="archived">Đã lưu trữ</option>
            </select>
          </label>
          <div className="md:col-span-2 flex items-end">
            <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" data-testid="create-class-submit" disabled={createPending} type="submit">
              {createPending ? "Đang gửi..." : "Gửi yêu cầu mở lớp"}
            </button>
          </div>
          </form>
          {createState.message ? (
            <p className={createState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"} data-testid="create-class-message">
              {createState.message}
            </p>
          ) : null}
          {teacherPendingCreateRequests.length > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Yêu cầu mở lớp đã gửi</h3>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  {teacherPendingCreateRequests.length} chờ duyệt
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {teacherPendingCreateRequests.map((request) => {
                  const course = coursesById.get(request.courseId);

                  return (
                    <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3" key={`create-form-request-${request.id}`}>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {request.classCode ?? "Lớp mới"}{request.title ? ` - ${request.title}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {course ? `${course.code} - ${course.title}` : "Học phần chưa xác định"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Học kỳ: {request.semester ?? "-"} · Năm học: {request.academicYear ?? "-"}
                        </p>
                      </div>
                      <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                        Chờ duyệt
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {actorRole === "teacher" ? (
        <section className="rounded-lg border border-violet-200 bg-violet-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-violet-950">Quản lý lớp mẫu</h2>
              <p className="mt-1 text-sm text-violet-900">
                Mở lớp mẫu để chỉnh sửa như một phòng học bình thường, hoặc xóa lớp mẫu nếu không còn dùng đến.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-violet-900">
              {templates.length} lớp mẫu
            </span>
          </div>

          {templates.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-violet-300 bg-white p-4 text-sm text-violet-900">
              Chưa có lớp mẫu nào.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {templates.map((template) => {
                const course = coursesById.get(template.courseId);
                const sourceClass = template.sourceClassId ? classesById.get(template.sourceClassId) ?? null : null;
                const canDeleteTemplate = template.createdBy === currentActorId;

                return (
                  <article className="rounded-lg border border-violet-200 bg-white p-4" key={template.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{template.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {course ? `${course.code} - ${course.title}` : "Học phần chưa xác định"}
                        </p>
                      </div>
                      <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-800">
                        Lớp mẫu
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-700">
                      Nguồn: {sourceClass ? `${sourceClass.classCode} - ${sourceClass.title}` : template.name}
                    </p>
                    {template.description ? <p className="mt-1 text-sm text-slate-600">{template.description}</p> : null}
                    <p className="mt-2 text-xs text-violet-800">
                      {template.sessionCount} buổi học · {template.materialCount} tài liệu · {template.simulationCount} mô phỏng
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {template.sourceClassId ? (
                        <Link
                          className="rounded-md border border-violet-300 px-4 py-2 text-sm font-medium text-violet-900"
                          href={`/classes/${template.sourceClassId}/room`}
                        >
                          Vào lớp mẫu
                        </Link>
                      ) : null}
                      {canDeleteTemplate ? (
                        <form action={templateDeleteAction}>
                          <input name="templateId" type="hidden" value={template.id} />
                          <button
                            className="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
                            disabled={templateDeletePending}
                            type="submit"
                          >
                            {templateDeletePending ? "Đang xóa..." : "Xóa lớp mẫu"}
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-500">Chỉ người tạo mới có thể xóa.</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {templateDeleteState.message ? (
            <p className={templateDeleteState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}>
              {templateDeleteState.message}
            </p>
          ) : null}

          <div className="mt-6 rounded-lg border border-violet-200 bg-white p-4">
            <h3 className="text-base font-semibold text-violet-950">Tạo lớp mẫu</h3>
            <p className="mt-1 text-sm text-violet-900">
              Tạo một lớp mẫu mới theo học phần. Lớp mẫu sẽ mở như một phòng học riêng để chỉnh sửa nội dung.
            </p>

            <form action={templateCreateAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="text-sm text-violet-900">
                Học phần
                <select className="mt-1 w-full rounded-md border border-violet-200 bg-white px-3 py-2 text-sm text-slate-900" name="courseId" required>
                  <option value="">Chọn học phần</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code} - {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-violet-900">
                Tên lớp mẫu
                <input className="mt-1 w-full rounded-md border border-violet-200 bg-white px-3 py-2 text-sm text-slate-900" maxLength={200} name="name" required />
              </label>
              <label className="text-sm text-violet-900 md:col-span-2">
                Mô tả
                <input className="mt-1 w-full rounded-md border border-violet-200 bg-white px-3 py-2 text-sm text-slate-900" maxLength={1000} name="description" />
              </label>
              <div className="flex items-end">
                <button className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={templateCreatePending} type="submit">
                  {templateCreatePending ? "Đang tạo..." : "Tạo lớp mẫu"}
                </button>
              </div>
            </form>

            {templateCreateState.message ? (
              <p className={templateCreateState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}>
                {templateCreateState.message}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
