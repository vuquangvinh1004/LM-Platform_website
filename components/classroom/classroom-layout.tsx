import { ClassroomAssessmentPanel } from "@/components/classroom/classroom-assessment-panel";
import { ClassroomBoardPanel } from "@/components/classroom/classroom-board-panel";
import { ClassroomMaterialCabinet } from "@/components/classroom/classroom-material-cabinet";
import { ClassroomProjectorPanel } from "@/components/classroom/classroom-projector-panel";
import { ClassroomSeatGrid } from "@/components/classroom/classroom-seat-grid";
import { ClassroomSessionPanel } from "@/components/classroom/classroom-session-panel";
import { ClassroomTeacherDesk } from "@/components/classroom/classroom-teacher-desk";
import type {
  ClassroomAnnouncement,
  ClassroomDirectMessage,
  ClassroomLayout as ClassroomLayoutModel,
  ClassroomMaterialItem,
  ClassroomOpenAssessment,
  ClassroomSessionSummary,
  ClassroomSimulationItem,
  ClassroomTemplateSummary,
} from "@/lib/types/classroom";
import type { ClassroomMessageMutationResult } from "@/lib/types/message";

type ClassroomLayoutProps = {
  layout: ClassroomLayoutModel;
  announcements: ClassroomAnnouncement[];
  materials: ClassroomMaterialItem[];
  simulations: ClassroomSimulationItem[];
  sessions?: ClassroomSessionSummary[];
  openAssessments?: ClassroomOpenAssessment[];
  assessmentAudience?: "student" | "manager";
  canCreateAnnouncement: boolean;
  createAnnouncementAction?: (formData: FormData) => Promise<void>;
  createSessionAction?: (formData: FormData) => Promise<void>;
  applyTemplateAction?: (formData: FormData) => Promise<void>;
  canSendMessageToStudents: boolean;
  canSendMessageToTeacher: boolean;
  sendMessageAction?: (formData: FormData) => Promise<ClassroomMessageMutationResult>;
  markMessagesAsReadAction?: () => Promise<ClassroomMessageMutationResult>;
  markStudentMessagesAsReadAction?: (studentId: string) => Promise<ClassroomMessageMutationResult>;
  updateTeacherDeskNoteAction?: (formData: FormData) => Promise<ClassroomMessageMutationResult>;
  currentActorId?: string;
  directMessages?: ClassroomDirectMessage[];
  announcementFlash?: {
    type: "success" | "error";
    message: string;
  };
  messageFlash?: {
    type: "success" | "error";
    message: string;
  };
  templateFlash?: {
    type: "success" | "error";
    message: string;
  };
  isTemplateClass?: boolean;
  templates?: ClassroomTemplateSummary[];
  announcementError?: string;
  sessionsError?: string;
  materialsError?: string;
  simulationsError?: string;
  canManageSimulations?: boolean;
  manageSimulationsHref?: string;
  canManageMaterials?: boolean;
  manageMaterialsHref?: string;
};

