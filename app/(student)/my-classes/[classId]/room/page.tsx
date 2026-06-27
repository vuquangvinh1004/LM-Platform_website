import { markClassDirectMessagesAsReadAction, sendClassDirectMessageAction } from "@/app/(student)/my-classes/[classId]/room/actions";
import { ClassroomLayout } from "@/components/classroom/classroom-layout";
import { BackTextLink } from "@/components/ui/back-text-link";
import { listAssessmentsForStudent } from "@/lib/services/assessment-service";
import { requireRole } from "@/lib/services/auth-service";
import { listClassDirectMessages } from "@/lib/services/message-service";
import {
  getClassroomLayout,
  listClassAnnouncements,
  listClassSessions,
  listClassroomMaterials,
  listClassroomSimulations,
} from "@/lib/services/classroom-service";

type StudentClassroomRoomPageProps = {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{
    flashScope?: string;
    flashType?: string;
    flashMessage?: string;
  }>;
};

export default async function StudentClassroomRoomPage({ params, searchParams }: StudentClassroomRoomPageProps) {
  const { classId } = await params;
  const query = await searchParams;
  const profileResult = await requireRole(["student", "admin"]);

  const messageFlash =
    query.flashScope === "message" && query.flashMessage
      ? {
          type: query.flashType === "success" ? ("success" as const) : ("error" as const),
          message: query.flashMessage,
        }
      : undefined;

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Phòng học của tôi</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const layoutResult = await getClassroomLayout({
    classId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!layoutResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Phòng học của tôi</h1>
        <p className="mt-2 text-sm text-red-600">{layoutResult.error.message}</p>
        <BackTextLink className="mt-4" href="/my-classes">Quay về danh sách lớp</BackTextLink>
      </main>
    );
  }

  const [announcementsResult, sessionsResult, materialsResult, simulationsResult, assessmentsResult, messagesResult] = await Promise.all([
    listClassAnnouncements({
      classId,
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
      page: 1,
      pageSize: 10,
    }),
    listClassSessions({
      classId,
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
    }),
    listClassroomMaterials({
      classId,
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
    }),
    listClassroomSimulations({
      classId,
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
    }),
    listAssessmentsForStudent({
      studentId: profileResult.data.id,
      classId,
    }),
    listClassDirectMessages({
      classId,
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
    }),
  ]);

  const openAssessments = assessmentsResult.ok
    ? assessmentsResult.data.items
        .filter((assessment) => assessment.status === "open" && assessment.studentListStatus === "available")
        .map((assessment) => ({
          id: assessment.id,
          title: assessment.title,
          dueAt: assessment.dueAt ?? null,
        }))
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-[90rem] px-6 py-8">
      <div className="mb-4">
        <BackTextLink href="/my-classes">Quay về các lớp học của tôi</BackTextLink>
      </div>

      <ClassroomLayout
        announcementError={announcementsResult.ok ? undefined : announcementsResult.error.message}
        announcements={announcementsResult.ok ? announcementsResult.data : []}
        canCreateAnnouncement={false}
        canSendMessageToStudents={false}
        canSendMessageToTeacher={true}
        currentActorId={profileResult.data.id}
        directMessages={messagesResult.ok ? messagesResult.data : []}
        layout={layoutResult.data}
        materials={materialsResult.ok ? materialsResult.data : []}
        materialsError={materialsResult.ok ? undefined : materialsResult.error.message}
        markMessagesAsReadAction={markClassDirectMessagesAsReadAction.bind(null, classId)}
        messageFlash={messageFlash}
        openAssessments={openAssessments}
        assessmentAudience="student"
        sendMessageAction={sendClassDirectMessageAction.bind(null, classId)}
        sessions={sessionsResult.ok ? sessionsResult.data : []}
        sessionsError={sessionsResult.ok ? undefined : sessionsResult.error.message}
        simulations={simulationsResult.ok ? simulationsResult.data : []}
        simulationsError={simulationsResult.ok ? undefined : simulationsResult.error.message}
      />
    </main>
  );
}
