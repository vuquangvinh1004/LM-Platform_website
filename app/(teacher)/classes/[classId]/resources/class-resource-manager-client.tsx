"use client";

import { useActionState, useMemo, useState } from "react";

import { saveClassResourcesAction } from "@/app/(teacher)/classes/[classId]/resources/actions";
import { initialClassResourceActionState } from "@/app/(teacher)/classes/[classId]/resources/resource-action-state";
import type { ClassResourceManagerData } from "@/lib/types/class-resource";

type ClassResourceManagerClientProps = {
  data: ClassResourceManagerData;
  initialMaterialCategory?: "Bài giảng" | "Tham khảo";
  returnTo?: string;
};

function ResourceToggleButton({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      className={
        selected
          ? "flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-lg font-semibold leading-none text-white"
          : "flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-lg font-semibold leading-none text-white"
      }
      onClick={onClick}
      type="button"
    >
      {selected ? "-" : "+"}
    </button>
  );
}

function normalizeCategoryName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

export function ClassResourceManagerClient({ data, initialMaterialCategory, returnTo }: ClassResourceManagerClientProps) {
  const [selectedMaterialIds, setSelectedMaterialIds] = useState(() => new Set(data.linkedMaterialIds));
  const [selectedSimulationIds, setSelectedSimulationIds] = useState(() => new Set(data.linkedSimulationIds));
  const [state, formAction, isPending] = useActionState(
    saveClassResourcesAction.bind(null, data.classId),
    initialClassResourceActionState,
  );

  const materialIds = useMemo(() => [...selectedMaterialIds], [selectedMaterialIds]);
  const simulationIds = useMemo(() => [...selectedSimulationIds], [selectedSimulationIds]);
  const visibleMaterials = useMemo(
    () =>
      initialMaterialCategory
        ? data.materials.filter((material) => normalizeCategoryName(material.categoryName) === normalizeCategoryName(initialMaterialCategory))
        : data.materials,
    [data.materials, initialMaterialCategory],
  );

  function toggleMaterial(id: string) {
    setSelectedMaterialIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSimulation(id: string) {
    setSelectedSimulationIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      {materialIds.map((id) => (
        <input key={`material-${id}`} name="materialIds" type="hidden" value={id} />
      ))}
      {simulationIds.map((id) => (
        <input key={`simulation-${id}`} name="simulationIds" type="hidden" value={id} />
      ))}
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-amber-950">Tài liệu</h2>
            <p className="mt-1 text-sm text-amber-900">
              {initialMaterialCategory
                ? `Chọn tài liệu danh mục ${initialMaterialCategory} từ Thư viện để hiển thị trong Tủ tài liệu của lớp.`
                : "Chọn tài liệu từ Thư viện để hiển thị trong Tủ tài liệu của lớp."}
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800">
            {selectedMaterialIds.size}/{data.materials.length} đã chọn
          </span>
        </div>

        {visibleMaterials.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-amber-300 bg-white p-4 text-sm text-amber-900">
            {initialMaterialCategory
              ? `Chưa có tài liệu danh mục ${initialMaterialCategory} khả dụng trong học phần này.`
              : "Chưa có tài liệu khả dụng trong học phần này."}
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {visibleMaterials.map((material) => {
              const selected = selectedMaterialIds.has(material.id);

              return (
                <article className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-4" key={material.id}>
                  <div>
                    <h3 className="font-semibold text-slate-900">{material.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {material.sectionLabel ?? "Tổng hợp"} · {material.fileType}
                    </p>
                    {material.description ? <p className="mt-2 text-sm text-slate-600">{material.description}</p> : null}
                  </div>
                  <ResourceToggleButton
                    label={selected ? `Bớt tài liệu ${material.title}` : `Thêm tài liệu ${material.title}`}
                    onClick={() => toggleMaterial(material.id)}
                    selected={selected}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-sky-200 bg-sky-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-sky-950">Mô phỏng</h2>
            <p className="mt-1 text-sm text-sky-900">Chọn mô phỏng từ Thư viện để hiển thị ở Màn chiếu của lớp.</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-sky-800">
            {selectedSimulationIds.size}/{data.simulations.length} đã chọn
          </span>
        </div>

        {data.simulations.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-sky-300 bg-white p-4 text-sm text-sky-900">
            Chưa có mô phỏng khả dụng trong học phần này.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {data.simulations.map((simulation) => {
              const selected = selectedSimulationIds.has(simulation.id);

              return (
                <article className="flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-white p-4" key={simulation.id}>
                  <div>
                    <h3 className="font-semibold text-slate-900">{simulation.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{simulation.slug}</p>
                    {simulation.description ? <p className="mt-2 text-sm text-slate-600">{simulation.description}</p> : null}
                  </div>
                  <ResourceToggleButton
                    label={selected ? `Bớt mô phỏng ${simulation.title}` : `Thêm mô phỏng ${simulation.title}`}
                    onClick={() => toggleSimulation(simulation.id)}
                    selected={selected}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>

      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800"
              : "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          }
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Đang lưu..." : "Xác nhận hoàn thành"}
        </button>
      </div>
    </form>
  );
}
