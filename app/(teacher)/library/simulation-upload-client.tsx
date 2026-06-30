"use client";

import { useActionState, useState } from "react";

import {
  acceptNativeSimulationIntegrationAction,
  linkSimulationUploadToCourseAction,
  requestNativeSimulationIntegrationAction,
  reviewNativeSimulationIntegrationAction,
  reviewSimulationUploadAction,
  uploadSimulationPackageAction,
} from "@/app/(teacher)/library/actions";
import { initialLibraryActionState } from "@/app/(teacher)/library/library-action-state";
import { getUserRolePresentation } from "@/lib/presentation/user-role";
import type { UserRole } from "@/lib/types/auth";
import type { CourseSummary } from "@/lib/types/course";
import type { LibraryCategoryItem, LibrarySimulationUploadItem } from "@/lib/types/library";

type SimulationUploadClientProps = {
  actorRole: UserRole;
  categories: LibraryCategoryItem[];
  courses: CourseSummary[];
  uploads: LibrarySimulationUploadItem[];
};

function reviewStatusLabel(status: LibrarySimulationUploadItem["reviewStatus"]): string {
  const labels: Record<LibrarySimulationUploadItem["reviewStatus"], string> = {
    pending_review: "Chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Bị từ chối",
  };

  return labels[status];
}

function nativeStatusLabel(status: LibrarySimulationUploadItem["nativeIntegrationStatus"]): string {
  const labels: Record<LibrarySimulationUploadItem["nativeIntegrationStatus"], string> = {
    not_requested: "Chưa đề xuất",
    requested: "Đã đề xuất",
    accepted: "Đã nhận xử lý",
    rejected: "Không chuyển native",
  };

  return labels[status];
}

function formatFileSize(fileSize: number): string {
  if (fileSize < 1024) {
    return `${fileSize} B`;
  }

  if (fileSize < 1024 * 1024) {
    return `${Math.round(fileSize / 1024)} KB`;
  }

  return `${(fileSize / 1024 / 1024).toFixed(1)} MB`;
}

