"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { initialCourseActionState } from "@/app/(teacher)/courses/course-action-state";
import {
  archiveCourseAction,
  assignCourseModeratorAction,
  assignCourseTeachersAction,
  createCourseAction,
  deleteCourseAction,
  reviewCourseChangeRequestAction,
  updateCourseAction,
} from "@/app/(teacher)/courses/actions";
import type {
  CourseAssessmentComponent,
  CourseChangeRequest,
  CourseCloItem,
  CourseModeratorOption,
  CourseSummary,
  CourseTeacherOption,
} from "@/lib/types/course";
import type { UserRole } from "@/lib/types/auth";

type CourseManagementClientProps = {
  actorRole: UserRole;
  courses: CourseSummary[];
  moderatorOptions: CourseModeratorOption[];
  teacherOptions: CourseTeacherOption[];
  changeRequests: CourseChangeRequest[];
  page: number;
  pageSize: number;
  totalItems: number;
  searchQuery?: string;
  selectedStatus?: "draft" | "active" | "archived";
};

const knowledgeBlockLabels: Record<string, string> = {
  general: "Đại cương",
  foundation: "Cơ sở ngành",
  major: "Ngành/Chuyên ngành",
};

const courseTypeLabels: Record<string, string> = {
  required: "Bắt buộc",
  elective: "Tự chọn",
};

const visibilityLabels: Record<string, string> = {
  private: "Chỉ thành viên",
  unlisted: "Nội bộ",
  public_preview: "Cho xem trước công khai",
};

function cloItemsToHiddenValue(items: CourseCloItem[]): string {
  return items
    .map((item) => `${item.code.trim()} | ${item.description.trim()}`)
    .filter((line) => !line.startsWith("|") && !line.endsWith("|"))
    .join("\n");
}

function assessmentComponentsToHiddenValue(items: CourseAssessmentComponent[]): string {
  return items
    .map((item) => `${item.type.trim()} | ${Number.isFinite(Number(item.weight)) ? Number(item.weight) : 0}`)
    .filter((line) => !line.startsWith("|"))
    .join("\n");
}

function courseStatusLabel(status: CourseSummary["status"]): string {
  const labels: Record<CourseSummary["status"], string> = {
    draft: "Bản nháp",
    active: "Đang hoạt động",
    archived: "Đã lưu trữ",
  };

  return labels[status];
}

