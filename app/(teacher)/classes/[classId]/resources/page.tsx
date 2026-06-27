import { ClassResourceManagerClient } from "@/app/(teacher)/classes/[classId]/resources/class-resource-manager-client";
import { AdminAreaLink } from "@/components/ui/admin-area-link";
import { BackTextLink } from "@/components/ui/back-text-link";
import { requireRole } from "@/lib/services/auth-service";
import { getClassResourceManagerData } from "@/lib/services/class-resource-service";
import type { ClassResourceActorRole } from "@/lib/services/class-resource-service";

type ClassResourcesPageProps = {
  params: Promise<{ classId: string }>;
  searchParams?: Promise<{ materialCategory?: string; returnTo?: string }>;
};

export default async function ClassResourcesPage({ params, searchParams }: ClassResourcesPageProps) {
  const emptyQuery: { materialCategory?: string; returnTo?: string } = {};
  const [{ classId }, query] = await Promise.all([params, searchParams ?? Promise.resolve(emptyQuery)]);
  const returnTo = typeof query.returnTo === "string" && query.returnTo.startsWith(`/classes/${classId}/`) ? query.returnTo : undefined;
  const materialCategory =
    query.materialCategory === "Bài giảng" || query.materialCategory === "Tham khảo" ? query.materialCategory : undefined;
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Tài nguyên lớp học</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
        <BackTextLink className="mt-4" href="/login">Quay lại đăng nhập</BackTextLink>
      </main>
    );
  }

  const dataResult = await getClassResourceManagerData({
    classId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role as ClassResourceActorRole,
  });

  if (!dataResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <BackTextLink href={`/classes/${classId}/room`}>Quay về phòng học</BackTextLink>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Tài nguyên lớp học</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {dataResult.error.message}
        </div>
      </main>
    );
  }

  const data = dataResult.data;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {profileResult.data.role !== "admin" ? <BackTextLink href={`/classes/${classId}/room`}>Quay về phòng học</BackTextLink> : <div />}
        {profileResult.data.role === "admin" ? <AdminAreaLink /> : null}
      </div>
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-semibold text-slate-900">Tài nguyên lớp học</h1>
        <p className="mt-1 text-sm text-slate-600">
          {data.classCode} - {data.classTitle} · {data.courseCode} - {data.courseTitle}
        </p>
      </div>

      <ClassResourceManagerClient data={data} initialMaterialCategory={materialCategory} returnTo={returnTo} />
    </main>
  );
}
