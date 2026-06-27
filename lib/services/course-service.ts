import {
  archiveCourseRepository,
  assignCourseModeratorRepository,
  applyApprovedCourseChangeRequestRepository,
  assignCourseTeachersRepository,
  createCourseChangeRequestRepository,
  createCourseCreateRequestRepository,
  createCourseUpdateRequestRepository,
  createCourseRepository,
  deleteCourseRepository,
  getCourseDeletionBlockersRepository,
  getCourseByIdRepository,
  getCourseChangeRequestByIdRepository,
  listActiveModeratorsRepository,
  listActiveTeachersRepository,
  listCourseChangeRequestsRepository,
  listCoursesForUserRepository,
  reviewCourseChangeRequestRepository,
  seedDefaultSimulationWidgetsForCourseRepository,
  updateCourseRepository,
  type ListCoursesRepositoryResult,
} from "@/lib/repositories/course-repository";
import type { CourseChangeRequest, CourseModeratorOption, CourseSummary, CourseTeacherOption } from "@/lib/types/course";
import type { CourseAssessmentComponent, CourseCloItem } from "@/lib/types/course";
import type { Paginated } from "@/lib/types/pagination";
import type { ServiceResult } from "@/lib/types/service-result";
import {
  archiveCourseSchema,
  createCourseSchema,
  deleteCourseSchema,
  listCoursesForUserSchema,
  updateCourseSchema,
} from "@/lib/validators/course-validator";

export type ListCoursesForUserInput = {
  userId: string;
  role: "admin" | "moderator" | "teacher" | "student";
  query?: string;
  status?: "draft" | "active" | "archived";
  page?: number;
  pageSize?: number;
};

export type CreateCourseInput = {
  ownerId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  code: string;
  title: string;
  description?: string;
  visibility?: "private" | "unlisted" | "public_preview";
  status?: "draft" | "active" | "archived";
  credits?: number;
  knowledgeBlock?: "general" | "foundation" | "major";
  courseType?: "required" | "elective";
  assignedTeacherIds?: string[];
  cloItems?: CourseCloItem[];
  assessmentComponents?: CourseAssessmentComponent[];
};

export type UpdateCourseInput = {
  courseId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  title: string;
  description?: string;
  visibility: "private" | "unlisted" | "public_preview";
  status: "draft" | "active" | "archived";
  credits?: number;
  knowledgeBlock?: "general" | "foundation" | "major";
  courseType?: "required" | "elective";
  cloItems?: CourseCloItem[];
  assessmentComponents?: CourseAssessmentComponent[];
};

export type ArchiveCourseInput = {
  courseId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
};

export type DeleteCourseInput = {
  courseId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
};

export type AssignCourseModeratorInput = {
  courseId: string;
  moderatorId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
};

export type AssignCourseTeachersInput = {
  courseId: string;
  teacherIds: string[];
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
};

export type CreateCourseChangeRequestInput = {
  courseId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  action: "archive" | "delete";
  reason?: string;
};

export type ReviewCourseChangeRequestInput = {
  requestId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  decision: "approved" | "rejected";
  note?: string;
};

function normalizeRepositoryError(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    return { message: error.message };
  }

  if (error && typeof error === "object") {
    const errorLike = error as { message?: unknown; code?: unknown };
    const message = typeof errorLike.message === "string" ? errorLike.message : "Unknown repository error";
    const code = typeof errorLike.code === "string" ? errorLike.code : undefined;
    return { message, code };
  }

  return { message: "Unknown repository error" };
}

function toPaginatedResult(
  repositoryResult: ListCoursesRepositoryResult,
  page: number,
  pageSize: number,
): Paginated<CourseSummary> {
  const totalPages = repositoryResult.totalItems === 0 ? 0 : Math.ceil(repositoryResult.totalItems / pageSize);

  return {
    items: repositoryResult.items,
    page,
    pageSize,
    totalItems: repositoryResult.totalItems,
    totalPages,
  };
}

/**
 * Lists courses visible to the given user role with pagination and optional filters.
 */
