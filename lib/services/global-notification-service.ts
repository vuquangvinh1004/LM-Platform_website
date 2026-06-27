import {
  createGlobalNotificationRepository,
  listGlobalNotificationsRepository,
  setGlobalNotificationExpiryRepository,
} from "@/lib/repositories/global-notification-repository";
import type { UserRole } from "@/lib/types/auth";
import type { GlobalNotificationItem } from "@/lib/types/global-notification";
import type { ServiceResult } from "@/lib/types/service-result";

type GlobalNotificationAudience = Array<"admin" | "moderator" | "teacher">;

export async function listGlobalNotifications(input: {
  actorId: string;
  actorRole: UserRole;
}): Promise<ServiceResult<GlobalNotificationItem[]>> {
  try {
    return {
      ok: true,
      data: await listGlobalNotificationsRepository(input),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải thông báo chung.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function createGlobalNotification(input: {
  actorId: string;
  actorRole: UserRole;
  title: string;
  content: string;
  expiresInDays?: number;
  audienceRoles?: GlobalNotificationAudience;
  targetProfileIds?: string[];
  kind?: GlobalNotificationItem["kind"];
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  expiresAt?: string | null;
}): Promise<ServiceResult<GlobalNotificationItem>> {
  if (input.actorRole !== "admin" && input.actorRole !== "moderator") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin hoặc Mod được gửi thông báo chung.",
      },
    };
  }

  if (!input.title.trim() || !input.content.trim()) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Tiêu đề và nội dung thông báo là bắt buộc.",
      },
    };
  }

  try {
    const expiresAt =
      typeof input.expiresInDays === "number" && Number.isFinite(input.expiresInDays) && input.expiresInDays > 0
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : input.expiresAt ?? null;

    return {
      ok: true,
      data: await createGlobalNotificationRepository({
        title: input.title.trim(),
        content: input.content.trim(),
        createdBy: input.actorId,
        createdByRole: input.actorRole,
        audienceRoles: input.audienceRoles,
        targetProfileIds: input.targetProfileIds,
        kind: input.kind,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        expiresAt,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo thông báo chung.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function setGlobalNotificationExpiry(input: {
  actorId: string;
  actorRole: UserRole;
  notificationId: string;
  expiresInDays: number;
}): Promise<ServiceResult<GlobalNotificationItem>> {
  if (input.actorRole !== "admin" && input.actorRole !== "moderator") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin hoặc Mod được thiết lập thời hạn thông báo.",
      },
    };
  }

  if (!Number.isFinite(input.expiresInDays) || input.expiresInDays <= 0) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Thời hạn thông báo không hợp lệ.",
      },
    };
  }

  try {
    const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    const updated = await setGlobalNotificationExpiryRepository({
      notificationId: input.notificationId,
      expiresAt,
    });

    if (!updated) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy thông báo cần thiết lập thời hạn.",
        },
      };
    }

    return {
      ok: true,
      data: updated,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể thiết lập thời hạn thông báo.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
