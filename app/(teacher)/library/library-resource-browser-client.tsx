"use client";

import { useActionState, useMemo, useState } from "react";

import { deletePersonalLibraryResourceAction, reviewMaterialAction } from "@/app/(teacher)/library/actions";
import { initialLibraryActionState } from "@/app/(teacher)/library/library-action-state";
import type { UserRole } from "@/lib/types/auth";
import type { CourseSummary } from "@/lib/types/course";
import type {
  LibraryCategoryItem,
  LibraryMaterialItem,
  LibrarySimulationItem,
  LibrarySimulationUploadItem,
} from "@/lib/types/library";

type LibraryResourceBrowserClientProps = {
  actorId: string;
  actorRole: UserRole;
  categories: LibraryCategoryItem[];
  courses: CourseSummary[];
  materials: LibraryMaterialItem[];
  simulations: LibrarySimulationItem[];
  simulationUploads: LibrarySimulationUploadItem[];
};

function formatFileSize(fileSize: number): string {
  if (fileSize < 1024) {
    return `${fileSize} B`;
  }

  if (fileSize < 1024 * 1024) {
    return `${Math.round(fileSize / 1024)} KB`;
  }

  return `${(fileSize / 1024 / 1024).toFixed(1)} MB`;
}

function tagText(tags: string[]): string {
  return tags.length > 0 ? tags.join("; ") : "Chưa có tag";
}

function materialReviewStatusLabel(status: LibraryMaterialItem["reviewStatus"]): string {
  if (status === "approved") {
    return "Đã duyệt";
  }

  if (status === "pending_review") {
    return "Chờ duyệt";
  }

  return "Bị từ chối";
}

function matchesFilters(
  resource: { categoryId: string | null; courseId?: string | null; requestedCourseId?: string | null; tags: string[]; title: string; description: string | null },
  categoryId: string,
  courseId: string,
  tagQuery: string,
): boolean {
  const normalizedTagQuery = tagQuery.trim().toLowerCase();
  const matchesCategory = !categoryId || resource.categoryId === categoryId;
  const resourceCourseId = resource.courseId ?? resource.requestedCourseId ?? "";
  const matchesCourse = !courseId || resourceCourseId === courseId;
  const haystack = [resource.title, resource.description ?? "", ...resource.tags].join(" ").toLowerCase();
  const matchesTag = !normalizedTagQuery || haystack.includes(normalizedTagQuery);

  return matchesCategory && matchesCourse && matchesTag;
}

