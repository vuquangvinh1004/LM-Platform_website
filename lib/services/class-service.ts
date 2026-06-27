import {
  createClassMembershipsRepository,
  createClassCreateRequestRepository,
  createClassLifecycleRequestRepository,
  applyApprovedClassChangeRequestRepository,
  findManageableClassRepository,
  findManageableCourseRepository,
  findStudentProfilesRepository,
  getClassChangeRequestByIdRepository,
  listClassChangeRequestsRepository,
  listClassesForUserRepository,
  listClassMembersRepository,
  listExistingActiveMembershipStudentIdsRepository,
  reviewClassChangeRequestRepository,
  type ListClassesForUserRepositoryResult,
  type ListClassMembersRepositoryResult,
} from "@/lib/repositories/class-repository";
import { createActivityLogRepository } from "@/lib/repositories/activity-log-repository";
import type { AddStudentsResult, ClassChangeRequest, ClassMemberSummary, CourseClassSummary } from "@/lib/types/class";
import type { Paginated } from "@/lib/types/pagination";
import type { ServiceResult } from "@/lib/types/service-result";
import {
  addStudentsToClassSchema,
  createClassSchema,
  importStudentsToClassSchema,
  listClassesForUserSchema,
  listClassMembersSchema,
} from "@/lib/validators/class-validator";
import { normalizeSpreadsheetHeader, readSpreadsheetMatrixFromCsv } from "@/lib/spreadsheets/spreadsheet-utils";

export type CreateClassInput = {
  courseId: string;
  teacherId: string;
  teacherRole: "admin" | "moderator" | "teacher" | "student";
  classCode: string;
  title: string;
  semester?: string;
  academicYear?: string;
  status?: "draft" | "active" | "archived";
};

export type AddStudentsToClassInput = {
  classId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  students: Array<{
    email?: string;
    studentCode?: string;
    fullName: string;
  }>;
};

type StudentMembershipInput = AddStudentsToClassInput["students"][number];

export type ListClassMembersInput = {
  classId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  page?: number;
  pageSize?: number;
};

export type ListClassesForUserInput = {
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  page?: number;
  pageSize?: number;
};

export type ImportStudentsToClassInput = {
  classId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  csvContent: string;
};

export type ReviewClassChangeRequestInput = {
  requestId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  decision: "approved" | "rejected";
  note?: string;
};

export type CreateClassLifecycleRequestInput = {
  classId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  action: "archive" | "delete";
  reason?: string;
};

export type ListClassChangeRequestsInput = {
  requestedBy?: string;
  courseIds?: string[];
  statuses?: Array<"pending_review" | "approved" | "rejected">;
  actions?: Array<"create" | "archive" | "delete">;
};

const fullNameHeaderAliases = new Set([
  "full name",
  "full_name",
  "fullname",
  "ho ten",
  "ho_ten",
  "name",
]);

const emailHeaderAliases = new Set(["email", "e-mail", "mail"]);

const studentCodeHeaderAliases = new Set([
  "student code",
  "student_code",
  "studentcode",
  "student id",
  "student_id",
  "ma sinh vien",
  "ma_sv",
]);

function normalizeRepositoryError(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    return { message: error.message };
  }

  if (error && typeof error === "object") {
    const errorLike = error as { message?: unknown; code?: unknown };
    return {
      message: typeof errorLike.message === "string" ? errorLike.message : "Unknown repository error",
      code: typeof errorLike.code === "string" ? errorLike.code : undefined,
    };
  }

  return { message: "Unknown repository error" };
}

function toPaginatedResult<T>(repositoryResult: { items: T[]; totalItems: number }, page: number, pageSize: number): Paginated<T> {
  const totalPages = repositoryResult.totalItems === 0 ? 0 : Math.ceil(repositoryResult.totalItems / pageSize);

  return {
    items: repositoryResult.items,
    page,
    pageSize,
    totalItems: repositoryResult.totalItems,
    totalPages,
  };
}

