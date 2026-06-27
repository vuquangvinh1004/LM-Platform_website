import Link from "next/link";

import type { ClassroomMaterialItem } from "@/lib/types/classroom";

type ClassroomMaterialCabinetProps = {
  materials: ClassroomMaterialItem[];
  errorMessage?: string;
  audience?: "student" | "manager";
  canOpenMaterials?: boolean;
  canManageMaterials?: boolean;
  openMaterialClassId?: string;
  manageMaterialsHref?: string;
};

const materialStatusLabels: Record<string, string> = {
  draft: "Bản nháp",
  published: "Đã phát hành",
  archived: "Đã lưu trữ",
};

export function ClassroomMaterialCabinet({
  materials,
  errorMessage,
  audience = "student",
  canOpenMaterials = true,
  canManageMaterials = false,
  openMaterialClassId,
  manageMaterialsHref = "/library",
}: ClassroomMaterialCabinetProps) {
  const materialBasePath = audience === "manager" ? "/classes/materials" : "/my-classes/materials";

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-amber-900">Tủ tài liệu</h2>
          <p className="mt-1 text-xs text-amber-700">Danh sách tài liệu theo học phần của lớp.</p>
        </div>
        {canManageMaterials ? (
          <Link className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white" href={manageMaterialsHref}>
            Thêm/bớt từ Thư viện
          </Link>
        ) : null}
      </div>

      {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}

      {materials.length === 0 ? (
        <p className="mt-3 text-sm text-amber-800">Chưa có tài liệu phù hợp.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {materials.map((material) => (
            <li className="rounded-md border border-amber-200 bg-white px-3 py-2" key={material.id}>
              <p className="text-sm font-medium text-slate-900">{material.title}</p>
              <p className="text-xs text-slate-600">
                Trạng thái: {materialStatusLabels[material.status] ?? material.status} · Mục: {material.sectionLabel ?? "Tổng hợp"}
              </p>
              {canOpenMaterials && material.status === "published" ? (
                <a
                  className="mt-2 inline-flex rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white"
                  href={
                    openMaterialClassId
                      ? `${materialBasePath}/${material.id}?classId=${openMaterialClassId}`
                      : `${materialBasePath}/${material.id}`
                  }
                >
                  Mở tài liệu
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
