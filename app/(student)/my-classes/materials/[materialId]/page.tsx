import { BackTextLink } from "@/components/ui/back-text-link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/services/auth-service";
import { getClassroomLayout } from "@/lib/services/classroom-service";
import { getReadableMaterial } from "@/lib/services/material-service";

type StudentMaterialViewerPageProps = {
  params: Promise<{
    materialId: string;
  }>;
  searchParams: Promise<{
    classId?: string;
    embed?: string;
  }>;
};

export default async function StudentMaterialViewerPage({ params, searchParams }: StudentMaterialViewerPageProps) {
  const profileResult = await requireRole(["student", "teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Tài liệu học tập</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
        <BackTextLink className="mt-4" href="/login">Quay lại đăng nhập</BackTextLink>
      </main>
    );
  }

  const [{ materialId }, query] = await Promise.all([params, searchParams]);
  const materialResult = await getReadableMaterial({
    materialId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    classId: query.classId,
  });
  const classContextResult =
    profileResult.data.role === "student" && query.classId
      ? await getClassroomLayout({
          classId: query.classId,
          actorId: profileResult.data.id,
          actorRole: profileResult.data.role,
        })
      : null;
  const isEmbedMode = query.embed === "1";
  const studentBackHref = classContextResult?.ok ? `/my-classes/${classContextResult.data.classInfo.id}/room` : "/my-classes";
  const studentBackLabel = classContextResult?.ok
    ? `Quay về lớp ${classContextResult.data.classInfo.classTitle || classContextResult.data.classInfo.classCode}`
    : "Quay về các lớp học của tôi";

  if (isEmbedMode) {
    if (!materialResult.ok) {
      return <div className="p-3 text-sm text-red-700">{materialResult.error.message}</div>;
    }

    redirect(materialResult.data.viewUrl);
  }

  const materialPanel = !materialResult.ok ? (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="student-material-error">
      {materialResult.error.message}
    </div>
  ) : (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900" data-testid="student-material-title">
            {materialResult.data.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">Loại tệp: {materialResult.data.fileType}</p>
        </div>
        {materialResult.data.allowDownload && materialResult.data.downloadUrl ? (
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            data-testid="student-material-download-link"
            href={materialResult.data.downloadUrl}
          >
            Tải xuống
          </a>
        ) : (
          <span className="text-sm text-slate-500" data-testid="student-material-download-disabled">
            Tải xuống đã bị tắt.
          </span>
        )}
      </div>

      <iframe
        className="min-h-[70vh] w-full rounded-md border border-slate-200"
        data-testid="student-material-viewer"
        src={materialResult.data.viewUrl}
        title={materialResult.data.title}
      />
    </section>
  );

  return (
    <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-12">
      <BackTextLink className="mb-4" href={profileResult.data.role === "student" ? studentBackHref : "/classes"}>
        {profileResult.data.role === "student" ? studentBackLabel : "Quay về quản lý lớp"}
      </BackTextLink>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Trình xem tài liệu</h1>
        <p className="mt-1 text-sm text-slate-600">Liên kết xem tài liệu được tạo ở máy chủ sau khi kiểm tra quyền truy cập.</p>
      </div>

      {materialPanel}
    </main>
  );
}