function CourseCloTableInput({
  defaultItems = [],
  name,
}: {
  defaultItems?: CourseCloItem[];
  name: string;
}) {
  const [rows, setRows] = useState<CourseCloItem[]>(defaultItems.length > 0 ? defaultItems : [{ code: "", description: "" }]);
  const hiddenValue = useMemo(() => cloItemsToHiddenValue(rows), [rows]);

  return (
    <div className="md:col-span-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">Chuẩn đầu ra học phần</p>
        <button
          className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700"
          onClick={() => setRows((currentRows) => [...currentRows, { code: "", description: "" }])}
          type="button"
        >
          Thêm CLO
        </button>
      </div>
      <input name={name} readOnly type="hidden" value={hiddenValue} />
      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="w-32 px-3 py-2 text-left font-medium">Mã CLO</th>
              <th className="px-3 py-2 text-left font-medium">Mô tả CLO</th>
              <th className="w-24 px-3 py-2 text-left font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row, rowIndex) => (
              <tr key={`clo-row-${rowIndex}`}>
                <td className="px-3 py-2">
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    onChange={(event) =>
                      setRows((currentRows) =>
                        currentRows.map((currentRow, currentIndex) =>
                          currentIndex === rowIndex ? { ...currentRow, code: event.target.value } : currentRow,
                        ),
                      )
                    }
                    placeholder="CLO_01"
                    value={row.code}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    onChange={(event) =>
                      setRows((currentRows) =>
                        currentRows.map((currentRow, currentIndex) =>
                          currentIndex === rowIndex ? { ...currentRow, description: event.target.value } : currentRow,
                        ),
                      )
                    }
                    placeholder="Mô tả chuẩn đầu ra"
                    value={row.description}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-50"
                    disabled={rows.length === 1}
                    onClick={() => setRows((currentRows) => currentRows.filter((_, currentIndex) => currentIndex !== rowIndex))}
                    type="button"
                  >
                    Bớt
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CourseAssessmentTableInput({
  defaultItems = [],
  name,
}: {
  defaultItems?: CourseAssessmentComponent[];
  name: string;
}) {
  const [rows, setRows] = useState<CourseAssessmentComponent[]>(defaultItems.length > 0 ? defaultItems : [{ type: "", weight: 0 }]);
  const hiddenValue = useMemo(() => assessmentComponentsToHiddenValue(rows), [rows]);

  return (
    <div className="md:col-span-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700">Thành phần đánh giá</p>
          <p className="text-xs text-slate-500">Tổng trọng số cần bằng 100%.</p>
        </div>
        <button
          className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700"
          onClick={() => setRows((currentRows) => [...currentRows, { type: "", weight: 0 }])}
          type="button"
        >
          Thêm thành phần
        </button>
      </div>
      <input name={name} readOnly type="hidden" value={hiddenValue} />
      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Loại đánh giá</th>
              <th className="w-36 px-3 py-2 text-left font-medium">Trọng số (%)</th>
              <th className="w-24 px-3 py-2 text-left font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row, rowIndex) => (
              <tr key={`assessment-row-${rowIndex}`}>
                <td className="px-3 py-2">
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    onChange={(event) =>
                      setRows((currentRows) =>
                        currentRows.map((currentRow, currentIndex) =>
                          currentIndex === rowIndex ? { ...currentRow, type: event.target.value } : currentRow,
                        ),
                      )
                    }
                    placeholder="Chuyên cần"
                    value={row.type}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    max={100}
                    min={0}
                    onChange={(event) =>
                      setRows((currentRows) =>
                        currentRows.map((currentRow, currentIndex) =>
                          currentIndex === rowIndex ? { ...currentRow, weight: Number(event.target.value) } : currentRow,
                        ),
                      )
                    }
                    type="number"
                    value={row.weight}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-50"
                    disabled={rows.length === 1}
                    onClick={() => setRows((currentRows) => currentRows.filter((_, currentIndex) => currentIndex !== rowIndex))}
                    type="button"
                  >
                    Bớt
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReadOnlyCourseTable({
  assessmentComponents,
  cloItems,
}: {
  assessmentComponents: CourseAssessmentComponent[];
  cloItems: CourseCloItem[];
}) {
  return (
    <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
      <div>
        <p className="text-xs font-medium uppercase text-slate-500">Chuẩn đầu ra học phần</p>
        <div className="mt-1 overflow-hidden rounded-md border border-slate-200 bg-white">
          {cloItems.length > 0 ? (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="w-24 px-3 py-2 text-left font-medium">Mã CLO</th>
                  <th className="px-3 py-2 text-left font-medium">Mô tả CLO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {cloItems.map((item) => (
                  <tr key={item.code}>
                    <td className="px-3 py-2 font-medium text-slate-800">{item.code}</td>
                    <td className="px-3 py-2 text-slate-700">{item.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-3 text-slate-600">Chưa cập nhật CLO.</p>
          )}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium uppercase text-slate-500">Thành phần đánh giá</p>
        <div className="mt-1 overflow-hidden rounded-md border border-slate-200 bg-white">
          {assessmentComponents.length > 0 ? (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Loại</th>
                  <th className="w-24 px-3 py-2 text-left font-medium">Trọng số</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {assessmentComponents.map((item) => (
                  <tr key={item.type}>
                    <td className="px-3 py-2 text-slate-700">{item.type}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{item.weight}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-3 text-slate-600">Chưa cập nhật đánh giá.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function CourseManagementClient({
  actorRole,
  courses,
  moderatorOptions,
  teacherOptions,
  changeRequests,
  page,
  pageSize,
  totalItems,
  searchQuery,
  selectedStatus,
}: CourseManagementClientProps) {
  const [createState, createAction, createPending] = useActionState(createCourseAction, initialCourseActionState);
  const [updateState, updateAction, updatePending] = useActionState(updateCourseAction, initialCourseActionState);
  const [archiveState, archiveAction, archivePending] = useActionState(archiveCourseAction, initialCourseActionState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCourseAction, initialCourseActionState);
  const [reviewState, reviewAction, reviewPending] = useActionState(reviewCourseChangeRequestAction, initialCourseActionState);
  const [assignState, assignAction, assignPending] = useActionState(assignCourseModeratorAction, initialCourseActionState);
  const [assignTeachersState, assignTeachersAction, assignTeachersPending] = useActionState(
    assignCourseTeachersAction,
    initialCourseActionState,
  );
  const [assigningCourseId, setAssigningCourseId] = useState<string | null>(null);
  const [assigningTeachersCourseId, setAssigningTeachersCourseId] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [createFormKey, setCreateFormKey] = useState(0);
  const previousCreateStatusRef = useRef(createState.status);
  const pendingRequests = changeRequests.filter((request) => request.status === "pending_review");
  const isAdmin = actorRole === "admin";

  useEffect(() => {
    if (previousCreateStatusRef.current !== "success" && createState.status === "success") {
      setCreateFormKey((currentValue) => currentValue + 1);
    }

    previousCreateStatusRef.current = createState.status;
  }, [createState.status]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          {actorRole === "moderator" ? "Danh sách học phần quản lý" : "Danh sách học phần"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Tổng {totalItems} học phần, trang {page} (kích thước trang {pageSize})
          {searchQuery ? `, tìm kiếm: ${searchQuery}` : ""}
          {selectedStatus ? `, trạng thái: ${selectedStatus}` : ""}
        </p>

        <div className="mt-4 space-y-4">
          {courses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">
              Chưa có học phần nào phù hợp với bộ lọc.
            </div>
          ) : (
            courses.map((course) => {
              const isAssignedToModerator = course.ownerRole === "moderator";
              const isEditingCourse = editingCourseId === course.id;
              const updateFormId = `update-course-form-${course.id}`;

              return (
              <article className="rounded-lg border border-slate-200 p-4" data-testid={`course-card-${course.code}`} key={course.id}>
                {!isAdmin ? (
                  <div className="mb-3 flex flex-wrap justify-end gap-2">
                    <Link
                      className="rounded-md border border-teal-300 px-3 py-2 text-xs font-medium text-teal-700"
                      href="/classes"
                    >
                      {actorRole === "moderator" ? "Xem các lớp" : "Tạo/quản lý lớp"}
                    </Link>
                  </div>
                ) : null}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-950">
                          {course.code} - {course.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">{course.description ?? "Chưa có mô tả."}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                        {courseStatusLabel(course.status)}
                      </span>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                      <div>
                        <dt className="text-xs text-slate-500">Số tín chỉ</dt>
                        <dd className="font-medium text-slate-900">{course.credits ?? "Chưa cập nhật"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Khối kiến thức</dt>
                        <dd className="font-medium text-slate-900">
                          {course.knowledgeBlock ? knowledgeBlockLabels[course.knowledgeBlock] : "Chưa chọn"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Loại học phần</dt>
                        <dd className="font-medium text-slate-900">
                          {course.courseType ? courseTypeLabels[course.courseType] : "Chưa chọn"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Mod quản lý</dt>
                        <dd className="font-medium text-slate-900">
                          {isAssignedToModerator ? course.ownerFullName ?? "Moderator" : "Chưa giao Mod"}
                        </dd>
                      </div>
                      <div className="md:col-span-4">
                        <dt className="text-xs text-slate-500">Giảng viên phụ trách</dt>
                        <dd className="font-medium text-slate-900">
                          {(course.assignedTeachers ?? []).length > 0
                            ? (course.assignedTeachers ?? []).map((teacher) => teacher.fullName ?? teacher.email ?? teacher.id).join(", ")
                            : "Chưa giao giảng viên phụ trách"}
                        </dd>
                      </div>
                    </dl>
                    <ReadOnlyCourseTable assessmentComponents={course.assessmentComponents} cloItems={course.cloItems} />
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {isAdmin ? (
                        <>
                          <button
                            className="rounded-md border border-blue-300 px-3 py-2 text-xs font-medium text-blue-700"
                            onClick={() => setAssigningCourseId((currentId) => (currentId === course.id ? null : course.id))}
                            type="button"
                          >
                            Giao quản lý
                          </button>
                          {isAssignedToModerator ? (
                            <span className="text-xs text-slate-500">Đang giao cho {course.ownerFullName ?? "Moderator"}.</span>
                          ) : (
                            <span className="text-xs text-slate-500">Chưa giao Mod quản lý.</span>
                          )}
                          <button
                            className="rounded-md border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700"
                            onClick={() => setAssigningTeachersCourseId((currentId) => (currentId === course.id ? null : course.id))}
                            type="button"
                          >
                            Giao giảng viên
                          </button>
                        </>
                      ) : null}
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                        onClick={() => setEditingCourseId(course.id)}
                        type="button"
                      >
                        Sửa học phần
                      </button>
                    </div>
                    {isAdmin && assigningCourseId === course.id ? (
                      <form action={assignAction} className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-blue-100 bg-white p-3">
                        <input name="courseId" type="hidden" value={course.id} />
                        <label className="min-w-72 text-sm text-slate-700">
                          Chọn Mod quản lý
                          <select
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            defaultValue={isAssignedToModerator ? course.ownerId : ""}
                            name="moderatorId"
                            required
                          >
                            <option value="">Chọn Mod</option>
                            {moderatorOptions.map((moderator) => (
                              <option key={moderator.id} value={moderator.id}>
                                {moderator.fullName ?? moderator.email ?? moderator.id}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                          disabled={assignPending || moderatorOptions.length === 0}
                          type="submit"
                        >
                          {assignPending ? "Đang lưu..." : "Lưu phân quyền"}
                        </button>
                        {moderatorOptions.length === 0 ? <p className="text-xs text-red-600">Chưa có tài khoản Mod đang hoạt động.</p> : null}
                      </form>
                    ) : null}
                    {isAdmin && assigningTeachersCourseId === course.id ? (
                      <form action={assignTeachersAction} className="mt-3 rounded-md border border-emerald-100 bg-white p-3">
                        <input name="courseId" type="hidden" value={course.id} />
                        <label className="block text-sm text-slate-700">
                          Chọn giảng viên phụ trách
                          <select
                            className="mt-1 min-h-36 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            defaultValue={(course.assignedTeachers ?? []).map((teacher) => teacher.id)}
                            multiple
                            name="teacherIds"
                          >
                            {teacherOptions.map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>
                                {teacher.fullName ?? teacher.email ?? teacher.id}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="mt-2 text-xs text-slate-500">
                          Có thể chọn nhiều giảng viên để cùng tạo lớp từ học phần này. Mỗi học phần chỉ có một Mod quản lý.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <button
                            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                            disabled={assignTeachersPending}
                            type="submit"
                          >
                            {assignTeachersPending ? "Đang lưu..." : "Lưu giảng viên phụ trách"}
                          </button>
                          {teacherOptions.length === 0 ? <p className="text-xs text-red-600">Chưa có giảng viên đang hoạt động.</p> : null}
                        </div>
                      </form>
                    ) : null}
                    {isAdmin && isAssignedToModerator ? (
                      <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        Học phần này đã giao Mod quản lý. Nếu Admin lưu chỉnh sửa, hệ thống sẽ gửi yêu cầu đến Mod quản lý để xác nhận đồng thuận trước khi áp dụng.
                      </p>
                    ) : null}
                  </div>

                {isEditingCourse ? (
                <>
                <form
                  action={updateAction}
                  className="mt-4 grid gap-3 md:grid-cols-2"
                  data-testid={`update-course-form-${course.code}`}
                  id={updateFormId}
                >
                  <input name="courseId" type="hidden" value={course.id} />
                  <label className="text-sm text-slate-700">
                    Mã học phần
                    <input
                      className="mt-1 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
                      disabled
                      defaultValue={course.code}
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Tên học phần
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      data-testid={`course-title-${course.code}`}
                      defaultValue={course.title}
                      name="title"
                      required
                    />
                  </label>
                  <label className="text-sm text-slate-700 md:col-span-2">
                    Mô tả
                    <textarea
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      data-testid={`course-description-${course.code}`}
                      defaultValue={course.description ?? ""}
                      name="description"
                      rows={3}
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Mức hiển thị
                    <select
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      data-testid={`course-visibility-${course.code}`}
                      defaultValue={course.visibility}
                      name="visibility"
                    >
                      <option value="private">{visibilityLabels.private}</option>
                      <option value="unlisted">{visibilityLabels.unlisted}</option>
                      <option value="public_preview">{visibilityLabels.public_preview}</option>
                    </select>
                  </label>
                  <label className="text-sm text-slate-700">
                    Số tín chỉ
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      defaultValue={course.credits ?? ""}
                      max={20}
                      min={1}
                      name="credits"
                      type="number"
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Khối kiến thức
                    <select
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      defaultValue={course.knowledgeBlock ?? ""}
                      name="knowledgeBlock"
                    >
                      <option value="">Chưa chọn</option>
                      <option value="general">Đại cương</option>
                      <option value="foundation">Cơ sở ngành</option>
                      <option value="major">Ngành/Chuyên ngành</option>
                    </select>
                  </label>
                  <label className="text-sm text-slate-700">
                    Loại học phần
                    <select
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      defaultValue={course.courseType ?? ""}
                      name="courseType"
                    >
                      <option value="">Chưa chọn</option>
                      <option value="required">Bắt buộc</option>
                      <option value="elective">Tự chọn</option>
                    </select>
                  </label>
                  <label className="text-sm text-slate-700">
                    Trạng thái
                    <select
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      data-testid={`course-status-${course.code}`}
                      defaultValue={course.status}
                      name="status"
                    >
                      <option value="draft">Bản nháp</option>
                      <option value="active">Đang hoạt động</option>
                      <option value="archived">Đã lưu trữ</option>
                    </select>
                  </label>
                  <CourseCloTableInput defaultItems={course.cloItems} name="cloItemsText" />
                  <CourseAssessmentTableInput defaultItems={course.assessmentComponents} name="assessmentComponentsText" />
                  <div className="md:col-span-2 text-xs text-slate-500">
                    {course.knowledgeBlock ? `Khối kiến thức: ${knowledgeBlockLabels[course.knowledgeBlock]}` : "Chưa có khối kiến thức"} ·{" "}
                    {course.courseType ? `Loại: ${courseTypeLabels[course.courseType]}` : "Chưa có loại học phần"}
                  </div>
                </form>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                    onClick={() => setEditingCourseId(null)}
                    type="button"
                  >
                    Thu gọn
                  </button>
                  <button
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                    data-testid={`update-course-submit-${course.code}`}
                    disabled={updatePending}
                    form={updateFormId}
                    type="submit"
                  >
                    {updatePending ? "Đang cập nhật..." : actorRole === "moderator" ? "Lưu thay đổi và gửi Admin" : "Lưu thay đổi"}
                  </button>
                <form action={archiveAction}>
                  <input name="courseId" type="hidden" value={course.id} />
                  <button
                    className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                    data-testid={`archive-course-submit-${course.code}`}
                    disabled={archivePending}
                    type="submit"
                  >
                    {archivePending ? "Đang lưu trữ..." : "Lưu trữ"}
                  </button>
                </form>
                {actorRole === "admin" ? (
                  <form action={deleteAction}>
                    <input name="courseId" type="hidden" value={course.id} />
                    <button
                      className="rounded-md border border-red-500 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 disabled:opacity-60"
                      disabled={deletePending}
                      type="submit"
                    >
                      {deletePending ? "Đang xóa..." : "Xóa học phần"}
                    </button>
                  </form>
                ) : null}
                </div>
                </>
                ) : null}
              </article>
              );
            })
          )}
        </div>
        {updateState.message ? (
          <p
            className={updateState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}
            data-testid="update-course-message"
          >
            {updateState.message}
          </p>
        ) : null}
        {archiveState.message ? (
          <p
            className={archiveState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}
            data-testid="archive-course-message"
          >
            {archiveState.message}
          </p>
        ) : null}
        {deleteState.message ? (
          <p
            className={deleteState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}
          >
            {deleteState.message}
          </p>
        ) : null}
        {assignState.message ? (
          <p
            className={assignState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}
          >
            {assignState.message}
          </p>
        ) : null}
        {assignTeachersState.message ? (
          <p
            className={assignTeachersState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}
          >
            {assignTeachersState.message}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Tạo học phần</h2>
        <form action={createAction} className="mt-4 grid gap-3 md:grid-cols-2" data-testid="create-course-form" key={createFormKey}>
          <label className="text-sm text-slate-700">
            Mã học phần
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid="create-course-code" name="code" required />
          </label>
          <label className="text-sm text-slate-700">
            Tên học phần
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid="create-course-title" name="title" required />
          </label>
          <label className="text-sm text-slate-700 md:col-span-2">
            Mô tả
            <textarea
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              data-testid="create-course-description"
              name="description"
              rows={3}
            />
          </label>
          <label className="text-sm text-slate-700">
            Số tín chỉ
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" min={1} max={20} name="credits" type="number" />
          </label>
          <label className="text-sm text-slate-700">
            Khối kiến thức
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="general" name="knowledgeBlock">
              <option value="general">Đại cương</option>
              <option value="foundation">Cơ sở ngành</option>
              <option value="major">Ngành/Chuyên ngành</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Loại học phần
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="required" name="courseType">
              <option value="required">Bắt buộc</option>
              <option value="elective">Tự chọn</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Mức hiển thị
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              data-testid="create-course-visibility"
              defaultValue="private"
              name="visibility"
            >
              <option value="private">{visibilityLabels.private}</option>
              <option value="unlisted">{visibilityLabels.unlisted}</option>
              <option value="public_preview">{visibilityLabels.public_preview}</option>
            </select>
          </label>
          {actorRole === "admin" ? (
            <label className="text-sm text-slate-700 md:col-span-2">
              Giảng viên phụ trách
              <select className="mt-1 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" multiple name="teacherIds">
                {teacherOptions.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName ?? teacher.email ?? teacher.id}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {actorRole === "admin" ? (
            <label className="text-sm text-slate-700">
              Trạng thái
              <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="draft" name="status">
                <option value="draft">Bản nháp</option>
                <option value="active">Đang hoạt động</option>
                <option value="archived">Đã lưu trữ</option>
              </select>
            </label>
          ) : null}
          <CourseCloTableInput name="cloItemsText" />
          <CourseAssessmentTableInput name="assessmentComponentsText" />
          <div className="flex items-end">
            <button
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              data-testid="create-course-submit"
              disabled={createPending}
              type="submit"
            >
              {createPending ? "Đang gửi..." : actorRole === "moderator" ? "Gửi Admin duyệt" : "Tạo học phần"}
            </button>
          </div>
        </form>
        {createState.message ? (
          <p
            className={createState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}
            data-testid="create-course-message"
          >
            {createState.message}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-amber-950">Yêu cầu thay đổi học phần</h2>
            <p className="mt-1 text-sm text-amber-800">Mod đề nghị tạo học phần để Admin duyệt; các yêu cầu xóa chỉ Admin được duyệt.</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-sm text-amber-800">{pendingRequests.length} chờ duyệt</span>
        </div>

        <div className="mt-4 space-y-3">
          {changeRequests.length === 0 ? (
            <div className="rounded-md border border-dashed border-amber-300 bg-white/70 p-4 text-sm text-amber-800">
              Chưa có yêu cầu thay đổi học phần.
            </div>
          ) : (
            changeRequests.map((request) => (
              <article className="rounded-md border border-amber-200 bg-white p-4" key={request.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {request.action === "create"
                        ? "Tạo học phần"
                        : request.action === "update"
                          ? "Chỉnh sửa học phần"
                          : request.action === "archive"
                            ? "Lưu trữ học phần"
                            : "Xóa học phần"}:{" "}
                      {request.targetCodeSnapshot} - {request.targetTitleSnapshot}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">Trạng thái: {request.status}</p>
                    {request.action === "create" ? (
                      <p className="mt-1 text-sm text-slate-600">
                        {request.requestedCredits ? `${request.requestedCredits} tín chỉ · ` : ""}
                        {request.requestedKnowledgeBlock ? `${knowledgeBlockLabels[request.requestedKnowledgeBlock]} · ` : ""}
                        {request.requestedCourseType ? courseTypeLabels[request.requestedCourseType] : ""}
                      </p>
                    ) : null}
                    {request.reason ? <p className="mt-1 text-sm text-slate-600">Lý do: {request.reason}</p> : null}
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">{request.status}</span>
                </div>
                {((actorRole === "admin" && request.action !== "update") ||
                  (actorRole === "moderator" && (request.action === "archive" || request.action === "update"))) &&
                request.status === "pending_review" ? (
                  <form action={reviewAction} className="mt-3 flex flex-wrap items-end gap-4">
                    <input name="requestId" type="hidden" value={request.id} />
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Quyết định</span>
                      <select className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="approved" name="decision">
                        <option value="approved">Duyệt</option>
                        <option value="rejected">Từ chối</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm text-slate-700">
                      <span>Ghi chú</span>
                      <input className="min-w-72 rounded-md border border-slate-300 px-3 py-2 text-sm" name="note" />
                    </label>
                    <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={reviewPending} type="submit">
                      {reviewPending ? "Đang lưu..." : "Lưu duyệt"}
                    </button>
                  </form>
                ) : null}
              </article>
            ))
          )}
        </div>
        {reviewState.message ? (
          <p className={reviewState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}>
            {reviewState.message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
