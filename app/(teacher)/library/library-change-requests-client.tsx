"use client";

import { useActionState } from "react";

import {
  applyAdminLibraryResourceActionForm,
  createLibraryArchiveRequestAction,
  reviewLibraryArchiveRequestAction,
} from "@/app/(teacher)/library/actions";
import { initialLibraryActionState } from "@/app/(teacher)/library/library-action-state";
import type { UserRole } from "@/lib/types/auth";
import type { LibraryChangeRequestItem, LibraryMaterialItem, LibrarySimulationItem } from "@/lib/types/library";

type LibraryChangeRequestsClientProps = {
  actorRole: UserRole;
  materials: LibraryMaterialItem[];
  simulations: LibrarySimulationItem[];
  requests: LibraryChangeRequestItem[];
};

function targetTypeLabel(targetType: LibraryChangeRequestItem["targetType"]): string {
  return targetType === "material" ? "Tài liệu" : "Mô phỏng";
}

function statusLabel(status: LibraryChangeRequestItem["status"]): string {
  const labels: Record<LibraryChangeRequestItem["status"], string> = {
    pending_review: "Chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Bị từ chối",
  };

  return labels[status];
}

function actionLabel(action: LibraryChangeRequestItem["action"]): string {
  return action === "delete" ? "Xóa" : "Ẩn";
}

export function LibraryChangeRequestsClient({
  actorRole,
  materials,
  simulations,
  requests,
}: LibraryChangeRequestsClientProps) {
  const [createState, createAction, isCreating] = useActionState(createLibraryArchiveRequestAction, initialLibraryActionState);
  const [directState, directAction, isApplyingDirect] = useActionState(
    applyAdminLibraryResourceActionForm,
    initialLibraryActionState,
  );
  const [reviewState, reviewAction, isReviewing] = useActionState(reviewLibraryArchiveRequestAction, initialLibraryActionState);
  const canReview = actorRole === "moderator" || actorRole === "admin";
  const isAdmin = actorRole === "admin";
  const resourceAction = isAdmin ? directAction : createAction;
  const isSubmittingResourceAction = isAdmin ? isApplyingDirect : isCreating;

  return (
    <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-amber-950">Duyệt xóa/ẩn tài nguyên</h2>
          <p className="mt-1 text-sm text-amber-900">
            {isAdmin
              ? "Admin ẩn hoặc xóa tài nguyên trực tiếp, không cần tạo yêu cầu duyệt."
              : "Ẩn tài nguyên do Mod/Admin duyệt. Xóa tài nguyên chỉ Admin được duyệt."}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800">
          {requests.filter((request) => request.status === "pending_review").length} chờ duyệt
        </span>
      </div>

      <form action={resourceAction} className="mt-4 grid gap-4 lg:grid-cols-[170px_1fr_1fr_auto]">
        <input name="targetType" type="hidden" value="material" />
        <label className="block">
          <span className="text-xs font-medium text-amber-900">Thao tác</span>
          <select className="mt-1 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm" name="action">
            <option value="archive">Ẩn</option>
            <option value="delete">Xóa</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-amber-900">Tài liệu</span>
          <select className="mt-1 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm" name="targetId" required>
            <option value="">Chọn tài liệu</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.title} · {material.courseCode || material.courseId}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-amber-900">Lý do</span>
          <input
            className="mt-1 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
            maxLength={255}
            name="reason"
            placeholder="Ví dụ: tài liệu cũ, cần thay bản mới"
          />
        </label>
        <button
          className="self-end rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={isSubmittingResourceAction}
          type="submit"
        >
          {isAdmin ? "Thực hiện" : "Gửi yêu cầu"}
        </button>
      </form>

      <form action={resourceAction} className="mt-4 grid gap-4 lg:grid-cols-[170px_1fr_1fr_auto]">
        <input name="targetType" type="hidden" value="simulation" />
        <label className="block">
          <span className="text-xs font-medium text-amber-900">Thao tác</span>
          <select className="mt-1 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm" name="action">
            <option value="archive">Ẩn</option>
            <option value="delete">Xóa</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-amber-900">Mô phỏng</span>
          <select className="mt-1 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm" name="targetId" required>
            <option value="">Chọn mô phỏng</option>
            {simulations.map((simulation) => (
              <option key={simulation.id} value={simulation.id}>
                {simulation.title} · {simulation.courseCode || simulation.courseId}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-amber-900">Lý do</span>
          <input
            className="mt-1 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
            maxLength={255}
            name="reason"
            placeholder="Ví dụ: mô phỏng không còn phù hợp"
          />
        </label>
        <button
          className="self-end rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={isSubmittingResourceAction}
          type="submit"
        >
          {isAdmin ? "Thực hiện" : "Gửi yêu cầu"}
        </button>
      </form>

      {[createState, directState].map((state, index) =>
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

      <div className="mt-5">
        <h3 className="text-base font-semibold text-amber-950">Yêu cầu đã tạo</h3>
        {requests.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-amber-300 bg-white/70 p-4 text-sm text-amber-900">
            Chưa có yêu cầu ẩn tài nguyên.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {requests.map((request) => (
              <article className="rounded-lg border border-amber-200 bg-white p-4" key={request.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {actionLabel(request.action)} {targetTypeLabel(request.targetType).toLowerCase()}: {request.targetTitleSnapshot}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{request.targetCourseLabelSnapshot ?? "Không có học phần"}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                    {statusLabel(request.status)}
                  </span>
                </div>
                {request.reason ? <p className="mt-2 text-sm text-slate-700">Lý do: {request.reason}</p> : null}
                {request.reviewNote ? <p className="mt-1 text-sm text-slate-700">Ghi chú duyệt: {request.reviewNote}</p> : null}
                {canReview && request.status === "pending_review" && (request.action !== "delete" || actorRole === "admin") ? (
                  <form action={reviewAction} className="mt-4 flex flex-wrap items-center gap-4">
                    <input name="requestId" type="hidden" value={request.id} />
                    <label className="flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-600">Quyết định</span>
                      <select className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs" name="status">
                        <option value="approved">Duyệt và {request.action === "delete" ? "xóa" : "ẩn"}</option>
                        <option value="rejected">Từ chối</option>
                      </select>
                    </label>
                    <input className="rounded-md border border-slate-300 px-3 py-2 text-xs" name="reviewNote" placeholder="Ghi chú" />
                    <button
                      className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                      disabled={isReviewing}
                      type="submit"
                    >
                      Lưu duyệt
                    </button>
                  </form>
                ) : null}
                {canReview && request.status === "pending_review" && request.action === "delete" && actorRole !== "admin" ? (
                  <p className="mt-3 text-xs font-medium text-amber-800">Chỉ Admin được duyệt yêu cầu xóa tài nguyên.</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>

      {reviewState.message ? (
        <p
          className={`mt-3 rounded-md border p-3 text-sm ${
            reviewState.status === "success" ? "border-teal-200 bg-teal-50 text-teal-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {reviewState.message}
        </p>
      ) : null}
    </section>
  );
}
