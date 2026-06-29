import { randomUUID } from "node:crypto";

import {
  createClassAnnouncementRepository,
  createClassSessionRepository,
  createClassSessionsFromTemplateRepository,
  createClassTemplateRepository,
  deleteClassSessionsByClassIdRepository,
  deleteClassTemplateRepository,
  getClassTemplateByIdRepository,
  getClassTemplateBySourceClassIdRepository,
  getClassSessionDetailRepository,
  hasClassroomAccessRepository,
  getClassroomClassInfoRepository,
  listClassResourceLinkIdsRepository,
  listActiveClassMembersRepository,
  listClassAnnouncementsRepository,
  listClassSessionsRepository,
  listClassTemplatesRepository,
  listClassroomMaterialsRepository,
  listClassroomSimulationsRepository,
  updateClassTemplateRepository,
  updateClassTeacherDeskNoteRepository,
  updateClassSessionRepository,
} from "@/lib/repositories/classroom-repository";
import { createClassRepository, deleteClassRepository } from "@/lib/repositories/class-repository";
import { listAssessmentsForManagerRepository } from "@/lib/repositories/assessment-repository";
import { createActivityLogRepository } from "@/lib/repositories/activity-log-repository";
import { listClassDirectMessagesRepository } from "@/lib/repositories/message-repository";
import type {
  ClassroomAnnouncement,
  ClassroomDirectMessage,
  ClassroomLayout,
  ClassroomMaterialItem,
  ClassroomMemberRecord,
  ClassroomOpenAssessment,
  ClassroomSeat,
  ClassroomTemplateSummary,
  ClassroomSessionDetail,
  ClassroomSessionSummary,
  ClassroomSimulationItem,
} from "@/lib/types/classroom";
import type { ServiceResult } from "@/lib/types/service-result";
import { timed } from "@/lib/utils/timing";
import {
  createClassAnnouncementSchema,
  appendClassSessionAssignmentSchema,
  appendClassSessionExtraMaterialSchema,
  appendClassSessionLectureItemSchema,
  appendClassSessionQuickReviewQuestionSchema,
  applyClassTemplateSchema,
  createClassTemplateSchema,
  createClassSessionSchema,
  getClassSessionSchema,
  getClassroomLayoutSchema,
  listClassTemplatesSchema,
  listClassAnnouncementsSchema,
  listClassroomMaterialsSchema,
  listClassroomSimulationsSchema,
  removeClassSessionItemSchema,
  updateClassSessionAccessSchema,
  updateTeacherDeskNoteSchema,
  updateClassSessionOverviewSchema,
} from "@/lib/validators/classroom-validator";
import { replaceClassResourceLinksRepository } from "@/lib/repositories/class-resource-repository";

const DEFAULT_CLASSROOM_COLUMNS = 4;
const DEFAULT_ROWS_PER_VIEWPORT = 5;

export type ManagerClassroomRoomData = {
  layout: ClassroomLayout;
  announcements: ClassroomAnnouncement[];
  sessions: ClassroomSessionSummary[];
  materials: ClassroomMaterialItem[];
  simulations: ClassroomSimulationItem[];
  openAssessments: ClassroomOpenAssessment[];
  directMessages: ClassroomDirectMessage[];
  templates: ClassroomTemplateSummary[];
};

function isSessionAccessibleToStudents(session: ClassroomSessionSummary | ClassroomSessionDetail): boolean {
  if (session.status === "cancelled") {
    return false;
  }

  if (session.studentAccess === "open") {
    return true;
  }

  if (session.studentAccess === "scheduled") {
    return Boolean(session.availableFrom && new Date(session.availableFrom).getTime() <= Date.now());
  }

  return false;
}