export async function listCoursesForUser(
  input: ListCoursesForUserInput,
): Promise<ServiceResult<Paginated<CourseSummary>>> {
  const parsedInput = listCoursesForUserSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu danh sách học phần không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const normalizedInput = parsedInput.data;

  if (normalizedInput.role === "student") {
    return {
      ok: true,
      data: {
        items: [],
        page: normalizedInput.page,
        pageSize: normalizedInput.pageSize,
        totalItems: 0,
        totalPages: 0,
      },
    };
  }

  try {
    const repositoryResult = await listCoursesForUserRepository({
      userId: normalizedInput.userId,
      role: normalizedInput.role,
      query: normalizedInput.query,
      status: normalizedInput.status,
      page: normalizedInput.page,
      pageSize: normalizedInput.pageSize,
    });

    return {
      ok: true,
      data: toPaginatedResult(repositoryResult, normalizedInput.page, normalizedInput.pageSize),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown repository error";

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể lấy danh sách học phần.",
        details: message,
      },
    };
  }
}

/**
 * Creates a course directly for admin, or creates a pending request for moderator.
 */
export async function createCourse(input: CreateCourseInput): Promise<ServiceResult<CourseSummary | CourseChangeRequest>> {
  const parsedInput = createCourseSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu tạo học phần không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole === "teacher" || parsedInput.data.actorRole === "student") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Mod/Admin được khởi tạo học phần.",
      },
    };
  }

  try {
    if (parsedInput.data.actorRole === "moderator") {
      const request = await createCourseCreateRequestRepository({
        requestedBy: parsedInput.data.ownerId,
        code: parsedInput.data.code,
        title: parsedInput.data.title,
        description: parsedInput.data.description,
        visibility: parsedInput.data.visibility,
        credits: parsedInput.data.credits,
        knowledgeBlock: parsedInput.data.knowledgeBlock,
        courseType: parsedInput.data.courseType,
        cloItems: parsedInput.data.cloItems,
        assessmentComponents: parsedInput.data.assessmentComponents,
      });

      return {
        ok: true,
        data: request,
      };
    }

    const createdCourse = await createCourseRepository(parsedInput.data);

    if (parsedInput.data.actorRole === "admin") {
      await assignCourseTeachersRepository({
        courseId: createdCourse.id,
        teacherIds: parsedInput.data.assignedTeacherIds ?? [],
        grantedBy: parsedInput.data.ownerId,
      });
    }

    await seedDefaultSimulationWidgetsForCourseRepository(createdCourse.id);

    const refreshedCourse = await getCourseByIdRepository(createdCourse.id);

    return {
      ok: true,
      data: refreshedCourse ?? createdCourse,
    };
  } catch (error) {
    const { code, message } = normalizeRepositoryError(error);
    const lowerMessage = message.toLowerCase();

    if (code === "23505" || lowerMessage.includes("duplicate") || lowerMessage.includes("unique")) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Mã học phần đã tồn tại với giảng viên này.",
          field: "code",
          details: message,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo học phần.",
        details: message,
      },
    };
  }
}

/**
 * Updates editable course fields while enforcing actor role constraints.
 */
export async function updateCourse(input: UpdateCourseInput): Promise<ServiceResult<CourseSummary | CourseChangeRequest>> {
  const parsedInput = updateCourseSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu cập nhật học phần không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const normalizedInput = parsedInput.data;

  if (normalizedInput.actorRole !== "teacher" && normalizedInput.actorRole !== "admin" && normalizedInput.actorRole !== "moderator") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền cập nhật học phần.",
      },
    };
  }

  try {
    const currentCourse = await getCourseByIdRepository(normalizedInput.courseId);

    if (!currentCourse) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy học phần để cập nhật hoặc bạn không được phép sửa.",
        },
      };
    }

    if (
      normalizedInput.actorRole === "admin" &&
      currentCourse.ownerRole === "moderator" &&
      currentCourse.ownerId !== normalizedInput.actorId
    ) {
      const request = await createCourseUpdateRequestRepository({
        targetCourseId: currentCourse.id,
        requestedBy: normalizedInput.actorId,
        assignedModeratorId: currentCourse.ownerId,
        codeSnapshot: currentCourse.code,
        titleSnapshot: currentCourse.title,
        title: normalizedInput.title,
        description: normalizedInput.description,
        visibility: normalizedInput.visibility,
        status: normalizedInput.status,
        credits: normalizedInput.credits,
        knowledgeBlock: normalizedInput.knowledgeBlock,
        courseType: normalizedInput.courseType,
        cloItems: normalizedInput.cloItems,
        assessmentComponents: normalizedInput.assessmentComponents,
      });

      return {
        ok: true,
        data: request,
      };
    }

    const updatedCourse = await updateCourseRepository(normalizedInput);

    if (!updatedCourse) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy học phần để cập nhật hoặc bạn không được phép sửa.",
        },
      };
    }

    return {
      ok: true,
      data: updatedCourse,
    };
  } catch (error) {
    const { message } = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể cập nhật học phần.",
        details: message,
      },
    };
  }
}