function parseStudentsFromCsv(csvContent: string): AddStudentsToClassInput["students"] {
  const rows = readSpreadsheetMatrixFromCsv(csvContent, "Tệp CSV không hợp lệ hoặc không có dữ liệu.");

  const headerRow = rows[0]?.map((cell) => normalizeSpreadsheetHeader(String(cell ?? ""))) ?? [];
  const fullNameIndex = headerRow.findIndex((value) => fullNameHeaderAliases.has(value));
  const emailIndex = headerRow.findIndex((value) => emailHeaderAliases.has(value));
  const studentCodeIndex = headerRow.findIndex((value) => studentCodeHeaderAliases.has(value));

  if (fullNameIndex === -1) {
    throw new Error("CSV phải có cột họ tên (fullName/full_name/họ tên).\n");
  }

  if (emailIndex === -1 && studentCodeIndex === -1) {
    throw new Error("CSV phải có ít nhất một cột email hoặc mã sinh viên.");
  }

  const students = rows
    .slice(1)
    .map((row): StudentMembershipInput | null => {
      const fullName = String(row[fullNameIndex] ?? "").trim();
      const email = emailIndex === -1 ? undefined : String(row[emailIndex] ?? "").trim().toLowerCase() || undefined;
      const studentCode = studentCodeIndex === -1 ? undefined : String(row[studentCodeIndex] ?? "").trim() || undefined;

      if (!fullName && !email && !studentCode) {
        return null;
      }

      return {
        fullName,
        email,
        studentCode,
      };
    })
    .filter((row): row is StudentMembershipInput => row !== null);

  if (students.length === 0) {
    throw new Error("CSV không có dòng dữ liệu hợp lệ để nhập.");
  }

  return students;
}

async function logClassMemberImport(input: {
  actorId: string;
  classId: string;
  added?: number;
  skipped?: number;
  status: "completed" | "failed";
  reason?: string;
}): Promise<void> {
  try {
    await createActivityLogRepository({
      actorId: input.actorId,
      action: "class.members.import_csv",
      entityType: "class",
      entityId: input.classId,
      metadata: {
        status: input.status,
        added: input.added,
        skipped: input.skipped,
        reason: input.reason,
      },
    });
  } catch {
    // Activity log failure must not block class member import flow.
  }
}

/**
 * Lists classes visible to teacher/admin/student by ownership or active membership.
 */
export async function listClassesForUser(
  input: ListClassesForUserInput,
): Promise<ServiceResult<Paginated<CourseClassSummary>>> {
  const parsedInput = listClassesForUserSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu danh sách lớp không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const normalizedInput = parsedInput.data;

  try {
    const repositoryResult: ListClassesForUserRepositoryResult = await listClassesForUserRepository(normalizedInput);

    return {
      ok: true,
      data: toPaginatedResult(repositoryResult, normalizedInput.page, normalizedInput.pageSize),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể lấy danh sách lớp.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}

export async function listClassChangeRequests(input: ListClassChangeRequestsInput = {}): Promise<ServiceResult<ClassChangeRequest[]>> {
  try {
    const requests = await listClassChangeRequestsRepository(input);
    return { ok: true, data: requests };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải yêu cầu thay đổi lớp học.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}

/**
 * Creates a class request for a teacher on a manageable course.
 */
export async function createClass(input: CreateClassInput): Promise<ServiceResult<CourseClassSummary>> {
  const parsedInput = createClassSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu tạo lớp không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const normalizedInput = parsedInput.data;

  if (normalizedInput.teacherRole !== "teacher") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message:
          normalizedInput.teacherRole === "moderator"
            ? "Mod không tạo lớp học phần; Mod chỉ duyệt yêu cầu mở lớp của giảng viên."
            : normalizedInput.teacherRole === "admin"
              ? "Admin không tạo lớp học phần trực tiếp; lớp học do giảng viên gửi yêu cầu để Mod duyệt."
              : "Bạn không có quyền tạo lớp học phần.",
      },
    };
  }

  try {
    const course = await findManageableCourseRepository({
      courseId: normalizedInput.courseId,
      actorId: normalizedInput.teacherId,
      actorRole: normalizedInput.teacherRole,
    });

    if (!course) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy học phần hoặc bạn không được phép tạo lớp cho học phần này.",
        },
      };
    }

    if (course.status === "archived") {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Học phần đã lưu trữ, không thể tạo lớp mới.",
          field: "courseId",
        },
      };
    }

    const request = await createClassCreateRequestRepository({
      courseId: normalizedInput.courseId,
      teacherId: normalizedInput.teacherId,
      requestedBy: normalizedInput.teacherId,
      classCode: normalizedInput.classCode,
      title: normalizedInput.title,
      semester: normalizedInput.semester,
      academicYear: normalizedInput.academicYear,
      status: normalizedInput.status,
    });

    return {
      ok: true,
      data: {
        id: request.id,
        courseId: normalizedInput.courseId,
        teacherId: normalizedInput.teacherId,
        courseCode: "",
        courseTitle: course.title,
        classCode: normalizedInput.classCode,
        title: normalizedInput.title,
        semester: normalizedInput.semester ?? null,
        academicYear: normalizedInput.academicYear ?? null,
        status: normalizedInput.status,
        createdAt: request.createdAt,
        updatedAt: request.createdAt,
      },
    };
  } catch (error) {
    const { code, message } = normalizeRepositoryError(error);
    const lowerMessage = message.toLowerCase();

    if (code === "23505" || lowerMessage.includes("duplicate") || lowerMessage.includes("unique")) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Mã lớp đã tồn tại trong học kỳ và năm học này.",
          field: "classCode",
          details: message,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo lớp học phần.",
        details: message,
      },
    };
  }
}

