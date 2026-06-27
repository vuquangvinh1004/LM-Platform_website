"use server";

import { redirect } from "next/navigation";

import { getClassroomRoomPaths, revalidatePaths } from "@/lib/navigation/route-invalidation";
import { requireRole } from "@/lib/services/auth-service";
import {
  applyClassTemplate,
  createClassAnnouncement,
  createClassSession,
  syncClassTemplateSnapshot,
  updateTeacherDeskNote,
} from "@/lib/services/classroom-service";
import { markClassDirectMessagesAsRead, sendClassDirectMessage } from "@/lib/services/message-service";
import type { ClassroomMessageMutationResult } from "@/lib/types/message";

function buildFlashPath(
  classId: string,
  scope: "announcement" | "message" | "template",
  type: "success" | "error",
  message: string,
): string {
  const query = new URLSearchParams({
    flashScope: scope,
    flashType: type,
    flashMessage: message,
  });

  const hash = scope === "message" ? "#classroom-messages" : scope === "template" ? "#classroom-templates" : "";

  return `/classes/${classId}/room?${query.toString()}${hash}`;
}

export async function applyClassTemplateAction(classId: string, formData: FormData): Promise<void> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    redirect(buildFlashPath(classId, "template", "error", profileResult.error.message));
  }

  const result = await applyClassTemplate({
    classId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    templateId: String(formData.get("templateId") ?? "").trim(),
  });

  if (!result.ok) {
    redirect(buildFlashPath(classId, "template", "error", result.error.message));
  }

  revalidatePaths(getClassroomRoomPaths(classId));
  redirect(buildFlashPath(classId, "template", "success", "Đã áp dụng lớp mẫu vào lớp hiện tại."));
}

/**
 * Creates one class announcement from teacher classroom board panel.
 */
export async function createClassAnnouncementAction(classId: string, formData: FormData): Promise<void> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    redirect(buildFlashPath(classId, "announcement", "error", profileResult.error.message));
  }

  const result = await createClassAnnouncement({
    classId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    title: String(formData.get("title") ?? "").trim(),
    content: String(formData.get("content") ?? "").trim(),
  });

  if (!result.ok) {
    redirect(buildFlashPath(classId, "announcement", "error", result.error.message));
  }

  revalidatePaths(getClassroomRoomPaths(classId));
  redirect(buildFlashPath(classId, "announcement", "success", "Đăng thông báo thành công."));
}

export async function createClassSessionAction(classId: string, formData: FormData): Promise<void> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    redirect(buildFlashPath(classId, "announcement", "error", profileResult.error.message));
  }

  const result = await createClassSession({
    classId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    title: String(formData.get("title") ?? "").trim(),
  });

  if (!result.ok) {
    redirect(buildFlashPath(classId, "announcement", "error", result.error.message));
  }

  await syncClassTemplateSnapshot(classId);
  revalidatePaths(getClassroomRoomPaths(classId));
  redirect(`/classes/${classId}/sessions/${result.data.id}`);
}

/**
 * Sends class direct message from teacher classroom UI.
 */
export async function sendClassDirectMessageAction(classId: string, formData: FormData): Promise<ClassroomMessageMutationResult> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      ok: false,
      message: profileResult.error.message,
    };
  }

  const result = await sendClassDirectMessage({
    classId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    recipientId: String(formData.get("recipientId") ?? "").trim(),
    content: String(formData.get("content") ?? "").trim(),
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.error.message,
    };
  }

  revalidatePaths(getClassroomRoomPaths(classId));
  return {
    ok: true,
    message: "Gửi tin nhắn thành công.",
  };
}

/**
 * Marks unread class direct messages as read for the current teacher/manager.
 */
export async function markClassDirectMessagesAsReadAction(classId: string): Promise<ClassroomMessageMutationResult> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      ok: false,
      message: profileResult.error.message,
    };
  }

  const result = await markClassDirectMessagesAsRead({
    classId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.error.message,
    };
  }

  revalidatePaths(getClassroomRoomPaths(classId));
  return {
    ok: true,
    message: "Đã cập nhật trạng thái đọc của tin nhắn.",
  };
}

export async function markStudentMessagesAsReadAction(classId: string, studentId: string): Promise<ClassroomMessageMutationResult> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      ok: false,
      message: profileResult.error.message,
    };
  }

  const result = await markClassDirectMessagesAsRead({
    classId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    senderId: studentId,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.error.message,
    };
  }

  revalidatePaths(getClassroomRoomPaths(classId));
  return {
    ok: true,
    message: "Đã cập nhật trạng thái đọc của tin nhắn.",
  };
}

export async function updateTeacherDeskNoteAction(classId: string, formData: FormData): Promise<ClassroomMessageMutationResult> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      ok: false,
      message: profileResult.error.message,
    };
  }

  const result = await updateTeacherDeskNote({
    classId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    note: String(formData.get("note") ?? "").trim() || undefined,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.error.message,
    };
  }

  await syncClassTemplateSnapshot(classId);
  revalidatePaths(getClassroomRoomPaths(classId));
  return {
    ok: true,
    message: "Đã lưu ghi chú thông tin.",
  };
}