/**
 * Archives a course by status transition only; no hard-delete is allowed.
 */
export async function archiveCourse(input: ArchiveCourseInput): Promise<ServiceResult<{ archived: true }>> {
  const parsedInput = archiveCourseSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu lưu trữ học phần không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const normalizedInput = parsedInput.data;

  if (normalizedInput.actorRole === "teacher") {
    const requestResult = await createCourseChangeRequest({
      courseId: normalizedInput.courseId,
      actorId: normalizedInput.actorId,
      actorRole: normalizedInput.actorRole,
      action: "archive",
    });

    return requestResult.ok ? { ok: true, data: { archived: true } } : { ok: false, error: requestResult.error };
  }

  if (normalizedInput.actorRole !== "admin" && normalizedInput.actorRole !== "moderator") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền lưu trữ học phần.",
      },
    };
  }

  try {
    const archived = await archiveCourseRepository(normalizedInput);

    if (!archived) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy học phần để lưu trữ hoặc bạn không được phép thao tác.",
        },
      };
    }

    return {
      ok: true,
      data: { archived: true },
    };
  } catch (error) {
    const { message } = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể lưu trữ học phần.",
        details: message,
      },
    };
  }
}

export async function createCourseChangeRequest(
  input: CreateCourseChangeRequestInput,
): Promise<ServiceResult<CourseChangeRequest>> {
  if (input.actorRole !== "teacher" && input.actorRole !== "moderator" && input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền tạo yêu cầu thay đổi học phần.",
      },
    };
  }

  if (input.action === "delete" && input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được yêu cầu xóa học phần.",
      },
    };
  }

  try {
    const course = await getCourseByIdRepository(input.courseId);

    if (!course) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy học phần.",
        },
      };
    }

    if (input.actorRole === "teacher" && course.ownerId !== input.actorId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Bạn không được phép thao tác với học phần này.",
        },
      };
    }

    const request = await createCourseChangeRequestRepository({
      action: input.action,
      course,
      requestedBy: input.actorId,
      reason: input.reason,
    });

    return { ok: true, data: request };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo yêu cầu thay đổi học phần.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}

export async function reviewCourseChangeRequest(
  input: ReviewCourseChangeRequestInput,
): Promise<ServiceResult<CourseChangeRequest>> {
  if (input.actorRole !== "moderator" && input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Mod/Admin được duyệt yêu cầu thay đổi học phần.",
      },
    };
  }

  try {
    const request = await getCourseChangeRequestByIdRepository(input.requestId);

    if (!request) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy yêu cầu thay đổi học phần.",
        },
      };
    }

    if (request.status !== "pending_review") {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Yêu cầu này đã được xử lý.",
        },
      };
    }

    if (request.action === "delete" && input.actorRole !== "admin") {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Chỉ Admin được duyệt yêu cầu xóa học phần.",
        },
      };
    }

    if (request.action === "create" && input.actorRole !== "admin") {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Chỉ Admin được duyệt yêu cầu tạo học phần.",
        },
      };
    }

    if (request.action === "update" && (input.actorRole !== "moderator" || request.assignedModeratorId !== input.actorId)) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Chỉ Mod đang quản lý học phần được xác nhận chỉnh sửa này.",
        },
      };
    }

    if (input.decision === "approved") {
      await applyApprovedCourseChangeRequestRepository({
        request,
        reviewedBy: input.actorId,
      });
    }

    const reviewed = await reviewCourseChangeRequestRepository({
      requestId: input.requestId,
      reviewedBy: input.actorId,
      status: input.decision,
      reviewNote: input.note,
    });

    if (!reviewed) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy yêu cầu sau khi duyệt.",
        },
      };
    }

    return { ok: true, data: reviewed };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể duyệt yêu cầu thay đổi học phần.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}

/**
 * Hard-deletes a course. Reserved for admin because dependent class/material/simulation rows cascade.
 */