export async function createClassLifecycleRequest(
  input: CreateClassLifecycleRequestInput,
): Promise<ServiceResult<ClassChangeRequest>> {
  if (input.actorRole !== "teacher" && input.actorRole !== "moderator" && input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền tạo yêu cầu thay đổi lớp.",
      },
    };
  }

  try {
    const manageableClass = await findManageableClassRepository({
      classId: input.classId,
      actorId: input.actorId,
      actorRole: input.actorRole,
    });

    if (!manageableClass) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp hoặc bạn không được phép thao tác.",
        },
      };
    }

    if (input.action === "delete" && input.actorRole !== "admin") {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Chỉ Admin được yêu cầu xóa lớp.",
        },
      };
    }

    const request = await createClassLifecycleRequestRepository({
      action: input.action,
      classId: input.classId,
      courseId: manageableClass.courseId,
      requestedBy: input.actorId,
      reason: input.reason,
    });

    return { ok: true, data: request };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo yêu cầu thay đổi lớp.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}

export async function reviewClassChangeRequest(
  input: ReviewClassChangeRequestInput,
): Promise<ServiceResult<ClassChangeRequest>> {
  if (input.actorRole !== "moderator" && input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Mod/Admin được duyệt yêu cầu thay đổi lớp.",
      },
    };
  }

  try {
    const request = await getClassChangeRequestByIdRepository(input.requestId);

    if (!request) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy yêu cầu thay đổi lớp.",
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
          message: "Chỉ Admin được duyệt yêu cầu xóa lớp.",
        },
      };
    }

    if (input.actorRole === "moderator") {
      const manageableCourse = await findManageableCourseRepository({
        courseId: request.courseId,
        actorId: input.actorId,
        actorRole: input.actorRole,
      });

      if (!manageableCourse) {
        return {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Bạn chỉ được duyệt lớp thuộc học phần do mình quản lý.",
          },
        };
      }
    }

    if (input.decision === "approved") {
      await applyApprovedClassChangeRequestRepository(request);
    }

    const reviewed = await reviewClassChangeRequestRepository({
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
        message: "Không thể duyệt yêu cầu thay đổi lớp.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}

/**
 * Adds student memberships by resolving email or student code and skipping duplicates.
 */
export async function addStudentsToClass(
  input: AddStudentsToClassInput,
): Promise<ServiceResult<AddStudentsResult>> {
  const parsedInput = addStudentsToClassSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu thêm sinh viên vào lớp không hợp lệ.",
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
        message: "Bạn không có quyền thêm sinh viên vào lớp học phần.",
      },
    };
  }

  try {
    const manageableClass = await findManageableClassRepository({
      classId: normalizedInput.classId,
      actorId: normalizedInput.actorId,
      actorRole: normalizedInput.actorRole,
    });

    if (!manageableClass) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học phần hoặc bạn không được phép quản lý lớp này.",
        },
      };
    }

    if (manageableClass.status === "archived") {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Lớp đã lưu trữ, không thể thêm sinh viên mới.",
          field: "classId",
        },
      };
    }

    const studentProfiles = await findStudentProfilesRepository({
      classId: normalizedInput.classId,
      emails: normalizedInput.students.map((student) => student.email ?? ""),
      studentCodes: normalizedInput.students.map((student) => student.studentCode ?? ""),
    });

    const profileByEmail = new Map(studentProfiles.map((profile) => [profile.email.toLowerCase(), profile]));
    const profileByStudentCode = new Map(
      studentProfiles
        .filter((profile) => profile.studentCode)
        .map((profile) => [profile.studentCode as string, profile]),
    );

    const resolvedProfiles = normalizedInput.students.map((student, index) => {
      const normalizedEmail = student.email?.trim().toLowerCase();
      const normalizedStudentCode = student.studentCode?.trim();

      const matchedProfile =
        (normalizedEmail ? profileByEmail.get(normalizedEmail) : undefined) ??
        (normalizedStudentCode ? profileByStudentCode.get(normalizedStudentCode) : undefined);

      return {
        row: index + 1,
        input: student,
        matchedProfile,
      };
    });

    const existingStudentIds = await listExistingActiveMembershipStudentIdsRepository(
      normalizedInput.classId,
      resolvedProfiles.flatMap((row) => (row.matchedProfile ? [row.matchedProfile.id] : [])),
    );

    const needsReview: Array<{ row: number; reason: string }> = [];
    const rowsToInsert: Array<{ classId: string; studentId: string }> = [];
    let skipped = 0;

    for (const row of resolvedProfiles) {
      if (!row.matchedProfile) {
        skipped += 1;
        needsReview.push({
          row: row.row,
          reason: `Không tìm thấy sinh viên ${row.input.fullName} bằng email hoặc mã sinh viên đã cung cấp.`,
        });
        continue;
      }

      if (existingStudentIds.has(row.matchedProfile.id)) {
        skipped += 1;
        needsReview.push({
          row: row.row,
          reason: `Sinh viên ${row.matchedProfile.fullName} đã có membership active trong lớp này.`,
        });
        continue;
      }

      rowsToInsert.push({
        classId: normalizedInput.classId,
        studentId: row.matchedProfile.id,
      });
      existingStudentIds.add(row.matchedProfile.id);
    }

    const added = await createClassMembershipsRepository(rowsToInsert);

    return {
      ok: true,
      data: {
        added,
        skipped,
        needsReview,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể thêm sinh viên vào lớp học phần.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}

/**
 * Imports class members from CSV text and reuses the standard membership-add flow.
 */
export async function importStudentsToClass(
  input: ImportStudentsToClassInput,
): Promise<ServiceResult<AddStudentsResult>> {
  const parsedInput = importStudentsToClassSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu nhập CSV sinh viên không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const students = parseStudentsFromCsv(parsedInput.data.csvContent);

    const importResult = await addStudentsToClass({
      classId: parsedInput.data.classId,
      actorId: parsedInput.data.actorId,
      actorRole: parsedInput.data.actorRole,
      students,
    });

    if (importResult.ok) {
      await logClassMemberImport({
        actorId: parsedInput.data.actorId,
        classId: parsedInput.data.classId,
        status: "completed",
        added: importResult.data.added,
        skipped: importResult.data.skipped,
      });
    }

    return importResult;
  } catch (error) {
    await logClassMemberImport({
      actorId: parsedInput.data.actorId,
      classId: parsedInput.data.classId,
      status: "failed",
      reason: error instanceof Error ? error.message : "Không thể đọc tệp CSV sinh viên.",
    });

    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error instanceof Error ? error.message : "Không thể đọc tệp CSV sinh viên.",
      },
    };
  }
}

/**
 * Lists class members for a manageable class.
 */
export async function listClassMembers(
  input: ListClassMembersInput,
): Promise<ServiceResult<Paginated<ClassMemberSummary>>> {
  const parsedInput = listClassMembersSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu danh sách sinh viên trong lớp không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const normalizedInput = parsedInput.data;

  if (!["teacher", "moderator", "admin", "student"].includes(normalizedInput.actorRole)) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền xem danh sách sinh viên trong lớp này.",
      },
    };
  }

  try {
    const repositoryResult: ListClassMembersRepositoryResult = await listClassMembersRepository(normalizedInput);

    return {
      ok: true,
      data: toPaginatedResult(repositoryResult, normalizedInput.page, normalizedInput.pageSize),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể lấy danh sách sinh viên trong lớp.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}