export function ClassroomLayout({
  layout,
  announcements,
  materials,
  simulations,
  sessions = [],
  openAssessments = [],
  assessmentAudience = "student",
  canCreateAnnouncement,
  createAnnouncementAction,
  createSessionAction,
  applyTemplateAction,
  canSendMessageToStudents,
  canSendMessageToTeacher,
  sendMessageAction,
  markMessagesAsReadAction,
  markStudentMessagesAsReadAction,
  updateTeacherDeskNoteAction,
  currentActorId,
  directMessages = [],
  announcementFlash,
  messageFlash,
  templateFlash,
  isTemplateClass = false,
  templates = [],
  announcementError,
  sessionsError,
  materialsError,
  simulationsError,
  canManageSimulations,
  manageSimulationsHref,
  canManageMaterials,
  manageMaterialsHref,
}: ClassroomLayoutProps) {
  const templateApplyFailed = templateFlash?.type === "error" && templateFlash.message.includes("Chỉ có thể áp dụng lớp mẫu");

  return (
    <div className="space-y-4" data-testid="classroom-layout">
      <section className="rounded-xl border border-slate-300 bg-slate-900 px-4 py-6 text-center text-slate-100">
        <h1 className="text-xl font-semibold">{layout.classInfo.classTitle}</h1>
        <p className="mt-1 text-sm text-slate-300">
          {layout.classInfo.classCode} · {layout.classInfo.courseCode} - {layout.classInfo.courseTitle}
        </p>
      </section>

      <ClassroomBoardPanel
        announcements={announcements}
        canCreateAnnouncement={canCreateAnnouncement}
        createAnnouncementAction={createAnnouncementAction}
        errorMessage={announcementError}
      />

      <ClassroomSessionPanel
        audience={assessmentAudience}
        classId={layout.classInfo.id}
        createSessionAction={assessmentAudience === "manager" ? createSessionAction : undefined}
        errorMessage={sessionsError}
        sessions={sessions}
      />

      <ClassroomAssessmentPanel assessments={openAssessments} audience={assessmentAudience} />

      {announcementFlash ? (
        <div
          className={
            announcementFlash.type === "success"
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          }
          role="status"
        >
          {announcementFlash.message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <ClassroomProjectorPanel
          canManageSimulations={canManageSimulations}
          errorMessage={simulationsError}
          manageSimulationsHref={manageSimulationsHref}
          simulations={simulations}
        />
        <ClassroomMaterialCabinet
          audience={assessmentAudience}
          canManageMaterials={canManageMaterials}
          errorMessage={materialsError}
          manageMaterialsHref={manageMaterialsHref}
          materials={materials}
          openMaterialClassId={layout.classInfo.id}
        />
      </div>

      {messageFlash ? (
        <div
          className={
            messageFlash.type === "success"
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          }
          role="status"
        >
          {messageFlash.message}
        </div>
      ) : null}

      <ClassroomTeacherDesk
        canSendMessage={canSendMessageToTeacher}
        currentActorId={currentActorId}
        classId={layout.classInfo.id}
        markMessagesAsReadAction={markMessagesAsReadAction}
        messages={directMessages}
        sendMessageAction={sendMessageAction}
        teacherId={layout.classInfo.teacherId}
        teacherDeskNote={layout.classInfo.teacherDeskNote}
        teacherEmail={layout.classInfo.teacherEmail}
        teacherName={layout.classInfo.teacherName}
        updateTeacherDeskNoteAction={updateTeacherDeskNoteAction}
      />

      {assessmentAudience === "manager" ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Khu sơ đồ chỗ ngồi sinh viên</h2>
            <span className="text-xs text-slate-600">{layout.columns} cột · xếp tự động theo tên</span>
          </div>

          <ClassroomSeatGrid
            canSendMessage={canSendMessageToStudents}
            columns={layout.columns}
            currentActorId={currentActorId}
            markMessagesAsReadAction={markStudentMessagesAsReadAction}
            messages={directMessages}
            seats={layout.seats}
            sendMessageAction={sendMessageAction}
          />
        </section>
      ) : null}

      {assessmentAudience === "manager" ? (
        isTemplateClass ? (
          <section className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3" id="classroom-templates">
            <p className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-[0.2em] text-amber-900">
              ĐÂY LÀ LỚP NGUỒN CỦA LỚP HỌC MẪU
            </p>
          </section>
        ) : (
          <section
            className={
              templateApplyFailed
                ? "rounded-xl border border-red-200 bg-red-50 p-4"
                : "rounded-xl border border-indigo-200 bg-indigo-50 p-4"
            }
            id="classroom-templates"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className={templateApplyFailed ? "text-base font-semibold text-red-950" : "text-base font-semibold text-indigo-950"}>
                  Áp dụng lớp mẫu
                </h2>
                <p className={templateApplyFailed ? "mt-1 text-xs text-red-700" : "mt-1 text-xs text-indigo-700"}>
                  Chọn một lớp mẫu cùng học phần để áp dụng vào lớp hiện tại khi lớp còn trống.
                </p>
              </div>
            </div>
            {applyTemplateAction ? (
              <form action={applyTemplateAction} className="mt-3 flex flex-wrap items-end gap-3">
                <label className="min-w-[260px] flex-1 text-sm text-indigo-900">
                  Áp dụng lớp mẫu
                  <select className="mt-1 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900" defaultValue="" name="templateId" required>
                    <option value="">Chọn lớp mẫu</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} · {template.sessionCount} buổi · {template.materialCount} tài liệu · {template.simulationCount} mô phỏng
                      </option>
                    ))}
                  </select>
                </label>
                <button className="rounded-md border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-900" type="submit">
                  Áp dụng vào lớp hiện tại
                </button>
              </form>
            ) : null}
            {applyTemplateAction ? (
              <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                Lưu ý: thao tác áp dụng lớp mẫu sẽ ghi đè toàn bộ buổi học, tài liệu và mô phỏng hiện có. Chỉ áp dụng khi lớp chưa có sinh viên hoặc bài kiểm tra, vì dữ liệu cũ không thể khôi phục.
              </p>
            ) : null}
            {templateApplyFailed ? (
              <div className="mt-3 rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-700">
                Lớp học hiện tại chưa đủ điều kiện áp dụng: hãy đảm bảo lớp chưa có sinh viên hoặc bài kiểm tra.
              </div>
            ) : null}
            {templateFlash ? (
              <div
                className={
                  templateFlash.type === "success"
                    ? "mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                    : templateApplyFailed
                      ? "mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                      : "mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                }
              >
                {templateFlash.message}
              </div>
            ) : null}
            {templates.length === 0 ? (
              <p className="mt-3 text-sm text-indigo-800">Chưa có lớp mẫu nào cho học phần này.</p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {templates.map((template) => (
                  <article className="rounded-lg border border-indigo-200 bg-white p-3" key={template.id}>
                    <p className="text-sm font-semibold text-slate-900">{template.name}</p>
                    {template.description ? <p className="mt-1 text-xs text-slate-600">{template.description}</p> : null}
                    <p className="mt-2 text-xs text-indigo-800">
                      {template.sessionCount} buổi học · {template.materialCount} tài liệu · {template.simulationCount} mô phỏng
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )
      ) : null}
    </div>
  );
}
