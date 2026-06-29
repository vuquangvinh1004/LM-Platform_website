"use server";

import type { ClassActionState } from "@/app/(teacher)/classes/class-action-state";
import {
  createClassCommand,
  createClassLifecycleRequestCommand,
  createTemplateClassCommand,
  deleteClassTemplateCommand,
  reviewClassChangeRequestCommand,
  reviewEnrollmentRequestCommand,
  updateClassAutoApproveEnrollmentCommand,
  updateClassPublicEnrollmentVisibilityCommand,
} from "@/lib/commands/class-commands";
import { getClassListPaths, getDashboardPaths, revalidatePaths } from "@/lib/navigation/route-invalidation";
import { requireRole } from "@/lib/services/auth-service";

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

  const createResult = await createClassCommand({
    courseId: String(formData.get("courseId") ?? "").trim(),
    teacherId: profileResult.data.id,
    teacherRole: profileResult.data.role,
    classCode: String(formData.get("classCode") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    semester: String(formData.get("semester") ?? "").trim() || undefined,
    academicYear: String(formData.get("academicYear") ?? "").trim() || undefined,
    status: (formData.get("status") as "draft" | "active" | "archived" | null) ?? "active",
    isOpenForEnrollment: formData.get("isOpenForEnrollment") === "on",
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
    message: profileResult.data.role === "teacher" ? "Đã gửi yêu cầu mở lớp để GIÁM SÁT VIÊN/QUẢN TRỊ VIÊN duyệt." : "Tạo lớp thành công.",
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

  const requestResult = await createClassLifecycleRequestCommand({
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

  const reviewResult = await reviewClassChangeRequestCommand({
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

  const reviewResult = await reviewEnrollmentRequestCommand({
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

export async function updateClassPublicEnrollmentVisibilityAction(
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

  const updateResult = await updateClassPublicEnrollmentVisibilityCommand({
    classId: String(formData.get("classId") ?? "").trim(),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    isOpenForEnrollment: formData.get("isOpenForEnrollment") === "true",
  });

  if (!updateResult.ok) {
    return {
      status: "error",
      message: updateResult.error.message,
    };
  }

  revalidatePaths(getClassListPaths());

  return {
    status: "success",
    message: updateResult.data.isOpenForEnrollment
      ? "Đã mở đăng ký công khai cho lớp."
      : "Đã ẩn lớp khỏi danh sách đăng ký công khai.",
  };
}

export async function updateClassAutoApproveEnrollmentAction(
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

  const updateResult = await updateClassAutoApproveEnrollmentCommand({
    classId: String(formData.get("classId") ?? "").trim(),
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    autoApproveEnrollment: formData.get("autoApproveEnrollment") === "true",
  });

  if (!updateResult.ok) {
    return {
      status: "error",
      message: updateResult.error.message,
    };
  }

  revalidatePaths(getClassListPaths());
  revalidatePaths(getDashboardPaths());

  return {
    status: "success",
    message: updateResult.data.autoApproveEnrollment
      ? "Đã bật duyệt tự động yêu cầu tham gia lớp."
      : "Đã tắt duyệt tự động yêu cầu tham gia lớp.",
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

  const deleteResult = await deleteClassTemplateCommand({
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

  const createResult = await createTemplateClassCommand({
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
