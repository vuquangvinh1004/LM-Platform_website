"use server";

import { revalidatePath } from "next/cache";

import type { CourseActionState } from "@/app/(teacher)/courses/course-action-state";
import { requireRole } from "@/lib/services/auth-service";
import { archiveCourse, assignCourseModerator, assignCourseTeachers, createCourse, deleteCourse, reviewCourseChangeRequest, updateCourse } from "@/lib/services/course-service";
import type { CourseAssessmentComponent, CourseCloItem } from "@/lib/types/course";

function parseCloItems(rawValue: FormDataEntryValue | null): CourseCloItem[] {
  return String(rawValue ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [code, ...descriptionParts] = line.split("|");
      return {
        code: String(code ?? "").trim(),
        description: descriptionParts.join("|").trim(),
      };
    })
    .filter((item) => item.code && item.description);
}

function parseAssessmentComponents(rawValue: FormDataEntryValue | null): CourseAssessmentComponent[] {
  return String(rawValue ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [type, weight] = line.split("|");
      return {
        type: String(type ?? "").trim(),
        weight: Number(String(weight ?? "").trim()),
      };
    })
    .filter((item) => item.type && Number.isFinite(item.weight));
}

function optionalNumberFromForm(rawValue: FormDataEntryValue | null): number | undefined {
  const value = String(rawValue ?? "").trim();
  return value ? Number(value) : undefined;
}

function optionalKnowledgeBlockFromForm(rawValue: FormDataEntryValue | null): "general" | "foundation" | "major" | undefined {
  const value = String(rawValue ?? "").trim();
  return value === "general" || value === "foundation" || value === "major" ? value : undefined;
}

function optionalCourseTypeFromForm(rawValue: FormDataEntryValue | null): "required" | "elective" | undefined {
  const value = String(rawValue ?? "").trim();
  return value === "required" || value === "elective" ? value : undefined;
}

/**
 * Creates a course for current teacher/admin profile using validated service input.
 */
