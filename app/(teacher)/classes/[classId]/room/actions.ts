"use server";

import { redirect } from "next/navigation";

import { getClassroomRoomPaths, revalidatePaths } from "@/lib/navigation/route-invalidation";
import { requireRole } from "@/lib/services/auth-service";
import {
  applyClassTemplateCommand,
  createClassAnnouncementCommand,
  createClassSessionCommand,
  markClassDirectMessagesAsReadCommand,
  sendClassDirectMessageCommand,
  updateTeacherDeskNoteCommand,
} from "@/lib/commands/classroom-commands";
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

  const actorRole = profileResult.data.role as "admin" | "moderator" | "teacher";

  // Template application is a special flow because it mutates both the active class room
  // and the template-derived snapshot that other views reuse.
  const result = await applyClassTemplateCommand({
    classId,
    actorId: profileResult.data.id,
    actorRole,
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

  const actorRole = profileResult.data.role as "admin" | "moderator" | "teacher";

  const result = await createClassAnnouncementCommand({
    classId,
    actorId: profileResult.data.id,
    actorRole,
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

  const actorRole = profileResult.data.role as "admin" | "moderator" | "teacher";

  // Creating a session is another snapshot-bearing mutation, so the template snapshot
  // is refreshed as part of the command before we invalidate the room view.
  const result = await createClassSessionCommand({
    classId,
    actorId: profileResult.data.id,
    actorRole,
    title: String(formData.get("title") ?? "").trim(),
  });

  if (!result.ok) {
    redirect(buildFlashPath(classId, "announcement", "error", result.error.message));
  }

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

  const actorRole = profileResult.data.role as "admin" | "moderator" | "teacher";

  const result = await sendClassDirectMessageCommand({
    classId,
    actorId: profileResult.data.id,
    actorRole,
    recipientId: String(formData.get("recipientId") ?? "").trim(),
    content: String(formData.get("content") ?? "").trim(),
  });

  if (!result.ok) {
    return result;
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

  const actorRole = profileResult.data.role as "admin" | "moderator" | "teacher";

  const result = await markClassDirectMessagesAsReadCommand({
    classId,
    actorId: profileResult.data.id,
    actorRole,
  });

  if (!result.ok) {
    return result;
  }

  revalidatePaths(getClassroomRoomPaths(classId));
  return result;
}

export async function markStudentMessagesAsReadAction(classId: string, studentId: string): Promise<ClassroomMessageMutationResult> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      ok: false,
      message: profileResult.error.message,
    };
  }

  const actorRole = profileResult.data.role as "admin" | "moderator" | "teacher";

  const result = await markClassDirectMessagesAsReadCommand({
    classId,
    actorId: profileResult.data.id,
    actorRole,
    senderId: studentId,
  });

  if (!result.ok) {
    return result;
  }

  revalidatePaths(getClassroomRoomPaths(classId));
  return result;
}

export async function updateTeacherDeskNoteAction(classId: string, formData: FormData): Promise<ClassroomMessageMutationResult> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return {
      ok: false,
      message: profileResult.error.message,
    };
  }

  const actorRole = profileResult.data.role as "admin" | "moderator" | "teacher";

  const result = await updateTeacherDeskNoteCommand({
    classId,
    actorId: profileResult.data.id,
    actorRole,
    note: String(formData.get("note") ?? "").trim() || undefined,
  });

  if (!result.ok) {
    return result;
  }

  revalidatePaths(getClassroomRoomPaths(classId));
  return result;
}
