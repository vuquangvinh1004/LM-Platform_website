import { applyClassTemplate, createClassAnnouncement, createClassSession, syncClassTemplateSnapshot, updateTeacherDeskNote } from "@/lib/services/classroom-service";
import { markClassDirectMessagesAsRead, sendClassDirectMessage } from "@/lib/services/message-service";
import type { ClassroomMessageMutationResult } from "@/lib/types/message";

export type ClassroomMutationActor = {
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher";
};

/**
 * Classroom mutations that affect the room snapshot should always sync the template snapshot
 * after the underlying change is saved, so the rendered room stays consistent across teacher,
 * student, and template-driven views.
 */
export async function applyClassTemplateCommand(input: ClassroomMutationActor & { classId: string; templateId: string }) {
  const result = await applyClassTemplate({
    classId: input.classId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    templateId: input.templateId,
  });

  if (!result.ok) {
    return result;
  }

  await syncClassTemplateSnapshot(input.classId);
  return result;
}

export async function createClassAnnouncementCommand(input: ClassroomMutationActor & { classId: string; title: string; content: string }) {
  return createClassAnnouncement({
    classId: input.classId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    title: input.title,
    content: input.content,
  });
}

export async function createClassSessionCommand(input: ClassroomMutationActor & { classId: string; title: string }) {
  const result = await createClassSession({
    classId: input.classId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    title: input.title,
  });

  if (!result.ok) {
    return result;
  }

  await syncClassTemplateSnapshot(input.classId);
  return result;
}

export async function sendClassDirectMessageCommand(input: ClassroomMutationActor & { classId: string; recipientId: string; content: string }): Promise<ClassroomMessageMutationResult> {
  const result = await sendClassDirectMessage({
    classId: input.classId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    recipientId: input.recipientId,
    content: input.content,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.error.message,
    };
  }

  return {
    ok: true,
    message: "Gửi tin nhắn thành công.",
  };
}

export async function markClassDirectMessagesAsReadCommand(input: ClassroomMutationActor & { classId: string; senderId?: string }): Promise<ClassroomMessageMutationResult> {
  const result = await markClassDirectMessagesAsRead({
    classId: input.classId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    senderId: input.senderId,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.error.message,
    };
  }

  return {
    ok: true,
    message: "Đã cập nhật trạng thái đọc của tin nhắn.",
  };
}

export async function updateTeacherDeskNoteCommand(input: ClassroomMutationActor & { classId: string; note?: string }): Promise<ClassroomMessageMutationResult> {
  const result = await updateTeacherDeskNote({
    classId: input.classId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    note: input.note,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.error.message,
    };
  }

  await syncClassTemplateSnapshot(input.classId);
  return {
    ok: true,
    message: "Đã lưu ghi chú thông tin.",
  };
}