export function LibraryResourceBrowserClient({
  actorId,
  actorRole,
  categories,
  courses,
  materials,
  simulations,
  simulationUploads,
}: LibraryResourceBrowserClientProps) {
  const [categoryId, setCategoryId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const [reviewMaterialState, reviewMaterialFormAction, isReviewingMaterial] = useActionState(
    reviewMaterialAction,
    initialLibraryActionState,
  );
  const [deletePersonalState, deletePersonalFormAction, isDeletingPersonal] = useActionState(
    deletePersonalLibraryResourceAction,
    initialLibraryActionState,
  );
  const canReview = actorRole === "moderator" || actorRole === "admin";

  const filteredMaterials = useMemo(
    () => materials.filter((material) => matchesFilters(material, categoryId, courseId, tagQuery)),
    [categoryId, courseId, materials, tagQuery],
  );
  const filteredSimulations = useMemo(
    () => simulations.filter((simulation) => matchesFilters(simulation, categoryId, courseId, tagQuery)),
    [categoryId, courseId, simulations, tagQuery],
  );
  const filteredUploads = useMemo(
    () => simulationUploads.filter((upload) => matchesFilters(upload, categoryId, courseId, tagQuery)),
    [categoryId, courseId, simulationUploads, tagQuery],
  );

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tài nguyên trong Thư viện</h2>
          <p className="mt-1 text-sm text-slate-600">Tìm theo danh mục hoặc tag, sau đó thêm/bớt tài nguyên tại từng lớp học.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Lọc theo danh mục</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            onChange={(event) => setCategoryId(event.target.value)}
            value={categoryId}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Lọc theo học phần</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            onChange={(event) => setCourseId(event.target.value)}
            value={courseId}
          >
            <option value="">Tất cả học phần</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} - {course.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Tìm theo tag hoặc tiêu đề</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setTagQuery(event.target.value)}
            placeholder="Ví dụ: vật lý, chương 7, mô phỏng"
            value={tagQuery}
          />
        </label>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="flex h-[38rem] flex-col rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-amber-950">Tài liệu</h3>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800">
              {filteredMaterials.length}/{materials.length}
            </span>
          </div>

          {filteredMaterials.length === 0 ? (
            <p className="mt-3 flex-1 rounded-md border border-dashed border-amber-300 bg-white/70 p-4 text-sm text-amber-900">
              Không có tài liệu phù hợp.
            </p>
          ) : (
            <div className="mt-3 grid flex-1 content-start gap-3 overflow-y-auto pr-2">
              {filteredMaterials.map((material) => (
                <article
                  className={`rounded-lg border bg-white p-4 ${
                    material.reviewStatus === "rejected" ? "border-rose-200 bg-rose-50/70" : "border-amber-200"
                  }`}
                  key={material.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-slate-900">{material.title}</h4>
                      <p className="mt-1 text-xs text-slate-500">
                        {material.courseCode ? `${material.courseCode} - ${material.courseTitle}` : "Thư viện cá nhân"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        material.reviewStatus === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : material.reviewStatus === "pending_review"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {materialReviewStatusLabel(material.reviewStatus)}
                    </span>
                  </div>
                  {material.reviewStatus === "rejected" ? (
                    <>
                      <p className="mt-3 text-sm text-rose-700">
                        Tài liệu này đã bị từ chối duyệt và không hiển thị như một tài nguyên dùng chung.
                      </p>
                      {material.reviewNote ? <p className="mt-2 text-xs text-rose-600">Ghi chú: {material.reviewNote}</p> : null}
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-sm text-slate-600">{material.description ?? "Chưa có mô tả."}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Danh mục: {material.categoryName ?? "Chưa phân loại"} · {formatFileSize(material.fileSize)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Tags: {tagText(material.tags)}</p>
                    </>
                  )}
                  {actorRole === "teacher" && !material.courseId && material.uploadedBy === actorId ? (
                    <form className="mt-3" action={deletePersonalFormAction}>
                      <input name="targetType" type="hidden" value="material" />
                      <input name="targetId" type="hidden" value={material.id} />
                      <button
                        className="rounded-md border border-red-300 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-60"
                        disabled={isDeletingPersonal}
                        type="submit"
                      >
                        Xóa khỏi thư viện cá nhân
                      </button>
                    </form>
                  ) : null}
                  {canReview && material.reviewStatus === "pending_review" ? (
                    <form className="mt-3 flex flex-wrap items-end gap-2" action={reviewMaterialFormAction}>
                      <input name="materialId" type="hidden" value={material.id} />
                      <label className="text-xs text-slate-600">
                        Duyệt
                        <select className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-xs" name="reviewStatus">
                          <option value="approved">Duyệt</option>
                          <option value="rejected">Từ chối</option>
                        </select>
                      </label>
                      <input className="rounded-md border border-slate-300 px-3 py-2 text-xs" name="reviewNote" placeholder="Ghi chú" />
                      <button
                        className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                        disabled={isReviewingMaterial}
                        type="submit"
                      >
                        Lưu duyệt
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="flex h-[38rem] flex-col rounded-lg border border-sky-200 bg-sky-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-sky-950">Mô phỏng</h3>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-sky-800">
              {filteredSimulations.length + filteredUploads.length}/{simulations.length + simulationUploads.length}
            </span>
          </div>

          {filteredSimulations.length + filteredUploads.length === 0 ? (
            <p className="mt-3 flex-1 rounded-md border border-dashed border-sky-300 bg-white/70 p-4 text-sm text-sky-900">
              Không có mô phỏng phù hợp.
            </p>
          ) : (
            <div className="mt-3 grid flex-1 content-start gap-3 overflow-y-auto pr-2">
              {filteredSimulations.map((simulation) => (
                <article className="rounded-lg border border-sky-200 bg-white p-4" key={simulation.id}>
                  <h4 className="font-semibold text-slate-900">{simulation.title}</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Widget · {simulation.courseCode ? `${simulation.courseCode} - ${simulation.courseTitle}` : simulation.courseId}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">{simulation.description ?? "Chưa có mô tả."}</p>
                  <p className="mt-2 text-xs text-slate-500">Danh mục: {simulation.categoryName ?? "Chưa phân loại"}</p>
                  <p className="mt-1 text-xs text-slate-500">Tags: {tagText(simulation.tags)}</p>
                </article>
              ))}
              {filteredUploads.map((upload) => (
                <article className="rounded-lg border border-sky-200 bg-white p-4" key={upload.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-slate-900">{upload.title}</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      HTML độc lập · {formatFileSize(upload.fileSize)}
                      {upload.requestedCourseCode ? ` · ${upload.requestedCourseCode} - ${upload.requestedCourseTitle}` : " · Thư viện cá nhân"}
                    </p>
                    </div>
                    {upload.reviewStatus === "approved" ? (
                      <a className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700" href={`/api/library/simulation-uploads/${upload.id}/open`} rel="noreferrer" target="_blank">
                        Mở thử
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{upload.description ?? "Chưa có mô tả."}</p>
                  <p className="mt-2 text-xs text-slate-500">Danh mục: {upload.categoryName ?? "Chưa phân loại"}</p>
                  <p className="mt-1 text-xs text-slate-500">Tags: {tagText(upload.tags)}</p>
                  {actorRole === "teacher" && !upload.requestedCourseId && upload.uploadedBy === actorId ? (
                    <form action={deletePersonalFormAction} className="mt-3">
                      <input name="targetType" type="hidden" value="simulation_upload" />
                      <input name="targetId" type="hidden" value={upload.id} />
                      <button
                        className="rounded-md border border-red-300 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-60"
                        disabled={isDeletingPersonal}
                        type="submit"
                      >
                        Xóa khỏi thư viện cá nhân
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      {reviewMaterialState.message ? (
        <p className={reviewMaterialState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}>
          {reviewMaterialState.message}
        </p>
      ) : null}
      {deletePersonalState.message ? (
        <p className={deletePersonalState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}>
          {deletePersonalState.message}
        </p>
      ) : null}
    </section>
  );
}