export async function createCourseAction(
  _prevState: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const createResult = await createCourse({
    ownerId: profileResult.data.id,
    actorRole: profileResult.data.role,
    code: String(formData.get("code") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    visibility: (formData.get("visibility") as "private" | "unlisted" | "public_preview" | null) ?? "private",
    status: (formData.get("status") as "draft" | "active" | "archived" | null) ?? "draft",
    credits: optionalNumberFromForm(formData.get("credits")),
    knowledgeBlock: optionalKnowledgeBlockFromForm(formData.get("knowledgeBlock")),
    courseType: optionalCourseTypeFromForm(formData.get("courseType")),
    assignedTeacherIds: formData.getAll("teacherIds").map((value) => String(value).trim()).filter(Boolean),
    cloItems: parseCloItems(formData.get("cloItemsText")),
    assessmentComponents: parseAssessmentComponents(formData.get("assessmentComponentsText")),
  });

  if (!createResult.ok) {
    return {
      status: "error",
      message: createResult.error.message,
    };
  }

  revalidatePath("/courses");

  return {
    status: "success",
    message: profileResult.data.role === "moderator" ? "Đã gửi yêu cầu tạo học phần để Admin duyệt." : "Tạo học phần thành công.",
  };
}

/**
 * Updates mutable course fields for current teacher/admin actor.
 */
export async function updateCourseAction(
  _prevState: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const updateResult = await updateCourse({
    courseId: String(formData.get("courseId") ?? "").trim(),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    visibility: (formData.get("visibility") as "private" | "unlisted" | "public_preview" | null) ?? "private",
    status: (formData.get("status") as "draft" | "active" | "archived" | null) ?? "draft",
    credits: optionalNumberFromForm(formData.get("credits")),
    knowledgeBlock: optionalKnowledgeBlockFromForm(formData.get("knowledgeBlock")),
    courseType: optionalCourseTypeFromForm(formData.get("courseType")),
    cloItems: parseCloItems(formData.get("cloItemsText")),
    assessmentComponents: parseAssessmentComponents(formData.get("assessmentComponentsText")),
  });

  if (!updateResult.ok) {
    return {
      status: "error",
      message: updateResult.error.message,
    };
  }

  revalidatePath("/courses");

  const isPendingUpdateRequest = "action" in updateResult.data && updateResult.data.action === "update";

  return {
    status: "success",
    message: isPendingUpdateRequest
      ? "Đã gửi yêu cầu chỉnh sửa học phần đến Mod quản lý để xác nhận đồng thuận."
      : profileResult.data.role === "moderator"
        ? "Đã lưu thay đổi học phần và gửi thông báo cho Admin."
        : "Cập nhật học phần thành công.",
  };
}

/**
 * Archives a course by setting status archived through service layer.
 */
export async function archiveCourseAction(
  _prevState: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const archiveResult = await archiveCourse({
    courseId: String(formData.get("courseId") ?? "").trim(),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!archiveResult.ok) {
    return {
      status: "error",
      message: archiveResult.error.message,
    };
  }

  revalidatePath("/courses");

  return {
    status: "success",
    message: profileResult.data.role === "teacher" ? "Đã gửi yêu cầu lưu trữ học phần để Mod/Admin duyệt." : "Lưu trữ học phần thành công.",
  };
}

export async function reviewCourseChangeRequestAction(
  _prevState: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const profileResult = await requireRole(["moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const reviewResult = await reviewCourseChangeRequest({
    requestId: String(formData.get("requestId") ?? "").trim(),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    decision: (formData.get("decision") as "approved" | "rejected" | null) ?? "approved",
    note: String(formData.get("note") ?? "").trim() || undefined,
  });

  if (!reviewResult.ok) {
    return {
      status: "error",
      message: reviewResult.error.message,
    };
  }

  revalidatePath("/courses");
  revalidatePath("/dashboard");

  return {
    status: "success",
    message: reviewResult.data.status === "approved" ? "Đã duyệt yêu cầu thay đổi học phần." : "Đã từ chối yêu cầu thay đổi học phần.",
  };
}

export async function deleteCourseAction(
  _prevState: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const deleteResult = await deleteCourse({
    courseId: String(formData.get("courseId") ?? "").trim(),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!deleteResult.ok) {
    return {
      status: "error",
      message: deleteResult.error.message,
    };
  }

  revalidatePath("/courses");
  revalidatePath("/classes");
  revalidatePath("/library");

  return {
    status: "success",
    message: "Xóa học phần thành công.",
  };
}

export async function assignCourseModeratorAction(
  _prevState: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const assignResult = await assignCourseModerator({
    courseId: String(formData.get("courseId") ?? "").trim(),
    moderatorId: String(formData.get("moderatorId") ?? "").trim(),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!assignResult.ok) {
    return {
      status: "error",
      message: assignResult.error.message,
    };
  }

  revalidatePath("/courses");
  revalidatePath("/dashboard");
  revalidatePath("/access-review");

  return {
    status: "success",
    message: "Đã giao Mod quản lý học phần.",
  };
}

export async function assignCourseTeachersAction(
  _prevState: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const profileResult = await requireRole(["admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const result = await assignCourseTeachers({
    courseId: String(formData.get("courseId") ?? "").trim(),
    teacherIds: formData.getAll("teacherIds").map((value) => String(value).trim()).filter(Boolean),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.error.message,
    };
  }

  revalidatePath("/courses");
  revalidatePath("/classes");
  revalidatePath("/materials");
  revalidatePath("/library");
  revalidatePath("/assessments");

  const assignedTeacherCount = result.data.assignedTeachers?.length ?? 0;

  return {
    status: "success",
    message:
      assignedTeacherCount > 0
        ? `Đã cập nhật ${assignedTeacherCount} giảng viên phụ trách học phần.`
        : "Đã bỏ toàn bộ giảng viên phụ trách khỏi học phần.",
  };
}
