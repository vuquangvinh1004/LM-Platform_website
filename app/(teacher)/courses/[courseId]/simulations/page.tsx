import { AdminAreaLink } from "@/components/ui/admin-area-link";
import { BackTextLink } from "@/components/ui/back-text-link";
import { requireRole } from "@/lib/services/auth-service";
import { listSimulationsForCourse } from "@/lib/services/simulation-service";
import { findSimulationRegistryItem } from "@/simulations/registry";
import { SimulationWidgetRenderer } from "@/simulations/widgets/simulation-widget-renderer";

const simulationStatusLabels: Record<string, string> = {
  draft: "Bản nháp",
  published: "Đã phát hành",
  archived: "Đã lưu trữ",
};

type CourseSimulationsPageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CourseSimulationsPage({ params }: CourseSimulationsPageProps) {
  const { courseId } = await params;
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Mô phỏng của học phần</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const simulationsResult = await listSimulationsForCourse({
    courseId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        {profileResult.data.role !== "admin" ? (
          <BackTextLink href={profileResult.data.role === "teacher" ? "/library" : "/courses"}>
            {profileResult.data.role === "teacher" ? "Quay về thư viện" : "Quay về danh sách học phần"}
          </BackTextLink>
        ) : (
          <div />
        )}
        {profileResult.data.role === "admin" ? <AdminAreaLink /> : null}
      </div>

      <h1 className="text-2xl font-semibold text-slate-900">Mô phỏng của học phần</h1>
      <p className="mt-2 text-sm text-slate-600">Danh sách mô phỏng đã đăng ký theo học phần.</p>

      {!simulationsResult.ok ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {simulationsResult.error.message}
        </div>
      ) : simulationsResult.data.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">
          Học phần chưa có mô phỏng nào.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {simulationsResult.data.map((simulation) => (
            <li className="rounded-lg border border-slate-200 p-4" key={simulation.id}>
              <p className="text-base font-semibold text-slate-900">{simulation.title}</p>
              <p className="mt-1 text-sm text-slate-600">Mã mô phỏng: {simulation.slug}</p>
              <p className="mt-1 text-xs text-slate-500">
                Trạng thái: {simulationStatusLabels[simulation.status] ?? simulation.status}
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {simulation.description ?? findSimulationRegistryItem(simulation.slug)?.description ?? "Chưa có mô tả."}
              </p>
              <SimulationWidgetRenderer slug={simulation.slug} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
