import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/auth";
import type { GlobalNotificationItem } from "@/lib/types/global-notification";

type GlobalNotificationRow = {
  id: string;
  title: string;
  content: string;
  status: "published" | "archived";
  audience_roles: Array<"admin" | "moderator" | "teacher"> | null;
  target_profile_ids: string[] | null;
  created_by: string;
  created_by_role: "admin" | "moderator" | "teacher" | null;
  notification_kind: "announcement" | "material_upload_request" | "material_upload_result" | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type CreateGlobalNotificationRepositoryInput = {
  title: string;
  content: string;
  createdBy: string;
  createdByRole: "admin" | "moderator" | "teacher";
  audienceRoles?: Array<"admin" | "moderator" | "teacher">;
  targetProfileIds?: string[];
  kind?: "announcement" | "material_upload_request" | "material_upload_result";
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  expiresAt?: string | null;
};

type UpdateGlobalNotificationExpiryRepositoryInput = {
  notificationId: string;
  expiresAt: string | null;
};

const GLOBAL_NOTIFICATION_SELECT =
  "id,title,content,status,audience_roles,target_profile_ids,created_by,created_by_role,notification_kind,related_entity_type,related_entity_id,expires_at,created_at,updated_at";

const LEGACY_GLOBAL_NOTIFICATION_SELECT =
  "id,title,content,status,audience_roles,created_by,created_at,updated_at";

function isLegacyGlobalNotificationSchemaError(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";

  return (
    error.code === "PGRST204"
    || message.includes("notification_kind")
    || message.includes("target_profile_ids")
    || message.includes("created_by_role")
    || message.includes("related_entity_type")
    || message.includes("related_entity_id")
    || message.includes("expires_at")
  );
}

function mapGlobalNotificationRow(row: GlobalNotificationRow): GlobalNotificationItem {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    status: row.status,
    audienceRoles: row.audience_roles ?? ["admin", "moderator", "teacher"],
    targetProfileIds: row.target_profile_ids ?? [],
    createdByRole: row.created_by_role ?? "admin",
    createdBy: row.created_by,
    kind: row.notification_kind ?? "announcement",
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function deleteExpiredGlobalNotificationsRepository(): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("global_notifications")
    .delete()
    .not("expires_at", "is", null)
    .lte("expires_at", new Date().toISOString());

  if (error) {
    if (isLegacyGlobalNotificationSchemaError(error)) {
      return;
    }

    throw error;
  }
}

export async function listGlobalNotificationsRepository(input?: {
  actorId: string;
  actorRole: UserRole;
}): Promise<GlobalNotificationItem[]> {
  await deleteExpiredGlobalNotificationsRepository();

  const supabase = createServiceRoleSupabaseClient();
  let result = await supabase
    .from("global_notifications")
    .select(GLOBAL_NOTIFICATION_SELECT)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<GlobalNotificationRow[]>();

  if (result.error && isLegacyGlobalNotificationSchemaError(result.error)) {
    result = await supabase
      .from("global_notifications")
      .select(LEGACY_GLOBAL_NOTIFICATION_SELECT)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<GlobalNotificationRow[]>();
  }

  if (result.error) {
    throw result.error;
  }

  const notifications = (result.data ?? []).map(mapGlobalNotificationRow);

  if (!input) {
    return notifications;
  }

  if (input.actorRole === "student") {
    return [];
  }

  const visibleRole = input.actorRole;

  return notifications.filter((notification) => {
    const matchesAudience = notification.audienceRoles.includes(visibleRole);
    const matchesTarget = notification.targetProfileIds.includes(input.actorId);

    return matchesAudience || matchesTarget;
  });
}

export async function createGlobalNotificationRepository(input: CreateGlobalNotificationRepositoryInput): Promise<GlobalNotificationItem> {
  const supabase = createServiceRoleSupabaseClient();
  let result = await supabase
    .from("global_notifications")
    .insert({
      title: input.title,
      content: input.content,
      created_by: input.createdBy,
      created_by_role: input.createdByRole,
      status: "published",
      audience_roles: input.audienceRoles ?? ["admin", "moderator", "teacher"],
      target_profile_ids: input.targetProfileIds ?? [],
      notification_kind: input.kind ?? "announcement",
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      expires_at: input.expiresAt ?? null,
    })
    .select(GLOBAL_NOTIFICATION_SELECT)
    .single<GlobalNotificationRow>();

  if (result.error && isLegacyGlobalNotificationSchemaError(result.error)) {
    result = await supabase
      .from("global_notifications")
      .insert({
        title: input.title,
        content: input.content,
        created_by: input.createdBy,
        status: "published",
        audience_roles: input.audienceRoles ?? ["admin", "moderator", "teacher"],
      })
      .select(LEGACY_GLOBAL_NOTIFICATION_SELECT)
      .single<GlobalNotificationRow>();
  }

  if (result.error) {
    throw result.error;
  }

  return mapGlobalNotificationRow(result.data);
}

export async function setGlobalNotificationExpiryRepository(input: UpdateGlobalNotificationExpiryRepositoryInput): Promise<GlobalNotificationItem | null> {
  const supabase = createServiceRoleSupabaseClient();
  let result = await supabase
    .from("global_notifications")
    .update({ expires_at: input.expiresAt })
    .eq("id", input.notificationId)
    .select(GLOBAL_NOTIFICATION_SELECT)
    .maybeSingle<GlobalNotificationRow>();

  if (result.error && isLegacyGlobalNotificationSchemaError(result.error)) {
    return null;
  }

  if (result.error) {
    throw result.error;
  }

  return result.data ? mapGlobalNotificationRow(result.data) : null;
}

export async function archiveGlobalNotificationsByRelatedEntityRepository(input: {
  relatedEntityType: string;
  relatedEntityId: string;
  kinds?: Array<GlobalNotificationItem["kind"]>;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  let query = supabase
    .from("global_notifications")
    .update({ status: "archived" })
    .eq("related_entity_type", input.relatedEntityType)
    .eq("related_entity_id", input.relatedEntityId);

  if (input.kinds && input.kinds.length > 0) {
    query = query.in("notification_kind", input.kinds);
  }

  const { error } = await query;

  if (error) {
    if (isLegacyGlobalNotificationSchemaError(error)) {
      return;
    }

    throw error;
  }
}
