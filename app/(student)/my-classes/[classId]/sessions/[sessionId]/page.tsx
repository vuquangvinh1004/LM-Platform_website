import { ClassroomSessionDetail } from "@/components/classroom/classroom-session-detail";
import { BackTextLink } from "@/components/ui/back-text-link";
import { requireRole } from "@/lib/services/auth-service";
import { getClassSession } from "@/lib/services/classroom-service";

type StudentClassSessionPageProps = {
  params: Promise<{
    classId: string;
    sessionId: string;
  }>;
};

export default async function StudentClassSessionPage({ params }: StudentClassSessionPageProps) {
  const { classId, sessionId } = await params;
  const profileResult = await requireRole(["student", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Buổi học</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const sessionResult = await getClassSession({
    classId,
    sessionId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!sessionResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-12">
        <BackTextLink href={`/my-classes/${classId}/room`}>Quay về phòng học</BackTextLink>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Buổi học</h1>
        <p className="mt-2 text-sm text-red-600">{sessionResult.error.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-8">
      <div className="mb-4">
        <BackTextLink href={`/my-classes/${classId}/room`}>Quay về lớp {sessionResult.data.classInfo.classTitle}</BackTextLink>
      </div>

      <header className="mb-6 rounded-xl border border-slate-300 bg-slate-900 px-4 py-6 text-center text-slate-100">
        <p className="text-sm text-slate-300">Buổi học {sessionResult.data.sessionIndex}</p>
        <h1 className="mt-1 text-2xl font-semibold">{sessionResult.data.title}</h1>
        <p className="mt-1 text-sm text-slate-300">
          {sessionResult.data.classInfo.classCode} · {sessionResult.data.classInfo.courseCode} - {sessionResult.data.classInfo.courseTitle}
        </p>
      </header>

      <ClassroomSessionDetail audience="student" session={sessionResult.data} />
    </main>
  );
}