async function logClassAnnouncementCreated(input: {
  actorId: string;
  classId: string;
  announcementId: string;
}): Promise<void> {
  try {
    await createActivityLogRepository({
      actorId: input.actorId,
      action: "class.announcement.created",
      entityType: "class",
      entityId: input.classId,
      metadata: {
        announcementId: input.announcementId,
      },
    });
  } catch {
    // Activity log failure must not block classroom announcement flow.
  }
}

function normalizeNameForSeatSort(fullName: string): string {
  return fullName.trim().replace(/\s+/g, " ").toLowerCase();
}

async function buildTemplateBlueprint(classId: string): Promise<{
  teacherDeskNote: string | null;
  linkedMaterialIds: string[];
  linkedSimulationIds: string[];
  sessionBlueprint: Array<{
    title?: string;
    overviewContent?: string;
    overviewObjectives?: string;
    lectureItems?: Array<{
      id: string;
      type: "slide" | "video" | "audio" | "reading";
      title: string;
      url?: string;
      content?: string;
    }>;
    extraMaterials?: Array<{
      id: string;
      title: string;
      url?: string;
      note?: string;
    }>;
    assignments?: Array<{
      id: string;
      title: string;
      instructions?: string;
      imageName?: string;
      imageDataUrl?: string;
    }>;
    quickReviewQuestions?: Array<{
      id: string;
      type: "multiple_choice" | "multiple_answer";
      question: string;
      guidance?: string;
      options: Array<{
        id: string;
        label: string;
        guidance?: string;
        isCorrect: boolean;
      }>;
    }>;
    studentAccess?: "open" | "locked" | "scheduled";
  }>;
}> {
  const [sessionSummaries, resourceLinks, classInfo] = await Promise.all([
    timed("classroom.templateSnapshot.sessions", () => listClassSessionsRepository(classId, true)),
    timed("classroom.templateSnapshot.resourceLinks", () => listClassResourceLinkIdsRepository(classId)),
    timed("classroom.templateSnapshot.classInfo", () => getClassroomClassInfoRepository(classId)),
  ]);

  const sessionBlueprint = await Promise.all(
    sessionSummaries.map(async (summary) => {
      const detail = await getClassSessionDetailRepository({
        classId,
        sessionId: summary.id,
        useServiceRole: true,
      });

      if (!detail) {
        return null;
      }

      return {
        title: detail.title,
        overviewContent: detail.overviewContent,
        overviewObjectives: detail.overviewObjectives,
        lectureItems: detail.lectureItems,
        extraMaterials: detail.extraMaterials,
        assignments: detail.assignments,
        quickReviewQuestions: detail.quickReviewQuestions,
        studentAccess: detail.studentAccess,
      };
    }),
  );

  return {
    teacherDeskNote: classInfo?.teacherDeskNote ?? null,
    linkedMaterialIds: resourceLinks.materialIds,
    linkedSimulationIds: resourceLinks.simulationIds,
    sessionBlueprint: sessionBlueprint.filter((item): item is NonNullable<typeof item> => Boolean(item)),
  };
}

export async function syncClassTemplateSnapshot(classId: string): Promise<void> {
  const [template, classInfo] = await Promise.all([
    timed("classroom.syncTemplate.template", () => getClassTemplateBySourceClassIdRepository(classId)),
    timed("classroom.syncTemplate.classInfo", () => getClassroomClassInfoRepository(classId)),
  ]);

  if (!template || !classInfo) {
    return;
  }

  const blueprint = await buildTemplateBlueprint(classId);

  await updateClassTemplateRepository({
    templateId: template.id,
    name: classInfo.classTitle,
    description: template.description,
    teacherDeskNote: blueprint.teacherDeskNote,
    linkedMaterialIds: blueprint.linkedMaterialIds,
    linkedSimulationIds: blueprint.linkedSimulationIds,
    sessionBlueprint: blueprint.sessionBlueprint,
  });
}

/**
 * Deterministically maps active class members into fixed classroom seats.
 */
