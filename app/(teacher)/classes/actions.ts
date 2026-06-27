"use server";

import type { ClassActionState } from "@/app/(teacher)/classes/class-action-state";
import { getClassListPaths, getDashboardPaths, revalidatePaths } from "@/lib/navigation/route-invalidation";
import { requireRole } from "@/lib/services/auth-service";
import {
  addStudentsToClass,
  createClass,
  createClassLifecycleRequest,
  importStudentsToClass,
  reviewClassChangeRequest,
} from "@/lib/services/class-service";
import { createTemplateClass, deleteClassTemplate } from "@/lib/services/classroom-service";
import { reviewEnrollmentRequest } from "@/lib/services/enrollment-service";

/**
 * Creates a class for the current teacher/admin profile.
 */
export async function createClassAction(
  _prevState: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const createResult = await createClass({
    courseId: String(formData.get("courseId") ?? "").trim(),
    teacherId: profileResult.data.id,
    teacherRole: profileResult.data.role,
    classCode: String(formData.get("classCode") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    semester: String(formData.get("semester") ?? "").trim() || undefined,
    academicYear: String(formData.get("academicYear") ?? "").trim() || undefined,
    status: (formData.get("status") as "draft" | "active" | "archived" | null) ?? "active",
  });

  if (!createResult.ok) {
    return {
      status: "error",
      message: createResult.error.message,
    };
  }

  revalidatePaths(getClassListPaths());

  return {
    status: "success",
    message: profileResult.data.role === "teacher" ? "Đã gửi yêu cầu mở lớp để Mod/Admin duyệt." : "Tạo lớp thành công.",
  };
}

export async function createClassLifecycleRequestAction(
  _prevState: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const requestResult = await createClassLifecycleRequest({
    classId: String(formData.get("classId") ?? "").trim(),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    action: (formData.get("action") as "archive" | "delete" | null) ?? "archive",
    reason: String(formData.get("reason") ?? "").trim() || undefined,
  });

  if (!requestResult.ok) {
    return {
      status: "error",
      message: requestResult.error.message,
    };
  }

  revalidatePaths(getClassListPaths());

  return {
    status: "success",
    message: requestResult.data.action === "delete" ? "Đã gửi yêu cầu xóa lớp." : "Đã gửi yêu cầu lưu trữ lớp.",
  };
}

export async function reviewClassChangeRequestAction(
  _prevState: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const profileResult = await requireRole(["moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const reviewResult = await reviewClassChangeRequest({
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

  revalidatePaths(getClassListPaths());
  revalidatePaths(getDashboardPaths());

  return {
    status: "success",
    message: reviewResult.data.status === "approved" ? "Đã duyệt yêu cầu thay đổi lớp." : "Đã từ chối yêu cầu thay đổi lớp.",
  };
}

export async function reviewClassEnrollmentRequestAction(
  _prevState: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const reviewResult = await reviewEnrollmentRequest({
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

  revalidatePaths(getClassListPaths());

  return {
    status: "success",
    message: reviewResult.data.status === "approved" ? "Đã duyệt sinh viên tham gia lớp." : "Đã từ chối yêu cầu tham gia lớp.",
  };
}

/**
 * Adds a single student manually to a class through the batch-oriented service.
 */
export async function addStudentToClassAction(
  _prevState: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const addResult = await addStudentsToClass({
    classId: String(formData.get("classId") ?? "").trim(),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    students: [
      {
        email: String(formData.get("email") ?? "").trim() || undefined,
        studentCode: String(formData.get("studentCode") ?? "").trim() || undefined,
        fullName: String(formData.get("fullName") ?? "").trim(),
      },
    ],
  });

  if (!addResult.ok) {
    return {
      status: "error",
      message: addResult.error.message,
    };
  }

  revalidatePaths(getClassListPaths());

  if (addResult.data.added > 0 && addResult.data.needsReview.length === 0) {
    return {
      status: "success",
      message: "Thêm sinh viên vào lớp thành công.",
    };
  }

  return {
    status: addResult.data.added > 0 ? "success" : "error",
    message: addResult.data.needsReview[0]?.reason ?? "Không thể thêm sinh viên vào lớp.",
  };
}

/**
 * Imports students from a CSV file for a manageable class.
 * This flow keeps CSV parsing in the service layer so the action stays focused on auth,
 * form decoding, and scope-based invalidation only.
 */
export async function importStudentsCsvToClassAction(
  _prevState: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const csvFile = formData.get("csvFile");

  if (!(csvFile instanceof File) || csvFile.size === 0) {
    return {
      status: "error",
      message: "Vui lòng chọn tệp CSV để nhập.",
    };
  }

  const importResult = await importStudentsToClass({
    classId: String(formData.get("classId") ?? "").trim(),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    csvContent: await csvFile.text(),
  });

  if (!importResult.ok) {
    return {
      status: "error",
      message: importResult.error.message,
    };
  }

  revalidatePaths(getClassListPaths());

  return {
    status: "success",
    message: `Nhập CSV hoàn tất: thêm ${importResult.data.added} sinh viên, bỏ qua ${importResult.data.skipped} dòng.`,
  };
}

export async function deleteClassTemplateAction(
  _prevState: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const templateId = String(formData.get("templateId") ?? "").trim();

  if (!templateId) {
    return {
      status: "error",
      message: "Vui lòng chọn lớp mẫu cần xóa.",
    };
  }

  const deleteResult = await deleteClassTemplate({
    templateId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!deleteResult.ok) {
    return {
      status: "error",
      message: deleteResult.error.message,
    };
  }

  revalidatePaths(getClassListPaths());

  return {
    status: "success",
    message: "Đã xóa lớp mẫu.",
  };
}

export async function createTemplateClassAction(
  _prevState: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const courseId = String(formData.get("courseId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || undefined;

  if (!courseId || !name) {
    return {
      status: "error",
      message: "Vui lòng chọn học phần và nhập tên lớp mẫu.",
    };
  }

  const createResult = await createTemplateClass({
    courseId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    name,
    description,
  });

  if (!createResult.ok) {
    return {
      status: "error",
      message: createResult.error.message,
    };
  }

  revalidatePaths(getClassListPaths());

  return {
    status: "success",
    message: "Đã tạo lớp mẫu.",
    redirectTo: `/classes/${createResult.data.classId}/room`,
  };
}
