"use client";

import { useActionState } from "react";

import {
  archiveLibraryCategoryAction,
  upsertLibraryCategoryAction,
} from "@/app/(teacher)/library/actions";
import { initialLibraryActionState } from "@/app/(teacher)/library/library-action-state";
import type { LibraryCategoryItem } from "@/lib/types/library";

type LibraryCategoryManagerClientProps = {
  categories: LibraryCategoryItem[];
};

export function LibraryCategoryManagerClient({ categories }: LibraryCategoryManagerClientProps) {
  const [upsertState, upsertAction, isSaving] = useActionState(upsertLibraryCategoryAction, initialLibraryActionState);
  const [archiveState, archiveAction, isArchiving] = useActionState(archiveLibraryCategoryAction, initialLibraryActionState);

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Danh mục Thư viện</h2>
          <p className="mt-1 text-sm text-slate-600">Mod/Admin quản lý danh sách danh mục dùng khi tải tài nguyên lên.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{categories.length} danh mục</span>
      </div>

      <form action={upsertAction} className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_140px_auto]">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Tên danh mục</span>
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" maxLength={80} name="name" required />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Mô tả</span>
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" maxLength={255} name="description" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Thứ tự</span>
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="sortOrder" type="number" />
        </label>
        <button className="self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={isSaving} type="submit">
          Lưu danh mục
        </button>
      </form>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {categories.map((category) => (
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={category.id}>
            <form action={upsertAction} className="grid gap-2">
              <input name="categoryId" type="hidden" value={category.id} />
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Tên</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  defaultValue={category.name}
                  maxLength={80}
                  name="name"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Mô tả</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  defaultValue={category.description ?? ""}
                  maxLength={255}
                  name="description"
                />
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-600">Thứ tự</span>
                  <input
                    className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    defaultValue={category.sortOrder}
                    name="sortOrder"
                    type="number"
                  />
                </label>
                <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-60" disabled={isSaving} type="submit">
                  Cập nhật
                </button>
              </div>
            </form>
            <form action={archiveAction} className="mt-2">
              <input name="categoryId" type="hidden" value={category.id} />
              <button className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-60" disabled={isArchiving} type="submit">
                Lưu trữ danh mục
              </button>
            </form>
          </article>
        ))}
      </div>

      {[upsertState, archiveState].map((state, index) =>
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
