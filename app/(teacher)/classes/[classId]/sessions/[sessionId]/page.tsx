import {
  addClassSessionAssignmentAction,
  addClassSessionExtraMaterialAction,
  addClassSessionLectureItemAction,
  addClassSessionQuickReviewQuestionAction,
  removeClassSessionItemAction,
  updateClassSessionAccessAction,
  updateClassSessionOverviewAction,
} from "@/app/(teacher)/classes/[classId]/sessions/[sessionId]/actions";
import { ClassroomSessionDetail } from "@/components/classroom/classroom-session-detail";
import { AdminAreaLink } from "@/components/ui/admin-area-link";
import { BackTextLink } from "@/components/ui/back-text-link";
import { requireRole } from "@/lib/services/auth-service";
import { getClassSession, listClassroomMaterials } from "@/lib/services/classroom-service";

type TeacherClassSessionPageProps = {
  params: Promise<{
    classId: string;
    sessionId: string;
  }>;
};

export default async function TeacherClassSessionPage({ params }: TeacherClassSessionPageProps) {
  const { classId, sessionId } = await params;
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Buổi học</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const [sessionResult, materialsResult] = await Promise.all([
    getClassSession({
      classId,
      sessionId,
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
    }),
    listClassroomMaterials({
      classId,
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
    }),
  ]);

  if (!sessionResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-12">
        <BackTextLink href={`/classes/${classId}/room`}>Quay về phòng học</BackTextLink>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Buổi học</h1>
        <p className="mt-2 text-sm text-red-600">{sessionResult.error.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <BackTextLink href={`/classes/${classId}/room`}>Quay về lớp {sessionResult.data.classInfo.classTitle}</BackTextLink>
        {profileResult.data.role === "admin" ? <AdminAreaLink /> : null}
      </div>

      <header className="mb-6 rounded-xl border border-slate-300 bg-slate-900 px-4 py-6 text-center text-slate-100">
        <p className="text-sm text-slate-300">Buổi học {sessionResult.data.sessionIndex}</p>
        <h1 className="mt-1 text-2xl font-semibold">{sessionResult.data.title}</h1>
        <p className="mt-1 text-sm text-slate-300">
          {sessionResult.data.classInfo.classCode} · {sessionResult.data.classInfo.courseCode} - {sessionResult.data.classInfo.courseTitle}
        </p>
      </header>

      <ClassroomSessionDetail
        addAssignmentAction={addClassSessionAssignmentAction.bind(null, classId, sessionId)}
        addExtraMaterialAction={addClassSessionExtraMaterialAction.bind(null, classId, sessionId)}
        addLectureItemAction={addClassSessionLectureItemAction.bind(null, classId, sessionId)}
        addQuickReviewQuestionAction={addClassSessionQuickReviewQuestionAction.bind(null, classId, sessionId)}
        audience="manager"
        availableMaterials={materialsResult.ok ? materialsResult.data : []}
        classId={classId}
        removeItemAction={removeClassSessionItemAction.bind(null, classId, sessionId)}
        session={sessionResult.data}
        updateAccessAction={updateClassSessionAccessAction.bind(null, classId, sessionId)}
        updateOverviewAction={updateClassSessionOverviewAction.bind(null, classId, sessionId)}
      />
    </main>
  );
}