export async function deleteCourse(input: DeleteCourseInput): Promise<ServiceResult<{ deleted: true }>> {
  const parsedInput = deleteCourseSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu xóa học phần không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được xóa học phần.",
      },
    };
  }

  try {
    const blockers = await getCourseDeletionBlockersRepository(parsedInput.data.courseId);

    if (blockers.classCount > 0 || blockers.materialCount > 0) {
      const blockingReasons = [
        blockers.classCount > 0 ? `${blockers.classCount} lớp học phần` : null,
        blockers.materialCount > 0 ? `${blockers.materialCount} tài liệu` : null,
      ].filter((value): value is string => Boolean(value));

      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: `Không thể xóa học phần vì vẫn còn ${blockingReasons.join(" và ")} liên kết.`,
        },
      };
    }

    const deleted = await deleteCourseRepository({ courseId: parsedInput.data.courseId });

    if (!deleted) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy học phần để xóa.",
        },
      };
    }

    return { ok: true, data: { deleted: true } };
  } catch (error) {
    const { code, message } = normalizeRepositoryError(error);

    if (code === "23503" || message.toLowerCase().includes("foreign key")) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Không thể xóa học phần vì vẫn còn dữ liệu liên kết cần xử lý trước.",
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể xóa học phần.",
        details: message,
      },
    };
  }
}

export async function listActiveModerators(): Promise<ServiceResult<CourseModeratorOption[]>> {
  try {
    const moderators = await listActiveModeratorsRepository();
    return { ok: true, data: moderators };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải danh sách Mod.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}

export async function listActiveTeachers(): Promise<ServiceResult<CourseTeacherOption[]>> {
  try {
    const teachers = await listActiveTeachersRepository();
    return { ok: true, data: teachers };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải danh sách giảng viên.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}

export async function assignCourseModerator(input: AssignCourseModeratorInput): Promise<ServiceResult<CourseSummary>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được giao Mod quản lý học phần.",
      },
    };
  }

  if (!input.courseId || !input.moderatorId) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Vui lòng chọn học phần và Mod quản lý.",
      },
    };
  }

  try {
    const moderators = await listActiveModeratorsRepository();
    const selectedModerator = moderators.find((moderator) => moderator.id === input.moderatorId);

    if (!selectedModerator) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy Mod đang hoạt động để giao quản lý.",
        },
      };
    }

    const course = await assignCourseModeratorRepository({
      courseId: input.courseId,
      moderatorId: input.moderatorId,
      grantedBy: input.actorId,
    });

    if (!course) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy học phần để giao quản lý.",
        },
      };
    }

    return { ok: true, data: course };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể giao Mod quản lý học phần.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}

export async function assignCourseTeachers(input: AssignCourseTeachersInput): Promise<ServiceResult<CourseSummary>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được giao giảng viên phụ trách học phần.",
      },
    };
  }

  if (!input.courseId) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Vui lòng chọn học phần cần giao giảng viên phụ trách.",
      },
    };
  }

  try {
    const teachers = await listActiveTeachersRepository();
    const activeTeacherIds = new Set(teachers.map((teacher) => teacher.id));
    const normalizedTeacherIds = [...new Set(input.teacherIds.filter((teacherId) => activeTeacherIds.has(teacherId)))];

    if (input.teacherIds.length > 0 && normalizedTeacherIds.length === 0) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy giảng viên đang hoạt động để gán vào học phần.",
        },
      };
    }

    const currentCourse = await getCourseByIdRepository(input.courseId);

    if (!currentCourse) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy học phần để giao giảng viên phụ trách.",
        },
      };
    }

    await assignCourseTeachersRepository({
      courseId: input.courseId,
      teacherIds: normalizedTeacherIds,
      grantedBy: input.actorId,
    });

    const updatedCourse = await getCourseByIdRepository(input.courseId);

    if (!updatedCourse) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không thể tải lại học phần sau khi giao giảng viên phụ trách.",
        },
      };
    }

    return { ok: true, data: updatedCourse };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể giao giảng viên phụ trách học phần.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}

export async function listCourseChangeRequests(): Promise<ServiceResult<CourseChangeRequest[]>> {
  try {
    const requests = await listCourseChangeRequestsRepository();
    return { ok: true, data: requests };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải yêu cầu thay đổi học phần.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}
