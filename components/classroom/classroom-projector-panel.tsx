import Link from "next/link";

import type { ClassroomSimulationItem } from "@/lib/types/classroom";
import { SimulationWidgetRenderer } from "@/simulations/widgets/simulation-widget-renderer";

type ClassroomProjectorPanelProps = {
  simulations: ClassroomSimulationItem[];
  errorMessage?: string;
  canManageSimulations?: boolean;
  manageSimulationsHref?: string;
};

const simulationStatusLabels: Record<string, string> = {
  draft: "Bản nháp",
  published: "Đã phát hành",
  archived: "Đã lưu trữ",
};

export function ClassroomProjectorPanel({
  simulations,
  errorMessage,
  canManageSimulations = false,
  manageSimulationsHref = "/library",
}: ClassroomProjectorPanelProps) {
  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-sky-900">Màn chiếu</h2>
          <p className="mt-1 text-xs text-sky-700">Mô phỏng theo ngữ cảnh học phần của lớp.</p>
        </div>
        {canManageSimulations ? (
          <Link className="rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white" href={manageSimulationsHref}>
            Thêm/bớt từ Thư viện
          </Link>
        ) : null}
      </div>

      {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}

      {simulations.length === 0 ? (
        <p className="mt-3 text-sm text-sky-800">Chưa có mô phỏng nào được gắn vào lớp này.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {simulations.map((simulation) => (
            <li className="rounded-md border border-sky-200 bg-white px-3 py-2" key={simulation.id}>
              <p className="text-sm font-medium text-slate-900">{simulation.title}</p>
              {simulation.description ? <p className="mt-1 text-xs text-slate-600">{simulation.description}</p> : null}
              <p className="text-xs text-slate-600">
                Trạng thái: {simulationStatusLabels[simulation.status] ?? simulation.status}
              </p>
              {simulation.openUrl ? (
                <a
                  className="mt-3 inline-flex rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white"
                  href={simulation.openUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Mở mô phỏng
                </a>
              ) : simulation.status === "published" ? (
                <div className="mt-3">
                  <SimulationWidgetRenderer slug={simulation.slug} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