export function buildDeterministicClassroomSeats(
  members: ClassroomMemberRecord[],
  columns: number = DEFAULT_CLASSROOM_COLUMNS,
): ClassroomSeat[] {
  const sortedMembers = [...members].sort((left, right) => {
    const normalizedLeftName = normalizeNameForSeatSort(left.fullName);
    const normalizedRightName = normalizeNameForSeatSort(right.fullName);

    if (normalizedLeftName === normalizedRightName) {
      return left.studentId.localeCompare(right.studentId);
    }

    return normalizedLeftName.localeCompare(normalizedRightName);
  });

  return sortedMembers.map((member, index) => {
    const seatOrder = index + 1;

    return {
      seatOrder,
      row: Math.floor(index / columns) + 1,
      column: (index % columns) + 1,
      studentId: member.studentId,
      fullName: member.fullName,
      studentCode: member.studentCode,
    };
  });
}

/**
 * Returns classroom visual layout after validating actor access under RLS.
 */
export async function getClassroomLayout(
  input: Parameters<typeof getClassroomLayoutSchema.parse>[0],
): Promise<ServiceResult<ClassroomLayout>> {
  const parsedInput = getClassroomLayoutSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu lấy bố cục phòng học không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const classInfo = await getClassroomClassInfoRepository(parsedInput.data.classId);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    const members = await listActiveClassMembersRepository(parsedInput.data.classId);
    const seats = buildDeterministicClassroomSeats(members, DEFAULT_CLASSROOM_COLUMNS);

    return {
      ok: true,
      data: {
        classInfo,
        seats,
        columns: DEFAULT_CLASSROOM_COLUMNS,
        rowsPerViewport: DEFAULT_ROWS_PER_VIEWPORT,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải bố cục phòng học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function getManagerClassroomRoomData(input: {
  classId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher";
}): Promise<ServiceResult<ManagerClassroomRoomData>> {
  try {
    const classInfo = await timed("classroom.room.classInfo", () =>
      getClassroomClassInfoRepository(input.classId),
    );

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    const [
      members,
      announcements,
      sessions,
      materials,
      simulations,
      assessments,
      directMessages,
      templates,
    ] = await Promise.all([
      timed("classroom.room.members", () => listActiveClassMembersRepository(input.classId)),
      timed("classroom.room.announcements", () => listClassAnnouncementsRepository(input.classId, 1, 10)),
      timed("classroom.room.sessions", () => listClassSessionsRepository(input.classId, true)),
      timed("classroom.room.materials", () => listClassroomMaterialsRepository(input.classId)),
      timed("classroom.room.simulations", () => listClassroomSimulationsRepository(input.classId)),
      timed("classroom.room.assessments", () => listAssessmentsForManagerRepository({ classId: input.classId })),
      timed("classroom.room.directMessages", () =>
        listClassDirectMessagesRepository({
          classId: input.classId,
          actorId: input.actorId,
        }),
      ),
      timed("classroom.room.templates", () =>
        listClassTemplatesRepository(
          classInfo.courseId,
          input.actorRole === "teacher" ? input.actorId : undefined,
        ),
      ),
    ]);

    const seats = buildDeterministicClassroomSeats(members, DEFAULT_CLASSROOM_COLUMNS);

    return {
      ok: true,
      data: {
        layout: {
          classInfo,
          seats,
          columns: DEFAULT_CLASSROOM_COLUMNS,
          rowsPerViewport: DEFAULT_ROWS_PER_VIEWPORT,
        },
        announcements,
        sessions,
        materials,
        simulations,
        openAssessments: assessments
          .filter((assessment) => assessment.status === "open")
          .map((assessment) => ({
            id: assessment.id,
            title: assessment.title,
            dueAt: assessment.dueAt ?? null,
          })),
        directMessages,
        templates,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải dữ liệu phòng học trực quan.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Returns announcements visible to actor for one class.
 */
export async function listClassAnnouncements(
  input: Parameters<typeof listClassAnnouncementsSchema.parse>[0],
): Promise<ServiceResult<ClassroomAnnouncement[]>> {
  const parsedInput = listClassAnnouncementsSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu danh sách thông báo lớp học không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const classInfo = await getClassroomClassInfoRepository(parsedInput.data.classId);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    const items = await listClassAnnouncementsRepository(
      parsedInput.data.classId,
      parsedInput.data.page,
      parsedInput.data.pageSize,
    );

    return {
      ok: true,
      data: items,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải thông báo lớp học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Creates a published class announcement under manager roles.
 */
export async function createClassAnnouncement(
  input: Parameters<typeof createClassAnnouncementSchema.parse>[0],
): Promise<ServiceResult<ClassroomAnnouncement>> {
  const parsedInput = createClassAnnouncementSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu tạo thông báo lớp học không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole === "student") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Sinh viên không có quyền tạo thông báo lớp học.",
      },
    };
  }

  try {
    const classInfo = await getClassroomClassInfoRepository(parsedInput.data.classId);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    const created = await createClassAnnouncementRepository({
      classId: parsedInput.data.classId,
      actorId: parsedInput.data.actorId,
      title: parsedInput.data.title,
      content: parsedInput.data.content,
    });

    await logClassAnnouncementCreated({
      actorId: parsedInput.data.actorId,
      classId: parsedInput.data.classId,
      announcementId: created.id,
    });

    return {
      ok: true,
      data: created,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo thông báo lớp học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function listClassSessions(input: Parameters<typeof getClassroomLayoutSchema.parse>[0]): Promise<ServiceResult<ClassroomSessionSummary[]>> {
  const parsedInput = getClassroomLayoutSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu danh sách buổi học không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const classInfo = await getClassroomClassInfoRepository(parsedInput.data.classId);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    return {
      ok: true,
      data: await listClassSessionsRepository(parsedInput.data.classId, true),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải danh sách buổi học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function createClassSession(input: Parameters<typeof createClassSessionSchema.parse>[0]): Promise<ServiceResult<ClassroomSessionSummary>> {
  const parsedInput = createClassSessionSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu tạo buổi học không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole === "student") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Sinh viên không có quyền tạo buổi học.",
      },
    };
  }

  try {
    const classInfo = await getClassroomClassInfoRepository(parsedInput.data.classId);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    const created = await createClassSessionRepository({
      classId: parsedInput.data.classId,
      title: parsedInput.data.title,
    });

    return {
      ok: true,
      data: created,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo buổi học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function getClassSession(input: Parameters<typeof getClassSessionSchema.parse>[0]): Promise<ServiceResult<ClassroomSessionDetail>> {
  const parsedInput = getClassSessionSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu buổi học không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const hasClassAccess = await hasClassroomAccessRepository(parsedInput.data.classId);

    if (!hasClassAccess) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy buổi học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    const session = await getClassSessionDetailRepository({
      classId: parsedInput.data.classId,
      sessionId: parsedInput.data.sessionId,
      useServiceRole: true,
    });

    if (!session) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy buổi học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    if (parsedInput.data.actorRole === "student" && !isSessionAccessibleToStudents(session)) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Buổi học này đang bị khóa hoặc chưa đến thời điểm mở.",
        },
      };
    }

    return {
      ok: true,
      data: session,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải buổi học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function updateClassSessionAccess(
  input: Parameters<typeof updateClassSessionAccessSchema.parse>[0],
): Promise<ServiceResult<{ sessionId: string }>> {
  const parsedInput = updateClassSessionAccessSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu khóa/mở buổi học không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const session = await loadEditableSession(parsedInput.data);

    if (!session.ok) {
      return session;
    }

    if (parsedInput.data.studentAccess === "scheduled" && !parsedInput.data.availableFrom) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Vui lòng chọn thời điểm mở buổi học tự động.",
        },
      };
    }

    await updateClassSessionRepository({
      classId: parsedInput.data.classId,
      sessionId: parsedInput.data.sessionId,
      studentAccess: parsedInput.data.studentAccess,
      availableFrom: parsedInput.data.studentAccess === "scheduled" ? parsedInput.data.availableFrom ?? null : null,
    });

    return { ok: true, data: { sessionId: parsedInput.data.sessionId } };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể cập nhật trạng thái mở buổi học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function getManagerForbiddenResult<T>(): ServiceResult<T> {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "Chỉ giảng viên, Mod hoặc Admin được chỉnh sửa buổi học.",
    },
  };
}

async function loadEditableSession(input: {
  classId: string;
  sessionId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
}): Promise<ServiceResult<ClassroomSessionDetail>> {
  if (input.actorRole === "student") {
    return getManagerForbiddenResult();
  }

  const session = await getClassSessionDetailRepository({
    classId: input.classId,
    sessionId: input.sessionId,
  });

  if (!session) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Không tìm thấy buổi học hoặc bạn không có quyền chỉnh sửa.",
      },
    };
  }

  return {
    ok: true,
    data: session,
  };
}

export async function updateClassSessionOverview(input: Parameters<typeof updateClassSessionOverviewSchema.parse>[0]): Promise<ServiceResult<{ sessionId: string }>> {
  const parsedInput = updateClassSessionOverviewSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu cập nhật nội dung buổi học không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const session = await loadEditableSession(parsedInput.data);

    if (!session.ok) {
      return session;
    }

    await updateClassSessionRepository({
      classId: parsedInput.data.classId,
      sessionId: parsedInput.data.sessionId,
      title: parsedInput.data.title,
      overviewContent: parsedInput.data.overviewContent,
      overviewObjectives: parsedInput.data.overviewObjectives,
    });

    return { ok: true, data: { sessionId: parsedInput.data.sessionId } };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể cập nhật nội dung buổi học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function appendClassSessionLectureItem(input: Parameters<typeof appendClassSessionLectureItemSchema.parse>[0]): Promise<ServiceResult<{ sessionId: string }>> {
  const parsedInput = appendClassSessionLectureItemSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu thêm thành phần bài giảng không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const session = await loadEditableSession(parsedInput.data);

    if (!session.ok) {
      return session;
    }

    await updateClassSessionRepository({
      classId: parsedInput.data.classId,
      sessionId: parsedInput.data.sessionId,
      lectureItems: [
        ...session.data.lectureItems,
        {
          id: randomUUID(),
          type: parsedInput.data.type,
          title: parsedInput.data.title,
          url: parsedInput.data.url,
          content: parsedInput.data.content,
        },
      ],
    });

    return { ok: true, data: { sessionId: parsedInput.data.sessionId } };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể thêm thành phần bài giảng.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function appendClassSessionExtraMaterial(input: Parameters<typeof appendClassSessionExtraMaterialSchema.parse>[0]): Promise<ServiceResult<{ sessionId: string }>> {
  const parsedInput = appendClassSessionExtraMaterialSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu thêm tài liệu đọc thêm không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const session = await loadEditableSession(parsedInput.data);

    if (!session.ok) {
      return session;
    }

    await updateClassSessionRepository({
      classId: parsedInput.data.classId,
      sessionId: parsedInput.data.sessionId,
      extraMaterials: [
        ...session.data.extraMaterials,
        {
          id: randomUUID(),
          title: parsedInput.data.title,
          url: parsedInput.data.url,
          note: parsedInput.data.note,
        },
      ],
    });

    return { ok: true, data: { sessionId: parsedInput.data.sessionId } };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể thêm tài liệu đọc thêm.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function appendClassSessionAssignment(input: Parameters<typeof appendClassSessionAssignmentSchema.parse>[0]): Promise<ServiceResult<{ sessionId: string }>> {
  const parsedInput = appendClassSessionAssignmentSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu thêm bài tập không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const session = await loadEditableSession(parsedInput.data);

    if (!session.ok) {
      return session;
    }

    await updateClassSessionRepository({
      classId: parsedInput.data.classId,
      sessionId: parsedInput.data.sessionId,
      assignments: [
        ...session.data.assignments,
        {
          id: randomUUID(),
          title: parsedInput.data.title,
          instructions: parsedInput.data.instructions,
          imageName: parsedInput.data.imageName,
          imageDataUrl: parsedInput.data.imageDataUrl,
        },
      ],
    });

    return { ok: true, data: { sessionId: parsedInput.data.sessionId } };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể thêm bài tập.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function appendClassSessionQuickReviewQuestion(input: Parameters<typeof appendClassSessionQuickReviewQuestionSchema.parse>[0]): Promise<ServiceResult<{ sessionId: string }>> {
  const parsedInput = appendClassSessionQuickReviewQuestionSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu thêm câu hỏi ôn tập không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const session = await loadEditableSession(parsedInput.data);

    if (!session.ok) {
      return session;
    }

    const correctOptionIndexes = new Set(parsedInput.data.correctOptionIndexes);

    await updateClassSessionRepository({
      classId: parsedInput.data.classId,
      sessionId: parsedInput.data.sessionId,
      quickReviewQuestions: [
        ...session.data.quickReviewQuestions,
        {
          id: randomUUID(),
          type: parsedInput.data.type,
          question: parsedInput.data.question,
          guidance: parsedInput.data.guidance,
          options: parsedInput.data.options.map((label, index) => ({
            id: randomUUID(),
            label,
            guidance: parsedInput.data.optionGuidances?.[index]?.trim() || undefined,
            isCorrect: correctOptionIndexes.has(index),
          })),
        },
      ],
    });

    return { ok: true, data: { sessionId: parsedInput.data.sessionId } };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể thêm câu hỏi ôn tập.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function removeClassSessionItem(input: Parameters<typeof removeClassSessionItemSchema.parse>[0]): Promise<ServiceResult<{ sessionId: string }>> {
  const parsedInput = removeClassSessionItemSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu xoá mục trong buổi học không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const session = await loadEditableSession(parsedInput.data);

    if (!session.ok) {
      return session;
    }

    switch (parsedInput.data.collection) {
      case "lectureItems":
        await updateClassSessionRepository({
          classId: parsedInput.data.classId,
          sessionId: parsedInput.data.sessionId,
          lectureItems: session.data.lectureItems.filter((item) => item.id !== parsedInput.data.itemId),
        });
        break;
      case "extraMaterials":
        await updateClassSessionRepository({
          classId: parsedInput.data.classId,
          sessionId: parsedInput.data.sessionId,
          extraMaterials: session.data.extraMaterials.filter((item) => item.id !== parsedInput.data.itemId),
        });
        break;
      case "assignments":
        await updateClassSessionRepository({
          classId: parsedInput.data.classId,
          sessionId: parsedInput.data.sessionId,
          assignments: session.data.assignments.filter((item) => item.id !== parsedInput.data.itemId),
        });
        break;
      case "quickReviewQuestions":
        await updateClassSessionRepository({
          classId: parsedInput.data.classId,
          sessionId: parsedInput.data.sessionId,
          quickReviewQuestions: session.data.quickReviewQuestions.filter((item) => item.id !== parsedInput.data.itemId),
        });
        break;
    }

    return { ok: true, data: { sessionId: parsedInput.data.sessionId } };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể xoá mục trong buổi học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Returns classroom materials in class course context.
 */
export async function listClassroomMaterials(
  input: Parameters<typeof listClassroomMaterialsSchema.parse>[0],
): Promise<ServiceResult<ClassroomMaterialItem[]>> {
  const parsedInput = listClassroomMaterialsSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu danh sách tài liệu phòng học không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const classInfo = await getClassroomClassInfoRepository(parsedInput.data.classId);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    const items = await listClassroomMaterialsRepository(parsedInput.data.classId);

    return {
      ok: true,
      data: items,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải tủ tài liệu phòng học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Returns classroom simulations in class course context.
 */
export async function listClassroomSimulations(
  input: Parameters<typeof listClassroomSimulationsSchema.parse>[0],
): Promise<ServiceResult<ClassroomSimulationItem[]>> {
  const parsedInput = listClassroomSimulationsSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu danh sách mô phỏng phòng học không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const classInfo = await getClassroomClassInfoRepository(parsedInput.data.classId);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    const items = await listClassroomSimulationsRepository(parsedInput.data.classId);

    return {
      ok: true,
      data: items,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải danh sách mô phỏng phòng học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function updateTeacherDeskNote(
  input: Parameters<typeof updateTeacherDeskNoteSchema.parse>[0],
): Promise<ServiceResult<{ classId: string }>> {
  const parsedInput = updateTeacherDeskNoteSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu cập nhật ghi chú bàn giảng viên không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole === "student") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Sinh viên không có quyền cập nhật ghi chú bàn giảng viên.",
      },
    };
  }

  try {
    const classInfo = await getClassroomClassInfoRepository(parsedInput.data.classId);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    if (parsedInput.data.actorRole === "teacher" && classInfo.teacherId !== parsedInput.data.actorId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Giảng viên không có quyền cập nhật ghi chú của lớp này.",
        },
      };
    }

    await updateClassTeacherDeskNoteRepository({
      classId: parsedInput.data.classId,
      note: parsedInput.data.note,
    });

    return {
      ok: true,
      data: { classId: parsedInput.data.classId },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể cập nhật ghi chú bàn giảng viên.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function listClassTemplates(
  input: Parameters<typeof listClassTemplatesSchema.parse>[0],
): Promise<ServiceResult<ClassroomTemplateSummary[]>> {
  const parsedInput = listClassTemplatesSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu lớp mẫu không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole === "student") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Sinh viên không có quyền xem lớp mẫu.",
      },
    };
  }

  try {
    const classInfo = await getClassroomClassInfoRepository(parsedInput.data.classId);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    const templates = await listClassTemplatesRepository(classInfo.courseId, parsedInput.data.actorRole === "teacher" ? parsedInput.data.actorId : undefined);

    return {
      ok: true,
      data: templates,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải danh sách lớp mẫu.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function createClassTemplate(
  input: Parameters<typeof createClassTemplateSchema.parse>[0],
): Promise<ServiceResult<{ classId: string }>> {
  const parsedInput = createClassTemplateSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu lưu lớp mẫu không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole === "student") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Sinh viên không có quyền lưu lớp mẫu.",
      },
    };
  }

  try {
    const classInfo = await getClassroomClassInfoRepository(parsedInput.data.classId);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    const blueprint = await buildTemplateBlueprint(parsedInput.data.classId);

    await createClassTemplateRepository({
      courseId: classInfo.courseId,
      sourceClassId: parsedInput.data.classId,
      actorId: parsedInput.data.actorId,
      name: parsedInput.data.name,
      description: parsedInput.data.description,
      teacherDeskNote: blueprint.teacherDeskNote,
      linkedMaterialIds: blueprint.linkedMaterialIds,
      linkedSimulationIds: blueprint.linkedSimulationIds,
      sessionBlueprint: blueprint.sessionBlueprint,
    });

    return {
      ok: true,
      data: { classId: parsedInput.data.classId },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể lưu lớp học mẫu.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function createTemplateClass(
  input: {
    courseId: string;
    actorId: string;
    actorRole: "admin" | "moderator" | "teacher" | "student";
    name: string;
    description?: string;
  },
): Promise<ServiceResult<{ classId: string; templateId: string }>> {
  if (input.actorRole === "student") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Sinh viên không có quyền tạo lớp mẫu.",
      },
    };
  }

  const templateCode = `TPL_${randomUUID().slice(0, 8).toUpperCase()}`;

  try {
    const createdClass = await createClassRepository({
      courseId: input.courseId,
      teacherId: input.actorId,
      classCode: templateCode,
      title: input.name,
      status: "draft",
      isOpenForEnrollment: false,
    });

    await createClassTemplateRepository({
      courseId: input.courseId,
      sourceClassId: createdClass.id,
      actorId: input.actorId,
      name: input.name,
      description: input.description,
      teacherDeskNote: null,
      linkedMaterialIds: [],
      linkedSimulationIds: [],
      sessionBlueprint: [],
    });

    return {
      ok: true,
      data: {
        classId: createdClass.id,
        templateId: createdClass.id,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo lớp mẫu.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function deleteClassTemplate(
  input: {
    templateId: string;
    actorId: string;
    actorRole: "admin" | "moderator" | "teacher" | "student";
  },
): Promise<ServiceResult<{ templateId: string }>> {
  if (input.actorRole === "student") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Sinh viên không có quyền xóa lớp mẫu.",
      },
    };
  }

  try {
    const template = await getClassTemplateByIdRepository(input.templateId);

    if (!template) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp mẫu.",
        },
      };
    }

    if (template.created_by !== input.actorId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Bạn chỉ có thể xóa lớp mẫu do chính mình tạo.",
        },
      };
    }

    if (template.source_class_id) {
      const sourceClass = await getClassroomClassInfoRepository(template.source_class_id);

      if (sourceClass?.classCode.startsWith("TPL_")) {
        await deleteClassRepository(template.source_class_id);
      }
    }

    await deleteClassTemplateRepository(input.templateId);

    return {
      ok: true,
      data: { templateId: input.templateId },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể xóa lớp mẫu.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function applyClassTemplate(
  input: Parameters<typeof applyClassTemplateSchema.parse>[0],
): Promise<ServiceResult<{ classId: string }>> {
  const parsedInput = applyClassTemplateSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu áp dụng lớp mẫu không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole === "student") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Sinh viên không có quyền áp dụng lớp mẫu.",
      },
    };
  }

  try {
    const [classInfo, template, activeMembers, assessments] = await Promise.all([
      getClassroomClassInfoRepository(parsedInput.data.classId),
      getClassTemplateByIdRepository(parsedInput.data.templateId),
      listActiveClassMembersRepository(parsedInput.data.classId),
      listAssessmentsForManagerRepository({ classId: parsedInput.data.classId }),
    ]);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    if (!template) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp mẫu.",
        },
      };
    }

    if (template.course_id !== classInfo.courseId) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Chỉ có thể áp dụng lớp mẫu cho lớp cùng học phần.",
        },
      };
    }

    if (activeMembers.length > 0 || assessments.length > 0) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Chỉ có thể áp dụng lớp mẫu khi lớp chưa có sinh viên và chưa có bài kiểm tra.",
        },
      };
    }

    const blueprint = Array.isArray(template.session_blueprint) ? template.session_blueprint : [];

    await deleteClassSessionsByClassIdRepository(parsedInput.data.classId);

    await createClassSessionsFromTemplateRepository({
      classId: parsedInput.data.classId,
      sessions: blueprint as never,
    });

    await replaceClassResourceLinksRepository({
      classId: parsedInput.data.classId,
      linkedBy: parsedInput.data.actorId,
      materialIds: template.linked_material_ids ?? [],
      simulationIds: template.linked_simulation_ids ?? [],
    });

    await updateClassTeacherDeskNoteRepository({
      classId: parsedInput.data.classId,
      note: template.teacher_desk_note ?? undefined,
    });

    return {
      ok: true,
      data: { classId: parsedInput.data.classId },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể áp dụng lớp mẫu.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
