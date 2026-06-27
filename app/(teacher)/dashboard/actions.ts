"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/services/auth-service";
import { createGlobalNotification, setGlobalNotificationExpiry } from "@/lib/services/global-notification-service";

export async function createGlobalNotificationAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin", "moderator"]);

  if (!profileResult.ok) {
    return;
  }

  const result = await createGlobalNotification({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    title: String(formData.get("title") ?? "").trim(),
    content: String(formData.get("content") ?? "").trim(),
    expiresInDays: Number(String(formData.get("expiresInDays") ?? "").trim() || "0") || undefined,
  });

  if (!result.ok) {
    return;
  }

  revalidatePath("/dashboard");
}

export async function setGlobalNotificationExpiryAction(formData: FormData): Promise<void> {
  const profileResult = await requireRole(["admin", "moderator"]);

  if (!profileResult.ok) {
    return;
  }

  const notificationId = String(formData.get("notificationId") ?? "").trim();
  const expiresInDays = Number(String(formData.get("expiresInDays") ?? "7"));

  if (!notificationId) {
    return;
  }

  const result = await setGlobalNotificationExpiry({
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    notificationId,
    expiresInDays,
  });

  if (!result.ok) {
    return;
  }

  revalidatePath("/dashboard");
}
