"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/services/auth-service";
import { markClassDirectMessagesAsRead, sendClassDirectMessage } from "@/lib/services/message-service";
import type { ClassroomMessageMutationResult } from "@/lib/types/message";

/**
 * Sends class direct message from student classroom UI.
 */
export async function sendClassDirectMessageAction(classId: string, formData: FormData): Promise<ClassroomMessageMutationResult> {
  const profileResult = await requireRole(["student", "admin"]);

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

  revalidatePath(`/my-classes/${classId}/room`);
  revalidatePath(`/classes/${classId}/room`);

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

export async function markClassDirectMessagesAsReadAction(classId: string): Promise<ClassroomMessageMutationResult> {
  const profileResult = await requireRole(["student", "admin"]);

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

  revalidatePath(`/my-classes/${classId}/room`);

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