export function SimulationUploadClient({ actorRole, categories, courses, uploads }: SimulationUploadClientProps) {
  const [uploadState, uploadAction, isUploading] = useActionState(uploadSimulationPackageAction, initialLibraryActionState);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [reviewState, reviewAction, isReviewing] = useActionState(reviewSimulationUploadAction, initialLibraryActionState);
  const [linkState, linkAction, isLinking] = useActionState(linkSimulationUploadToCourseAction, initialLibraryActionState);
  const [nativeState, nativeAction, isRequestingNative] = useActionState(
    requestNativeSimulationIntegrationAction,
    initialLibraryActionState,
  );
  const [nativeAcceptState, nativeAcceptAction, isAcceptingNative] = useActionState(
    acceptNativeSimulationIntegrationAction,
    initialLibraryActionState,
  );
  const [nativeReviewState, nativeReviewAction, isReviewingNative] = useActionState(
    reviewNativeSimulationIntegrationAction,
    initialLibraryActionState,
  );
  const canReview = actorRole === "moderator" || actorRole === "admin";
  const canReviewNative = actorRole === "admin";
  const canRequestNative = actorRole === "moderator";
  const canLinkToCourse = actorRole === "moderator";
  const isStaffUploader = actorRole === "moderator" || actorRole === "admin";
  const moderatorRole = getUserRolePresentation("moderator");
  const adminRole = getUserRolePresentation("admin");

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tải mô phỏng HTML</h2>
          <p className="mt-1 text-sm text-slate-600">
            {isStaffUploader
              ? actorRole === "moderator"
                ? <><span className={moderatorRole.emphasisClassName}>{moderatorRole.label}</span> tải mô phỏng trực tiếp vào Thư viện dùng chung và có thể chọn <span className={moderatorRole.emphasisClassName}>TÀI LIỆU DÙNG CHUNG</span> hoặc một học phần mình đang quản lý.</>
                : <><span className={adminRole.emphasisClassName}>{adminRole.label}</span> tải mô phỏng trực tiếp vào Thư viện dùng chung và cần chọn đúng học phần.</>
              : "Bỏ trống học phần để lưu mô phỏng vào thư viện cá nhân; chọn học phần để gửi duyệt vào Thư viện dùng chung."}
          </p>
        </div>
        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-800">V1: mở bằng tab mới</span>
      </div>

      <form action={uploadAction} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Học phần</span>
          <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="courseId" required={isStaffUploader}>
            {isStaffUploader ? (
              <>
                <option value="__other">Tài liệu dùng chung</option>
              </>
            ) : (
              <option value="">Không chọn - lưu vào thư viện cá nhân</option>
            )}
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} - {course.title}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500">
            {isStaffUploader
              ? actorRole === "moderator"
                ? <><span className={moderatorRole.emphasisClassName}>{moderatorRole.label}</span> có thể chọn <span className={moderatorRole.emphasisClassName}>TÀI LIỆU DÙNG CHUNG</span> hoặc một học phần cụ thể do mình quản lý; mô phỏng được duyệt sẵn khi tải lên.</>
                : <><span className={adminRole.emphasisClassName}>{adminRole.label}</span> cần chọn một học phần cụ thể; mô phỏng được duyệt sẵn khi tải lên.</>
              : "Chọn học phần để gửi yêu cầu duyệt vào Thư viện dùng chung của học phần."}
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Tiêu đề mô phỏng</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            maxLength={120}
            name="title"
            placeholder="Ví dụ: Mô phỏng Vật lý 6"
            required
          />
        </label>

        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Mô tả</span>
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            maxLength={500}
            name="description"
            placeholder="Ghi chú ngắn về nội dung mô phỏng."
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Danh mục</span>
          <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="categoryId">
            <option value="">Chọn danh mục</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Tags</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            name="tags"
            placeholder="Ví dụ: vật lý; tương tác; mô phỏng"
          />
        </label>

        <div className="block">
          <span className="text-sm font-medium text-slate-700">Tệp HTML</span>
          <div className="mt-1 flex w-full flex-wrap items-center gap-3 rounded-md border border-slate-300 px-3 py-2 text-sm">
            <label className="inline-flex cursor-pointer rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" htmlFor="simulation-file-input">
              Chọn file
            </label>
            <input
              accept=".html,text/html"
              className="sr-only"
              id="simulation-file-input"
              name="file"
              onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name ?? "")}
              required
              type="file"
            />
            <span className="text-slate-500">{selectedFileName || "Chưa chọn file"}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 md:col-span-2">
          <p className="max-w-3xl text-xs text-slate-500">
            {isStaffUploader
              ? "Định dạng hỗ trợ: HTML độc lập, tối đa 19 MB. Mô phỏng được đưa thẳng vào Thư viện và có thể mở bằng tab mới."
              : "Định dạng hỗ trợ: HTML độc lập, tối đa 19 MB. Mô phỏng cá nhân có thể mở bằng tab mới; mô phỏng chọn học phần sẽ chờ duyệt trước khi đưa vào Thư viện dùng chung."}
          </p>
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={isUploading}
            type="submit"
          >
            {isUploading ? "Đang tải..." : "Tải mô phỏng"}
          </button>
        </div>
      </form>

      {uploadState.message ? (
        <p
          className={`mt-3 rounded-md border p-3 text-sm ${
            uploadState.status === "success" ? "border-teal-200 bg-teal-50 text-teal-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {uploadState.message}
        </p>
      ) : null}

      {actorRole === "admin" ? (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-slate-900">Mô phỏng đã tải lên</h3>
          {uploads.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600">
              Chưa có mô phỏng HTML nào trong Thư viện.
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {uploads.map((upload) => (
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={upload.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-slate-900">{upload.title}</h4>
                      <p className="mt-1 text-xs text-slate-500">
                        {upload.originalFileName} · {formatFileSize(upload.fileSize)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-700">
                        {reviewStatusLabel(upload.reviewStatus)}
                      </span>
                      <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800">
                        Native: {nativeStatusLabel(upload.nativeIntegrationStatus)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{upload.description ?? "Chưa có mô tả."}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Danh mục: {upload.categoryName ?? "Chưa phân loại"}
                    {upload.tags.length > 0 ? ` · Tags: ${upload.tags.join("; ")}` : ""}
                  </p>
                  {upload.reviewNote ? <p className="mt-2 text-xs text-amber-800">Ghi chú duyệt: {upload.reviewNote}</p> : null}

                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    {upload.reviewStatus === "approved" ? (
                      <a
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                        href={`/api/library/simulation-uploads/${upload.id}/open`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Mở thử
                      </a>
                    ) : null}

                    {canLinkToCourse && upload.reviewStatus === "approved" ? (
                      <form action={linkAction} className="flex flex-wrap items-end gap-2">
                        <input name="uploadId" type="hidden" value={upload.id} />
                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">Học phần</span>
                          <select
                            className="mt-1 min-w-56 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                            name="courseId"
                            required
                          >
                            <option value="">Chọn học phần</option>
                            {courses.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.code} - {course.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="rounded-md bg-teal-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                          disabled={isLinking || courses.length === 0}
                          type="submit"
                        >
                          Gắn vào học phần
                        </button>
                      </form>
                    ) : null}

                    {canReview && upload.reviewStatus === "pending_review" ? (
                      <form action={reviewAction} className="flex flex-wrap items-end gap-2">
                        <input name="uploadId" type="hidden" value={upload.id} />
                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">Duyệt</span>
                          <select className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs" name="reviewStatus">
                            <option value="approved">Duyệt</option>
                            <option value="rejected">Từ chối</option>
                          </select>
                        </label>
                        <input
                          className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                          name="reviewNote"
                          placeholder="Ghi chú"
                        />
                        <button
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-60"
                          disabled={isReviewing}
                          type="submit"
                        >
                          Lưu duyệt
                        </button>
                      </form>
                    ) : null}

                    {actorRole === "admin" ? (
                      <form action={nativeAcceptAction}>
                        <input name="uploadId" type="hidden" value={upload.id} />
                        <button
                          className="rounded-md bg-indigo-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                          disabled={isAcceptingNative || upload.nativeIntegrationStatus === "accepted"}
                          type="submit"
                        >
                          Tích hợp native
                        </button>
                      </form>
                    ) : canRequestNative ? (
                      <form action={nativeAction}>
                        <input name="uploadId" type="hidden" value={upload.id} />
                        <button
                          className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-800 disabled:opacity-60"
                          disabled={isRequestingNative || upload.nativeIntegrationStatus === "requested"}
                          type="submit"
                        >
                          Đề xuất tích hợp native
                        </button>
                      </form>
                    ) : null}
                    {canReviewNative && upload.nativeIntegrationStatus === "requested" ? (
                      <form action={nativeReviewAction} className="flex flex-wrap items-end gap-2">
                        <input name="uploadId" type="hidden" value={upload.id} />
                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">Tích hợp native</span>
                          <select
                            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                            name="nativeIntegrationStatus"
                          >
                            <option value="accepted">Nhận xử lý</option>
                            <option value="rejected">Từ chối</option>
                          </select>
                        </label>
                        <input
                          className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                          name="reviewNote"
                          placeholder="Ghi chú native"
                        />
                        <button
                          className="rounded-md bg-indigo-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                          disabled={isReviewingNative}
                          type="submit"
                        >
                          Lưu native
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {[reviewState, linkState, nativeState, nativeAcceptState, nativeReviewState].map((state, index) =>
        state.message ? (
          <p
            className={`mt-3 rounded-md border p-3 text-sm ${
              state.status === "success" ? "border-teal-200 bg-teal-50 text-teal-800" : "border-red-200 bg-red-50 text-red-700"
            }`}
            key={`${state.status}-${index}`}
          >
            {state.message}
          </p>
        ) : null,
      )}
    </section>
  );
}
