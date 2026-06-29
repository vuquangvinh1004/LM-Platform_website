import {
  applyClassTemplateAction,
  createClassAnnouncementAction,
  createClassSessionAction,
  markClassDirectMessagesAsReadAction,
  markStudentMessagesAsReadAction,
  sendClassDirectMessageAction,
  updateTeacherDeskNoteAction,
} from "@/app/(teacher)/classes/[classId]/room/actions";
import { ClassroomLayout } from "@/components/classroom/classroom-layout";
import { AdminAreaLink } from "@/components/ui/admin-area-link";
import { BackTextLink } from "@/components/ui/back-text-link";
import { requireRole } from "@/lib/services/auth-service";
import {
  getManagerClassroomRoomData,
} from "@/lib/services/classroom-service";

type TeacherClassroomRoomPageProps = {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{
    flashScope?: string;
    flashType?: string;
    flashMessage?: string;
  }>;
};

export default async function TeacherClassroomRoomPage({ params, searchParams }: TeacherClassroomRoomPageProps) {
  const [{ classId }, query, profileResult] = await Promise.all([
    params,
    searchParams,
    requireRole(["teacher", "moderator", "admin"]),
  ]);

  const announcementFlash =
    query.flashScope === "announcement" && query.flashMessage
      ? {
          type: query.flashType === "success" ? ("success" as const) : ("error" as const),
          message: query.flashMessage,
        }
      : undefined;

  const messageFlash =
    query.flashScope === "message" && query.flashMessage
      ? {
          type: query.flashType === "success" ? ("success" as const) : ("error" as const),
          message: query.flashMessage,
        }
      : undefined;

  const templateFlash =
    query.flashScope === "template" && query.flashMessage
      ? {
          type: query.flashType === "success" ? ("success" as const) : ("error" as const),
          message: query.flashMessage,
        }
      : undefined;

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Phòng học trực quan</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const roomDataResult = await getManagerClassroomRoomData({
    classId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role as "admin" | "moderator" | "teacher",
  });

  if (!roomDataResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Phòng học trực quan</h1>
        <p className="mt-2 text-sm text-red-600">{roomDataResult.error.message}</p>
        <BackTextLink className="mt-4" href="/classes">Quay về danh sách lớp</BackTextLink>
      </main>
    );
  }
  const roomData = roomDataResult.data;
  const sameCourseTemplates = roomData.templates.filter((template) => template.courseId === roomData.layout.classInfo.courseId);
  const isTemplateSourceClass = roomData.templates.some((template) => template.sourceClassId === classId);
  return (
    <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        {profileResult.data.role !== "admin" ? <BackTextLink href="/classes">Quay về Quản lý lớp</BackTextLink> : <div />}
        {profileResult.data.role === "admin" ? <AdminAreaLink /> : null}
      </div>

      <ClassroomLayout
        announcementFlash={announcementFlash}
        announcements={roomData.announcements}
        canCreateAnnouncement={true}
        canManageMaterials={true}
        canManageSimulations={true}
        canSendMessageToStudents={true}
        canSendMessageToTeacher={false}
        currentActorId={profileResult.data.id}
        createAnnouncementAction={createClassAnnouncementAction.bind(null, classId)}
        createSessionAction={createClassSessionAction.bind(null, classId)}
        directMessages={roomData.directMessages}
        layout={roomData.layout}
        templateFlash={templateFlash}
        templates={sameCourseTemplates}
        applyTemplateAction={applyClassTemplateAction.bind(null, classId)}
        materials={roomData.materials}
        manageMaterialsHref={`/classes/${classId}/resources`}
        manageSimulationsHref={`/classes/${classId}/resources`}
        markMessagesAsReadAction={markClassDirectMessagesAsReadAction.bind(null, classId)}
        markStudentMessagesAsReadAction={markStudentMessagesAsReadAction.bind(null, classId)}
        messageFlash={messageFlash}
        isTemplateClass={isTemplateSourceClass}
        openAssessments={roomData.openAssessments}
        assessmentAudience="manager"
        sendMessageAction={sendClassDirectMessageAction.bind(null, classId)}
        sessions={roomData.sessions}
        simulations={roomData.simulations}
        updateTeacherDeskNoteAction={updateTeacherDeskNoteAction.bind(null, classId)}
      />
    </main>
  );
}
