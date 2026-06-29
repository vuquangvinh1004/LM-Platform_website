"use server";

import { revalidatePath } from "next/cache";

import type { CourseActionState } from "@/app/(teacher)/courses/course-action-state";
import { requireRole } from "@/lib/services/auth-service";
import { archiveCourse, assignCourseModerator, assignCourseTeachers, createCourse, deleteCourse, reviewCourseChangeRequest, updateCourse } from "@/lib/services/course-service";
import type { CourseAssessmentComponent, CourseCloItem } from "@/lib/types/course";

function parseCloItems(rawValue: FormDataEntryValue | null): CourseCloItem[] {
  try {
    const parsed = JSON.parse(String(rawValue ?? "[]")) as CourseCloItem[];
    return parsed
      .map((item) => ({
        code: String(item.code ?? "").trim(),
        description: String(item.description ?? "").trim(),
      }))
      .filter((item) => item.code && item.description);
  } catch {
    return [];
  }
}

function parseAssessmentComponents(rawValue: FormDataEntryValue | null): CourseAssessmentComponent[] {
  try {
    const parsed = JSON.parse(String(rawValue ?? "[]")) as CourseAssessmentComponent[];
    return parsed
      .map((item) => ({
        type: item.type,
        weight: Number(item.weight),
        cloCodes: Array.isArray(item.cloCodes)
          ? item.cloCodes.map((code) => String(code).trim()).filter(Boolean)
          : [],
      }))
      .filter((item) => item.type && Number.isFinite(item.weight));
  } catch {
    return [];
  }
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
  const profileResult = await requireRole(["moderator"]);

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
    message: "Tạo học phần thành công.",
  };
}

/**
 * Updates mutable course fields for current teacher/admin actor.
 */
export async function updateCourseAction(
  _prevState: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const profileResult = await requireRole(["moderator"]);

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

  return {
    status: "success",
    message: "Cập nhật học phần thành công.",
  };
}

/**
 * Archives a course by setting status archived through service layer.
 */
export async function archiveCourseAction(
  _prevState: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const profileResult = await requireRole(["moderator"]);

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
    message: "Lưu trữ học phần thành công.",
  };
}

export async function reviewCourseChangeRequestAction(
  _prevState: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const profileResult = await requireRole(["moderator"]);

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
    message: reviewResult.data.status === "approved" ? "Đã xử lý yêu cầu thay đổi học phần." : "Đã từ chối yêu cầu thay đổi học phần.",
  };
}

export async function deleteCourseAction(
  _prevState: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const profileResult = await requireRole(["moderator"]);

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

  const actionMode = String(formData.get("actionMode") ?? "save").trim();
  const moderatorId = actionMode === "remove" ? "" : String(formData.get("moderatorId") ?? "").trim();

  const assignResult = await assignCourseModerator({
    courseId: String(formData.get("courseId") ?? "").trim(),
    moderatorId,
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
    message: moderatorId
      ? "Đã cập nhật Giám sát viên quản lý học phần."
      : "Đã bỏ quyền Giám sát viên quản lý học phần.",
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

  const currentTeacherIds = formData
    .getAll("currentTeacherIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const selectedTeacherId = String(formData.get("teacherId") ?? "").trim();
  const actionMode = String(formData.get("actionMode") ?? "add").trim();
  const nextTeacherIds = selectedTeacherId
    ? actionMode === "remove"
      ? currentTeacherIds.filter((teacherId) => teacherId !== selectedTeacherId)
      : [...new Set([...currentTeacherIds, selectedTeacherId])]
    : currentTeacherIds;

  const result = await assignCourseTeachers({
    courseId: String(formData.get("courseId") ?? "").trim(),
    teacherIds: nextTeacherIds,
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
    message: selectedTeacherId
      ? actionMode === "remove"
        ? "Đã bỏ quyền giảng dạy của giảng viên khỏi học phần."
        : "Đã cập nhật giảng viên giảng dạy cho học phần."
      : assignedTeacherCount > 0
        ? `Đã cập nhật ${assignedTeacherCount} giảng viên phụ trách học phần.`
        : "Đã bỏ toàn bộ giảng viên phụ trách khỏi học phần.",
  };
}
