"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { initialCourseActionState } from "@/app/(teacher)/courses/course-action-state";
import {
  archiveCourseAction,
  assignCourseModeratorAction,
  assignCourseTeachersAction,
  createCourseAction,
  reviewCourseChangeRequestAction,
  updateCourseAction,
} from "@/app/(teacher)/courses/actions";
import { getUserRolePresentation } from "@/lib/presentation/user-role";
import type {
  CourseAssessmentComponent,
  CourseAssessmentComponentType,
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

const assessmentComponentTypeLabels: Record<CourseAssessmentComponentType, string> = {
  diagnostic: "Chẩn đoán",
  frequent: "Thường xuyên",
  periodic: "Định kỳ",
  final: "Tổng kết",
};

function courseStatusLabel(status: CourseSummary["status"]): string {
  const labels: Record<CourseSummary["status"], string> = {
    draft: "Bản nháp",
    active: "Đang hoạt động",
    archived: "Đã lưu trữ",
  };

  return labels[status];
}

function CourseMetadataMatrixInput({
  defaultCloItems = [],
  defaultAssessmentComponents = [],
  cloName,
  assessmentName,
}: {
  defaultCloItems?: CourseCloItem[];
  defaultAssessmentComponents?: CourseAssessmentComponent[];
  cloName: string;
  assessmentName: string;
}) {
  const [cloRows, setCloRows] = useState<CourseCloItem[]>(
    defaultCloItems.length > 0 ? defaultCloItems : [{ code: "", description: "" }],
  );
  const [assessmentRows, setAssessmentRows] = useState<CourseAssessmentComponent[]>(
    defaultAssessmentComponents.length > 0 ? defaultAssessmentComponents : [{ type: "diagnostic", weight: 0, cloCodes: [] }],
  );
  const normalizedCloRows = useMemo(
    () => cloRows.map((item) => ({ code: item.code.trim(), description: item.description.trim() })),
    [cloRows],
  );
  const availableCloCodes = useMemo(
    () => normalizedCloRows.map((item) => item.code).filter(Boolean),
    [normalizedCloRows],
  );
  const cloHiddenValue = useMemo(() => JSON.stringify(normalizedCloRows), [normalizedCloRows]);
  const assessmentHiddenValue = useMemo(
    () =>
      JSON.stringify(
        assessmentRows.map((item) => ({
          type: item.type,
          weight: Number.isFinite(Number(item.weight)) ? Number(item.weight) : 0,
          cloCodes: (item.cloCodes ?? []).filter((code) => availableCloCodes.includes(code)),
        })),
      ),
    [assessmentRows, availableCloCodes],
  );

  useEffect(() => {
    setAssessmentRows((currentRows) => {
      let hasChanges = false;
      const nextRows = currentRows.map((row) => {
        const nextCloCodes = (row.cloCodes ?? []).filter((code) => availableCloCodes.includes(code));

        if (nextCloCodes.length !== (row.cloCodes ?? []).length) {
          hasChanges = true;
        }

        return {
          ...row,
          cloCodes: nextCloCodes,
        };
      });

      return hasChanges ? nextRows : currentRows;
    });
  }, [availableCloCodes]);

  return (
    <>
      <div className="md:col-span-2">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">Chuẩn đầu ra học phần</p>
          <button
            className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700"
            onClick={() => setCloRows((currentRows) => [...currentRows, { code: "", description: "" }])}
            type="button"
          >
            Thêm CLO
          </button>
        </div>
        <input name={cloName} readOnly type="hidden" value={cloHiddenValue} />
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
              {cloRows.map((row, rowIndex) => (
                <tr key={`clo-row-${rowIndex}`}>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      onChange={(event) =>
                        setCloRows((currentRows) =>
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
                        setCloRows((currentRows) =>
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
                      disabled={cloRows.length === 1}
                      onClick={() => setCloRows((currentRows) => currentRows.filter((_, currentIndex) => currentIndex !== rowIndex))}
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

      <div className="md:col-span-2">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Thành phần đánh giá</p>
            <p className="text-xs text-slate-500">Chỉ dùng 4 loại cố định và cho phép tích chọn CLO áp dụng theo từng thành phần.</p>
          </div>
          <button
            className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 disabled:opacity-50"
            disabled={assessmentRows.length >= Object.keys(assessmentComponentTypeLabels).length}
            onClick={() => setAssessmentRows((currentRows) => [...currentRows, { type: "frequent", weight: 0, cloCodes: [] }])}
            type="button"
          >
            Thêm thành phần
          </button>
        </div>
        <input name={assessmentName} readOnly type="hidden" value={assessmentHiddenValue} />
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="min-w-48 px-3 py-2 text-left font-medium">Loại đánh giá</th>
                <th className="w-36 px-3 py-2 text-left font-medium">Trọng số (%)</th>
                {availableCloCodes.map((cloCode) => (
                  <th className="w-24 px-3 py-2 text-center font-medium" key={cloCode}>{cloCode}</th>
                ))}
                <th className="w-24 px-3 py-2 text-left font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {assessmentRows.map((row, rowIndex) => {
                const selectedTypes = assessmentRows.map((item) => item.type);

                return (
                  <tr key={`assessment-row-${rowIndex}`}>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        onChange={(event) =>
                          setAssessmentRows((currentRows) =>
                            currentRows.map((currentRow, currentIndex) =>
                              currentIndex === rowIndex
                                ? { ...currentRow, type: event.target.value as CourseAssessmentComponentType }
                                : currentRow,
                            ),
                          )
                        }
                        value={row.type}
                      >
                        {Object.entries(assessmentComponentTypeLabels).map(([value, label]) => (
                          <option
                            disabled={selectedTypes.includes(value as CourseAssessmentComponentType) && row.type !== value}
                            key={value}
                            value={value}
                          >
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        max={100}
                        min={0}
                        onChange={(event) =>
                          setAssessmentRows((currentRows) =>
                            currentRows.map((currentRow, currentIndex) =>
                              currentIndex === rowIndex ? { ...currentRow, weight: Number(event.target.value) } : currentRow,
                            ),
                          )
                        }
                        type="number"
                        value={row.weight}
                      />
                    </td>
                    {availableCloCodes.map((cloCode) => (
                      <td className="px-3 py-2 text-center" key={`${rowIndex}-${cloCode}`}>
                        <input
                          checked={(row.cloCodes ?? []).includes(cloCode)}
                          onChange={(event) =>
                            setAssessmentRows((currentRows) =>
                              currentRows.map((currentRow, currentIndex) => {
                                if (currentIndex !== rowIndex) {
                                  return currentRow;
                                }

                                return {
                                  ...currentRow,
                                  cloCodes: event.target.checked
                                    ? [...(currentRow.cloCodes ?? []), cloCode]
                                    : (currentRow.cloCodes ?? []).filter((code) => code !== cloCode),
                                };
                              }),
                            )
                          }
                          type="checkbox"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <button
                        className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-50"
                        disabled={assessmentRows.length === 1}
                        onClick={() => setAssessmentRows((currentRows) => currentRows.filter((_, currentIndex) => currentIndex !== rowIndex))}
                        type="button"
                      >
                        Bớt
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
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
                  <th className="px-3 py-2 text-left font-medium">CLO áp dụng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {assessmentComponents.map((item) => (
                  <tr key={item.type}>
                    <td className="px-3 py-2 text-slate-700">{assessmentComponentTypeLabels[item.type] ?? item.type}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{item.weight}%</td>
                    <td className="px-3 py-2 text-slate-700">{(item.cloCodes ?? []).length > 0 ? (item.cloCodes ?? []).join(", ") : "-"}</td>
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
  const [reviewState, reviewAction, reviewPending] = useActionState(reviewCourseChangeRequestAction, initialCourseActionState);
  const [assignState, assignAction, assignPending] = useActionState(assignCourseModeratorAction, initialCourseActionState);
  const [assignTeachersState, assignTeachersAction, assignTeachersPending] = useActionState(assignCourseTeachersAction, initialCourseActionState);
  const [assigningCourseId, setAssigningCourseId] = useState<string | null>(null);
  const [assigningTeachersCourseId, setAssigningTeachersCourseId] = useState<string | null>(null);
  const [selectedModeratorByCourseId, setSelectedModeratorByCourseId] = useState<Record<string, string>>({});
  const [selectedTeacherByCourseId, setSelectedTeacherByCourseId] = useState<Record<string, string>>({});
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [createFormKey, setCreateFormKey] = useState(0);
  const previousCreateStatusRef = useRef(createState.status);
  const pendingRequests = changeRequests.filter((request) => request.status === "pending_review");
  const isAdmin = actorRole === "admin";
  const adminRole = getUserRolePresentation("admin");
  const moderatorRole = getUserRolePresentation("moderator");
  const teacherRole = getUserRolePresentation("teacher");

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
              const assignedTeacherIds = (course.assignedTeachers ?? []).map((teacher) => teacher.id);
              const selectedModeratorId = selectedModeratorByCourseId[course.id] ?? (isAssignedToModerator ? course.ownerId : "");
              const selectedTeacherId = selectedTeacherByCourseId[course.id] ?? "";
              const selectedTeacherAlreadyAssigned = selectedTeacherId ? assignedTeacherIds.includes(selectedTeacherId) : false;
              const isEditingCourse = editingCourseId === course.id;
              const updateFormId = `update-course-form-${course.id}`;

              return (
              <article className="rounded-lg border border-slate-200 p-4" data-testid={`course-card-${course.code}`} key={course.id}>
                {!isAdmin ? (
                  <div className="mb-3 flex flex-wrap justify-end gap-2">
                    {actorRole === "moderator" ? (
                      <Link
                        className="rounded-md border border-teal-300 px-3 py-2 text-xs font-medium text-teal-700"
                        href={`/courses/${course.id}/results`}
                      >
                        Xem kết quả
                      </Link>
                    ) : (
                      <Link
                        className="rounded-md border border-teal-300 px-3 py-2 text-xs font-medium text-teal-700"
                        href="/classes"
                      >
                        Tạo/quản lý lớp
                      </Link>
                    )}
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
                        <dt className="text-xs text-slate-500">Giám sát viên quản lý</dt>
                        <dd className="font-medium text-slate-900">{isAssignedToModerator ? course.ownerFullName ?? "Giám sát viên" : "Quản trị viên đang giữ"}</dd>
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
                          <button
                            className="rounded-md border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700"
                            onClick={() => setAssigningTeachersCourseId((currentId) => (currentId === course.id ? null : course.id))}
                            type="button"
                          >
                            Giao giảng dạy
                          </button>
                          {isAssignedToModerator ? (
                            <span className="text-xs text-slate-500">Đang giao quản lý cho {course.ownerFullName ?? moderatorRole.optionLabel}.</span>
                          ) : (
                            <span className="text-xs text-slate-500">{adminRole.optionLabel} đang trực tiếp giữ học phần này.</span>
                          )}
                        </>
                      ) : null}
                      {!isAdmin ? (
                        <button
                          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                          onClick={() => setEditingCourseId(course.id)}
                          type="button"
                        >
                          Sửa học phần
                        </button>
                      ) : null}
                    </div>
                    {isAdmin && assigningCourseId === course.id ? (
                      <form action={assignAction} className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-blue-100 bg-white p-3">
                        <input name="courseId" type="hidden" value={course.id} />
                        <input
                          name="actionMode"
                          type="hidden"
                          value={isAssignedToModerator && selectedModeratorId === course.ownerId ? "remove" : "save"}
                        />
                        <label className="min-w-72 text-sm text-slate-700">
                          Chọn Giám sát viên quản lý
                          <select
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            name="moderatorId"
                            onChange={(event) =>
                              setSelectedModeratorByCourseId((current) => ({
                                ...current,
                                [course.id]: event.target.value,
                              }))
                            }
                            value={selectedModeratorId}
                          >
                            <option value="">Chọn Giám sát viên</option>
                            {moderatorOptions.map((moderator) => (
                              <option key={moderator.id} value={moderator.id}>
                                {moderator.fullName ?? moderator.email ?? moderator.id}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                          disabled={assignPending || !selectedModeratorId}
                          type="submit"
                        >
                          {assignPending
                            ? "Đang lưu..."
                            : isAssignedToModerator && selectedModeratorId === course.ownerId
                              ? "Bỏ phân quyền"
                              : "Lưu quản lý"}
                        </button>
                        {moderatorOptions.length === 0 ? (
                          <p className="text-xs text-amber-700">Chưa có tài khoản Giám sát viên đang hoạt động, bạn chỉ có thể giữ học phần ở quyền Quản trị viên.</p>
                        ) : null}
                      </form>
                    ) : null}
                    {isAdmin && assigningTeachersCourseId === course.id ? (
                      <form action={assignTeachersAction} className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-emerald-100 bg-white p-3">
                        <input name="courseId" type="hidden" value={course.id} />
                        {assignedTeacherIds.map((teacherId) => (
                          <input key={`${course.id}-${teacherId}`} name="currentTeacherIds" type="hidden" value={teacherId} />
                        ))}
                        <input name="actionMode" type="hidden" value={selectedTeacherAlreadyAssigned ? "remove" : "add"} />
                        <label className="min-w-72 text-sm text-slate-700">
                          Chọn giảng viên giảng dạy
                          <select
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            name="teacherId"
                            onChange={(event) =>
                              setSelectedTeacherByCourseId((current) => ({
                                ...current,
                                [course.id]: event.target.value,
                              }))
                            }
                            value={selectedTeacherId}
                          >
                            <option value="">Chọn giảng viên</option>
                            {teacherOptions.map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>
                                {teacher.fullName ?? teacher.email ?? teacher.id}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                          disabled={assignTeachersPending || !selectedTeacherId}
                          type="submit"
                        >
                          {assignTeachersPending
                            ? "Đang lưu..."
                            : selectedTeacherAlreadyAssigned
                              ? "Bỏ phân quyền"
                              : "Lưu giảng dạy"}
                        </button>
                        <div className="text-xs text-slate-500">
                          <p className="text-xs text-slate-500">
                            Có thể chọn nhiều <span className={teacherRole.emphasisClassName}>{teacherRole.label}</span> cho cùng một học phần.
                          </p>
                        </div>
                        {teacherOptions.length === 0 ? (
                          <p className="mt-2 text-xs text-amber-700">Chưa có tài khoản giảng viên đang hoạt động để giao học phần.</p>
                        ) : null}
                      </form>
                    ) : null}
                    {isAdmin && isAssignedToModerator ? (
                      <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        <span className={adminRole.emphasisClassName}>{adminRole.label}</span> chỉ theo dõi học phần, cập nhật quyền{" "}
                        <span className={moderatorRole.emphasisClassName}>{moderatorRole.label}</span> quản lý và phân công{" "}
                        <span className={teacherRole.emphasisClassName}>{teacherRole.label}</span> giảng dạy tại đây; các thay đổi nội dung học phần
                        được xử lý ở luồng <span className={moderatorRole.emphasisClassName}>{moderatorRole.label}</span>.
                      </p>
                    ) : null}
                    {isAdmin && !isAssignedToModerator ? (
                      <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        Học phần này hiện không giao cho <span className={moderatorRole.emphasisClassName}>{moderatorRole.label}</span> nào.{" "}
                        <span className={adminRole.emphasisClassName}>{adminRole.label}</span> đang giữ quyền quan sát và có thể gán lại bất cứ lúc nào.
                      </p>
                    ) : null}
                  </div>

                {!isAdmin && isEditingCourse ? (
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
                  <CourseMetadataMatrixInput
                    assessmentName="assessmentComponentsText"
                    cloName="cloItemsText"
                    defaultAssessmentComponents={course.assessmentComponents}
                    defaultCloItems={course.cloItems}
                  />
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
                    {updatePending ? "Đang cập nhật..." : "Lưu thay đổi"}
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

      {!isAdmin ? (
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
          <CourseMetadataMatrixInput assessmentName="assessmentComponentsText" cloName="cloItemsText" />
          <div className="flex items-end">
            <button
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              data-testid="create-course-submit"
              disabled={createPending}
              type="submit"
            >
              {createPending ? "Đang gửi..." : "Tạo học phần"}
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
      ) : null}

      {!isAdmin ? (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-amber-950">Ghi chú thay đổi học phần</h2>
            <p className="mt-1 text-sm text-amber-800">{moderatorRole.optionLabel} quản lý học phần trực tiếp; khu vực này chỉ còn là chỗ hiển thị lịch sử hoặc ghi chú nếu có dữ liệu cũ.</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-sm text-amber-800">{pendingRequests.length} mục lịch sử</span>
        </div>

        <div className="mt-4 space-y-3">
          {changeRequests.length === 0 ? (
            <div className="rounded-md border border-dashed border-amber-300 bg-white/70 p-4 text-sm text-amber-800">
              Chưa có lịch sử thay đổi học phần.
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
                {actorRole === "moderator" && (request.action === "archive" || request.action === "update") && request.status === "pending_review" ? (
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
                      {reviewPending ? "Đang lưu..." : "Lưu"}
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
      ) : null}
    </div>
  );
}
