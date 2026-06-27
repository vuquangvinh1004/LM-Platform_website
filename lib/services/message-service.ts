import {
  createClassDirectMessageRepository,
  findClassForMessageRepository,
  isActiveMemberOfClassRepository,
  listClassDirectMessagesRepository,
  markReceivedDirectMessagesAsReadRepository,
} from "@/lib/repositories/message-repository";
import type { ClassroomDirectMessage } from "@/lib/types/classroom";
import { createActivityLogRepository } from "@/lib/repositories/activity-log-repository";
import type { MarkClassDirectMessagesAsReadInput, SendClassDirectMessageInput } from "@/lib/types/message";
import type { ServiceResult } from "@/lib/types/service-result";
import { classDirectMessageAccessSchema, markClassDirectMessagesAsReadSchema, sendClassDirectMessageSchema } from "@/lib/validators/message-validator";

async function logClassDirectMessageSent(input: {
  actorId: string;
  classId: string;
  messageId: string;
  recipientId: string;
}): Promise<void> {
  try {
    await createActivityLogRepository({
      actorId: input.actorId,
      action: "class.direct_message.sent",
      entityType: "class",
      entityId: input.classId,
      metadata: {
        messageId: input.messageId,
        recipientId: input.recipientId,
      },
    });
  } catch {
    // Activity log failure must not block direct message flow.
  }
}

/**
 * Sends a class-scoped direct message with permission checks by role.
 */
export async function sendClassDirectMessage(
  input: SendClassDirectMessageInput,
): Promise<ServiceResult<{ messageId: string }>> {
  const parsedInput = sendClassDirectMessageSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu gửi tin nhắn không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const normalizedInput = parsedInput.data;
    const classInfo = await findClassForMessageRepository(normalizedInput.classId);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    if (normalizedInput.actorRole === "student") {
      const [isSenderMember, isRecipientTeacher] = await Promise.all([
        isActiveMemberOfClassRepository(normalizedInput.classId, normalizedInput.actorId),
        Promise.resolve(normalizedInput.recipientId === classInfo.teacherId),
      ]);

      if (!isSenderMember || !isRecipientTeacher) {
        return {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Sinh viên chỉ được nhắn tin cho giảng viên trong lớp đang tham gia.",
          },
        };
      }
    }

    const created = await createClassDirectMessageRepository({
      classId: normalizedInput.classId,
      senderId: normalizedInput.actorId,
      recipientId: normalizedInput.recipientId,
      content: normalizedInput.content,
    });

    await logClassDirectMessageSent({
      actorId: normalizedInput.actorId,
      classId: normalizedInput.classId,
      messageId: created.id,
      recipientId: normalizedInput.recipientId,
    });

    return {
      ok: true,
      data: {
        messageId: created.id,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể gửi tin nhắn phòng học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Lists recent class-scoped direct messages visible to the current actor.
 */
export async function listClassDirectMessages(input: {
  classId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
}): Promise<ServiceResult<ClassroomDirectMessage[]>> {
  const parsedInput = classDirectMessageAccessSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu tải danh sách tin nhắn không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const normalizedInput = parsedInput.data;
    const classInfo = await findClassForMessageRepository(normalizedInput.classId);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    if (normalizedInput.actorRole === "student") {
      const isSenderMember = await isActiveMemberOfClassRepository(normalizedInput.classId, normalizedInput.actorId);

      if (!isSenderMember) {
        return {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Sinh viên không có quyền xem tin nhắn của lớp này.",
          },
        };
      }
    } else if (normalizedInput.actorRole === "teacher" && normalizedInput.actorId !== classInfo.teacherId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Giảng viên không có quyền xem tin nhắn của lớp này.",
        },
      };
    }

    const messages = await listClassDirectMessagesRepository({
      classId: normalizedInput.classId,
      actorId: normalizedInput.actorId,
    });

    return {
      ok: true,
      data: messages,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải tin nhắn phòng học.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Marks all unread received direct messages in one class as read for the current actor.
 */
export async function markClassDirectMessagesAsRead(
  input: MarkClassDirectMessagesAsReadInput,
): Promise<ServiceResult<{ updatedCount: number }>> {
  const parsedInput = markClassDirectMessagesAsReadSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu cập nhật trạng thái tin nhắn không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const normalizedInput = parsedInput.data;
    const classInfo = await findClassForMessageRepository(normalizedInput.classId);

    if (!classInfo) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học hoặc bạn không có quyền truy cập.",
        },
      };
    }

    if (normalizedInput.actorRole === "student") {
      const isSenderMember = await isActiveMemberOfClassRepository(normalizedInput.classId, normalizedInput.actorId);

      if (!isSenderMember) {
        return {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Sinh viên không có quyền cập nhật tin nhắn của lớp này.",
          },
        };
      }
    } else if (normalizedInput.actorRole === "teacher" && normalizedInput.actorId !== classInfo.teacherId) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Giảng viên không có quyền cập nhật tin nhắn của lớp này.",
        },
      };
    }

    const updatedCount = await markReceivedDirectMessagesAsReadRepository({
      classId: normalizedInput.classId,
      actorId: normalizedInput.actorId,
      senderId: normalizedInput.senderId,
    });

    return {
      ok: true,
      data: {
        updatedCount,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể cập nhật trạng thái đọc của tin nhắn.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
